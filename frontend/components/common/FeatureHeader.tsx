import Link from "next/link";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import FeatureNav from "@/components/common/FeatureNav";

// 헤더 + 주요 메뉴(PC 인라인, 모바일 가로 줄) — 별도 헤더가 없는 도구 페이지(광고비 비교·키워드 생성기)에 붙여 쓴다
export default function FeatureHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xl font-bold text-blue-600 md:text-2xl">
              AEOlab
            </Link>
            <FeatureNav variant="inline" />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/trial" className="hidden min-h-[44px] items-center text-sm text-gray-600 hover:text-gray-900 sm:inline-flex">
              무료 체험
            </Link>
            <AuthNavControlClient />
          </div>
        </div>
      </header>
      <FeatureNav variant="row" />
    </>
  );
}
