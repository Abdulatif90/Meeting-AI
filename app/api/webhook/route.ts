import OpenAI from "openai";
import JSONL from "jsonl-parse-stringify";
import { and, eq, not } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import {
  MessageNewEvent,
  CallEndedEvent,
  CallLiveStartedEvent,
  CallSessionEndedEvent,
  CallTranscriptionReadyEvent,
  CallRecordingReadyEvent,
  CallSessionParticipantLeftEvent,
  CallSessionStartedEvent,
} from "@stream-io/node-sdk";

import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import { inngest } from "@/inngest/client";
import { generateAvatarUri } from "@/lib/avatar";
import { streamChat } from "@/lib/stream-chat";
import { StreamTranscriptItem } from "@/modules/meetings/types";

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const chatModel = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
const realtimeModel =
  process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview";

/* ── In-memory lock to prevent duplicate AI replies from concurrent webhooks ── */
const processingMessages = new Set<string>();

function isRateLimitError(error: unknown) {
  return error instanceof OpenAI.RateLimitError;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSummaryFallbackReply(
  question: string,
  summary: string | null
): string {
  if (!summary) {
    return "I'm sorry, the meeting summary is not available yet. Please try again later.";
  }

  const lowerQ = question.toLowerCase();
  const paragraphs = summary
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0);

  const keywords = lowerQ
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const scored = paragraphs.map((p) => {
    const lp = p.toLowerCase();
    const hits = keywords.filter((k) => lp.includes(k)).length;
    return { text: p.trim(), hits };
  });

  scored.sort((a, b) => b.hits - a.hits);

  const best = scored.filter((s) => s.hits > 0).slice(0, 3);

  if (best.length === 0) {
    return `Based on the meeting summary:\n\n${summary.slice(0, 1500)}`;
  }

  return `Based on the meeting summary:\n\n${best.map((b) => b.text).join("\n\n")}`;
}

function formatTranscriptTimestamp(seconds: number): string {
  const safeSeconds = Math.max(Math.floor(seconds), 0);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (safeSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

function buildTranscriptContext(
  question: string,
  transcript: StreamTranscriptItem[]
): string | null {
  if (transcript.length === 0) {
    return null;
  }

  const keywords = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const scoredItems = transcript.map((item, index) => {
    const normalizedText = item.text.toLowerCase();
    const hits = keywords.filter((keyword) => normalizedText.includes(keyword)).length;

    return { index, item, hits };
  });

  const selectedIndexes = new Set<number>();

  const topMatches = scoredItems
    .filter((entry) => entry.hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .slice(0, 10);

  if (topMatches.length > 0) {
    topMatches.forEach(({ index }) => {
      selectedIndexes.add(index);
      if (index > 0) {
        selectedIndexes.add(index - 1);
      }
      if (index < transcript.length - 1) {
        selectedIndexes.add(index + 1);
      }
    });
  } else {
    transcript.slice(0, 18).forEach((_, index) => {
      selectedIndexes.add(index);
    });
  }

  const lines = [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => {
      const item = transcript[index];

      return `[${formatTranscriptTimestamp(item.start_ts)}] ${item.speaker_id}: ${item.text}`;
    })
    .join("\n")
    .slice(0, 6000);

  return lines.length > 0 ? lines : null;
}

async function getTranscriptContext(
  question: string,
  transcriptUrl: string | null
): Promise<string | null> {
  if (!transcriptUrl) {
    return null;
  }

  try {
    const transcriptResponse = await fetch(transcriptUrl);

    if (!transcriptResponse.ok) {
      return null;
    }

    const transcriptText = await transcriptResponse.text();
    const transcript = JSONL.parse<StreamTranscriptItem>(transcriptText);

    return buildTranscriptContext(question, transcript);
  } catch {
    return null;
  }
}

function getCallIdFromCid(callCid?: string | null): string | null {
  if (!callCid) {
    return null;
  }

  const [, callId] = callCid.split(":");

  return callId ?? null;
}

function getMeetingIdFromEvent(payload: Record<string, unknown>): string | null {
  const call = payload.call as
    | {
        id?: string;
        custom?: {
          meetingId?: string;
          meeting_id?: string;
        };
      }
    | undefined;

  const callCid = payload.call_cid as string | undefined;
  const custom = payload.custom as
    | {
        meetingId?: string;
        meeting_id?: string;
      }
    | undefined;

  return (
    call?.custom?.meetingId ??
    call?.custom?.meeting_id ??
    custom?.meetingId ??
    custom?.meeting_id ??
    call?.id ??
    getCallIdFromCid(callCid) ??
    null
  );
}

function getEventTimestamp(payload: Record<string, unknown>): Date {
  const createdAt = payload.created_at;

  if (typeof createdAt === "string") {
    const parsedDate = new Date(createdAt);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return new Date();
}

function verifySignatureWithSDK(body: string, signature: string): boolean {
  return streamVideo.verifyWebhook(body, signature);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature");
  const apiKey = req.headers.get("x-api-key");
  const expectedApiKey = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY;

  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  if (apiKey && expectedApiKey && apiKey !== expectedApiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const body = await req.text();

  if (!verifySignatureWithSDK(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (payload as Record<string, unknown>)?.type;

  if (eventType === "call.session_started" || eventType === "call.live_started") {
    const event = payload as CallSessionStartedEvent | CallLiveStartedEvent;
    const meetingId = getMeetingIdFromEvent(event as unknown as Record<string, unknown>);

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          not(eq(meetings.status, "completed")),
          not(eq(meetings.status, "active")),
          not(eq(meetings.status, "cancelled")),
        )
      );

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    await db
      .update(meetings)
      .set({
        status: "active",
        startedAt:
          existingMeeting.startedAt ??
          getEventTimestamp(event as unknown as Record<string, unknown>),
        endedAt: null,
      })
      .where(eq(meetings.id, existingMeeting.id));

    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingMeeting.agentId));

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    try {
      const call = streamVideo.video.call("default", meetingId);
      const realtimeClient = await streamVideo.video.connectOpenAi({
        call,
        openAiApiKey: process.env.OPENAI_API_KEY!,
        agentUserId: existingAgent.id,
        model: realtimeModel,
      });

      realtimeClient.updateSession({
        instructions: existingAgent.instructions,
      });
    } catch (error) {
      console.error("Failed to connect realtime agent", error);
    }
  } else if (eventType === "call.session_participant_left") {
    const event = payload as CallSessionParticipantLeftEvent;
    const meetingId = getMeetingIdFromEvent(event as unknown as Record<string, unknown>);

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const call = streamVideo.video.call("default", meetingId);

    const participants = await call.queryCallParticipants({ limit: 10 });
    const hasHostParticipant = participants.participants.some(
      (participant) => participant.role === "admin"
    );

    if (!hasHostParticipant) {
      await call.end();
    }
  } else if (
    eventType === "call.session_ended" ||
    eventType === "call.ended" ||
    eventType === "call.recording_stopped" ||
    eventType === "call.transcription_stopped"
  ) {
    const event = payload as CallEndedEvent | CallSessionEndedEvent;
    const meetingId = getMeetingIdFromEvent(event as unknown as Record<string, unknown>);

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (existingMeeting.status !== "cancelled") {
      await db
        .update(meetings)
        .set({
          status: existingMeeting.summary ? "completed" : "processing",
          startedAt:
            existingMeeting.startedAt ??
            getEventTimestamp(event as unknown as Record<string, unknown>),
          endedAt:
            existingMeeting.endedAt ??
            getEventTimestamp(event as unknown as Record<string, unknown>),
        })
        .where(eq(meetings.id, meetingId));
    }

    await inngest.send({
      name: "meetings/sync-assets",
      data: {
        meetingId,
      },
    });
  } else if (eventType === "call.transcription_ready") {
    const event = payload as CallTranscriptionReadyEvent;
    const meetingId = getMeetingIdFromEvent(event as unknown as Record<string, unknown>);
    const transcriptUrl = event.call_transcription?.url;

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    if (!transcriptUrl) {
      return NextResponse.json({ error: "Missing transcript URL" }, { status: 400 });
    }

    const [updatedMeeting] = await db
      .update(meetings)
      .set({
        transcriptUrl,
        status: "processing",
      })
      .where(eq(meetings.id, meetingId))
      .returning();

    if (!updatedMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!updatedMeeting.transcriptUrl) {
      return NextResponse.json({ error: "Missing transcript URL" }, { status: 500 });
    }

    await inngest.send({
      name: "meetings/processing",
      data: {
        meetingId: updatedMeeting.id,
        transcriptUrl: updatedMeeting.transcriptUrl,
      },
    });
  } else if (eventType === "call.recording_ready") {
    const event = payload as CallRecordingReadyEvent;
    const meetingId = getMeetingIdFromEvent(event as unknown as Record<string, unknown>);
    const recordingUrl = event.call_recording?.url;

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
    }

    if (!recordingUrl) {
      return NextResponse.json({ error: "Missing recording URL" }, { status: 400 });
    }

    await db
      .update(meetings)
      .set({
        recordingUrl,
      })
      .where(eq(meetings.id, meetingId));

    await inngest.send({
      name: "meetings/sync-assets",
      data: {
        meetingId,
      },
    });
  } else if (eventType === "message.new") {
    const event = payload as MessageNewEvent;

    const userId = event.user?.id;
    const channelId = event.channel_id;
    const incomingMessageId = event.message?.id;
    const text = event.message?.text;

    if (!userId || !channelId || !text || !incomingMessageId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, channelId), eq(meetings.status, "completed")));

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingMeeting.agentId));

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (userId !== existingAgent.id) {
      /* ── Prevent concurrent processing of the same message ── */
      if (processingMessages.has(incomingMessageId)) {
        return NextResponse.json({ status: "ok" });
      }
      processingMessages.add(incomingMessageId);

      try {
        const transcriptContext = await getTranscriptContext(
          text,
          existingMeeting.transcriptUrl
        );

        const instructions = `
        You are an AI assistant helping the user revisit a recently completed meeting.
        Answer the user's question using the meeting context below and the recent chat history.
        Write the answer naturally in your own words. Do not just repeat or paste the summary.
        If useful, give a direct answer first and then a short explanation or bullet list.

        Meeting summary:
        
        ${existingMeeting.summary}

        Relevant transcript excerpts:

        ${transcriptContext ?? "Transcript excerpts are not available."}
        
        The following are your original instructions from the live meeting assistant. Please continue to follow these behavioral guidelines as you assist the user:
        
        ${existingAgent.instructions}
        
        The user may ask questions about the meeting, request clarifications, or ask for follow-up actions.
        Use the summary, transcript excerpts, and recent conversation together.
        Synthesize the answer yourself instead of copying the summary text unless quoting is necessary.
        When the user asks for specifics, prefer concrete details from the transcript excerpts.
        
        You also have access to the recent conversation history between you and the user. Use the context of previous messages to provide relevant, coherent, and helpful responses. If the user's question refers to something discussed earlier, make sure to take that into account and maintain continuity in the conversation.
        
        If the available meeting context is incomplete, clearly say what is known and what is missing.
        Do not invent facts, commitments, or decisions that are not supported by the meeting context.
        
        Be concise, helpful, and accurate.
        `;

        const channel = streamChat.channel("messaging", channelId);
        await channel.watch();

        const alreadyReplied = channel.state.messages.some((message) => {
          const replyToMessageId = (message as { aiReplyToMessageId?: string })
            .aiReplyToMessageId;

          return (
            message.user?.id === existingAgent.id &&
            replyToMessageId === incomingMessageId
          );
        });

        if (alreadyReplied) {
          return NextResponse.json({ status: "ok" });
        }

        const previousMessages = channel.state.messages
          .filter((message) => message.id !== incomingMessageId)
          .filter((msg) => msg.text && msg.text.trim() !== "")
          .slice(-8)
          .map<ChatCompletionMessageParam>((message) => ({
            role: message.user?.id === existingAgent.id ? "assistant" : "user",
            content: message.text || "",
          }));

        let GPTResponseText: string | null = null;

        /* ── Retry up to 3 times with backoff for rate limits ── */
        const retryDelays = [0, 1500, 3000];
        for (let attempt = 0; attempt < retryDelays.length; attempt++) {
          if (attempt > 0) {
            await delay(retryDelays[attempt]);
          }
          try {
            const GPTResponse = await openaiClient.chat.completions.create({
              messages: [
                { role: "system", content: instructions },
                ...previousMessages,
                { role: "user", content: text },
              ],
              model: chatModel,
              temperature: 0.6,
            });
            GPTResponseText = GPTResponse.choices[0].message.content;
            break; // success – exit retry loop
          } catch (error) {
            if (isRateLimitError(error) && attempt < retryDelays.length - 1) {
              console.warn(`OpenAI rate limit hit, retry ${attempt + 1}/${retryDelays.length - 1}`);
              continue;
            }
            if (isRateLimitError(error)) {
              // All retries exhausted – use summary-based fallback
              GPTResponseText = buildSummaryFallbackReply(
                text,
                existingMeeting.summary
              );
            } else {
              throw error;
            }
          }
        }

        if (!GPTResponseText) {
          return NextResponse.json(
            { error: "No response from GPT" },
            { status: 400 }
          );
        }

        const avatarUrl = generateAvatarUri({
          seed: existingAgent.name,
          variant: "botttsNeutral",
        });

        await streamChat.upsertUser({
          id: existingAgent.id,
          name: existingAgent.name,
          image: avatarUrl,
        });

        await channel.sendMessage({
          text: GPTResponseText,
          aiReplyToMessageId: incomingMessageId,
          user: {
            id: existingAgent.id,
            name: existingAgent.name,
            image: avatarUrl,
          },
        } as never);
      } finally {
        processingMessages.delete(incomingMessageId);
      }
    }

    return NextResponse.json({ status: "ok" });
  }

  return NextResponse.json({ status: "ok" });
}
