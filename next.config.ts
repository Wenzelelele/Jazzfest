import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build-Kennung für den Service Worker: jede neue Vercel-Version bekommt
  // einen eigenen Cache-Namen, alte Caches werden beim Aktivieren gelöscht
  // (siehe public/sw.js). Lokal/ohne Vercel bleibt es bei "dev".
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
};

export default nextConfig;
