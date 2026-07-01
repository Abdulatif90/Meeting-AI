# TESTING.md — Meeting-AI (strategy)

> NOTE: the project currently has NO tests and no test command configured.
> The high-level "what and why" lives here; the concrete setup steps live
> in TEST.md.

## Target state (once set up)
- Framework: Vitest
- package.json: "test": "vitest"
- First tests: procedures (ownership, error cases)

## What to test (priority order)
1. Ownership: accessing another user's meeting -> NOT_FOUND
2. Premium limit: exceeding the free limit -> FORBIDDEN
3. Input validation: empty name/agentId -> error
4. AI fallback: no transcript -> buildSummaryFallback runs

## Good-test rule
- The test name states the behavior:
  "returns NOT_FOUND when meeting belongs to another user"
- Don't write a test that always passes (even with garbage) — the
  Reviewer will catch that.

## Update this file once setup lands
For now this is a plan, not the current state.
