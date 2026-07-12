"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Channel as StreamChannel } from "stream-chat";
import {
  useCreateChatClient,
  Chat,
  Channel,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";

import { useTRPC } from "@/trpc/client";
import { LoadingState } from "@/components/loading-state";



interface ChatUIProps {
  meetingId: string;
  meetingName: string;
  userId: string;
  userName: string;
  userImage: string | undefined;
};

export const ChatUI = ({
  meetingId,
  meetingName,
  userId,
  userName,
  userImage,
}: ChatUIProps) => {
  const trpc = useTRPC();
  const { mutateAsync: generateChatToken } = useMutation(
    trpc.meetings.generateChatToken.mutationOptions(),
  );

  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const client = useCreateChatClient({
    apiKey: process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
    tokenOrProvider: generateChatToken,
    userData: {
      id: userId,
      name: userName,
      image: userImage,
    },
  });

  useEffect(() => {
    if (!client) return;

    let isCancelled = false;

    const initChannel = async () => {
      const nextChannel = client.channel("messaging", meetingId, {
        members: [userId],
      });

      await nextChannel.watch();

      if (!isCancelled) {
        setChannel(nextChannel);
      }
    };

    initChannel().catch((error) => {
      // Teardown race: leaving the tab disconnects the client while watch()
      // is still in flight — expected, not a real failure.
      if (isCancelled) return;
      console.error("Failed to initialize meeting chat", error);
    });

    return () => {
      isCancelled = true;
      setChannel(null);
    };
  }, [client, meetingId, meetingName, userId]);

  if (!client || !channel) {

    return (
      <LoadingState
        title="Loading Chat"
        description="This may take a few seconds"
      />
    );
  }
  return (
    // Fixed height + str-chat stretched to fill it: scrolling is owned by
    // MessageList's internal list container (Stream's documented layout).
    // A custom max-h wrapper around MessageList breaks its scroll behavior.
    <div className="bg-white rounded-lg border overflow-hidden h-[calc(100vh-18rem)] min-h-96 [&_.str-chat]:h-full">
      <Chat client={client}>
        <Channel channel={channel}>
          <Window>
            <MessageList />
            {/* Default submit sends the message to Stream, which fires the
                `message.new` webhook → the agent's AI reply. */}
            <MessageInput />
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  )
}