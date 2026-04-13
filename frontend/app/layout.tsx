import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
};

export const metadata: Metadata = {
  metadataBase: new URL("https://aeolab.co.kr"),
  title: "AEOlab — AI 검색 시대, 내 가게는 보이고 있을까요?",
  description:
    "네이버 AI 브리핑·카카오맵·ChatGPT 3채널에서 내 사업장 노출 여부를 자동 진단하고 개선 방법을 알려드립니다. 한국 소상공인 AI 검색 노출 관리 서비스.",
  openGraph: {
    title: "AEOlab — AI 검색 노출 진단 서비스",
    description: "네이버 AI 브리핑이 내 가게를 발견할 수 있는지 자동 진단 · 경쟁사 비교 · 개선 가이드",
    siteName: "AEOlab",
    // opengraph-image.tsx 파일이 Next.js App Router에서 자동으로 OG 이미지를 생성합니다.
    // 정적 URL 참조 불필요 — Next.js가 /opengraph-image 경로를 자동 등록합니다.
  },
  twitter: {
    card: "summary_large_image",
    title: "AEOlab — AI 검색 노출 최적화",
    description: "네이버·카카오·ChatGPT 3채널 노출 여부 자동 진단 · 경쟁사 벤치마킹 · 개선 가이드",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
