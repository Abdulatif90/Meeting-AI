# API.md — Meeting-AI (tRPC)

> Task-loaded: read when writing a new endpoint / procedure.
> Source: trpc/init.ts, modules/*/server/procedures.ts.

## Procedure types (trpc/init.ts)
- baseProcedure — unprotected (rare)
- protectedProcedure — auth required. ctx.auth.user.id is available.
- premiumProcedure("meetings" | "agents") — protected + free-limit check.
  Throws FORBIDDEN if the free limit is exceeded.

A new endpoint should almost ALWAYS be protectedProcedure or
premiumProcedure. Use baseProcedure only if it is intentionally public.

## Standard pattern (follow this)
    someAction: protectedProcedure
      .input(zodSchema)                     // 1. validate input (Zod)
      .mutation(async ({ ctx, input }) => { // or .query
        // 2. DB op filtered by userId
        const [row] = await db.select().from(X)
          .where(and(eq(X.id, input.id), eq(X.userId, ctx.auth.user.id)));
        // 3. if not found -> explicit TRPCError
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "..." });
        return row;
      }),

## Error codes (in use)
- UNAUTHORIZED — no session (protectedProcedure does this automatically)
- FORBIDDEN — premium limit (premiumProcedure) or ownership violation
- NOT_FOUND — resource missing or belongs to another user
Pick the right code for new errors — don't return INTERNAL_SERVER_ERROR
for everything.

## Input validation
Every mutation uses .input(zodSchema). Schemas live in
modules/<domain>/schemas.ts. Example: meetingsInsertSchema (name + agentId,
both min 1). Never use req.input without Zod — that's a BLOCKER.

## Pagination
constants.ts: DEFAULT_PAGE=1, DEFAULT_PAGE_SIZE=10, MAX_PAGE_SIZE=100.
List endpoints should use these constants — don't hardcode your own numbers.
