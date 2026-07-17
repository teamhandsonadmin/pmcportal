import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js dynamically resolves worker-script files relative to its own
  // package directory at runtime — Next.js's server bundler rewrites those
  // paths and breaks that resolution unless the package is left un-bundled.
  serverExternalPackages: ['tesseract.js'],

  // /hvac/* was the task detail route's original name, a leftover from when
  // this app only tracked HVAC tasks — renamed to /tasks/* since it now
  // covers every trade. This is a real app with already-shared /hvac links
  // (bookmarks, chat history, etc.), so the old path permanently redirects
  // rather than 404ing. Does NOT touch the HvacTask Prisma model or table —
  // that rename is a separate, much larger concern this isn't attempting.
  async redirects() {
    return [
      {
        source: '/hvac',
        destination: '/tasks',
        permanent: true,
      },
      {
        source: '/hvac/:path*',
        destination: '/tasks/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
