// modules/meetings/service.test.ts
//
// Tests for the generateAiAnswer service function.
//
// Behaviors locked in:
//   1. OpenAI is called with the meeting summary in the system prompt
//      and the user's question as the user message
//   2. The AI response is sent to the correct Stream Chat channel AS THE AGENT
//      (a real channel member), after the channel is watched
//   3. The agent user is upserted before sending the message
//   4. Throws (and does NOT send to chat) when OpenAI returns a null response
//
// vi.hoisted() is used for mocks that vi.mock() factories reference directly,
// because vi.mock() is hoisted above const declarations (Vitest hoisting rule).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock fns before vi.mock() factories run.
const { mockCreate, mockSendMessage, mockUpsertUser, mockWatch, mockChannel } =
  vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockSendMessage: vi.fn().mockResolvedValue({}),
    mockUpsertUser: vi.fn().mockResolvedValue({}),
    mockWatch: vi.fn().mockResolvedValue({}),
    mockChannel: vi.fn(),
  }));

// generateAiAnswer looks up the meeting's agent (to reply as that agent),
// so the db mock resolves db.select().from(agents).where() to agentResult.
let agentResult: unknown[];
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(agentResult) }) }),
  },
}));
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

const AGENT = { id: "agent_1", name: "Test Agent" };

const answer = (content: string | null) =>
  mockCreate.mockResolvedValue({ choices: [{ message: { content } }] });

describe("generateAiAnswer", () => {
  beforeEach(() => {
    agentResult = [AGENT];
    mockCreate.mockReset();
    mockSendMessage.mockReset().mockResolvedValue({});
    mockUpsertUser.mockReset().mockResolvedValue({});
    mockWatch.mockReset().mockResolvedValue({});
    mockChannel
      .mockReset()
      .mockReturnValue({ watch: mockWatch, sendMessage: mockSendMessage });
  });

  it("sends the meeting summary in the system prompt and the question as user message", async () => {
    answer("We discussed project X timelines.");

    await generateAiAnswer({
      meetingId: "m1",
      agentId: AGENT.id,
      question: "What was discussed?",
      meetingSummary: "Summary: project X timelines.",
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[0].content).toContain("Summary: project X timelines.");
    expect(callArgs.messages[1]).toMatchObject({
      role: "user",
      content: "What was discussed?",
    });
  });

  it("watches the channel and sends the AI response as the meeting's agent", async () => {
    answer("Topics covered: planning, deadlines.");

    await generateAiAnswer({
      meetingId: "meeting-123",
      agentId: AGENT.id,
      question: "What topics were covered?",
      meetingSummary: "Summary",
    });

    expect(mockChannel).toHaveBeenCalledWith("messaging", "meeting-123");
    expect(mockWatch).toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledWith({
      text: "Topics covered: planning, deadlines.",
      user: expect.objectContaining({ id: AGENT.id, name: AGENT.name }),
    });
  });

  it("upserts the agent user before sending the message", async () => {
    answer("Answer");

    await generateAiAnswer({
      meetingId: "m1",
      agentId: AGENT.id,
      question: "Question?",
      meetingSummary: "Summary",
    });

    expect(mockUpsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: AGENT.id }),
    );
  });

  it("throws and does not send to chat when OpenAI returns a null response", async () => {
    answer(null);

    await expect(
      generateAiAnswer({
        meetingId: "m1",
        agentId: AGENT.id,
        question: "Question?",
        meetingSummary: "Summary",
      }),
    ).rejects.toThrow("OpenAI returned an empty response");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
