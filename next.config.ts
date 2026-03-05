import type { NextConfig } from "next";

const devRewrites =
  process.env.NODE_ENV === "development"
    ? {
        async rewrites() {
          const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-afl-model-site";
          const region = process.env.FIREBASE_FUNCTIONS_REGION ?? "australia-southeast1";

          return [
            {
              source: "/api/genie",
              destination: `http://127.0.0.1:5001/${projectId}/${region}/genieProxy`,
            },
          ];
        },
      }
    : {};

const nextConfig: NextConfig = {
  output: "export",
  ...devRewrites,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
