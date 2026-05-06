"use client";

import Script from "next/script";

/**
 * Google Analytics 4 측정 컴포넌트
 *
 * - NEXT_PUBLIC_GA4_ID 환경변수가 없으면 아무것도 렌더링하지 않음 (개발/스테이징 안전)
 * - Enhanced Measurement (스크롤 뎁스·외부 링크 클릭 등)는 GA4 콘솔에서 기본 활성화되어 있어
 *   별도 코드가 필요 없음
 * - 페이지뷰는 send_page_view: true 로 명시 (Next.js App Router는 기본 자동 전송)
 */
export default function GA4() {
  const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

  if (!GA4_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA4_ID}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}
