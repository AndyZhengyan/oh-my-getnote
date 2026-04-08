import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@lancedb/lancedb', 'openai'],
};

export default nextConfig;
