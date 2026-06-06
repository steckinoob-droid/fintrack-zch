import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
  webpack: (config) => {
    // pdfjs-dist uses canvas in Node.js — not needed in the browser
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
