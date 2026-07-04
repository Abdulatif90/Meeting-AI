# REVIEW_CHECKLIST.md — Meeting-AI

> Role-loaded (Reviewer). The exact bugs that recur in THIS project.
> Check in order; if a higher item fails, don't wait on the lower ones.

## 1. Ownership (most important)
- Is every select/update/delete filtered by userId?
  If not -> BLOCKER. The user can reach another user's data.

## 2. Layer violation
- Was new heavy logic written inside a procedure (instead of a service)?
  -> WARNING (procedures.ts is already 333 lines).

## 3. Error handling
- Any .catch(() => []) or empty catch? -> BLOCKER (errors swallowed).
- Silent return instead of TRPCError for a missing resource? -> WARNING.

## 4. Input validation
- Does the mutation use .input(zodSchema)? -> if not, BLOCKER.
- Does it rely on user_123 or another hardcoded value? -> BLOCKER.

## 5. Correct error code
- Are UNAUTHORIZED / FORBIDDEN / NOT_FOUND chosen correctly?
  Is everything returning 500? -> WARNING.

## 6. AI/Inngest (if touched)
- Is there a fallback in summary generation (buildSummaryFallback pattern)?
- Is transcript length capped (the 16000 limit pattern)?

## Skip
- Formatting/style — ESLint owns it. Don't spend time here.

## Verdict
APPROVE or REQUEST_CHANGES + one sentence why.
