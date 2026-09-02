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
  async redirects() {
    // /resources는 /guide/channels의 더 오래된 중복 콘텐츠(10개 업종, duel-track 모델 미반영).
    // 2026-09-03 두 시스템 병존으로 인한 콘텐츠 drift·내비게이션 혼선 확인 후 통합 —
    // 더 나은 체크리스트 문구는 /guide/channels 쪽 10개 업종에 먼저 반영 완료.
    return [
      { source: "/resources", destination: "/guide/channels", permanent: true },
      { source: "/resources/:category", destination: "/guide/channels/:category", permanent: true },
    ];
  },
  async headers() {
    // backend(main.py SecurityHeadersMiddleware)는 /api·/health 등 FastAPI 응답에만 적용되고
    // Next.js가 렌더링하는 로그인·가입·대시보드 등 사용자 화면 HTML에는 전혀 적용되지 않아 추가함.
    //
    // CSP는 2026-08-23 Report-Only로 먼저 배포해 Playwright 실측(로그인·가입·요금제 결제모달
    // 클릭→실제 카드입력 iframe까지 진입)으로 위반 목록을 수집·보정 후 강제 적용(Content-Security-Policy)
    // 으로 전환 완료 — 전환 직전 동일 플로우 재실측으로 OUR 정책 위반 0건 확인(Toss 자체 sandbox
    // 페이지의 자기 CSP 위반은 그들 도메인 소관이라 무관). 외부기준(OWASP CSP 가이드) 대조 결과
    // nonce 기반 strict-dynamic은 App Router 미들웨어 재작업이
    // 커서 1차는 allowlist 방식(script-src에 'unsafe-inline' 포함 — 백엔드 main.py CSP와 동일 절충).
    // 실측 도메인(1차 추정과 실제가 달랐던 것 위주로 기록):
    //   - Toss: SDK가 런타임에 <script src="https://js.tosspayments.com/v1">를 직접 주입함
    //     (번들 내장 추정이 오판이었음, 실측으로 발견) — script-src에 추가.
    //     결제창은 실제로 iframe(payment-gateway-sandbox.tosspayments.com)으로 뜸 — frame-src 확인.
    //   - Kakao SDK: t1.kakaocdn.net (SRI 고정, KakaoSDKLoader.tsx)
    //   - GA4/Google Ads: gtag.js가 googletagmanager.com 외에 analytics.google.com·
    //     stats.g.doubleclick.net(리마케팅 오디언스)·google.co.kr(ads-audiences 픽셀)까지 호출함
    //     (google-analytics.com만으로는 부족 — 실측으로 발견, *.google.com/*.doubleclick.net으로 포괄)
    //     ※ 2026-08-23 강제적용 후 재검증 중 /admin에서 google.co.kr 픽셀이 실제 차단(Report-Only
    //     때는 "수용 가능한 공백"으로 문서화만 했으나 실측으로 실제 발생 확인) — AEOlab 사용자는
    //     거의 전원 한국(ko-kr)이라 google.co.kr을 명시 추가함(다른 국가 TLD는 트래픽 없어 배제)
    //   - Supabase: 브라우저가 직접 호출(REST+Storage), duqepesuqquqffqvlkxf.supabase.co
    //   - Sentry: instrumentation-client.ts → ingest.us.sentry.io
    //   - Cloudflare: static.cloudflareinsights.com (엣지에서 자동 주입되는 beacon)
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://t1.kakaocdn.net https://static.cloudflareinsights.com https://js.tosspayments.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://duqepesuqquqffqvlkxf.supabase.co https://t1.kakaocdn.net https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com https://*.google.co.kr https://*.doubleclick.net",
      "font-src 'self' data:",
      // *.analytics.google.com은 서브도메인만 매칭하고 루트 도메인 자체(analytics.google.com,
      // 실측된 gtag.js 수집 엔드포인트)는 못 잡아 별도로 명시 필요(실측으로 발견한 CSP 와일드카드 함정)
      "connect-src 'self' https://duqepesuqquqffqvlkxf.supabase.co https://*.ingest.us.sentry.io https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://*.googletagmanager.com https://*.doubleclick.net https://*.tosspayments.com https://static.cloudflareinsights.com",
      "frame-src 'self' https://*.tosspayments.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=()" },
          { key: "Content-Security-Policy", value: cspDirectives },
        ],
      },
    ];
  },
};

export default nextConfig;
