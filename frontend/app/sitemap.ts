import { MetadataRoute } from "next";
import { KEYWORD_PAGES } from "@/lib/keywords-data";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { FLAT_CATEGORIES } from "@/lib/categories";

const SITE_BUILD_DATE = new Date("2026-06-18");

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
      url: `${baseUrl}/how-it-works`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: SITE_BUILD_DATE,
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
      url: `${baseUrl}/login`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/ranking`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/resources`,
      lastModified: SITE_BUILD_DATE,
      changeFrequency: "monthly",
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
    ...guideChannelPages,
    ...keywordPages,
    ...blogPages,
  ];
}
