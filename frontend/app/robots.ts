import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/trial", "/pricing"],
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/settings/",
          "/guide/",
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
