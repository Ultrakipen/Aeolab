import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GA4 from "@/components/analytics/GA4";
import ReferralTracker from "@/components/analytics/ReferralTracker";
import KakaoSDKLoader from "@/components/common/KakaoSDKLoader";
import MobileFloatingCTA from "@/components/common/MobileFloatingCTA";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  title: "AEOlab — AI 검색 시대, 내 가게는 보이고 있을까요?",
  description:
    "네이버 AI 브리핑·ChatGPT·Gemini·Google AI Overview 4채널에서 내 사업장 노출 여부를 자동 진단합니다. 음식점·카페·미용·교육 등 25개 업종 지원. 경쟁사 비교·키워드 갭 분석·AI 개선 가이드 제공. 한국 소상공인 AI 검색 노출 관리 서비스.",
  keywords: [
    "AI 검색 노출", "네이버 AI 브리핑", "ChatGPT 노출", "AEO", "AI Engine Optimization",
    "소상공인 AI", "스마트플레이스", "지역 검색 최적화", "AI 검색 마케팅",
  ],
  alternates: {
    canonical: "https://aeolab.co.kr",
    languages: { "ko-KR": "https://aeolab.co.kr" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title: "AEOlab — AI 검색 노출 진단 서비스",
    description: "네이버 AI 브리핑·ChatGPT·Gemini·Google AI 4채널이 내 가게를 발견할 수 있는지 자동 진단 · 경쟁사 비교 · 개선 가이드",
    siteName: "AEOlab",
    locale: "ko_KR",
    type: "website",
    url: "https://aeolab.co.kr",
    // opengraph-image.tsx 파일이 Next.js App Router에서 자동으로 OG 이미지를 생성합니다.
  },
  twitter: {
    card: "summary_large_image",
    title: "AEOlab — AI 검색 노출 최적화",
    description: "네이버·ChatGPT·Gemini·Google AI 4채널 노출 여부 자동 진단 · 경쟁사 벤치마킹 · 개선 가이드",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
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
                  description: "한국 소상공인을 위한 AI 검색 사업장 성장 플랫폼 — 네이버 AI 브리핑·ChatGPT·Gemini·Google AI 노출 진단 및 개선",
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
                  description: "네이버 AI 브리핑·ChatGPT·Gemini·Google AI Overview 4종 채널에서 사업장 노출을 자동 진단하고 개선 가이드를 제공",
                  offers: {
                    "@type": "AggregateOffer",
                    priceCurrency: "KRW",
                    lowPrice: "9900",
                    highPrice: "200000",
                    offerCount: "5",
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
