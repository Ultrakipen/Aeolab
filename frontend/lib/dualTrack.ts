/**
 * 업종별 DUAL_TRACK_RATIO 기본 global 비중.
 * backend score_engine.py DUAL_TRACK_RATIO(get_dual_track_ratio() 단일 소스)와 동일.
 * 신규 사용자 첫 스캔 전 GlobalAiFocusCard 표시 조건 계산에 사용.
 *
 * 단일 소스 관리: 백엔드 DUAL_TRACK_RATIO와 함께 변경 시 양쪽 동시 수정 필수.
 * 2026-09-03: 59개 전 업종 값이 백엔드와 어긋나 있던 것(2026-05~06 개편 미반영) 발견,
 * backend get_dual_track_ratio() 실행 결과로 전수 재동기화. "other"("기타")는 이전엔
 * 키 자체가 없어 DEFAULT(0.40)로 우연히 맞았으나, 백엔드가 restaurant(0.20)로
 * 오폴백하던 별도 버그가 있었음 — 그 버그를 score_engine.py에서 수정한 뒤 값을 다시 확인.
 */
const GLOBAL_WEIGHTS: Record<string, number> = {
  // 음식·음료
  restaurant: 0.20,
  cafe: 0.25,
  bakery: 0.40,
  bar: 0.20,
  accommodation: 0.30,
  // 뷰티·웰니스
  beauty: 0.30,
  nail: 0.40,
  skincare: 0.30,
  massage: 0.30,
  spa: 0.35,
  semi_permanent: 0.30,
  // 반려동물·피트니스
  pet: 0.30,
  fitness: 0.35,
  yoga: 0.35,
  dance: 0.30,
  ballet: 0.30,
  martial_arts: 0.30,
  // 의료·약
  pharmacy: 0.25,
  medical: 0.45,
  dental: 0.40,
  oriental_medicine: 0.30,
  clinic: 0.45,
  // 전문직
  legal: 0.80,
  accounting: 0.70,
  realestate: 0.30,
  // 교육
  education: 0.60,
  tutoring: 0.60,
  academy: 0.60,
  art_class: 0.40,
  music_class: 0.40,
  music_lesson: 0.45,
  music_studio: 0.45,
  // 인테리어·디자인·미디어
  interior: 0.45,
  design: 0.65,
  photo: 0.30,
  video: 0.45,
  // 자동차·생활
  auto: 0.30,
  car_wash: 0.25,
  cleaning: 0.40,
  laundry: 0.25,
  electronics_repair: 0.30,
  // 쇼핑·패션
  shopping: 0.90,
  clothing: 0.50,
  fashion: 0.40,
  flower: 0.25,
  optics: 0.25,
  footwear: 0.55,
  stationery: 0.40,
  // 레저·여가
  workshop: 0.45,
  norebang: 0.20,
  billiards: 0.25,
  climbing: 0.40,
  cooking: 0.40,
  experience: 0.45,
  golf: 0.30,
  swim: 0.30,
  jjimjil: 0.25,
  escape: 0.40,
  // 아동·교육
  kids: 0.25,
  study: 0.30,
  childcare: 0.25,
  // 업종 미분류 — DEFAULT_GLOBAL_WEIGHT과 값은 같지만(0.40)
  // 백엔드가 "other"를 restaurant(0.20)로 오폴백하던 버그를 고친 뒤 재확인한 값
  other: 0.40,
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
