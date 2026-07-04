# 🧠 Meet.AI

**AI-agent-powered video meetings SaaS.** Create a custom AI agent, start a video call, and the agent joins you in real time. When the call ends, you get a recording, transcript, AI summary — and an "Ask AI" chat to query the meeting afterwards.

**Live:** https://meeting-ai-saas1.vercel.app/

---

## ✨ Features

- 🤖 **Custom AI agents** — create agents with their own instructions (a doctor, an interviewer, a tutor…)
- 🎥 **Real-time video calls** — the agent joins the call as a voice participant (OpenAI Realtime + Stream Video)
- 📝 **Automatic post-processing** — recording, transcript with speaker names, and AI-generated summary
- 💬 **Ask AI** — chat with an AI that knows your meeting's summary, transcript, and conversation history
- 🔍 **Search & filters** — full-text search across meetings and agents, status filters, pagination
- 💳 **Billing** — free tier limits and premium subscriptions via Polar
- 🔐 **Auth** — email/password + Google & GitHub OAuth via better-auth

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| API | tRPC (end-to-end type safety) |
| Database | Neon Postgres + Drizzle ORM |
| Auth | better-auth (email, Google, GitHub) |
| Video & Chat | Stream Video SDK + Stream Chat SDK |
| Realtime AI | OpenAI Realtime API (`gpt-realtime`) via Stream's agent bridge |
| Summaries / Ask AI | OpenAI (`gpt-4o-mini`) |
| Background jobs | Inngest + agent-kit |
| Billing | Polar |
| UI | Tailwind CSS v4 + shadcn/ui + Radix |
| Testing | Vitest |

## 🔄 How It Works

```
1. User creates an agent (custom instructions) and a meeting
2. User joins the call  ──►  Stream Video
3. Stream fires call.session_started  ──►  /api/webhook
4. Server bridges the agent into the call (OpenAI Realtime)
5. Live conversation: user ⇄ AI agent (voice)
6. Call ends  ──►  webhook  ──►  Inngest background jobs:
      transcript fetch → speaker matching → AI summary
7. Meeting page shows: Summary | Transcript | Recording | Ask AI
8. Ask AI messages  ──►  message.new webhook  ──►  GPT reply in chat
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Accounts: [Neon](https://neon.tech), [Stream](https://getstream.io), [OpenAI](https://platform.openai.com) (with credit balance), [Polar](https://polar.sh), Google/GitHub OAuth apps
- [ngrok](https://ngrok.com) (free static domain) — Stream webhooks must reach your machine in dev

### 1. Install

```bash
git clone <repo-url>
cd Meeting-AI
npm install
```

### 2. Environment

Create `.env` in the project root:

```env
# Database (Neon)
DATABASE_URL=

# Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stream (Video + Chat — same app, same keys work for both)
NEXT_PUBLIC_STREAM_VIDEO_API_KEY=
STREAM_VIDEO_SECRET_KEY=
NEXT_PUBLIC_STREAM_CHAT_API_KEY=
STREAM_CHAT_SECRET_KEY=

# OpenAI (requires credit balance for realtime agent + summaries)
OPENAI_API_KEY=
# Optional overrides:
# OPENAI_CHAT_MODEL=gpt-4o-mini
# OPENAI_REALTIME_MODEL=gpt-realtime

# Billing
POLAR_ACCESS_TOKEN=

# Inngest (dev mode)
INNGEST_DEV=1
```

> OAuth callback URLs: `{BETTER_AUTH_URL}/api/auth/callback/google` and `.../callback/github`.

### 3. Database

```bash
npm run db:push      # push schema to Neon
npm run db:studio    # (optional) inspect tables
```

### 4. Run — three terminals

The AI pipeline needs all three processes:

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — ngrok tunnel (Stream webhooks → your machine)
npm run dev:webhook

# Terminal 3 — Inngest (transcripts & summaries)
npm run dev:inngest
```

Then point Stream's webhooks at your tunnel (one-time per switch):

```bash
npm run webhook:dev     # → ngrok (local development)
npm run webhook:prod    # → production URL (before relying on prod!)
npm run webhook:show    # print current target
```

> ⚠️ The Stream app's webhooks are **global** — they point at either your tunnel *or* production, never both. Switch back with `npm run webhook:prod` before demoing production.

Open http://localhost:3000, create an agent, create a meeting, join the call, and talk to your agent.

## 📜 Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack, 4 GB heap) |
| `npm run dev:webhook` | ngrok tunnel for Stream webhooks |
| `npm run dev:inngest` | Inngest dev server (background jobs) |
| `npm run webhook:dev/prod/show` | Point Stream webhooks at ngrok / prod / inspect |
| `npm run build` | Production build (includes typecheck) |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:run` | Vitest (watch / single run) |
| `npm run db:push/studio/generate` | Drizzle schema tools |

## 📁 Project Structure

Module-based — each domain owns its API, validation, types, and UI:

```
modules/<domain>/
  server/procedures.ts   # tRPC endpoints (thin: validate → service → return)
  service.ts             # business logic lives here, not in procedures
  schemas.ts             # Zod input validation
  types.ts
  ui/                    # React components & views

Domains: agents, meetings, premium, call, auth, home, dashboard

app/api/webhook/         # Stream webhook (agent join, call lifecycle, Ask AI)
inngest/                 # background jobs (transcript, summary)
db/schema.ts             # Drizzle schema
lib/                     # auth, stream, polar, avatar clients
```

**House rules** (see [CLAUDE.md](CLAUDE.md) and [doc/](doc/)):
1. No business logic inside tRPC procedures — extract to the service layer.
2. Never swallow errors (`.catch(() => [])` is banned) — log and surface them.
3. Every DB query filters by `userId`. Ownership is security.

## 🧪 Testing

Vitest, co-located with the code (`*.test.ts` next to the module):

```bash
npm run test:run
```

Tests mock `@/db`, Stream, and OpenAI at the module boundary — no network, no real keys needed. See [doc/TEST.md](doc/TEST.md) and [doc/TESTING.md](doc/TESTING.md) for the mocking patterns (chainable DB mocks, `vi.hoisted()` usage).

## 📚 Further Docs

| Doc | Contents |
|---|---|
| [doc/API.md](doc/API.md) | tRPC procedure conventions |
| [doc/DB_SCHEMA.md](doc/DB_SCHEMA.md) | Tables & relations |
| [doc/ANTI_PATTERNS.md](doc/ANTI_PATTERNS.md) | What not to do (mandatory read) |
| [doc/TEST.md](doc/TEST.md) / [doc/TESTING.md](doc/TESTING.md) | Test setup & patterns |
| [doc/REVIEW_CHECKLIST.md](doc/REVIEW_CHECKLIST.md) | Code review checklist |
| [doc/INSTALL.md](doc/INSTALL.md) | Test tooling install steps |

## ⚠️ Troubleshooting

| Symptom | Likely cause |
|---|---|
| Agent doesn't join the call | ngrok not running, webhooks pointed at prod (`npm run webhook:show`), or OpenAI credit balance is empty |
| Ask AI gives template-like answers | OpenAI quota exhausted — the webhook falls back to summary excerpts |
| Meeting stuck in "processing" | Inngest dev server not running (`npm run dev:inngest`), or OpenAI quota — check runs at http://localhost:8288 |
| Webhook 401 "Invalid signature" | Stream keys in `.env` don't match the Stream app the webhooks are registered on |
