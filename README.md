  🧠 Meeting.AI Architecture Document  https://meeting-ai-saas1.vercel.app/

  🧠 Meeting.AI — System Architecture

  📌 Overview

Meeting.AI is an AI-native video meeting platform where users interact with real-time AI agents during live calls.

The system combines:
- real-time communication (video/audio)
- streaming AI responses
- asynchronous background processing
- SaaS billing & access control

---

  🏗️ Architecture Goals

- Low-latency AI responses during live calls
- Reliable post-meeting processing (transcripts, summaries)
- Scalable multi-user support
- Cost-controlled AI usage
- Strong type safety across the stack
  
  🧩 High-Level Architecture

Client (Next.js / React)
↓
tRPC API Layer (Next.js server)
↓
-

| External Services           |
| --------------------------- |
| Stream (Video + Chat)       |
| OpenAI (Realtime AI Agents) |
| Inngest (Background Jobs)   |
| Polar (Billing)             |
| BetterAuth (Authentication) |

---

```
    ↓
```

PostgreSQL (Neon) via Drizzle ORM

```

---

  🔄 Core System Flows

   1. 🎥 Real-Time Meeting Flow

 Goal:  Enable live AI interaction during video calls

   Flow:
1. User joins meeting (client)
2. Stream Video SDK establishes connection
3. Audio stream is sent to OpenAI Realtime API
4. AI agent processes input and streams responses
5. Responses are rendered in real-time

   Key Design Decisions:

-  Stream SDK over custom WebRTC 
  - avoids infra complexity
  - provides scalability out of the box

- OpenAI Realtime API 
  - enables streaming responses (low latency)
  - avoids request/response bottleneck

   Risks:

- Latency spikes from OpenAI
- Audio sync issues
- Rate limiting under heavy load

---

   2. 🧾 Post-Meeting Processing Flow

 Goal:  Convert raw meeting into structured knowledge

   Flow:
1. Meeting ends
2. Event sent to Inngest
3. Background workflows triggered:
   - Fetch transcript
   - Generate summary (OpenAI)
   - Store results in DB
4. Meeting status updated → `completed`

   Why Background Jobs?

- Avoid blocking user experience
- Retries on failure
- Decouples heavy AI work from request lifecycle

   Failure Handling:

- Inngest retries failed jobs
- Idempotent processing (safe re-runs)
- Partial completion handling (e.g., transcript exists, summary failed)

---

   3. 💬 Post-Meeting AI Chat

 Goal:  Allow users to query past meetings

   Flow:
1. User sends query
2. Context retrieved (transcript + summary)
3. Query sent to OpenAI
4. Response streamed via Stream Chat SDK

   Design Insight:

This is essentially:
>  RAG (Retrieval-Augmented Generation) 

Even if simplified:
- retrieval = transcript search
- generation = OpenAI response

---

   4. 💳 Billing & Access Control

   Flow:
1. User hits usage limit
2. Redirect to pricing page
3. Polar handles checkout
4. Webhook updates subscription status
5. Access control enforced in API layer

   Critical Concern:

- Always validate subscription  server-side 
- Never trust client state

---

  🧱 Tech Stack — Why These Choices?

   tRPC (vs REST)

- End-to-end type safety
- Eliminates API contract mismatch
- Faster development

 Trade-off: 
- Less flexible for public APIs

---

   Inngest (vs traditional queues)

- No infra setup (serverless)
- Built-in retries & workflows
- Easy event-driven model

 Trade-off: 
- Less control vs custom queue (BullMQ, Kafka)

---

   Stream (vs custom WebRTC)

- Handles scaling, TURN/STUN, edge infra
- Faster time to production

 Trade-off: 
- Vendor lock-in
- Cost at scale

---

   Drizzle ORM (vs Prisma)

- Lightweight
- SQL-first approach
- Better control over queries

 Trade-off: 
- Less abstraction

---

  ⚠️ Production Concerns

   1. Rate Limiting

- AI calls are expensive
- Must enforce:
  - per-user limits
  - per-minute usage caps

---

   2. Cost Control

- Streaming AI = high cost risk
- Strategies:
  - token limits
  - shorter sessions
  - caching summaries

---

   3. Failure Scenarios

| Scenario | Impact | Mitigation |
|----------|--------|-----------|
| OpenAI downtime | AI unavailable | fallback messaging |
| Inngest failure | no summaries | retry + alerting |
| Stream outage | no calls | graceful UI fallback |

---

   4. Data Consistency

- Ensure:
  - meeting status reflects real state
  - background jobs are idempotent
  - no duplicate processing

---

   5. Security

- Validate all API requests
- Protect webhooks (signature verification)
- Secure environment variables

---

  📈 Scaling Strategy

   Horizontal Scaling

- Stateless Next.js API
- Neon handles DB scaling
- Stream handles video scaling

---

   Bottlenecks

- OpenAI API throughput
- Background job concurrency
- DB query performance

---

  🔮 Future Architecture Improvements

- Multi-agent conversations
- Real-time transcription streaming
- Vector DB for better RAG
- Queue-based fallback (if Inngest fails)
- Edge AI processing (reduce latency)

---

  🧠 Key Insight

Meeting.AI is not just a video app.

It is a combination of:
-  real-time systems 
-  event-driven architecture 
-  AI pipelines 

---

  🏁 Summary

This system demonstrates:

- Real-time AI integration
- Distributed system thinking
- Async processing patterns
- SaaS monetization architecture

It is designed as a  production-grade AI-native application , not just a demo project.
```

---

  
