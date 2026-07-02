import JSONL from "jsonl-parse-stringify";
import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { agents, user } from "@/db/schema";
import { generateAvatarUri } from "@/lib/avatar";

import { StreamTranscriptItem } from "./types";

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
