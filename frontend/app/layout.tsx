import { GEMINI_MEASUREMENT_LIVE as GEMINI_LIVE } from "@/lib/featureFlags";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import GA4 from "@/components/analytics/GA4";
import ReferralTracker from "@/components/analytics/ReferralTracker";
import KakaoSDKLoader from "@/components/common/KakaoSDKLoader";
import MobileFloatingCTA from "@/components/common/MobileFloatingCTA";
import { PLAN_PRICES } from "@/lib/plans";

// 2026-09-05: 실사용 굵기가 400~900뿐(전수 grep 확인, font-thin(100)은
// pricing/page.tsx 1곳뿐)이라 fonttools varLib.instancer로 45~930 가변축을
// 400~930으로 트리밍 — 2.06MB→1.45MB(29% 감소), 400~900 렌더링은 픽셀 단위로
// 동일함을 스크린샷 비교로 확인. weight 선언도 실제 파일 범위에 맞춤.
// 2026-10-25: 한글을 KS X 1001 2,350자 + 소스에 실제 쓰인 한글로 서브셋(1.4MB→360KB).
// 1.4MB 폰트가 JS와 대역폭을 다퉈 모바일 느린 4G에서 JS 로드가 2.3~4.5초 늦어지던 것을
// 폰트 차단 A/B로 확인(LCP·CLS 영향 없음). 서브셋 밖 한글(사용자 입력 등 희귀 글자)은 시스템 폰트로 대체 표시.
const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "400 900",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://aeolab.co.kr"),
  title: "AI 검색 노출 진단 — 내 가게 무료 체크 | AEOlab",
  description:
    "네이버·ChatGPT·구글 AI 검색에 내 가게가 나오는지 무료로 진단하고, 경쟁사 비교와 개선 방법까지 알려드립니다.",
  keywords: [
    "AI 검색 노출 진단", "AI 노출 진단 도구", "AI 검색 노출", "네이버 AI 브리핑", "ChatGPT 노출", "AEO", "AI Engine Optimization",
    "소상공인 AI", "스마트플레이스", "지역 검색 최적화", "AI 검색 마케팅",
  ],
  alternates: {
    canonical: "https://aeolab.co.kr",
    languages: { "ko-KR": "https://aeolab.co.kr" },
  },
  verification: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION
    ? { other: { "naver-site-verification": process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION } }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title: "AEOlab — AI 검색 노출 진단 서비스",
    description: "네이버·ChatGPT·구글 AI 검색에 내 가게가 나오는지 무료로 진단하고, 경쟁사 비교와 개선 방법까지 알려드립니다.",
    siteName: "AEOlab",
    locale: "ko_KR",
    type: "website",
    url: "https://aeolab.co.kr",
    // opengraph-image.tsx 파일이 Next.js App Router에서 자동으로 OG 이미지를 생성합니다.
  },
  twitter: {
    card: "summary_large_image",
    title: "AEOlab — AI 검색 노출 개선",
    description: "네이버·ChatGPT·구글 AI 검색에 내 가게가 나오는지 무료로 진단하고, 경쟁사 비교와 개선 방법까지 알려드립니다.",
    // opengraph-image.tsx 자동 적용 — 별도 images 배열 불필요
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} h-full antialiased light`}
    >
      <head>
        {/* 네이버 서치어드바이저 RSS 자동 수집용 — /feed.xml (블로그) */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="AEOlab 블로그"
          href="/feed.xml"
        />
        {/* JSON-LD: Organization + Service — SERP rich result + AI 검색 인용 보강 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://aeolab.co.kr/#organization",
                  name: "AEOlab",
                  alternateName: "AI Engine Optimization Lab",
                  url: "https://aeolab.co.kr",
                  description: "한국 소상공인을 위한 AI 검색 사업장 성장 서비스 — 네이버 AI 브리핑·ChatGPT·Gemini·Google AI 노출 진단 및 개선",
                  areaServed: { "@type": "Country", name: "South Korea" },
                },
                {
                  "@type": "WebSite",
                  "@id": "https://aeolab.co.kr/#website",
                  url: "https://aeolab.co.kr",
                  name: "AEOlab",
                  inLanguage: "ko-KR",
                  publisher: { "@id": "https://aeolab.co.kr/#organization" },
                },
                {
                  "@type": "Service",
                  "@id": "https://aeolab.co.kr/#service",
                  serviceType: "AI 검색 노출 관리 (AI Engine Optimization)",
                  provider: { "@id": "https://aeolab.co.kr/#organization" },
                  areaServed: { "@type": "Country", name: "South Korea" },
                  description: GEMINI_LIVE ? "네이버 AI 브리핑·ChatGPT·Gemini·Google 검색 4곳에서 사업장 노출을 자동 진단하고 개선 가이드를 제공" : "네이버 AI 브리핑·ChatGPT·Google 검색에서 사업장 노출을 자동 진단하고 개선 가이드를 제공",
                  offers: {
                    "@type": "AggregateOffer",
                    priceCurrency: "KRW",
                    lowPrice: String(PLAN_PRICES.basic),
                    highPrice: String(PLAN_PRICES.enterprise),
                    offerCount: String(Object.keys(PLAN_PRICES).length),
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <GA4 />
        <KakaoSDKLoader />
        <ReferralTracker />
        {children}
        {/*
         * 모바일 전용 하단 고정 CTA — 내부에서 usePathname 기반으로
         * /, /demo, /pricing 에서만 노출. /trial, /dashboard 등은 자체 제외.
         * md:hidden 로 PC에는 아예 렌더되지 않음.
         */}
        <MobileFloatingCTA />
      </body>
    </html>
  );
}
