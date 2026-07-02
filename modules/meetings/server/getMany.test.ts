// modules/meetings/server/getMany.test.ts
//
// Safety-net BEFORE extracting getMany logic into the service layer.
// These tests lock the current behavior so that after the move we can
// confirm nothing changed (all tests must stay green).
//
// Behaviors locked in:
//   1. ownership   — the calling user's meetings are returned correctly
//   2. empty result — pagination shape is {items:[], total:0, totalPages:0}
//   3. search       — a search term is forwarded without breaking the shape
//
// getMany issues two db queries per call, in this order:
//   query 1: data rows  (select … orderBy/limit/offset)
//   query 2: count row  (select count(*))
//
// The two queries have DIFFERENT chain endings after .where():
//   data:  .where().orderBy().limit().offset()   → awaited at .offset()
//   count: .where()                              → awaited directly
//
// A plain object-returning mock can't serve both. Instead each db.select()
// returns a "chainable thenable": every method returns `this`, and the
// object's .then() (called by `await`) shifts the next entry from dbQueue.

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

// Entries consumed in call order: first db.select() call gets [0], second gets [1].
const dbQueue: unknown[][] = [];

// Each db.select() creates a fresh chain. Chain methods return `this` so the
// chain can be any length. When awaited, resolves with dbQueue.shift().
const makeChain = () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "innerJoin", "where", "orderBy", "limit", "offset"]) {
    chain[m] = () => chain;
  }
  chain["then"] = (
    onFulfilled: (v: unknown) => void,
    onRejected?: (e: unknown) => void,
  ) => Promise.resolve(dbQueue.shift() ?? []).then(onFulfilled, onRejected);
  return chain;
};

vi.mock("@/db", () => ({
  db: { select: () => makeChain() },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: (...a: unknown[]) => a,
    eq: (...a: unknown[]) => a,
    ilike: (...a: unknown[]) => a,
  };
});

import { meetingsRouter } from "./procedures";

const callGetMany = (input: Record<string, unknown> = {}) =>
  meetingsRouter.createCaller({} as never).getMany(input as never);

describe("meetings.getMany", () => {
  beforeEach(() => {
    dbQueue.length = 0;
  });

  it("returns the calling user's meetings with correct shape", async () => {
    dbQueue.push([
      { id: "m1", userId: "user_A", name: "Planning" },
      { id: "m2", userId: "user_A", name: "Sync" },
    ]);
    dbQueue.push([{ count: 2 }]);

    const result = await callGetMany();

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: "m1", userId: "user_A" });
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1); // Math.ceil(2 / 10)
  });

  it("returns correct pagination shape for empty results", async () => {
    dbQueue.push([]);
    dbQueue.push([{ count: 0 }]);

    await expect(callGetMany()).resolves.toEqual({
      items: [],
      total: 0,
      totalPages: 0,
    });
  });

  it("returns matching items when search is provided", async () => {
    dbQueue.push([{ id: "m3", userId: "user_A", name: "Planning" }]);
    dbQueue.push([{ count: 1 }]);

    const result = await callGetMany({ search: "Planning" });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1); // Math.ceil(1 / 10)
  });
});
