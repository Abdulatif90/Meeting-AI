import { eq, inArray } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";
import { createAgent, openai, TextMessage } from "@inngest/agent-kit";
import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { streamVideo } from "@/lib/stream-video";

import { StreamTranscriptItem } from "@/modules/meetings/types";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getLatestAssetUrl = (
  assets: Array<{
    url: string;
    start_time: string | Date;
  }>,
) => {
  const latestAsset = assets.reduce<typeof assets[number] | null>((latest, asset) => {
    if (!latest) {
      return asset;
    }

    return new Date(asset.start_time).getTime() >
      new Date(latest.start_time).getTime()
      ? asset
      : latest;
  }, null);

  return latestAsset?.url ?? null;
};

const formatTranscriptForSummary = (
  transcript: Array<
    StreamTranscriptItem & {
      user: {
        name: string;
      };
    }
  >,
) => {
  const lines = transcript.slice(0, 200).map((item) => {
    const startSeconds = Math.max(Math.floor(item.start_ts), 0);
    const minutes = Math.floor(startSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (startSeconds % 60)
      .toString()
      .padStart(2, "0");

    return `[${minutes}:${seconds}] ${item.user.name}: ${item.text}`;
  });

  return lines.join("\n").slice(0, 16000);
};

const buildSummaryFallback = (
  transcript: Array<
    StreamTranscriptItem & {
      user: {
        name: string;
      };
    }
  >,
) => {
  const previewLines = transcript.slice(0, 8).map((item) => {
    return `- ${item.user.name}: ${item.text}`;
  });

  if (previewLines.length === 0) {
    return "### Overview\nTranscript is not available yet.\n\n### Notes\n- No transcript content was found for this meeting.";
  }

  return [
    "Overview",
    "A summary could not be generated automatically, so the first transcript highlights are shown below.",
    "",
    "Notes",
    ...previewLines,
  ].join("\n");
};

const extractSummaryText = (message: TextMessage | undefined) => {
  const content = message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
};

const summarizer = createAgent({
  name: "summarizer",
  system: `
    You are an expert summarizer. You write readable, concise, simple content. You are given a transcript of a meeting and you need to summarize it.

Use the following markdown structure for every output:

Overview
Provide a detailed, engaging summary of the session's content. Focus on major features, user workflows, and any key takeaways. Write in a narrative style, using full sentences. Highlight unique or powerful aspects of the product, platform, or discussion.

 Notes
Break down key content into thematic sections with timestamp ranges. Each section should summarize key points, actions, or demos in bullet format.

Example:
Section Name
- Main point or demo shown here
- Another key insight or interaction
- Follow-up tool or explanation provided

 Next Section
- Feature X automatically does Y
- Mention of integration with Z
  `.trim(),
  model: openai({ model: "gpt-4o", apiKey: process.env.OPENAI_API_KEY }),
});

export const meetingsProcessing = inngest.createFunction(
  {
    id: "meetings/processing",
    triggers: [{ event: "meetings/processing" }],
  },
  async ({ event, step }) => {
    const transcriptUrl = event.data.transcriptUrl;

    const response = await step.run("fetch-transcript", async () => {
      const res = await fetch(transcriptUrl);

      if (!res.ok) {
        throw new Error(`Failed to fetch transcript: ${res.status}`);
      }

      return res.text();
    });

    const transcript = await step.run("parse-transcript", async () => {
      return JSONL.parse<StreamTranscriptItem>(response);
    });

    const transcriptWithSpeakers = await step.run("add-speakers", async () => {
      const speakerIds: string[] = [
        ...new Set(transcript.map((item) => item.speaker_id)),
      ];

      const userSpeakers = await db
        .select()
        .from(user)
        .where(inArray(user.id, speakerIds))
        .then((users) =>
          users.map((user) => ({
            ...user,
          }))
        );

      const agentSpeakers = await db
        .select()
        .from(agents)
        .where(inArray(agents.id, speakerIds))
        .then((agents) =>
          agents.map((agent) => ({
            ...agent,
          }))
        );

      const speakers = [...userSpeakers, ...agentSpeakers];

      return transcript.map((item: StreamTranscriptItem) => {
        const speaker = speakers.find(
          (speaker) => speaker.id === item.speaker_id
        );

        if (!speaker) {
          return {
            ...item,
            user: {
              name: "Unknown",
            },
          };
        }

        return {
          ...item,
          user: {
            name: speaker.name,
          },
        };
      });
    });

    if (transcriptWithSpeakers.length === 0) {
      await step.run("save-empty-summary", async () => {
        await db
          .update(meetings)
          .set({
            summary: buildSummaryFallback([]),
            status: "completed",
          })
          .where(eq(meetings.id, event.data.meetingId));
      });

      return;
    }

    const summaryInput = formatTranscriptForSummary(transcriptWithSpeakers);

    let summary = "";

    try {
      const { output } = await summarizer.run(
        "Summarize the following transcript:\n" + summaryInput
      );

      summary = extractSummaryText(output[0] as TextMessage | undefined);
    } catch {
      summary = "";
    }

    await step.run("save-summary", async () => {
      await db
        .update(meetings)
        .set({
          summary: summary.length > 0 ? summary : buildSummaryFallback(transcriptWithSpeakers),
          status: "completed",
        })
        .where(eq(meetings.id, event.data.meetingId));
    });
  },
);

export const meetingsSyncAssets = inngest.createFunction(
  {
    id: "meetings/sync-assets",
    triggers: [{ event: "meetings/sync-assets" }],
  },
  async ({ event, step }) => {
    const meetingId = event.data.meetingId;

    const [existingMeeting] = await step.run("load-meeting", async () => {
      return db
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .limit(1);
    });

    if (!existingMeeting) {
      return;
    }

    const call = streamVideo.video.call("default", meetingId);

    const { recordingUrl, transcriptUrl } = await step.run(
      "poll-assets",
      async () => {
        let latestRecordingUrl: string | null = null;
        let latestTranscriptUrl: string | null = null;

        for (let attempt = 0; attempt < 6; attempt++) {
          const [recordingsResponse, transcriptionsResponse] = await Promise.all([
            call.listRecordings(),
            call.listTranscriptions(),
          ]);

          latestRecordingUrl = getLatestAssetUrl(recordingsResponse.recordings);
          latestTranscriptUrl = getLatestAssetUrl(
            transcriptionsResponse.transcriptions
          );

          if (latestRecordingUrl || latestTranscriptUrl) {
            break;
          }

          if (attempt < 5) {
            await sleep(5000);
          }
        }

        return {
          recordingUrl: latestRecordingUrl,
          transcriptUrl: latestTranscriptUrl,
        };
      }
    );

    await step.run("save-assets", async () => {
      const values: {
        recordingUrl?: string;
        transcriptUrl?: string;
      } = {};

      if (recordingUrl && !existingMeeting.recordingUrl) {
        values.recordingUrl = recordingUrl;
      }

      if (transcriptUrl && !existingMeeting.transcriptUrl) {
        values.transcriptUrl = transcriptUrl;
      }

      if (Object.keys(values).length === 0) {
        return existingMeeting;
      }

      const [updatedMeeting] = await db
        .update(meetings)
        .set(values)
        .where(eq(meetings.id, meetingId))
        .returning();

      return updatedMeeting;
    });

    if (transcriptUrl && !existingMeeting.summary) {
      await step.run("enqueue-processing", async () => {
        await inngest.send({
          name: "meetings/processing",
          data: {
            meetingId,
            transcriptUrl,
          },
        });
      });

      return;
    }

    if (!transcriptUrl && !existingMeeting.summary) {
      await step.run("complete-without-transcript", async () => {
        await db
          .update(meetings)
          .set({
            status: "completed",
            summary:
              "### Overview\nTranscript was not generated for this meeting, so an AI summary is not available.\n\n### Notes\n- Recording may still be available in the recording tab.\n- If transcription is required, verify the Stream transcription webhook and settings.",
          })
          .where(eq(meetings.id, meetingId));
      });
    }
  },
);