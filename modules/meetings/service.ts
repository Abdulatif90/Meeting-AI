import JSONL from "jsonl-parse-stringify";
import OpenAI from "openai";
import { and, count, desc, eq, getTableColumns, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { generateAvatarUri } from "@/lib/avatar";
import { streamChat } from "@/lib/stream-chat";

import { MeetingStatus, StreamTranscriptItem } from "./types";

export async function fetchTranscriptWithSpeakers(transcriptUrl: string) {
  const transcript = await fetch(transcriptUrl)
    .then((res) => res.text())
    .then((text) => JSONL.parse<StreamTranscriptItem>(text))
    .catch(() => {
      return [] as StreamTranscriptItem[];
    });

  const speakerIds = [...new Set(transcript.map((item) => item.speaker_id))];

  const userSpeakers = await db
    .select()
    .from(user)
    .where(inArray(user.id, speakerIds))
    .then((users) =>
      users.map((u) => ({
        ...u,
        image:
          u.image ?? generateAvatarUri({ seed: u.name, variant: "initials" }),
      }))
    );

  const agentSpeakers = await db
    .select()
    .from(agents)
    .where(inArray(agents.id, speakerIds))
    .then((agentRows) =>
      agentRows.map((agent) => ({
        ...agent,
        image: generateAvatarUri({
          seed: agent.name,
          variant: "botttsNeutral",
        }),
      }))
    );

  const speakers = [...userSpeakers, ...agentSpeakers];

  return transcript.map((item) => {
    const speaker = speakers.find((s) => s.id === item.speaker_id);

    if (!speaker) {
      return {
        ...item,
        user: {
          name: "Unknown",
          image: generateAvatarUri({ seed: "Unknown", variant: "initials" }),
        },
      };
    }

    return {
      ...item,
      user: {
        name: speaker.name,
        image: speaker.image,
      },
    };
  });
}

export async function listMeetings(
  userId: string,
  params: {
    page: number;
    pageSize: number;
    search?: string | null;
    agentId?: string | null;
    status?: MeetingStatus | null;
  },
) {
  const { search, page, pageSize, status, agentId } = params;

  const data = await db
    .select({
      ...getTableColumns(meetings),
      agent: agents,
      duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as("duration"),
    })
    .from(meetings)
    .innerJoin(agents, eq(meetings.agentId, agents.id))
    .where(
      and(
        eq(meetings.userId, userId),
        search ? ilike(meetings.name, `%${search}%`) : undefined,
        status ? eq(meetings.status, status) : undefined,
        agentId ? eq(meetings.agentId, agentId) : undefined,
      )
    )
    .orderBy(desc(meetings.createdAt), desc(meetings.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [total] = await db
    .select({ count: count() })
    .from(meetings)
    .innerJoin(agents, eq(meetings.agentId, agents.id))
    .where(
      and(
        eq(meetings.userId, userId),
        search ? ilike(meetings.name, `%${search}%`) : undefined,
        status ? eq(meetings.status, status) : undefined,
        agentId ? eq(meetings.agentId, agentId) : undefined,
      )
    );

  const totalPages = Math.ceil(total.count / pageSize);

  return { items: data, total: total.count, totalPages };
}

export async function generateAiAnswer({
  meetingId,
  agentId,
  question,
  meetingSummary,
}: {
  meetingId: string;
  agentId: string;
  question: string;
  meetingSummary: string;
}) {
  // Reply AS the meeting's agent — it is already a member of the chat channel,
  // so Stream accepts the message (the same pattern the webhook uses).
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) throw new Error("Agent not found for this meeting");

  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let answer: string | null;
  try {
    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are ${agent.name}, an AI assistant helping the user revisit a completed meeting. Answer the user's question using the meeting summary below. Write the answer naturally in your own words — do not just repeat or paste the summary.\n\nMeeting summary:\n${meetingSummary}`,
        },
        { role: "user", content: question },
      ],
      max_tokens: 500,
    });
    answer = completion.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.error("[askAi] OpenAI request failed", error);
    throw new Error("Failed to generate an AI answer. Please try again.");
  }

  if (!answer) throw new Error("OpenAI returned an empty response");

  const avatarUrl = generateAvatarUri({
    seed: agent.name,
    variant: "botttsNeutral",
  });

  await streamChat.upsertUser({
    id: agent.id,
    name: agent.name,
    image: avatarUrl,
  });

  const channel = streamChat.channel("messaging", meetingId);
  await channel.watch();
  await channel.sendMessage({
    text: answer,
    user: { id: agent.id, name: agent.name, image: avatarUrl },
  } as never);
}
