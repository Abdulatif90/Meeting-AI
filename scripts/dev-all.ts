/**
 * Starts the whole local dev stack in ONE terminal with prefixed output:
 *
 *   [next]     npm run dev          (port 3000 — guarded by predev)
 *   [ngrok]    npm run dev:webhook  (tunnel → localhost:3000)
 *   [inngest]  npm run dev:inngest  (background jobs / summaries)
 *
 * Ctrl+C stops everything. If any process dies, the rest are shut down too,
 * so no orphan keeps port 3000 busy for the next run.
 *
 *   npm run dev:all
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";

const tasks = [
  { name: "next", script: "dev" },
  { name: "ngrok", script: "dev:webhook" },
  { name: "inngest", script: "dev:inngest" },
];

const pad = Math.max(...tasks.map((t) => t.name.length));
const children: ChildProcess[] = [];
let shuttingDown = false;

function shutdown(code: number) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      // Kill the whole tree — plain child.kill() leaves the npm shell's
      // grandchildren (node/ngrok) alive, holding port 3000 hostage.
      try {
        execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
      } catch {
        /* already gone */
      }
    } else {
      child.kill("SIGINT");
    }
  }
  process.exit(code);
}

for (const task of tasks) {
  const prefix = `[${task.name.padEnd(pad)}] `;
  const child = spawn("npm", ["run", task.script], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);

  const forward = (stream: NodeJS.ReadableStream, out: NodeJS.WriteStream) => {
    let buffer = "";
    stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        out.write(prefix + buffer.slice(0, newlineIndex + 1));
        buffer = buffer.slice(newlineIndex + 1);
      }
    });
  };

  if (child.stdout) forward(child.stdout, process.stdout);
  if (child.stderr) forward(child.stderr, process.stderr);

  child.on("exit", (code) => {
    console.log(`${prefix}exited (code ${code ?? "?"})`);
    shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
