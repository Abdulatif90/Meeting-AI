/**
 * One-command health check for the local dev chain the AI agent depends on:
 *
 *   Stream → ngrok tunnel → localhost:3000 → /api/webhook → connectOpenAi
 *
 * Verifies every link and prints exactly which one is broken:
 *   1. dev server listening on port 3000 (not silently moved to 3001)
 *   2. ngrok tunnel up and forwarding to 3000
 *   3. recent webhook deliveries through ngrok (any 502s?)
 *   4. Stream's webhook URL points at the ngrok tunnel, not production
 *   5. inngest dev server running (summaries pipeline)
 *   6. system clock skew (token iat/exp validity)
 *
 *   npm run dev:doctor
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { StreamChat, type EventHook } from "stream-chat";

import { NGROK_URL, PROD_URL } from "./webhook-config";

const NGROK_API = "http://127.0.0.1:4040";

let failures = 0;
const ok = (msg: string) => console.log(`  V  ${msg}`);
const warn = (msg: string) => console.log(`  !  ${msg}`);
const bad = (msg: string) => {
  failures++;
  console.log(`  X  ${msg}`);
};

function portListening(port: number): boolean {
  if (process.platform !== "win32") return false;

  for (const proto of ["tcp", "tcpv6"]) {
    let output = "";
    try {
      output = execSync(`netstat -ano -p ${proto}`, { encoding: "utf8" });
    } catch {
      continue;
    }
    for (const line of output.split(/\r?\n/)) {
      const columns = line.trim().split(/\s+/);
      if (
        columns.length >= 5 &&
        columns[3] === "LISTENING" &&
        columns[1].endsWith(`:${port}`)
      ) {
        return true;
      }
    }
  }
  return false;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function checkDevServer() {
  console.log("\n1. Dev server");
  if (portListening(3000)) {
    ok("listening on port 3000");
  } else {
    bad("NOTHING is listening on port 3000 — start it: npm run dev");
    if (portListening(3001)) {
      warn(
        "…but port 3001 IS busy: next dev probably fell back to 3001. " +
          "Stop it and restart so it binds to 3000.",
      );
    }
  }
}

interface NgrokTunnel {
  public_url: string;
  config: { addr: string };
}

async function checkNgrok() {
  console.log("\n2. ngrok tunnel");
  const data = await fetchJson<{ tunnels: NgrokTunnel[] }>(
    `${NGROK_API}/api/tunnels`,
  );

  if (!data || data.tunnels.length === 0) {
    bad("ngrok is not running — start it: npm run dev:webhook");
    return;
  }

  const expectedOrigin = new URL(NGROK_URL).origin;
  const tunnel = data.tunnels[0];

  if (tunnel.public_url !== expectedOrigin) {
    bad(
      `tunnel URL is ${tunnel.public_url}, expected ${expectedOrigin} ` +
        "(scripts/webhook-config.ts)",
    );
  } else if (!tunnel.config.addr.endsWith(":3000")) {
    bad(`tunnel forwards to ${tunnel.config.addr}, expected localhost:3000`);
  } else {
    ok(`${tunnel.public_url} → ${tunnel.config.addr}`);
  }
}

interface NgrokRequest {
  request: { method: string; uri: string };
  response: { status_code: number };
}

async function checkWebhookDeliveries() {
  console.log("\n3. Recent webhook deliveries (through ngrok)");
  const data = await fetchJson<{ requests: NgrokRequest[] }>(
    `${NGROK_API}/api/requests/http?limit=20`,
  );

  if (!data) {
    warn("ngrok inspector not reachable — skipping");
    return;
  }

  const hooks = data.requests.filter((r) =>
    r.request.uri.startsWith("/api/webhook"),
  );

  if (hooks.length === 0) {
    warn("no webhook deliveries recorded yet (join a call to trigger one)");
    return;
  }

  const failed = hooks.filter((r) => r.response.status_code >= 400);
  if (failed.length > 0) {
    bad(
      `${failed.length}/${hooks.length} recent deliveries failed ` +
        `(last status ${failed[0].response.status_code}) — ` +
        "usually the dev server is not on port 3000",
    );
  } else {
    ok(`last ${hooks.length} deliveries returned 2xx`);
  }
}

async function checkStreamWebhookTarget() {
  console.log("\n4. Stream webhook target");
  const apiKey = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY;
  const secret = process.env.STREAM_CHAT_SECRET_KEY;

  if (!apiKey || !secret) {
    bad("missing Stream env vars — cannot check (see .env)");
    return;
  }

  try {
    const client = StreamChat.getInstance(apiKey, secret);
    const settings = await client.getAppSettings();
    const hooks = ((settings.app as { event_hooks?: EventHook[] })
      ?.event_hooks ?? []) as EventHook[];
    const webhooks = hooks.filter((h) => h.hook_type === "webhook");

    if (webhooks.length === 0) {
      bad("no webhook hooks configured on the Stream app");
      return;
    }

    for (const hook of webhooks) {
      if (hook.webhook_url === NGROK_URL) {
        ok(`${hook.product}: points at the ngrok tunnel (local dev)`);
      } else if (hook.webhook_url === PROD_URL) {
        bad(
          `${hook.product}: points at PRODUCTION — the local agent will ` +
            "never join. Fix: npm run webhook:dev",
        );
      } else {
        bad(`${hook.product}: unexpected URL ${hook.webhook_url}`);
      }
    }
  } catch (error) {
    bad(`Stream API error: ${(error as Error).message}`);
  }
}

async function checkInngest() {
  console.log("\n5. Inngest dev server");
  if (portListening(8288)) {
    ok("listening on port 8288");
  } else {
    warn(
      "not running — transcripts/summaries won't be generated. " +
        "Start it: npm run dev:inngest",
    );
  }
}

async function checkClockSkew() {
  console.log("\n6. System clock");
  try {
    const response = await fetch("https://www.google.com", { method: "HEAD" });
    const serverDate = response.headers.get("date");
    if (!serverDate) {
      warn("could not read reference time — skipping");
      return;
    }
    // HTTP Date has 1s granularity; only flag clearly meaningful skew.
    const skewSeconds = (Date.now() - new Date(serverDate).getTime()) / 1000;
    if (Math.abs(skewSeconds) > 5) {
      warn(
        `clock is ~${Math.abs(skewSeconds).toFixed(1)}s ` +
          `${skewSeconds > 0 ? "AHEAD" : "BEHIND"} — sync it ` +
          "(Settings → Time & Language → Sync now)",
      );
    } else {
      ok(`skew ~${skewSeconds.toFixed(1)}s (fine)`);
    }
  } catch {
    warn("offline? could not check clock skew");
  }
}

async function main() {
  console.log("Meeting-AI dev doctor");

  await checkDevServer();
  await checkNgrok();
  await checkWebhookDeliveries();
  await checkStreamWebhookTarget();
  await checkInngest();
  await checkClockSkew();

  console.log(
    failures === 0
      ? "\nAll critical checks passed. If the agent still doesn't join, check .agent-debug.log."
      : `\n${failures} critical problem(s) found — fix the X lines above, top to bottom.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
