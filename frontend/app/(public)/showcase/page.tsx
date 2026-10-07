import Link from "next/link";
import { Metadata } from "next";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import { SiteFooter } from "@/components/common/SiteFooter";
import { ShowcaseTabs } from "./ShowcaseTabs";

export const metadata: Metadata = {
  title: "화면 미리보기 — AEOlab",
  description: "AEOlab 대시보드 화면을 미리 살펴보세요. 업종·지역 분석 결과가 어떻게 보이는지 탭별로 확인할 수 있습니다.",
};

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-blue-600 font-bold text-sm">← AEOlab</Link>
          <AuthNavControlClient />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 mb-2 break-keep">
            AEOlab 화면 미리보기
          </h1>
          <p className="text-sm md:text-base text-gray-600 break-keep">
            각 탭을 클릭해 대시보드·경쟁사 관리·개선 가이드 등 주요 화면을 미리 살펴보세요.
          </p>
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mt-3">
            <span className="text-blue-700 text-sm font-semibold break-keep">
              실제 사업장 데이터로 만든 화면 · 내 사업장 상호만 'OO음악학원'으로 가렸습니다
            </span>
          </div>
        </div>

        <ShowcaseTabs />

        <div className="mt-10 md:mt-14 bg-blue-600 rounded-xl p-6 md:p-8 text-center text-white">
          <p className="text-lg md:text-xl font-black mb-1 break-keep">내 가게도 이렇게 관리해 보세요</p>
          <p className="text-sm text-blue-200 mb-4">지금 시작하면 첫 스캔부터 바로 확인할 수 있습니다</p>
          <Link
            href="/pricing"
            className="inline-block bg-white text-blue-700 font-bold text-base px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
          >
            요금제 보기 →
          </Link>
        </div>
      </div>

      <SiteFooter activePage="/showcase" />
    </div>
  );
}
