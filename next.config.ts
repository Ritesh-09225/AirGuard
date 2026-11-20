import type { NextConfig } from "next";

/**
 * Security headers applied to every route (defense-in-depth on top of
 * validation, rate limiting and the no-raw-HTML rendering policy).
 *
 * Framing policy: this app is embedded cross-origin by the sandbox preview
 * panel, so `X-Frame-Options: DENY` (which would show the browser's
 * "refused to connect" error in that panel) is deliberately NOT set.
 * `frame-ancestors *` keeps the restriction expressible and upgradeable: a
 * production deployment with accounts or one-click destructive actions must
 * pin it to the trusted parent origin. The app holds no sessions, no PII and
 * no irreversible UI actions, so clickjacking surface is negligible here.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors *" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
