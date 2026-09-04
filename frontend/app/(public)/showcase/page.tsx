import Link from "next/link";
import { Metadata } from "next";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import { SiteFooter } from "@/components/common/SiteFooter";
import { ShowcaseTabs } from "./ShowcaseTabs";

export const metadata: Metadata = {
  title: "실사용 화면 미리보기 — AEOlab",
  description: "실제 구독 사업장의 대시보드 화면을 그대로 확인하세요. 상호명만 비공개 처리했습니다.",
};

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-indigo-600 font-bold text-sm">← AEOlab</Link>
          <AuthNavControlClient />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 mb-2">
            실제 구독 사업장 화면 그대로
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            음악 교습소 사업장이 실제로 사용 중인 8개 화면입니다. 가공 없는 실제 분석 결과입니다.
          </p>
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
            <span className="text-amber-700 text-sm font-semibold">
              실제 데이터 · 상호명만 비공개 처리(OO음악학원) · 나머지는 실측 그대로
            </span>
          </div>
        </div>

        <ShowcaseTabs />

        <div className="mt-10 md:mt-14 bg-indigo-600 rounded-xl p-6 md:p-8 text-center text-white">
          <p className="text-lg md:text-xl font-black mb-1">내 가게도 이렇게 관리해 보세요</p>
          <p className="text-sm text-indigo-200 mb-4">지금 시작하면 첫 스캔부터 바로 확인할 수 있습니다</p>
          <Link
            href="/pricing"
            className="inline-block bg-white text-indigo-700 font-bold text-base px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            요금제 보기 →
          </Link>
        </div>
      </div>

      <SiteFooter activePage="/showcase" />
    </div>
  );
}
