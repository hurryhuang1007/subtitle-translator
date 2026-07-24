import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', '@prisma/client', '@prisma/adapter-better-sqlite3'],
};

export default nextConfig;
