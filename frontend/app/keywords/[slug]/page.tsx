import { notFound } from "next/navigation";
import Link from "next/link";
import { KEYWORD_PAGES } from "@/lib/keywords-data";

export async function generateStaticParams() {
  return KEYWORD_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = KEYWORD_PAGES.find((p) => p.slug === slug);
  if (!page) return {};
  return {
    title: `${page.title} | AEOlab`,
    description: page.description,
    openGraph: {
      title: `${page.title} | AEOlab`,
      description: page.description,
    },
  };
}

export default async function KeywordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = KEYWORD_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();

  const competitionColor: Record<string, string> = {
    높음: "bg-red-100 text-red-700",
    중간: "bg-yellow-100 text-yellow-700",
    낮음: "bg-green-100 text-green-700",
  };
  const badgeClass = competitionColor[page.competitionLevel] ?? "bg-gray-100 text-gray-700";

  // 관련 페이지 (같은 지역 or 같은 업종, 현재 페이지 제외, 최대 3개)
  const related = KEYWORD_PAGES.filter(
    (p) =>
      p.slug !== page.slug &&
      (p.region === page.region || p.category === page.category)
  ).slice(0, 3);

  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-4 py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-14">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-700">
            홈
          </Link>
          <span>/</span>
          <Link href="/keywords" className="hover:text-gray-700">
            키워드 분석
          </Link>
          <span>/</span>
          <span className="text-gray-900 break-keep">
            {page.region} {page.category}
          </span>
        </nav>

        {/* 제목 영역 */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-3">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}`}
            >
              경쟁 강도: {page.competitionLevel}
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
              {page.region}
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
              {page.category}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 break-keep">
            {page.title}
          </h1>
          <p className="text-base text-gray-600 leading-relaxed break-keep">
            {page.description}
          </p>
        </div>

        {/* 실제 사장님 질문 */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-8">
          <p className="text-sm font-bold text-gray-400 mb-2">
            {page.region} {page.category} 사장님 실제 질문
          </p>
          <p className="text-base font-semibold text-gray-800 break-keep">
            &ldquo;{page.personaQuestion}&rdquo;
          </p>
          <p className="text-sm text-gray-500 mt-2">— {page.personaName} 사장님</p>
        </div>

        {/* AI 추천 패턴 */}
        <section className="mb-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 break-keep">
            AI가 &lsquo;{page.region} {page.category}&rsquo;를 추천하는 방식
          </h2>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <p className="text-sm md:text-base text-blue-900 leading-relaxed break-keep">
              {page.aiPattern}
            </p>
          </div>
        </section>

        {/* 핵심 키워드 */}
        <section className="mb-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 break-keep">
            AI 노출에 필요한 핵심 키워드 {page.keywords.length}개
          </h2>
          <div className="flex flex-wrap gap-2">
            {page.keywords.map((kw) => (
              <span
                key={kw}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full border border-gray-200"
              >
                {kw}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-3">
            * 이 키워드들이 스마트플레이스·블로그·리뷰에 자연스럽게 포함될수록
            AI 노출 가능성이 높아집니다.
          </p>
        </section>

        {/* 개선 팁 */}
        <section className="mb-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3 break-keep">
            지금 바로 할 수 있는 개선 방법 3가지
          </h2>
          <div className="space-y-3">
            {page.tips.map((tip, i) => (
              <div
                key={i}
                className="flex gap-3 items-start p-4 bg-white border border-gray-200 rounded-xl"
              >
                <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">
                  {tip}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 md:p-8 text-center text-white mb-10">
          <h2 className="text-xl md:text-2xl font-bold mb-2 break-keep">
            내 가게가 위 키워드에 노출되는지 확인해보세요
          </h2>
          <p className="text-blue-100 text-sm mb-5 break-keep">
            {page.region} {page.category} 기준으로 AI 노출 점수와 키워드 공백을
            30초 안에 확인합니다
          </p>
          <Link
            href="/trial"
            className="inline-block bg-white text-blue-700 font-bold text-base px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            내 가게 AI 노출 확인하기
          </Link>
          <p className="text-xs text-blue-200 mt-3">가입 없이 · 카드 없이 · 30초</p>
        </div>

        {/* 관련 페이지 */}
        {related.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              관련 지역·업종 분석
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/keywords/${r.slug}`}
                  className="block p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <span className="text-xs font-semibold text-blue-600 mb-1 block">
                    {r.region} · {r.category}
                  </span>
                  <p className="text-sm font-semibold text-gray-800 break-keep line-clamp-2">
                    {r.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 푸터 */}
      <footer className="border-t border-gray-100 py-6 px-4 mt-4">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">
            AEOlab 홈으로
          </Link>
          <span className="mx-2">·</span>
          <Link href="/keywords" className="hover:text-gray-700">
            전체 키워드 분석
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
