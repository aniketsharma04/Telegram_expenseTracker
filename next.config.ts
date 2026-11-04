import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Card faces live in public/cards (src/lib/cards/art.ts); the optimiser
    // resizes them for the app and caches each size for 30 days.
    localPatterns: [{ pathname: "/cards/**", search: "" }],
    minimumCacheTTL: 2_592_000,
    formats: ["image/webp"],
  },
};

export default nextConfig;
