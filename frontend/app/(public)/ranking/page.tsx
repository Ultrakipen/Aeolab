import type { Metadata } from "next";
import Link from "next/link";
import { BarChart2 } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControl } from "@/components/common/AuthNavControl";
import RankingClient from "./RankingClient";

export const metadata: Metadata = {
  title: "업종·지역별 AI 노출 익명 랭킹 | AEOlab",
  description:
    "음식점·카페·미용 등 업종과 지역을 선택해 AI 검색 노출 익명 랭킹을 확인하세요. 사업장명 없이 순위와 백분위만 공개됩니다.",
  openGraph: {
    title: "업종·지역별 AI 노출 익명 랭킹 — AEOlab",
    description:
      "업종·지역별로 AI 검색 노출 수준을 비교하세요. 네이버 AI 브리핑·ChatGPT·Gemini·Google AI 4채널 기준.",
  },
};

export default function RankingPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">
              AEOlab
            </Link>
            <span className="text-gray-300 hidden sm:inline">/</span>
            <span className="text-sm text-gray-500 hidden sm:inline">AI 노출 랭킹</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/trial"
              className="hidden sm:block text-sm text-gray-600 hover:text-gray-900"
            >
              무료 체험
            </Link>
            <AuthNavControl />
          </div>
        </div>
      </header>

      {/* 페이지 타이틀 영역 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-10">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-blue-600">익명 랭킹 공개</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            업종·지역별 AI 검색 노출 랭킹
          </h1>
          <p className="text-sm md:text-base text-gray-500 leading-relaxed break-keep">
            네이버 AI 브리핑·ChatGPT·Gemini·Google AI 4채널 기준으로 집계한 익명 랭킹입니다.
            사업장명·점수 원본은 공개되지 않으며, 순위와 백분위만 표시됩니다.
          </p>
        </div>
      </div>

      {/* 클라이언트 인터랙티브 영역 */}
      <RankingClient />

      <SiteFooter activePage="/ranking" />
    </main>
  );
}
