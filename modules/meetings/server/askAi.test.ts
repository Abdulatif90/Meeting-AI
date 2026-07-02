// modules/meetings/server/askAi.test.ts
//
// Tests for the meetings.askAi procedure.
//
// Behaviors locked in:
//   1. NOT_FOUND          — meeting belongs to another user (userId filter)
//   2. PRECONDITION_FAILED — meeting exists but has no summary yet
//   3. Happy path          — calls generateAiAnswer with the correct args
//
// The service is mocked entirely so no real OpenAI call is made.
// vi.hoisted() is used for mocks referenced inside vi.mock() factories,
// because vi.mock() is hoisted above const declarations.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock fns so they are available inside vi.mock() factories.
const { mockGenerateAiAnswer } = vi.hoisted(() => ({
  mockGenerateAiAnswer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn().mockResolvedValue({ user: { id: "user_A" } }) },
  },
}));
vi.mock("@/lib/stream-video", () => ({ streamVideo: {} }));
vi.mock("@/lib/stream-chat", () => ({
  streamChat: { createToken: vi.fn().mockReturnValue("tok"), upsertUser: vi.fn() },
}));
vi.mock("@/lib/polar", () => ({
  polarClient: {},
  getPolarCustomerState: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/avatar", () => ({ generateAvatarUri: () => "avatar://stub" }));

// Single ownership query: db.select().from().where() → meetingResult
let meetingResult: unknown[];
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(meetingResult) }) }),
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a };
});

// Mock the service so no real OpenAI call happens.
vi.mock("../service", () => ({
  fetchTranscriptWithSpeakers: vi.fn(),
  listMeetings: vi.fn(),
  generateAiAnswer: mockGenerateAiAnswer,
}));

import { meetingsRouter } from "./procedures";

const callAskAi = (id: string, question: string) =>
  meetingsRouter.createCaller({} as never).askAi({ id, question });

describe("meetings.askAi", () => {
  beforeEach(() => {
    meetingResult = [];
    mockGenerateAiAnswer.mockClear();
  });

  it("throws NOT_FOUND when the meeting belongs to another user", async () => {
    meetingResult = []; // userId filter excluded the row

    await expect(callAskAi("m1", "What was discussed?")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockGenerateAiAnswer).not.toHaveBeenCalled();
  });

  it("throws PRECONDITION_FAILED when the meeting has no summary yet", async () => {
    meetingResult = [{ id: "m1", userId: "user_A", summary: null }];

    await expect(callAskAi("m1", "What was discussed?")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mockGenerateAiAnswer).not.toHaveBeenCalled();
  });

  it("calls generateAiAnswer with the correct args when the meeting is ready", async () => {
    meetingResult = [{ id: "m1", userId: "user_A", summary: "Meeting about project X" }];

    await callAskAi("m1", "What was discussed?");

    expect(mockGenerateAiAnswer).toHaveBeenCalledOnce();
    expect(mockGenerateAiAnswer).toHaveBeenCalledWith(
      "m1",
      "What was discussed?",
      "Meeting about project X",
    );
  });
});
