// inngest/functions.test.ts
//
// Tests buildSummaryFallback — the safety net used when the AI summarizer
// returns nothing (see ANTI_PATTERNS.md: AI steps must have a fallback).
//
// buildSummaryFallback itself is a PURE function (transcript -> markdown),
// so it needs no mocks. BUT importing functions.ts runs import-time side
// effects — it builds a Stream client and an agent-kit agent, both of which
// read API keys. We stub those so the import doesn't throw in the test env.
//
// PREREQUISITE: export the function in inngest/functions.ts by changing
//   const buildSummaryFallback = (
// to
//   export const buildSummaryFallback = (

import { describe, it, expect, vi } from "vitest";

// --- Stub import-time side effects in functions.ts ---
// Stream client (lib/stream-video builds a real client needing keys)
vi.mock("@/lib/stream-video", () => ({ streamVideo: {} }));
// agent-kit: createAgent()/openai() run at module load with an API key
vi.mock("@inngest/agent-kit", () => ({
  createAgent: () => ({ run: vi.fn() }),
  openai: () => ({}),
  // TextMessage is a type only; a runtime stub is harmless
}));
// inngest client
vi.mock("@/inngest/client", () => ({ inngest: { createFunction: () => ({}) } }));
// db is imported but buildSummaryFallback never touches it
vi.mock("@/db", () => ({ db: {} }));

import { buildSummaryFallback } from "./functions";

// Minimal shape matching what the function reads: item.user.name and item.text
const line = (name: string, text: string) => ({ user: { name }, text }) as never;

describe("buildSummaryFallback", () => {
  it("returns the 'not available' message when the transcript is empty", () => {
    const result = buildSummaryFallback([]);

    expect(result).toContain("Transcript is not available yet");
    expect(result).toContain("No transcript content was found");
  });

  it("lists transcript lines as '- name: text' when content exists", () => {
    const result = buildSummaryFallback([
      line("Alice", "Hello everyone"),
      line("Bob", "Good to be here"),
    ]);

    expect(result).toContain("- Alice: Hello everyone");
    expect(result).toContain("- Bob: Good to be here");
    expect(result).not.toContain("Transcript is not available yet");
  });

  it("caps the preview at the first 8 lines even with more input", () => {
    const many = Array.from({ length: 12 }, (_, i) => line(`User${i}`, `Line ${i}`));

    const result = buildSummaryFallback(many);
    const previewLines = result.split("\n").filter((l) => l.startsWith("- "));

    expect(previewLines).toHaveLength(8);
    expect(result).toContain("- User0: Line 0");
    expect(result).not.toContain("- User8: Line 8");
  });
});