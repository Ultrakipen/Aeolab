"use client";

import Script from "next/script";

/**
 * Kakao JS SDK 로더 — app/layout.tsx에서 1회만 렌더.
 *
 * - strategy="afterInteractive" : 페이지가 인터랙티브 상태가 된 후 로드 (LCP 영향 최소)
 * - onLoad에서 Kakao.init() 호출. 이미 초기화된 경우 skip
 * - 환경변수 우선순위: NEXT_PUBLIC_KAKAO_APP_KEY → NEXT_PUBLIC_KAKAO_JS_KEY (레거시)
 *   키가 없으면 SDK 자체를 로드하지 않음 — KakaoShareButton은 clipboard fallback으로 동작
 *
 * SDK 무결성(SRI): 2.7.2 공식 integrity 해시를 고정해 공급망 공격 차단.
 * 카카오가 SDK 버전을 올릴 경우 integrity도 함께 갱신해야 함.
 */
const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
const KAKAO_SDK_INTEGRITY =
  "sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4";

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share?: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

export default function KakaoSDKLoader() {
  const appKey =
    process.env.NEXT_PUBLIC_KAKAO_APP_KEY ||
    process.env.NEXT_PUBLIC_KAKAO_JS_KEY ||
    "";

  if (!appKey) return null;

  return (
    <Script
      id="kakao-sdk"
      src={KAKAO_SDK_URL}
      integrity={KAKAO_SDK_INTEGRITY}
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onLoad={() => {
        try {
          if (window.Kakao && !window.Kakao.isInitialized()) {
            window.Kakao.init(appKey);
          }
        } catch {
          // init 실패 시에도 앱 전체는 정상 동작해야 함 → 무시
        }
      }}
    />
  );
}
