# CLAUDE.md — Meeting-AI

> This file is a ROUTER. It holds little knowledge itself — it tells you
> which doc to read for which task. Every agent reads this, every task.

## The project in one line
An AI-agent-powered meetings SaaS. A user creates an AI agent (with its
own instructions), starts a video call, the agent joins in real time,
then a transcript and AI summary are generated. Billing via Polar
(free/premium limits).

## Stack (do not change without a reason)
- Next.js 15 (App Router) + React 19 + TypeScript
- tRPC (type-safe API) — modules/*/server/procedures.ts
- Drizzle ORM + Neon Postgres — db/schema.ts
- better-auth — lib/auth.ts
- Inngest + agent-kit — inngest/functions.ts (AI background jobs)
- Stream — video + chat
- Polar — billing/premium

## Folder structure (module-based)
modules/<domain>/
  procedures: server/procedures.ts   # tRPC endpoints
  schemas:    schemas.ts             # Zod input validation
  types:      types.ts
  ui:         ui/                    # React components
Domains: agents, meetings, premium, call, auth, home, dashboard

## Commands (to verify your own work)
- npm run dev       — dev server
- npm run build     — production build (typecheck happens here)
- npm run lint      — ESLint
- npm run db:push   — push schema to DB
- npm run db:studio — inspect DB
- npm test          — run tests (see TEST.md — setup required first)

## ROUTER — which doc to read, by task

| If the task touches | Read |
|---|---|
| A new tRPC endpoint / procedure | API.md, ANTI_PATTERNS.md |
| A DB table / schema change | DB_SCHEMA.md, MIGRATIONS.md |
| Auth / session / premium limits | SECURITY.md |
| AI summary / transcript / Inngest | AI_PIPELINE.md |
| Writing any code | ANTI_PATTERNS.md (MANDATORY) |
| Writing tests | TEST.md, TESTING.md |
| Reviewing code | REVIEW_CHECKLIST.md |

## 3 rules that apply to every task
1. Do NOT stuff business logic inside a procedure — extract it into a
   service layer. (procedures.ts is already 333 lines — don't let it grow.)
2. Do NOT swallow errors. Never write .catch(() => []) — log it, return
   a clear error.
3. Every query must be filtered by userId (ownership). This is security.
