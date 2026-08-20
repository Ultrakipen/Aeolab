import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV || "production",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // 봇/스캐너가 Next-Action 헤더에 임의 값("x","0","1" 등)을 넣어 서버 액션을
    // 무작위로 두드리는 트래픽 — 앱 크래시 없이 Next.js가 정상 처리하는 무해한
    // 패턴이나 조용히 Sentry 쿼터만 소모해 실제 오류 신호를 희석시킴 (2026-08-21 발견).
    ignoreErrors: [/Server Reference ID did not match the expected format/],
  });
}
