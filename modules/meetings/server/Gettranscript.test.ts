// modules/meetings/server/getTranscript.test.ts
//
// Safety net BEFORE refactoring getTranscript into a service layer.
// These tests capture the current behavior so that, after extraction, we can
// confirm nothing broke (the tests must stay green).
//
// Behaviors locked in:
//   1. ownership   -> another user's meeting => NOT_FOUND
//   2. no transcript URL => returns []
//   3. transcript present => lines mapped to speakers; unknown speaker
//      falls back to name "Unknown"
//
// getTranscript runs: db.select().from(meetings).where()  (ownership)
// then fetch(url), then db.select().from(user).where(), then
// db.select().from(agents).where(). We mock all of them.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn().mockResolvedValue({ user: { id: "user_A" } }) },
  },
}));
vi.mock("@/lib/stream-video", () => ({ streamVideo: {} }));
vi.mock("@/lib/stream-chat", () => ({ streamChat: {} }));
vi.mock("@/lib/polar", () => ({
  polarClient: {},
  getPolarCustomerState: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/avatar", () => ({
  generateAvatarUri: () => "avatar://stub",
}));

// getTranscript issues three selects in order: meetings, user, agents.
// We queue results by call order.
const selectQueue: unknown[][] = [];
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectQueue.shift() ?? []),
      }),
    }),
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: (...a: unknown[]) => a,
    eq: (...a: unknown[]) => a,
    inArray: (...a: unknown[]) => a,
  };
});

// Control fetch (used only when transcriptUrl is present).
const globalFetch = vi.fn();
vi.stubGlobal("fetch", globalFetch);

import { meetingsRouter } from "./procedures";

const call = (id: string) =>
  meetingsRouter.createCaller({} as never).getTranscript({ id });

describe("meetings.getTranscript — behavior lock before refactor", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    globalFetch.mockReset();
  });

  it("throws NOT_FOUND when the meeting is missing or not owned", async () => {
    selectQueue.push([]); // ownership select returns nothing

    await expect(call("not_mine")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns [] when the meeting has no transcript URL", async () => {
    selectQueue.push([{ id: "m1", userId: "user_A", transcriptUrl: null }]);

    await expect(call("m1")).resolves.toEqual([]);
  });

  it("maps transcript items to speakers, unknown -> 'Unknown'", async () => {
    // 1) ownership: meeting with a transcript URL
    selectQueue.push([{ id: "m1", userId: "user_A", transcriptUrl: "http://t" }]);
    // 2) user speakers
    selectQueue.push([{ id: "u1", name: "Alice", image: null }]);
    // 3) agent speakers
    selectQueue.push([]);

    // fetch returns JSONL text (one item per line)
    globalFetch.mockResolvedValue({
      text: () =>
        Promise.resolve(
          JSON.stringify({ speaker_id: "u1", text: "hello" }) +
            "\n" +
            JSON.stringify({ speaker_id: "ghost", text: "boo" })
        ),
    });

    const result = await call("m1");

    expect(result).toHaveLength(2);
    expect(result[0].user.name).toBe("Alice");
    expect(result[1].user.name).toBe("Unknown");
  });
});