import { MetadataRoute } from "next";
import { KEYWORD_PAGES } from "@/lib/keywords-data";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { FLAT_CATEGORIES } from "@/lib/categories";

// 실제로 내용이 바뀐 날짜만 갱신할 것 — 매번 오늘 날짜로 바꾸면 구글이 lastmod를 신뢰하지 않는다.
const SITE_BUILD_DATE = new Date("2026-10-12"); // 랜딩·체험·요금 등 10-10 개편 반영
const LEGAL_UPDATED_DATE = new Date("2026-06-18"); // 약관·개인정보(미변경)

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://aeolab.co.kr";

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
    ...keywordPages,
    ...blogPages,
  ];
}
