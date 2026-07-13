/**
 * Fails fast when the given port is already taken.
 *
 * Wired as the `predev` hook: without it `next dev` silently falls back to
 * 3001 when 3000 is busy — but ngrok keeps forwarding webhooks to 3000, so
 * every Stream event 502s and the AI agent never joins the call.
 *
 *   npm run dev          # runs this automatically via predev
 *   tsx scripts/ensure-port.ts 3000
 */
import net from "node:net";
import { execSync } from "node:child_process";

const port = Number(process.argv[2] ?? "3000");

function windowsListeningPids(): string[] {
  const pids = new Set<string>();

  for (const proto of ["tcp", "tcpv6"]) {
    let output = "";
    try {
      output = execSync(`netstat -ano -p ${proto}`, { encoding: "utf8" });
    } catch {
      continue;
    }

    for (const line of output.split(/\r?\n/)) {
      const columns = line.trim().split(/\s+/);
      // TCP  0.0.0.0:3000  0.0.0.0:0  LISTENING  1234
      if (
        columns.length >= 5 &&
        columns[3] === "LISTENING" &&
        columns[1].endsWith(`:${port}`)
      ) {
        pids.add(columns[4]);
      }
    }
  }

  return [...pids];
}

function processName(pid: string): string {
  try {
    const csv = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: "utf8",
    });
    const name = csv.split(",")[0]?.replace(/"/g, "").trim();
    return name && name !== "INFO:" ? name : "unknown";
  } catch {
    return "unknown";
  }
}

function failBusy(details: string[]) {
  console.error(`\n✖ Port ${port} is already in use:`);
  for (const detail of details) {
    console.error(`    ${detail}`);
  }
  console.error(
    `\n  If next dev fell back to another port, ngrok would still forward\n` +
      `  webhooks to ${port} — Stream events would 502 and the AI agent\n` +
      `  would never join the call.\n\n` +
      `  Free the port first (taskkill /PID <pid> /F), then run dev again.\n`,
  );
  process.exit(1);
}

if (process.platform === "win32") {
  const pids = windowsListeningPids();
  if (pids.length > 0) {
    failBusy(pids.map((pid) => `${processName(pid)} (PID ${pid})`));
  }
  process.exit(0);
} else {
  // Non-Windows fallback: try to bind the port.
  const probe = net.createServer();
  probe.once("error", () => failBusy([`another process is listening`]));
  probe.once("listening", () => {
    probe.close(() => process.exit(0));
  });
  probe.listen(port);
}
