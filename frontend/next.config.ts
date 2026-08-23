import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.219.51"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "duqepesuqquqffqvlkxf.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    // backend(main.py SecurityHeadersMiddleware)는 /api·/health 등 FastAPI 응답에만 적용되고
    // Next.js가 렌더링하는 로그인·가입·대시보드 등 사용자 화면 HTML에는 전혀 적용되지 않아 추가함.
    // CSP는 Toss 결제위젯·Kakao SDK·GA4 등 외부 스크립트 allowlist 설계가 필요해 별도 검토 후 추가.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
