import type { Metadata } from "next";
import Link from "next/link";
import { KEYWORD_PAGES, REGION_GROUPS } from "@/lib/keywords-data";

export const metadata: Metadata = {
  title: "지역별 AI 검색 노출 현황 분석 | AEOlab",
  description:
    "창원·김해·부산·서울·수원·대구 등 지역별, 맛집·카페·미용실·헬스장 업종별 AI 검색 노출 현황과 핵심 키워드를 분석합니다.",
  openGraph: {
    title: "지역별 AI 검색 노출 현황 분석 | AEOlab",
    description:
      "창원·김해·부산·서울 등 지역별 AI 검색 노출 현황과 핵심 키워드를 분석합니다.",
  },
};

const competitionColors: Record<string, string> = {
  높음: "bg-red-100 text-red-700",
  중간: "bg-yellow-100 text-yellow-700",
  낮음: "bg-green-100 text-green-700",
};

export default function KeywordsIndexPage() {
  // 지역 그룹별로 페이지를 분류
  const groupedPages = Object.entries(REGION_GROUPS).map(([groupName, regions]) => {
    const pages = KEYWORD_PAGES.filter((p) => regions.includes(p.region));
    return { groupName, pages };
  });

  const totalCount = KEYWORD_PAGES.length;

  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-4 py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">
            AEOlab
          </Link>
          <Link
            href="/trial"
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            무료 진단 시작
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14">
        {/* 상단 타이틀 */}
        <div className="mb-10">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-gray-700">
              홈
            </Link>
            <span>/</span>
            <span className="text-gray-900">키워드 분석</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 break-keep">
            지역별 AI 검색 노출 현황 분석
          </h1>
          <p className="text-base text-gray-600 leading-relaxed break-keep">
            ChatGPT·네이버 AI 브리핑이 각 지역·업종을 추천하는 방식과 핵심
            키워드를 분석합니다. 현재 {totalCount}개 지역·업종 조합을 다루고
            있습니다.
          </p>
        </div>

        {/* 통계 요약 */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <div className="text-center bg-blue-50 rounded-xl p-4">
            <p className="text-2xl md:text-3xl font-bold text-blue-700">
              {totalCount}
            </p>
            <p className="text-sm text-blue-600 mt-1">분석 페이지</p>
          </div>
          <div className="text-center bg-indigo-50 rounded-xl p-4">
            <p className="text-2xl md:text-3xl font-bold text-indigo-700">
              {Object.keys(REGION_GROUPS).length}
            </p>
            <p className="text-sm text-indigo-600 mt-1">지역 그룹</p>
          </div>
          <div className="text-center bg-violet-50 rounded-xl p-4">
            <p className="text-2xl md:text-3xl font-bold text-violet-700">4</p>
            <p className="text-sm text-violet-600 mt-1">분석 업종</p>
          </div>
        </div>

        {/* 지역별 섹션 */}
        {groupedPages.map(({ groupName, pages }) => (
          <section key={groupName} className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-xl font-bold text-gray-900">{groupName}</h2>
              <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {pages.length}개
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {pages.map((page) => {
                const badgeClass =
                  competitionColors[page.competitionLevel] ??
                  "bg-gray-100 text-gray-700";
                return (
                  <Link
                    key={page.slug}
                    href={`/keywords/${page.slug}`}
                    className="group block p-5 border border-gray-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    {/* 배지 */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}
                      >
                        경쟁 {page.competitionLevel}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {page.category}
                      </span>
                    </div>

                    {/* 제목 */}
                    <h3 className="text-base font-bold text-gray-900 mb-2 break-keep group-hover:text-blue-700 transition-colors line-clamp-2">
                      {page.title}
                    </h3>

                    {/* 설명 */}
                    <p className="text-sm text-gray-500 break-keep line-clamp-2 mb-3">
                      {page.description}
                    </p>

                    {/* 키워드 미리보기 */}
                    <div className="flex flex-wrap gap-1">
                      {page.keywords.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200"
                        >
                          {kw}
                        </span>
                      ))}
                      <span className="text-xs text-gray-400 px-1 py-0.5">
                        +{page.keywords.length - 3}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {/* CTA */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 md:p-10 text-center text-white">
          <h2 className="text-xl md:text-2xl font-bold mb-2 break-keep">
            내 가게 AI 노출 점수를 지금 확인하세요
          </h2>
          <p className="text-blue-100 text-sm md:text-base mb-6 break-keep">
            위 지역·업종 기준으로 ChatGPT·네이버 AI 브리핑이 내 가게를 추천하는지
            30초 안에 자동 진단합니다
          </p>
          <Link
            href="/trial"
            className="inline-block bg-white text-blue-700 font-bold text-base px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            내 가게 무료 진단 시작
          </Link>
          <p className="text-xs text-blue-200 mt-3">
            가입 없이 · 카드 없이 · 30초
          </p>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="border-t border-gray-100 py-6 px-4 mt-6">
        <div className="max-w-5xl mx-auto text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">
            AEOlab 홈으로
          </Link>
          <span className="mx-2">·</span>
          <Link href="/blog" className="hover:text-gray-700">
            블로그
          </Link>
          <span className="mx-2">·</span>
          <Link href="/trial" className="hover:text-gray-700">
            무료 진단
          </Link>
        </div>
      </footer>
    </main>
  );
}
