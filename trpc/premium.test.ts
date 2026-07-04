// trpc/premium.test.ts
//
// Tests premiumProcedure — the middleware that enforces free-tier limits
// (see ANTI_PATTERNS.md #5 and API.md). Free users hitting the limit get
// FORBIDDEN; premium users (active subscription) are always allowed.
//
// Constants (modules/premium/constants.ts): MAX_FREE_MEETINGS=3, MAX_FREE_AGENTS=1
//
// Strategy: attach premiumProcedure to a tiny test router and call it. We mock:
//   - next/headers + @/lib/auth  -> get past protectedProcedure (logged in)
//   - @/lib/polar getPolarCustomerState -> control premium vs free
//   - @/db -> control the meeting/agent counts the middleware reads

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: "user_A" } }),
    },
  },
}));

// Controls whether the user is premium. Set per-test via the exported ref.
const polarState = { value: null as null | { activeSubscriptions: unknown[] } };
vi.mock("@/lib/polar", () => ({
  polarClient: {},
  getPolarCustomerState: vi.fn(() => Promise.resolve(polarState.value)),
}));

// premiumProcedure runs TWO count queries: meetings, then agents.
// db.select({...}).from(X).where(...) must resolve to [{ count: N }].
// We queue results in call order: first meetings, then agents.
const countQueue: number[] = [];
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ count: countQueue.shift() ?? 0 }]),
      }),
    }),
  },
}));

// count() / eq() are called but the mock doesn't use them.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, count: () => "count", eq: (...a: unknown[]) => a };
});

import { premiumProcedure, createTRPCRouter } from "@/trpc/init";

// A tiny router: one endpoint guarded by premiumProcedure. If the middleware
// throws FORBIDDEN, we never reach the resolver.
const makeCaller = (entity: "meetings" | "agents") => {
  const router = createTRPCRouter({
    guarded: premiumProcedure(entity).query(() => "reached-resolver"),
  });
  return router.createCaller({} as never);
};

describe("premiumProcedure — free-tier limits", () => {
  beforeEach(() => {
    polarState.value = null; // default: free user
    countQueue.length = 0;
  });

  it("throws FORBIDDEN when a free user hits the agent limit (>=1)", async () => {
    polarState.value = null;      // free
    countQueue.push(0, 1);        // meetings=0, agents=1 (at limit)

    await expect(makeCaller("agents").guarded()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows a free user under the agent limit (0)", async () => {
    polarState.value = null;      // free
    countQueue.push(0, 0);        // meetings=0, agents=0 (under limit)

    await expect(makeCaller("agents").guarded()).resolves.toBe("reached-resolver");
  });

  it("allows a premium user even over the limit", async () => {
    polarState.value = { activeSubscriptions: [{}] }; // premium
    countQueue.push(9, 9);                            // way over limits

    await expect(makeCaller("agents").guarded()).resolves.toBe("reached-resolver");
  });

  it("throws FORBIDDEN when a free user hits the meeting limit (>=3)", async () => {
    polarState.value = null;      // free
    countQueue.push(3, 0);        // meetings=3 (at limit), agents=0

    await expect(makeCaller("meetings").guarded()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});