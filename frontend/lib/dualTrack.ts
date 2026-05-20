/**
 * 업종별 DUAL_TRACK_RATIO 기본 global 비중.
 * backend score_engine.py:108~172 DUAL_TRACK_RATIO와 동일.
 * 신규 사용자 첫 스캔 전 GlobalAiFocusCard 표시 조건 계산에 사용.
 *
 * 단일 소스 관리: 백엔드 DUAL_TRACK_RATIO와 함께 변경 시 양쪽 동시 수정 필수.
 */
const GLOBAL_WEIGHTS: Record<string, number> = {
  // 음식·음료
  restaurant: 0.30,
  cafe: 0.35,
  bakery: 0.35,
  bar: 0.30,
  accommodation: 0.30,
  // 뷰티·웰니스
  beauty: 0.35,
  nail: 0.35,
  skincare: 0.35,
  massage: 0.40,
  spa: 0.40,
  semi_permanent: 0.35,
  // 반려동물·피트니스
  pet: 0.35,
  fitness: 0.40,
  yoga: 0.40,
  dance: 0.45,
  ballet: 0.45,
  martial_arts: 0.45,
  // 의료·약
  pharmacy: 0.30,
  medical: 0.50,
  dental: 0.50,
  oriental_medicine: 0.50,
  clinic: 0.50,
  // 전문직
  legal: 0.80,
  accounting: 0.70,
  realestate: 0.40,
  // 교육
  education: 0.55,
  tutoring: 0.55,
  academy: 0.60,
  art_class: 0.50,
  music_class: 0.50,
  music_lesson: 0.50,
  // 인테리어·디자인·미디어
  interior: 0.50,
  design: 0.65,
  photo: 0.55,
  video: 0.60,
  // 자동차·생활
  auto: 0.40,
  car_wash: 0.35,
  cleaning: 0.40,
  laundry: 0.40,
  electronics_repair: 0.45,
  // 쇼핑·패션
  shopping: 0.90,
  clothing: 0.65,
  fashion: 0.55,
  flower: 0.50,
  optics: 0.45,
  footwear: 0.50,
  stationery: 0.40,
  // 레저·여가
  workshop: 0.50,
  norebang: 0.30,
  billiards: 0.30,
  climbing: 0.40,
  // 아동·교육
  kids: 0.40,
  study: 0.45,
};

const DEFAULT_GLOBAL_WEIGHT = 0.40;

/**
 * 업종 코드로 DUAL_TRACK_RATIO 기본 global 비중을 반환.
 * 스캔 전 신규 사용자에게 GlobalAiFocusCard 표시 여부를 결정하는 데 사용.
 *
 * @param category businesses.category 값 (예: "legal", "restaurant")
 * @returns 0.0~1.0 global 비중. 미등록 업종은 0.40 반환.
 */
export function getDefaultGlobalWeight(category: string): number {
  return GLOBAL_WEIGHTS[category] ?? DEFAULT_GLOBAL_WEIGHT;
}
