// modules/meetings/service.test.ts
//
// Tests for the generateAiAnswer service function.
//
// Behaviors locked in:
//   1. OpenAI is called with the meeting summary in the system prompt
//      and the user's question as the user message
//   2. The AI response is sent to the correct Stream Chat channel as "ai-assistant"
//   3. The ai-assistant user is upserted before sending the message
//   4. Throws (and does NOT send to chat) when OpenAI returns a null response
//
// vi.hoisted() is used for mocks that vi.mock() factories reference directly,
// because vi.mock() is hoisted above const declarations (Vitest hoisting rule).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock fns before vi.mock() factories run.
const { mockCreate, mockSendMessage, mockUpsertUser, mockChannel } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockSendMessage: vi.fn().mockResolvedValue({}),
  mockUpsertUser: vi.fn().mockResolvedValue({}),
  mockChannel: vi.fn(),
}));

// @/db is imported at module level by service.ts (used by other functions).
// Mock it so the module loads without a real DB connection.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/avatar", () => ({ generateAvatarUri: () => "avatar://stub" }));

// OpenAI: mock as a class so `new OpenAI()` works correctly.
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

// Stream Chat: server-side client used to send the AI response.
vi.mock("@/lib/stream-chat", () => ({
  streamChat: { upsertUser: mockUpsertUser, channel: mockChannel },
}));

import { generateAiAnswer } from "./service";

describe("generateAiAnswer", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockSendMessage.mockReset().mockResolvedValue({});
    mockUpsertUser.mockReset().mockResolvedValue({});
    mockChannel.mockReset().mockReturnValue({ sendMessage: mockSendMessage });
  });

  it("sends the meeting summary in the system prompt and the question as user message", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "We discussed project X timelines." } }],
    });

    await generateAiAnswer("m1", "What was discussed?", "Summary: project X timelines.");

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[0].content).toContain("Summary: project X timelines.");
    expect(callArgs.messages[1]).toMatchObject({
      role: "user",
      content: "What was discussed?",
    });
  });

  it("sends the AI response to the correct Stream Chat channel as ai-assistant", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Topics covered: planning, deadlines." } }],
    });

    await generateAiAnswer("meeting-123", "What topics were covered?", "Summary");

    expect(mockChannel).toHaveBeenCalledWith("messaging", "meeting-123");
    expect(mockSendMessage).toHaveBeenCalledWith({
      text: "Topics covered: planning, deadlines.",
      user_id: "ai-assistant",
    });
  });

  it("upserts the ai-assistant user before sending the message", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Answer" } }],
    });

    await generateAiAnswer("m1", "Question?", "Summary");

    expect(mockUpsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ai-assistant" }),
    );
  });

  it("throws and does not send to chat when OpenAI returns a null response", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(generateAiAnswer("m1", "Question?", "Summary")).rejects.toThrow(
      "OpenAI returned an empty response",
    );
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
