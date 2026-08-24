import type { NextConfig } from "next";
import path from "path";

// CSP: izinkan self + inline style (komponen pakai style={{}}) + next/font self-hosted.
// 'unsafe-inline' untuk script dibutuhkan Next App Router (hydration inline). connect-src 'self'
// cukup selama fitur kamera/analyze mati; tambah URL backend di sini saat diaktifkan.
// React dev mode butuh eval() untuk debugging — hanya di dev, JANGAN di production.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Folder induk punya node_modules+lockfile sendiri → Turbopack salah tebak root.
  turbopack: { root: path.resolve(__dirname) },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=self, microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
