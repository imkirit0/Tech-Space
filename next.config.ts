import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root: a stray lockfile higher up the drive otherwise makes
  // Turbopack guess the wrong workspace root.
  turbopack: { root: process.cwd() },
  // Lets a second dev server (e.g. one pointed at the local test database) run
  // beside the main one, with its own build folder: NEXT_DIST_DIR=.next-test next dev -p 3210
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Allow opening the dev server from other devices on the office LAN
  // (dev-only setting; has no effect on production builds).
  // "*.*.*.*" = any IPv4 address (a bare "*" is rejected by Next).
  allowedDevOrigins: ["*.*.*.*"],
  experimental: {
    serverActions: {
      // Ticket attachments: up to 4 MB per upload (Vercel caps request bodies at 4.5 MB).
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
