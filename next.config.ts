import type { NextConfig } from "next";

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  experimental: {},
};

export default nextConfig;

function normalizeBasePath(value: string | undefined) {
  const cleaned = value?.trim().replace(/^\/+|\/+$/g, "");
  return cleaned ? `/${cleaned}` : "";
}
