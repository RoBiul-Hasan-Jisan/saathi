// The browser only ever talks to this Next.js server. Everything under /api is forwarded to the
// separate backend, so cookies are same-origin (no CORS or cookie headaches in development or on Vercel).
const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
