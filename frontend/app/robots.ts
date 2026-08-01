import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // /guide/channels/, /guide/chatgpt-search는 공개 SEO 콘텐츠(sitemap.ts 등재) — 대시보드
        // 전용 /guide(현재 사업장 가이드)·/guide/ai-tab 등과 URL 프리픽스가 겹쳐 "/guide/" 통짜
        // disallow로는 공개 콘텐츠까지 함께 차단됐었다. allow는 더 구체적인 경로라 disallow보다
        // 우선한다(robots.txt 스펙: 가장 긴 일치 규칙이 우선).
        allow: ["/", "/trial", "/pricing", "/guide/channels/", "/guide/chatgpt-search"],
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/settings/",
          "/guide",
          "/competitors/",
          "/history/",
          "/schema/",
          "/startup/",
          "/ad-defense/",
        ],
      },
    ],
    sitemap: "https://aeolab.co.kr/sitemap.xml",
  };
}
