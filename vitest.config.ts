// vitest.config.ts (project root)
//
// Two things are configured here:
// 1. The "@" alias — the codebase imports with "@/db", "@/trpc/init", etc.
//    Without it, every import inside a test fails to resolve.
// 2. "server-only" is stubbed to an empty module. Next.js code imports the
//    real "server-only" package, which throws when run outside a server
//    context (like Vitest). Aliasing it to an empty file neutralizes it.

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Neutralize server-only / client-only guards for the test runner
      "server-only": path.resolve(__dirname, "test/empty-module.ts"),
      "client-only": path.resolve(__dirname, "test/empty-module.ts"),
    },
  },
});
