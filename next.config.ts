import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },

  // Tree-shake barrel imports from large packages so only the icons/functions
  // actually used are bundled (lucide-react is imported in ~40 files).
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
  },

  // ── Webpack (Next.js ≤15 / --webpack flag) ───────────────────────────────
  // pdfjs-dist optionally requires 'canvas' for Node.js server rendering.
  // We never use it server-side, so alias it to false to drop it from the bundle.
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  // ── Turbopack (Next.js 16 default) ──────────────────────────────────────
  // Same canvas alias expressed in Turbopack's resolveAlias syntax.
  // We point to an empty shim so the import resolves without native bindings.
  turbopack: {
    resolveAlias: {
      canvas: path.resolve("./src/lib/utils/canvas-shim.ts"),
    },
  },
};

export default nextConfig;
