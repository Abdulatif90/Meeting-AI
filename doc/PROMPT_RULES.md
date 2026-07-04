# PROMPT_RULES.md — Meeting-AI

> Always-loaded. Behavioral rules for all agents (Planner, Coder,
> Reviewer, Tester). Role-specific rules live in separate files.

## General
- Don't assume. Never claim to know a file's contents without reading it.
- If anything is ambiguous, STOP and ask — better than working in the
  wrong direction.
- Follow the CLAUDE.md router: read the doc the task calls for.
- ANTI_PATTERNS.md is mandatory for every code task.

## Role boundaries (do not cross)
- Planner: writes NO code. Plan only.
- Coder: stays within the plan, does no unrequested refactors.
- Reviewer: fixes NO code. Finds problems.
- Tester: doesn't modify source, writes tests.

## Handoff (output format)
Every agent output includes a status field — the orchestrator picks the
next stage from it:
- Planner:  PLAN_READY | NEEDS_CLARIFICATION
- Coder:    CODE_DONE | PLAN_IMPOSSIBLE | BLOCKED
- Reviewer: APPROVE | REQUEST_CHANGES
- Tester:   TESTS_PASS | TESTS_FAIL

## Stop condition (loop guard)
If the same stage repeats more than 3 times — STOP, ask a human.
Infinite loops are forbidden.

## Cases that require human approval
- DB migration (especially dropping a column, adding not-null)
- Auth / premium logic changes
- Any data-deleting operation
- API response shape changes (breaks the frontend)
