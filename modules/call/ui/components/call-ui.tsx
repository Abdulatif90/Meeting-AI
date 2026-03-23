import { useEffect, useState } from "react";
import {
  StreamTheme,
  useCall,
  useCallStateHooks,
  useToggleCallRecording,
} from "@stream-io/video-react-sdk";

import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
  meetingId: string;
  meetingName: string;
};

const formatRecordingTimer = (elapsedSeconds: number) => {
  const hours = Math.floor(elapsedSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(elapsedSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
};

export const CallUI = ({ meetingId, meetingName }: Props) => {
  const call = useCall();
  const { useCallSession } = useCallStateHooks();
  const callSession = useCallSession();
  const { isCallRecordingInProgress } = useToggleCallRecording();
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const [hadRecording, setHadRecording] = useState(false);

  useEffect(() => {
    if (!isCallRecordingInProgress) {
      return;
    }

    setHadRecording(true);
    setRecordingStartedAt((currentValue) => {
      if (currentValue) {
        return currentValue;
      }

      if (callSession?.started_at) {
        return new Date(callSession.started_at).getTime();
      }

      return Date.now();
    });
  }, [callSession?.started_at, isCallRecordingInProgress]);

  useEffect(() => {
    if (!isCallRecordingInProgress || !recordingStartedAt) {
      return;
    }

    const updateElapsedSeconds = () => {
      setRecordingElapsedSeconds(
        Math.max(Math.floor((Date.now() - recordingStartedAt) / 1000), 0)
      );
    };

    updateElapsedSeconds();

    const intervalId = window.setInterval(updateElapsedSeconds, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isCallRecordingInProgress, recordingStartedAt]);

  const handleJoin = async () => {
    if (!call) return;

    await call.join();

    setShow("call");
  };

  const handleLeave = () => {
    if (!call) return;

    call.endCall().finally(() => {
      setShow("ended");
    });
  };

  return (
    <StreamTheme className="h-full">
      {show === "lobby" && <CallLobby onJoin={handleJoin} />}
      {show === "call" && (
        <CallActive
          onLeave={handleLeave}
          meetingName={meetingName}
          isRecording={isCallRecordingInProgress}
          recordingElapsedLabel={
            isCallRecordingInProgress
              ? formatRecordingTimer(recordingElapsedSeconds)
              : null
          }
          recordingSaved={hadRecording && !isCallRecordingInProgress}
        />
      )}
      {show === "ended" && (
        <CallEnded meetingId={meetingId} hadRecording={hadRecording} />
      )}
    </StreamTheme>
  )
};