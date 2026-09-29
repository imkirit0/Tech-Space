import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root: a stray lockfile higher up the drive otherwise makes
  // Turbopack guess the wrong workspace root.
  turbopack: { root: process.cwd() },
  // Allow opening the dev server from other devices on the office LAN
  // (dev-only setting; has no effect on production builds).
  allowedDevOrigins: ["192.168.18.191", "192.168.18.*"],
  experimental: {
    serverActions: {
      // Ticket attachments: up to 4 MB per upload (Vercel caps request bodies at 4.5 MB).
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
