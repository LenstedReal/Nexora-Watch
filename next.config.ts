import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pg",
    "playwright-core",
    "@sparticuz/chromium-min",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
    proxyClientMaxBodySize: "2gb",
  },
};

export default nextConfig;
