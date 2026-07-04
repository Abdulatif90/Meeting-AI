# ANTI_PATTERNS.md — Meeting-AI

> This file holds "don't do this, we have a specific reason" knowledge.
> Every entry is taken from the ACTUAL codebase, not from a textbook.
> Read by Coder and Reviewer.

## 1. Swallowing errors (empty catch) — FORBIDDEN
Exists in code: procedures.ts -> getTranscript:
    const transcript = await fetch(url).then(...).catch(() => []);
Problem: if fetch fails, the user sees an empty transcript and the cause
is lost. Impossible to debug.
Correct: log the error (what, which meeting), then either return empty
OR show the user a clear state ("transcript not ready yet").
Do NOT write .catch(() => []) in new code.

## 2. Business logic inside a procedure — LIMIT THIS
meetings/server/procedures.ts is already 333 lines. Inside one procedure:
DB queries, fetch, JSONL parse, speaker merging — all mixed together.
Problem: every new feature grows this file until it's unreadable.
Correct: move heavy logic into modules/meetings/service.ts; the procedure
should only: validate input -> call service -> return result.
Don't forcibly migrate old code, but write NEW logic in the service.

## 3. Query without userId filter — SECURITY VIOLATION
Correct pattern (already in the code, KEEP this):
    .where(and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)))
Every select/update/delete MUST check userId. Otherwise a user can
read/modify another user's meeting.
Write queries filtered by userId only. An unfiltered query is a BLOCKER.

## 4. Hardcoded context — MUST FIX (existing bug)
trpc/init.ts:
    export const createTRPCContext = cache(async () => {
      return { userId: 'user_123' };   // <- hardcoded, left behind
    });
This looks like a test value that leaked into production. New code must
not rely on it. Auth comes through protectedProcedure as ctx.auth.user.id
— use that, NOT user_123.

## 5. Two DB queries inside premiumProcedure — WATCH
premiumProcedure counts meetings + agents on every call (2 separate
queries). Fine at low volume, but at scale this adds load to every
protected request.
If you add a new premium check, consider merging into one query — don't
multiply the two.
