import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@mind-studio/core", "@mind-studio/ui"],
};

export default nextConfig;
