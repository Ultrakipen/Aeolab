import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";

// 문의 글은 검색 결과에 노출할 가치가 없고, 공개 제목이 스팸 SEO 대상이 되지 않도록 색인 제외
// (크롤은 허용해야 noindex가 읽힌다 — login/signup과 동일 방식)
export const metadata: Metadata = {
  title: "문의·건의 게시판 | AEOlab",
  description: "AEOlab 이용 문의, 건의, 제휴·광고 문의를 남겨 주세요. 로그인 없이 작성할 수 있습니다.",
  robots: { index: false, follow: true },
};

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-600">AEOlab</span>
            <span className="text-sm text-gray-600 hidden sm:block">네이버·ChatGPT·Google AI 노출 관리</span>
          </Link>
          <nav className="flex items-center gap-3 lg:gap-6">
            <Link href="/faq" className="hidden md:block text-base text-gray-600 hover:text-gray-900">
              FAQ
            </Link>
            <Link href="/pricing" className="hidden sm:block text-base text-gray-600 hover:text-gray-900">
              요금제
            </Link>
            <Link
              href="/board"
              className="hidden md:block text-base text-blue-600 font-semibold"
              aria-current="page"
            >
              문의
            </Link>
            <AuthNavControlClient />
            <Link
              href="/trial"
              className="bg-blue-600 text-white text-sm md:text-base px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold whitespace-nowrap"
            >
              무료 진단 시작
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <SiteFooter activePage="/board" />
    </main>
  );
}
