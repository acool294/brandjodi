import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source; Next compiles it.
  transpilePackages: ["@brandjodi/shared"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
