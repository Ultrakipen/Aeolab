/**
 * BreadcrumbList JSON-LD — 네이버 서치어드바이저·구글 SERP 브레드크럼 리치 결과 지원
 * 사용처: 콘텐츠 상세 페이지(블로그·키워드·채널 가이드) 전용, 방문 UI 브레드크럼과 별개로 렌더
 */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      // </script> 조기 종료 방지 — JSON.stringify는 "<"를 이스케이프하지 않음
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
