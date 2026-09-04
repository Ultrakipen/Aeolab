import { notFound } from "next/navigation";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return {};
  return {
    title: `${post.title} | AEOlab 블로그`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: `${post.title} | AEOlab 블로그`,
      description: post.description,
    },
  };
}

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

/**
 * 마크다운 없이 줄바꿈 기반 단순 파싱
 * - "## 제목" → <h2>
 * - "# 제목" → <h3> (본문 소제목)
 * - 빈 줄 → 단락 구분
 * - 그 외 → <p>
 */
function parseContent(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let paragraphLines: string[] = [];
  let key = 0;

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(" ").trim();
    if (text) {
      elements.push(
        <p
          key={key++}
          className="text-base text-gray-700 leading-relaxed break-keep mb-4"
        >
          {text}
        </p>
      );
    }
    paragraphLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("## ")) {
      flushParagraph();
      elements.push(
        <h2
          key={key++}
          className="text-lg md:text-xl font-bold text-gray-900 mt-8 mb-3 break-keep"
        >
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      flushParagraph();
      elements.push(
        <h3
          key={key++}
          className="text-base md:text-lg font-bold text-gray-900 mt-6 mb-2 break-keep"
        >
          {line.slice(2)}
        </h3>
      );
    } else if (line === "") {
      flushParagraph();
    } else {
      paragraphLines.push(line);
    }
  }
  flushParagraph();

  return elements;
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  // 다른 아티클 추천 (현재 제외, 최대 3개)
  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  const badgeClass =
    categoryColors[post.category] ?? "bg-gray-100 text-gray-600";

  const parsedContent = parseContent(post.content);

  const postUrl = `https://aeolab.co.kr/blog/${post.slug}`;

  return (
    <main className="min-h-screen bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "홈", url: "https://aeolab.co.kr/" },
          { name: "블로그", url: "https://aeolab.co.kr/blog" },
          { name: post.title, url: postUrl },
        ]}
      />
      <script
        type="application/ld+json"
        // </script> 조기 종료 방지 — JSON.stringify는 "<"를 이스케이프하지 않음
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "@id": `${postUrl}#article`,
            headline: post.title,
            description: post.description,
            image: "https://aeolab.co.kr/opengraph-image",
            datePublished: post.publishedAt,
            dateModified: post.publishedAt,
            inLanguage: "ko-KR",
            mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
            author: { "@type": "Organization", name: "AEOlab", url: "https://aeolab.co.kr" },
            publisher: { "@type": "Organization", name: "AEOlab", url: "https://aeolab.co.kr" },
          }).replace(/</g, "\\u003c"),
        }}
      />
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">
            AEOlab
          </Link>
          <div className="flex items-center gap-3 md:gap-4">
            <AuthNavControlClient />
            <Link
              href="/trial"
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              무료 진단 시작
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-14">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link href="/" className="hover:text-gray-700">
            홈
          </Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-gray-700">
            블로그
          </Link>
          <span>/</span>
          <span className="text-gray-900 break-keep line-clamp-1">
            {post.title}
          </span>
        </nav>

        {/* 아티클 헤더 */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span
              className={`text-sm font-semibold px-2.5 py-1 rounded-full ${badgeClass}`}
            >
              {post.category}
            </span>
            <span className="text-sm text-gray-600">
              {formatDate(post.publishedAt)}
            </span>
            <span className="text-sm text-gray-600">
              읽기 {post.readTime}분
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 break-keep">
            {post.title}
          </h1>
          <p className="text-base text-gray-600 leading-relaxed break-keep border-l-4 border-blue-200 pl-4">
            {post.description}
          </p>
        </div>

        {/* 본문 */}
        <article className="mb-10">
          {parsedContent}
        </article>

        {/* 인라인 CTA */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 md:p-8 text-center text-white mb-12">
          <h2 className="text-xl md:text-2xl font-bold mb-2 break-keep">
            가이드를 읽었다면, 지금 내 가게를 진단해보세요
          </h2>
          <p className="text-blue-100 text-sm mb-5 break-keep">
            ChatGPT·네이버 AI 브리핑에서 내 가게가 어떻게 노출되는지 30초 안에
            확인합니다
          </p>
          <Link
            href="/trial"
            className="inline-block bg-white text-blue-700 font-bold text-base px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            내 가게 AI 노출 확인하기
          </Link>
          <p className="text-sm text-blue-200 mt-3">
            가입 없이 · 카드 없이 · 30초
          </p>
        </div>

        {/* 다른 아티클 추천 */}
        {related.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              다른 가이드 읽기
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {related.map((r) => {
                const rBadge =
                  categoryColors[r.category] ?? "bg-gray-100 text-gray-600";
                return (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group block p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <span
                      className={`text-sm font-semibold px-2 py-0.5 rounded-full mb-2 inline-block ${rBadge}`}
                    >
                      {r.category}
                    </span>
                    <p className="text-sm font-semibold text-gray-800 break-keep group-hover:text-blue-700 transition-colors line-clamp-2 mb-1">
                      {r.title}
                    </p>
                    <p className="text-sm text-gray-600">읽기 {r.readTime}분</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <SiteFooter activePage="/blog" />
    </main>
  );
}
