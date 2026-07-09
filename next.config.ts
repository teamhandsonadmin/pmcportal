import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js dynamically resolves worker-script files relative to its own
  // package directory at runtime — Next.js's server bundler rewrites those
  // paths and breaks that resolution unless the package is left un-bundled.
  serverExternalPackages: ['tesseract.js'],
};

export default nextConfig;
