import type { NextConfig } from "next";
import path from "path";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

const DEFAULT_PROFILE_PICTURE_URL = "https://desti-profile-pictures.desti.workers.dev";

function buildProfilePictureRemotePatterns(): RemotePattern[] {
  const candidates = [
    process.env.WORKER_UPLOAD_URL,
    DEFAULT_PROFILE_PICTURE_URL,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const seen = new Set<string>();

  return candidates.flatMap((candidate) => {
    try {
      const url = new URL(candidate);
      const pathname = url.pathname === "/" ? "/**" : `${url.pathname.replace(/\/+$/, "")}/**`;
      const key = `${url.protocol}//${url.hostname}:${url.port}${pathname}`;

      if (seen.has(key)) {
        return [];
      }

      seen.add(key);

      return [
        {
          protocol: url.protocol.replace(":", "") as "http" | "https",
          hostname: url.hostname,
          port: url.port || undefined,
          pathname,
        },
      ];
    } catch {
      return [];
    }
  });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildProfilePictureRemotePatterns(),
  },
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
