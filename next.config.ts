import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const production =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production" ||
  process.env.NEXT_PUBLIC_APP_ENV === "production";

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(production
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.STATICS_NEXT_DIST_DIR || ".next",
  typescript: {
    tsconfigPath: process.env.STATICS_NEXT_TSCONFIG || "tsconfig.json",
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
