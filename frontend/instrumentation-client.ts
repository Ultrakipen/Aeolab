// Sentry SDK(브라우저 트레이싱 포함, gzip ~130KB)를 정적 import하면 모든 페이지의
// 초기 스크립트 목록에 포함돼 랜딩페이지 파싱 부담이 커진다(2026-08-01 실측,
// docs/site_speed_inspection_v1.0.md). tracesSampleRate로는 이 번들 크기를 줄일 수
// 없음을 SDK 소스(getDefaultIntegrations)로 직접 확인 — 대신 동적 import로 별도
// 청크로 분리하고 hydration 이후(idle 시점)에 로드해 초기 파싱 경로에서 제외한다.
// 트레이드오프: 이 지연 구간(수백ms) 동안 발생하는 에러는 캡처되지 않을 수 있음.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  const initSentry = () => {
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_APP_ENV || "production",
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
      });
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(initSentry, { timeout: 3000 });
  } else {
    setTimeout(initSentry, 1);
  }
}
