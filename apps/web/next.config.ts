import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma', '@prisma/adapter-pg', 'pg'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
