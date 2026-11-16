import { MetadataRoute } from "next";
import { KEYWORD_PAGES } from "@/lib/keywords-data";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { FLAT_CATEGORIES } from "@/lib/categories";
import { areaPath, fetchAreaAvailable } from "@/lib/area";

// 실제로 내용이 바뀐 날짜만 갱신할 것 — 매번 오늘 날짜로 바꾸면 구글이 lastmod를 신뢰하지 않는다.
const SITE_BUILD_DATE = new Date("2026-10-12"); // 랜딩·체험·요금 등 10-10 개편 반영
const AREA_LAUNCH_DATE = new Date("2026-11-16"); // /area 공개일(10-12 사이트 개편일보다 늦다 — 실제 생긴 날짜를 쓴다)
const LEGAL_UPDATED_DATE = new Date("2026-06-18"); // 약관·개인정보(미변경)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://aeolab.co.kr";

  // 우리 동네 상권 — 공공데이터가 실제로 수집된 조합만(빈 페이지가 색인되지 않게). 백엔드 실패 시 빈 목록.
  const areaPages: MetadataRoute.Sitemap = (await fetchAreaAvailable()).map((a) => ({
    url: `${baseUrl}${areaPath(a.region, a.category)}`,
    lastModified: AREA_LAUNCH_DATE,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const keywordPages: MetadataRoute.Sitemap = KEYWORD_PAGES.map((p) => ({
    url: `${baseUrl}/keywords/${p.slug}`,
    lastModified: SITE_BUILD_DATE,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const guideChannelPages: MetadataRoute.Sitemap = FLAT_CATEGORIES.map((c) => ({
    url: `${baseUrl}/guide/channels/${c.value}`,
    lastModified: SITE_BUILD_DATE,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: `${baseUrl}/`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/trial`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/ai-search-diagnosis`,
      lastModified: new Date("2026-10-21"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: LEGAL_UPDATED_DATE,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: LEGAL_UPDATED_DATE,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/demo`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/keywords`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/ranking`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/area`,
      lastModified: AREA_LAUNCH_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // 소상공인 지원사업 공고 — 하루 한 번 갱신되는 목록
    {
      url: `${baseUrl}/support-programs`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    // 사장님 계산기 허브와 4개 계산기(기존 광고비 비교·키워드 생성기도 처음으로 사이트맵에 등재)
    ...["/tools", "/tools/break-even", "/tools/delivery-settlement", "/tools/labor-cost", "/tools/vat", "/tools/ad-cost-calculator", "/tools/keyword"].map(
      (path) => ({
        url: `${baseUrl}${path}`,
        lastModified: AREA_LAUNCH_DATE,
        changeFrequency: "monthly" as const,
        priority: path === "/tools" ? 0.7 : 0.6,
      }),
    ),
    {
      url: `${baseUrl}/showcase`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/score-guide`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/quick`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/stories`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/guide/chatgpt-search`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/guide/channels`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    ...guideChannelPages,
    ...areaPages,
    ...keywordPages,
    ...blogPages,
  ];
}
