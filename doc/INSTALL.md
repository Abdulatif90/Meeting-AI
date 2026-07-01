# Running these tests — 3 steps

## 1. Install Vitest
    npm install -D vitest @vitest/coverage-v8

## 2. Add to package.json "scripts"
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"

## 3. Place the files
    vitest.config.ts                              -> project root
    procedures.test.ts                            -> modules/meetings/server/
    (optional) summary-fallback.test.ts           -> inngest/ (see note)

Then run:
    npm test

## Expected output
    ✓ meetings.remove — ownership (2)
      ✓ throws NOT_FOUND when the meeting belongs to another user
      ✓ returns the meeting when it belongs to the user

## Important adjustment note
The mock in procedures.test.ts mirrors the `remove` chain:
    db.delete(meetings).where(...).returning()
Other procedures use different chains (e.g. getOne uses
db.select().from().innerJoin().where()). When you test those,
mirror THAT chain in the mock — read the procedure first.
