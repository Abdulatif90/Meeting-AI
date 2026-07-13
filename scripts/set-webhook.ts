/**
 * Repoints the Stream app's webhook hooks (video + chat) at a target URL.
 *
 * This is a SINGLE Stream app shared by local dev and production, and its
 * event hooks are global — they can only point at ONE place at a time. So
 * while developing locally you point them at your ngrok tunnel; before relying
 * on production again you point them back at the deployed URL.
 *
 *   npm run webhook:dev    # point at the ngrok tunnel (local development)
 *   npm run webhook:prod   # point back at the Vercel deployment
 *   npm run webhook:show   # print the current hook URLs, change nothing
 *
 * The webhook route lives at <base>/api/webhook. Existing event_types and
 * per-hook product are preserved; only the URL changes.
 */
import "dotenv/config";
import { StreamChat, type EventHook } from "stream-chat";

import { NGROK_URL, PROD_URL } from "./webhook-config";

const targets: Record<string, string> = {
  dev: NGROK_URL,
  prod: PROD_URL,
  show: "",
};

function getClient() {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY;
  const secret = process.env.STREAM_CHAT_SECRET_KEY;
  if (!apiKey || !secret) {
    throw new Error(
      "Missing NEXT_PUBLIC_STREAM_CHAT_API_KEY or STREAM_CHAT_SECRET_KEY in .env",
    );
  }
  return StreamChat.getInstance(apiKey, secret);
}

async function main() {
  const mode = process.argv[2] ?? "show";
  if (!(mode in targets)) {
    throw new Error(`Unknown mode "${mode}". Use: dev | prod | show`);
  }

  const client = getClient();
  const current = await client.getAppSettings();
  const hooks = ((current.app as { event_hooks?: EventHook[] })?.event_hooks ??
    []) as EventHook[];

  if (mode === "show") {
    for (const h of hooks) {
      console.log(`• ${h.product ?? "?"} (${h.hook_type}): ${h.webhook_url}`);
    }
    return;
  }

  const targetUrl = targets[mode];

  // Preserve everything about each webhook hook; only swap the URL.
  const nextHooks: EventHook[] = hooks.map((h) =>
    h.hook_type === "webhook" ? { ...h, webhook_url: targetUrl } : h,
  );

  await client.updateAppSettings({ event_hooks: nextHooks });

  const updated = await client.getAppSettings();
  const updatedHooks = ((updated.app as { event_hooks?: EventHook[] })
    ?.event_hooks ?? []) as EventHook[];

  console.log(`✅ Webhooks repointed to: ${targetUrl}`);
  for (const h of updatedHooks) {
    console.log(`• ${h.product ?? "?"} (${h.hook_type}): ${h.webhook_url}`);
  }
}

main().catch((error) => {
  console.error(
    "❌ Failed to update webhook:",
    (error as { response?: { data?: unknown } })?.response?.data ?? error,
  );
  process.exit(1);
});
