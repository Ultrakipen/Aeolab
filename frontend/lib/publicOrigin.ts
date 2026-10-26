import type { NextRequest } from "next/server";

// 서버 라우트에서 리디렉션할 "공개 주소"를 구한다.
// 배경(2026-10-26): nginx 뒤의 Next.js는 request.url의 호스트를 내부 주소(localhost:3000)로 계산해,
// `new URL(request.url).origin`으로 리디렉션하면 인증 후 https://localhost:3000/... 로 이동했다.
// → nginx가 전달하는 Host(또는 X-Forwarded-Host)를 쓰되, 허용 도메인 목록에 없으면 NEXT_PUBLIC_APP_URL로 대체
//   (Host 헤더 조작으로 외부 사이트로 리디렉션되는 것을 방지).
const ALLOWED_HOSTS = new Set(["aeolab.co.kr", "www.aeolab.co.kr"]);

export function getPublicOrigin(request: NextRequest): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://aeolab.co.kr").replace(/\/$/, "");

  // 개발 환경은 요청 주소를 그대로 사용
  if (process.env.NODE_ENV === "development") {
    return new URL(request.url).origin;
  }

  const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const host = rawHost.split(",")[0].trim().toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return appUrl;

  const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  return `${proto === "http" ? "http" : "https"}://${host}`;
}
