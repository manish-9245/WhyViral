/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ["*"] } },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // Crawlee + Playwright are server-only and heavy — don't bundle for client, keep external
  serverExternalPackages: ["crawlee", "playwright", "playwright-core"],
};
export default nextConfig;
