import type { Metadata } from "next";

// 페이지별 공유 미리보기(Open Graph) — 페이지에서 openGraph 를 지정하면 루트의 기본값(제목·이미지)이 통째로 대체되므로
// 이미지·사이트명까지 함께 채워 준다. url 은 사이트 루트 기준 경로(metadataBase 가 절대 주소로 바꿈).
export function pageOpenGraph(p: { title: string; description: string; path: string }): NonNullable<Metadata["openGraph"]> {
  return {
    title: p.title,
    description: p.description,
    url: p.path,
    siteName: "AEOlab",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  };
}
