import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "소상공인 AI 검색 노출 가이드 | AEOlab 블로그",
  description:
    "네이버 AI 브리핑·ChatGPT에 내 가게가 노출되는 방법을 실제 사례와 함께 알아봅니다. 소상공인을 위한 AI 검색 최적화 가이드.",
  openGraph: {
    title: "소상공인 AI 검색 노출 가이드 | AEOlab 블로그",
    description:
      "네이버 AI 브리핑·ChatGPT에 내 가게가 노출되는 방법을 실제 사례와 함께 알아봅니다.",
  },
};

const categoryColors: Record<string, string> = {
  "네이버 AI": "bg-green-100 text-green-700",
  "ChatGPT 노출": "bg-blue-100 text-blue-700",
  "AI 최적화 전략": "bg-purple-100 text-purple-700",
  "종합 가이드": "bg-orange-100 text-orange-700",
  "키워드 전략": "bg-indigo-100 text-indigo-700",
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${m}월 ${d}일`;
}

export default function BlogIndexPage() {
  const featured = BLOG_POSTS[0];
  const rest = BLOG_POSTS.slice(1);

  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
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
        {/* 타이틀 */}
        <div className="mb-10">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-gray-700">
              홈
            </Link>
            <span>/</span>
            <span className="text-gray-900">블로그</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 break-keep">
            소상공인 AI 검색 노출 가이드
          </h1>
          <p className="text-base text-gray-600 leading-relaxed break-keep">
            네이버 AI 브리핑·ChatGPT에 내 가게가 노출되는 방법을 실제 사장님
            사례와 함께 알려드립니다.
          </p>
        </div>

        {/* 추천 아티클 (첫 번째 게시글 크게 노출) */}
        <Link
          href={`/blog/${featured.slug}`}
          className="group block mb-10 p-6 md:p-8 border border-gray-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                categoryColors[featured.category] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {featured.category}
            </span>
            <span className="text-xs text-gray-400">
              {formatDate(featured.publishedAt)}
            </span>
            <span className="text-xs text-gray-400">
              읽기 {featured.readTime}분
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep group-hover:text-blue-700 transition-colors">
            {featured.title}
          </h2>
          <p className="text-base text-gray-600 leading-relaxed break-keep mb-4">
            {featured.description}
          </p>
          <span className="text-sm font-semibold text-blue-600 group-hover:underline">
            자세히 읽기 &rarr;
          </span>
        </Link>

        {/* 나머지 아티클 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block p-5 border border-gray-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    categoryColors[post.category] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {post.category}
                </span>
                <span className="text-xs text-gray-400">
                  읽기 {post.readTime}분
                </span>
              </div>
              <h2 className="text-base md:text-lg font-bold text-gray-900 mb-2 break-keep group-hover:text-blue-700 transition-colors line-clamp-2">
                {post.title}
              </h2>
              <p className="text-sm text-gray-500 break-keep line-clamp-3 mb-3">
                {post.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {formatDate(post.publishedAt)}
                </span>
                <span className="text-sm font-semibold text-blue-600 group-hover:underline">
                  읽기 &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 md:p-8 text-center text-white">
          <h2 className="text-xl md:text-2xl font-bold mb-2 break-keep">
            가이드를 읽었다면, 지금 바로 내 가게를 진단해보세요
          </h2>
          <p className="text-blue-100 text-sm mb-5 break-keep">
            ChatGPT·네이버 AI 브리핑에서 내 가게가 어떻게 노출되는지 30초 안에
            확인합니다
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
          <Link href="/keywords" className="hover:text-gray-700">
            키워드 분석
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
