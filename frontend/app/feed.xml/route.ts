import { BLOG_POSTS } from "@/lib/blog-posts";

export const dynamic = "force-static";

const SITE_URL = "https://aeolab.co.kr";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 블로그 RSS 2.0 피드 — 네이버 서치어드바이저는 사이트맵보다 RSS를 신규 콘텐츠
 * 수집에 우선 활용 권장(공식 가이드). /feed.xml을 서치어드바이저 "요청 > RSS 제출"에 등록할 것.
 */
export async function GET() {
  const sorted = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const items = sorted
    .map((post) => {
      const url = `${SITE_URL}/blog/${post.slug}`;
      const pubDate = new Date(post.publishedAt).toUTCString();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.description)}</description>
      <category>${escapeXml(post.category)}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AEOlab 블로그</title>
    <link>${SITE_URL}/blog</link>
    <description>AI 검색 노출(AEO) 최적화 — 네이버 AI 브리핑·ChatGPT·Gemini·Google AI 노출 가이드</description>
    <language>ko-KR</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
