/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig = {
  ...(isStaticExport
    ? {
        output: 'export',
        env: { NEXT_PUBLIC_STATIC_EXPORT: 'true' },
      }
    : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  // Keep compile workers low on constrained CI (Vercel) to avoid OOM worker crashes.
  experimental: {
    cpus: 1,
  },
};

module.exports = nextConfig;
