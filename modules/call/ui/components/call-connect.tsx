"use client";

import { LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Call,
  CallingState,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
} from "@stream-io/video-react-sdk";

import { useTRPC } from "@/trpc/client";
import { CallUI } from "./call-ui";

interface Props {
  meetingId: string;
  meetingName: string;
  userId: string;
  userName: string;
  userImage: string;
};

export const CallConnect = ({
  meetingId,
  meetingName,
  userId,
  userName,
  userImage,
}: Props) => {
  const trpc = useTRPC();
  const { mutateAsync: generateToken } = useMutation(
    trpc.meetings.generateToken.mutationOptions(),
  );

  const [client, setClient] = useState<StreamVideoClient>();
  useEffect(() => {
    const _client = new StreamVideoClient({
      apiKey: process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!,
      user: {
        id: userId,
        name: userName,
        image: userImage,
      },
      tokenProvider: generateToken,
    });

    setClient(_client);

    return () => {
      _client.disconnectUser();
      setClient(undefined);
    };
  }, [userId, userName, userImage, generateToken]);

  const [call, setCall] = useState<Call>();
  useEffect(() => {
      if (!client) return;

      const _call = client.call("default", meetingId);
      _call.camera.disable();
      _call.microphone.disable();
      setCall(_call);

      return () => {
        setCall(undefined);
        // Always release the devices so the camera/mic hardware light turns
        // off — leave() alone does not stop the lobby preview track.
        _call.camera.disable().catch(() => {});
        _call.microphone.disable().catch(() => {});
        // Only leave a call we actually joined. In React 19 dev, StrictMode
        // double-invokes effects: the call is still IDLE on the first teardown,
        // and leaving it would move the reused instance into a LEFT state —
        // breaking video (and the agent session) on remount and throwing
        // "Cannot leave call that has already been left".
        const state = _call.state.callingState;
        if (state === CallingState.JOINED || state === CallingState.JOINING) {
          _call.leave().catch((error) => {
            console.error("Failed to leave call", error);
          });
        }
      };
  }, [client, meetingId]);

  if (!client || !call) {
    return (
      <div className="flex h-screen items-center justify-center bg-radial from-sidebar-accent to-sidebar">
        <LoaderIcon className="size-6 animate-spin text-white" />
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI meetingId={meetingId} meetingName={meetingName} />
      </StreamCall>
    </StreamVideo>
  );
};