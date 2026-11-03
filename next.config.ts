import type { NextConfig } from "next";
import { CARD_ART_HOSTS } from "./src/lib/cards/art";

const nextConfig: NextConfig = {
  images: {
    // Card faces from the banks' own sites (src/lib/cards/art.ts), resized
    // and cached here so the app never hot-links a bank and each image is
    // fetched from the bank about once a month.
    remotePatterns: CARD_ART_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
    minimumCacheTTL: 2_592_000,
    formats: ["image/webp"],
  },
};

export default nextConfig;
