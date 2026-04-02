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
  title: "AEOlab — AI가 내 가게를 추천하게 만드는 서비스",
  description:
    "ChatGPT·네이버 AI·구글·Perplexity·Grok·Claude 7개 AI에서 내 사업장 노출을 자동 추적하고 개선 가이드를 제공합니다. 한국 소상공인 AI 검색 최적화 플랫폼.",
  openGraph: {
    title: "AEOlab — AI 검색 노출 최적화",
    description: "7개 AI 플랫폼에서 내 가게가 추천되는지 자동 추적 · 경쟁사 벤치마킹 · 개선 가이드",
    siteName: "AEOlab",
    images: [{ url: "https://aeolab.co.kr/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AEOlab — AI 검색 노출 최적화",
    description: "7개 AI 플랫폼에서 내 가게가 추천되는지 자동 추적 · 경쟁사 벤치마킹 · 개선 가이드",
    images: ["https://aeolab.co.kr/og-image.png"],
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
