import path from "node:path";
import type { NextConfig } from "next";

// Stream's video SDK pulls in @mediapipe/tasks-vision (background blur). Point
// it at the ESM bundle so bundlers resolve a single, correct entry.
const mediapipeAbsolute = path.resolve(
  process.cwd(),
  "node_modules/@mediapipe/tasks-vision/vision_bundle.mjs",
);
// Turbopack's resolveAlias rejects absolute Windows paths
// ("windows imports are not implemented yet"), so it needs a project-relative
// path instead.
const mediapipeRelative =
  "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";

const nextConfig: NextConfig = {
  // Stream's video SDK does not tolerate React StrictMode's double-invoked
  // effects in dev: the extra mount/unmount leaves the call (breaking video and
  // throwing "Cannot leave call that has already been left"). This behaviour is
  // dev-only; disabling StrictMode makes dev match production for the call flow.
  reactStrictMode: false,
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["@mediapipe/tasks-vision$"] = mediapipeAbsolute;
    return config;
  },
  turbopack: {
    resolveAlias: {
      "@mediapipe/tasks-vision": mediapipeRelative,
    },
  },
};

export default nextConfig;
