import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { StreamTheme, useCall } from "@stream-io/video-react-sdk";

import { useTRPC } from "@/trpc/client";
import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
  meetingId: string;
  meetingName: string;
};

export const CallUI = ({ meetingId, meetingName }: Props) => {
  const call = useCall();
  const trpc = useTRPC();
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");
  const { mutateAsync: ensureCall, isPending: isJoining } = useMutation(
    trpc.meetings.ensureCall.mutationOptions(),
  );

  const handleJoin = async () => {
    if (!call) return;

    try {
      await ensureCall({ id: meetingId });
      await call.join();
      setShow("call");
    } catch (error) {
      console.error("Failed to join call", error);
    }
  };


  const handleLeave = () => {
    if (!call) return;

    call.endCall();
    setShow("ended");
  };

  return (
    <StreamTheme className="h-full">
      {show === "lobby" && <CallLobby onJoin={handleJoin} isJoining={isJoining} />}
      {show === "call" && <CallActive onLeave={handleLeave} meetingName={meetingName} />}
      {show === "ended" && <CallEnded />}
    </StreamTheme>
  )
};