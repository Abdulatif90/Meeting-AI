import Link from "next/link";
import Image from "next/image";
import {
  CallControls,
  useCallStateHooks,
  SpeakerLayout,
} from "@stream-io/video-react-sdk";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { generateAvatarUri } from "@/lib/avatar";

interface Props {
  onLeave: () => void;
  meetingName: string;
  isRecording: boolean;
  recordingElapsedLabel: string | null;
  recordingSaved: boolean;
};

export const CallActive = ({
  onLeave,
  meetingName,
  isRecording,
  recordingElapsedLabel,
  recordingSaved,
}: Props) => {
  const { useLocalParticipant, useRemoteParticipants } = useCallStateHooks();
  const localParticipant = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  return (
    <div className="flex flex-col justify-between p-4 h-full text-white gap-y-4">
      <div className="bg-[#101213] rounded-full p-4 flex items-center gap-4">
        <Link href="/" className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit">
          <Image src="/logo.svg" width={22} height={22} alt="Logo" />
        </Link>
        <h4 className="text-base">
          {meetingName}
        </h4>
        <div className="ml-auto flex items-center gap-2">
          {isRecording && recordingElapsedLabel ? (
            <Badge className="bg-red-500/15 text-red-200 border-red-500/30 hover:bg-red-500/15">
              REC {recordingElapsedLabel}
            </Badge>
          ) : null}
          {!isRecording && recordingSaved ? (
            <Badge className="bg-emerald-500/15 text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/15">
              Saved
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] flex-1 min-h-0">
        <div className="min-h-80 rounded-3xl overflow-hidden bg-[#101213]">
          <SpeakerLayout />
        </div>
        <div className="bg-[#101213] rounded-3xl p-4 flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-3">
            <p className="text-sm font-medium text-white/70">Host</p>
            {localParticipant ? (
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage
                      src={
                        localParticipant.image ??
                        generateAvatarUri({
                          seed: localParticipant.name ?? "Host",
                          variant: "initials",
                        })
                      }
                      alt={localParticipant.name ?? "Host"}
                    />
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{localParticipant.name ?? "Host"}</p>
                    <p className="text-xs text-white/60">Meeting owner</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-white">
                  Host
                </Badge>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-y-3 min-h-0">
            <p className="text-sm font-medium text-white/70">Participants</p>
            <div className="flex flex-col gap-y-2 overflow-y-auto">
              {remoteParticipants.length > 0 ? (
                remoteParticipants.map((participant) => {
                  const isHost = participant.roles?.includes("admin");

                  return (
                    <div
                      key={participant.sessionId}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarImage
                            src={
                              participant.image ??
                              generateAvatarUri({
                                seed: participant.name ?? participant.userId,
                                variant: isHost ? "initials" : "botttsNeutral",
                              })
                            }
                            alt={participant.name ?? participant.userId}
                          />
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {participant.name ?? participant.userId}
                          </p>
                          <p className="text-xs text-white/60">
                            {isHost ? "Host" : "AI/User participant"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-white/10 bg-white/5 text-white capitalize">
                        {isHost ? "Host" : "Participant"}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-white/60">No other participants yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#101213] rounded-full px-4">
        <CallControls onLeave={onLeave} />
      </div>
    </div>
  );
};