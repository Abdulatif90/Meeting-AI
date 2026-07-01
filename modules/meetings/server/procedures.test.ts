// modules/meetings/server/procedures.test.ts
//
// First real test for Meeting-AI. Tests the #1 rule from ANTI_PATTERNS.md:
// every query is filtered by userId (ownership). If the meeting belongs to
// another user, the userId filter returns no row -> the procedure must throw
// NOT_FOUND.
//
// To reach the procedure body we must get past protectedProcedure, which calls
// next/headers `headers()` and better-auth `getSession()`. Both are mocked so
// the test simulates an already-authenticated user.
//
// NOTE: vi.mock is hoisted to the top of the file, so the factory functions
// must NOT reference outer variables. The logged-in user id is written inline
// as the literal "user_A".

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Get past protectedProcedure ---
// next/headers: headers() only works inside a real request; stub it.
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
// better-auth: pretend the user "user_A" is logged in. This id becomes
// ctx.auth.user.id inside the procedure. (Literal, not a variable — hoisting.)
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: "user_A" } }),
    },
  },
}));

// --- External-client modules that build clients at import time ---
vi.mock("@/lib/stream-video", () => ({ streamVideo: {} }));
vi.mock("@/lib/stream-chat", () => ({ streamChat: {} }));
vi.mock("@/lib/polar", () => ({
  polarClient: {},
  getPolarCustomerState: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/avatar", () => ({
  generateAvatarUri: () => "avatar://stub",
}));

// --- Mock the db. Chain matches the real `remove`:
//     db.delete(meetings).where(...).returning() ---
let returningResult: unknown[];
vi.mock("@/db", () => ({
  db: {
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(returningResult),
      }),
    }),
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a };
});

import { meetingsRouter } from "./procedures";

// The logged-in user, matching the mocked session above.
const LOGGED_IN_USER = "user_A";

// protectedProcedure supplies ctx.auth from the mocked session, so the caller
// context can be empty.
const callRemove = (id: string) => {
  const caller = meetingsRouter.createCaller({} as never);
  return caller.remove({ id });
};

describe("meetings.remove — ownership", () => {
  beforeEach(() => {
    returningResult = [];
  });

  it("throws NOT_FOUND when the meeting belongs to another user", async () => {
    returningResult = []; // userId filter excluded the row

    await expect(callRemove("meeting_owned_by_B")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns the meeting when it belongs to the user", async () => {
    returningResult = [{ id: "m1", userId: LOGGED_IN_USER, name: "My meeting" }];

    const result = await callRemove("m1");
    expect(result).toMatchObject({ id: "m1", userId: LOGGED_IN_USER });
  });
});
