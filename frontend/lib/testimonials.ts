/**
 * 베타 사용자 후기 데이터
 *
 * 실제 후기 확보 시 isPlaceholder를 false로 변경, quote 교체할 것.
 * 모든 항목이 isPlaceholder: true이면 Testimonials 섹션 자체가 숨김 처리됨.
 */

export interface Testimonial {
  id: string;
  industry: string;     // 업종 라벨 (예: "카페")
  region: string;       // 지역 라벨 (예: "강남")
  quote: string;        // 후기 본문
  result: string;       // 결과 요약 (예: "AI 노출 +18점 (2주)")
  isPlaceholder: boolean;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "beta-001",
    industry: "카페",
    region: "강남",
    quote: "[베타 사용자 후기 자리 — 실제 후기 확보 후 교체]",
    result: "AI 노출 +18점 (2주)",
    isPlaceholder: true,
  },
  {
    id: "beta-002",
    industry: "음식점",
    region: "수원",
    quote: "[베타 사용자 후기 자리 — 실제 후기 확보 후 교체]",
    result: "네이버 AI 브리핑 신규 노출",
    isPlaceholder: true,
  },
];
