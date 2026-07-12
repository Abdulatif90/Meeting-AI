// vitest.config.ts (project root)
//
// Configured here:
// 1. The "@" alias — the codebase imports with "@/db", "@/trpc/init", etc.
// 2. "server-only" / "client-only" stubbed to an empty module (they throw
//    outside their intended runtime).
// 3. A pre-transform for .tsx files: the project tsconfig uses Next's
//    `jsx: "preserve"`, which makes vite's esbuild leave JSX untouched and
//    breaks component tests. This plugin compiles JSX itself before vite
//    sees the file.

import { defineConfig } from "vitest/config";
import { transform } from "esbuild";
import path from "path";

export default defineConfig({
  plugins: [
    {
      name: "tsx-jsx-transform",
      enforce: "pre",
      async transform(code, id) {
        if (!id.endsWith(".tsx")) return null;
        const result = await transform(code, {
          loader: "tsx",
          jsx: "automatic",
          jsxImportSource: "react",
        });
        return { code: result.code, map: result.map || null };
      },
    },
  ],
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
