# TEST.md — Meeting-AI (setup + how to write tests)

> Concrete, runnable setup for testing this codebase. TESTING.md covers
> WHAT to test and WHY; this file covers HOW to set it up and write one.
> The project has zero tests today — this is step 1 of the foundation.

## Why Vitest (not Jest)
This is a Vite/Next 15 + TypeScript project. Vitest runs native ESM and
TS with almost no config, and reuses the same transform as the app.
Jest would need extra babel/ts config here.

## 1. Install
    npm install -D vitest @vitest/coverage-v8

For component tests later (not needed for procedure tests):
    npm install -D @testing-library/react @testing-library/jest-dom jsdom

## 2. Add scripts to package.json
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"

Then CLAUDE.md's `npm test` command becomes real.

## 3. Create vitest.config.ts at the project root
    import { defineConfig } from "vitest/config";
    import path from "path";

    export default defineConfig({
      test: {
        environment: "node",
        globals: true,
      },
      resolve: {
        alias: { "@": path.resolve(__dirname, ".") },
      },
    });

The alias matters: the codebase imports with "@/db", "@/trpc/init", etc.
Without this alias every import in a test fails.

## 4. Where tests live
Co-locate next to the code:
    modules/meetings/server/procedures.test.ts
    modules/agents/server/procedures.test.ts

## The core testing challenge here: the DB
Procedures call a real Drizzle/Neon DB (db/index.ts). Two options:

Option A — mock the db (fast, no real DB, start here):
Mock "@/db" so queries return controlled rows. Good for testing logic
like ownership checks and error paths (NOT_FOUND, FORBIDDEN).

Option B — real test DB (integration, later):
Point DATABASE_URL at a disposable Neon branch / local Postgres, reset
between tests. Higher fidelity, more setup. Do this once Option A tests
exist and you need end-to-end confidence.

Start with Option A.

## First real test — ownership (highest-value)
This tests the #1 rule from ANTI_PATTERNS.md: a query filtered by userId.
File: modules/meetings/server/procedures.test.ts

    import { describe, it, expect, vi, beforeEach } from "vitest";

    // Mock the db module BEFORE importing the router
    const mockWhere = vi.fn();
    vi.mock("@/db", () => ({
      db: {
        select: () => ({ from: () => ({ where: mockWhere }) }),
      },
    }));

    import { meetingsRouter } from "./procedures";
    import { TRPCError } from "@trpc/server";

    const callGetTranscript = (userId: string, input: { id: string }) => {
      const caller = meetingsRouter.createCaller({
        auth: { user: { id: userId } },
      } as any);
      return caller.getTranscript(input);
    };

    describe("meetings.getTranscript", () => {
      beforeEach(() => vi.clearAllMocks());

      it("throws NOT_FOUND when the meeting belongs to another user", async () => {
        // db returns no row because userId filter excludes it
        mockWhere.mockResolvedValueOnce([]);

        await expect(
          callGetTranscript("user_A", { id: "meeting_owned_by_B" })
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
      });
    });

Note: exact mock shape depends on the Drizzle query chain in your
procedure — read the actual procedure first and mirror its chain
(.select().from().where(), or .delete().where().returning(), etc.).

## What to test next (in order)
1. meetings.remove — NOT_FOUND when row doesn't belong to user
2. premiumProcedure — FORBIDDEN when free limit reached, no subscription
3. meetingsInsertSchema — rejects empty name / empty agentId
4. buildSummaryFallback — returns the preview format when transcript empty
   (this one is a pure function in inngest/functions.ts — easiest test,
    no mocking needed; consider exporting it to test directly)

## Rules for writing tests here
- Name states behavior: "returns FORBIDDEN when free meeting limit reached".
- One assertion focus per test.
- Never write a test that passes regardless of the source — assert the
  specific code/shape, not just "it didn't throw".
- If a test fails because the SOURCE is wrong (not the test), that's a
  real bug you found — report it, don't "fix" the test to pass.

## After setup
Update TESTING.md's note (remove "no tests exist yet") and update
CLAUDE.md if the test command changes.
