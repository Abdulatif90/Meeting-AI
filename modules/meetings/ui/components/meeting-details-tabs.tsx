"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import {
  BookOpenTextIcon,
  ClockFadingIcon,
  FileTextIcon,
  FileVideoIcon,
  SparklesIcon,
} from "lucide-react";
import { format } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDuration } from "@/lib/utils";

import { MeetingGetOne } from "../../types";
import { ChatProvider } from "./chat-provider";
import { Transcript } from "./transcript";

const meetingTabs = ["summary", "transcript", "recording", "chat"] as const;

type MeetingTab = (typeof meetingTabs)[number];

const isMeetingTab = (value: string | null): value is MeetingTab => {
  return !!value && meetingTabs.includes(value as MeetingTab);
};

interface Props {
  data: MeetingGetOne;
}

export const MeetingDetailsTabs = ({ data }: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const currentTab: MeetingTab = isMeetingTab(tabParam)
    ? tabParam
    : "summary";

  const handleTabChange = (nextTab: string) => {
    if (!isMeetingTab(nextTab)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", nextTab);

    router.replace(`${pathname}?${nextParams.toString()}`, {
      scroll: false,
    });
  };

  const canUseAskAi = data.status === "completed" && !!data.summary;

  return (
    <div className="flex flex-col gap-y-4">
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <div className="bg-white rounded-lg border px-3">
          <ScrollArea>
            <TabsList className="p-0 bg-background justify-start rounded-none h-13">
              <TabsTrigger
                value="summary"
                className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:text-accent-foreground h-full hover:text-accent-foreground"
              >
                <BookOpenTextIcon />
                Summary
              </TabsTrigger>
              <TabsTrigger
                value="transcript"
                className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:text-accent-foreground h-full hover:text-accent-foreground"
              >
                <FileTextIcon />
                Transcript
              </TabsTrigger>
              <TabsTrigger
                value="recording"
                className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:text-accent-foreground h-full hover:text-accent-foreground"
              >
                <FileVideoIcon />
                Recording
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:text-accent-foreground h-full hover:text-accent-foreground"
              >
                <SparklesIcon />
                Ask AI
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
        <TabsContent value="chat">
          {canUseAskAi ? (
            <ChatProvider meetingId={data.id} meetingName={data.name} />
          ) : (
            <div className="bg-white rounded-lg border px-4 py-5">
              <p className="text-sm font-medium">Ask AI is not ready yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Ask AI becomes available after the transcript and summary finish processing.
              </p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="transcript">
          <Transcript meetingId={data.id} />
        </TabsContent>
        <TabsContent value="recording">
          <div className="bg-white rounded-lg border px-4 py-5">
            {data.recordingUrl ? (
              <video
                src={data.recordingUrl}
                className="w-full rounded-lg"
                controls
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {data.status === "processing"
                  ? "Recording is being saved and prepared."
                  : "Recording is not available yet."}
              </p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="summary">
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-5 gap-y-5 flex flex-col col-span-5">
              <h2 className="text-2xl font-medium capitalize">{data.name}</h2>
              <div className="flex gap-x-2 items-center flex-wrap">
                <Link
                  href={`/agents/${data.agent.id}`}
                  className="flex items-center gap-x-2 underline underline-offset-4 capitalize"
                >
                  <GeneratedAvatar
                    variant="botttsNeutral"
                    seed={data.agent.name}
                    className="size-5"
                  />
                  {data.agent.name}
                </Link>
                <p>{data.startedAt ? format(data.startedAt, "PPP") : ""}</p>
                <Badge variant="outline" className="capitalize">
                  {data.status}
                </Badge>
              </div>
              <div className="flex gap-x-2 items-center">
                <SparklesIcon className="size-4" />
                <p>General summary</p>
              </div>
              <Badge
                variant="outline"
                className="flex items-center gap-x-2 [&>svg]:size-4 w-fit"
              >
                <ClockFadingIcon className="text-blue-700" />
                {data.duration != null ? formatDuration(data.duration) : "No duration"}
              </Badge>
              <div>
                {data.summary ? (
                  <Markdown
                    components={{
                      h1: (props) => (
                        <h1 className="text-2xl font-medium mb-6" {...props} />
                      ),
                      h2: (props) => (
                        <h2 className="text-xl font-medium mb-6" {...props} />
                      ),
                      h3: (props) => (
                        <h3 className="text-lg font-medium mb-6" {...props} />
                      ),
                      h4: (props) => (
                        <h4 className="text-base font-medium mb-6" {...props} />
                      ),
                      p: (props) => (
                        <p className="mb-6 leading-relaxed" {...props} />
                      ),
                      ul: (props) => (
                        <ul className="list-disc list-inside mb-6" {...props} />
                      ),
                      ol: (props) => (
                        <ol className="list-decimal list-inside mb-6" {...props} />
                      ),
                      li: (props) => <li className="mb-1" {...props} />,
                      strong: (props) => (
                        <strong className="font-semibold" {...props} />
                      ),
                      code: (props) => (
                        <code className="bg-gray-100 px-1 py-0.5 rounded" {...props} />
                      ),
                      blockquote: (props) => (
                        <blockquote className="border-l-4 pl-4 italic my-4" {...props} />
                      ),
                    }}
                  >
                    {data.summary}
                  </Markdown>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {data.status === "processing"
                      ? "Meeting has ended. Recording, transcript, and summary are being processed."
                      : "Summary is still being generated."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};