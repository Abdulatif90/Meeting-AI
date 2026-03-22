import Link from "next/link";
import {
  ArrowRightIcon,
  BotIcon,
  CalendarClockIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const highlights = [
  {
    title: "AI meeting operators",
    description:
      "Launch reusable agents that lead calls, capture intent, and keep every session structured.",
    icon: BotIcon,
  },
  {
    title: "Live call workflow",
    description:
      "Create meetings, join instantly, and let recording plus transcription run in the background.",
    icon: VideoIcon,
  },
  {
    title: "Usable outputs",
    description:
      "Turn transcripts into summaries your team can actually review and act on after the call ends.",
    icon: SparklesIcon,
  },
];

const stats = [
  { label: "Meeting flow", value: "Create -> Join -> Summarize" },
  { label: "Agent setup", value: "Prompt-driven" },
  { label: "Call capture", value: "Video + transcript" },
];

export const HomeView = () => {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(28,155,108,0.22),transparent_30%),linear-gradient(180deg,#f7fbf9_0%,#edf5f1_45%,#ffffff_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-3xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur md:px-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary/80">
              Meeting AI
            </p>
            <p className="text-sm text-muted-foreground">
              Run meetings with agents, recordings, and summaries in one flow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </header>

        <section className="relative mt-8 grid flex-1 items-center gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-sm text-primary shadow-sm">
              <CalendarClockIcon className="size-4" />
              AI-assisted meeting workspace
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance md:text-6xl lg:text-7xl">
                Meetings that start fast and finish with clear output.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Build agents, host calls, capture transcripts, and ship summaries from a
                single workspace designed for repeatable conversations.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/sign-up">
                  Create account
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sign-in">Open existing workspace</Link>
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur"
                >
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-x-10 top-10 h-24 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/70 bg-[#10352b] p-5 text-white shadow-2xl shadow-primary/10">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-white/60">
                      Live workspace
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">Product Strategy Sync</h2>
                  </div>
                  <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">
                    Recording on
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  {highlights.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-white/10 bg-black/10 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-white/10 p-2">
                            <Icon className="size-5" />
                          </div>
                          <div>
                            <h3 className="font-medium">{item.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-white/70">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};