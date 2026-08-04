import type { NextConfig } from "next";

// NEXT_BASE_PATH is set by the Pages workflow to the repository name so the
// exported site works from https://<user>.github.io/<repo>/.
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
};

export default nextConfig;
