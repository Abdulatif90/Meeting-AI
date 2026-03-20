import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};

    config.resolve.alias["@mediapipe/tasks-vision$"] = path.resolve(
      process.cwd(),
      "node_modules/@mediapipe/tasks-vision/vision_bundle.mjs",
    );

    return config;
  },
};

export default nextConfig;
