/**
 * 사진 카테고리 단일 진실 소스 (프론트 미러).
 *
 * 백엔드 `services/photo_categories.py:EXPECTED_PHOTO_CATS`와 동기화 필수.
 * 한쪽 변경 시 반드시 양쪽 동시 수정 (CLAUDE.md 단일 진실 동기화 원칙).
 */

export const EXPECTED_CATEGORIES: Record<string, string[]> = {
  restaurant:    ["음식·음료", "메뉴", "풍경"],
  cafe:          ["음식·음료", "메뉴", "풍경"],
  bakery:        ["음식·음료", "메뉴", "풍경"],
  bar:           ["음식·음료", "메뉴", "분위기"],
  accommodation: ["객실", "전망", "부대시설"],
  beauty:        ["시술", "매장", "결과"],
  nail:          ["시술", "디자인", "매장"],
  fitness:       ["시설", "운동", "인테리어"],
  pet:           ["반려동물", "시설", "서비스"],
};

export const SUPPORTED_CATEGORIES = Object.keys(EXPECTED_CATEGORIES);

/** 카테고리명 정규화: `-` → `·` 표준화 */
export function normalizeCatName(name: string): string {
  return (name || "").replace(/-/g, "·");
}

/** 업종별 기대 카테고리. 미지원 업종은 빈 배열. */
export function getExpectedCats(category: string): string[] {
  return EXPECTED_CATEGORIES[category] ?? [];
}

/** 사진 카테고리 카드를 노출할 업종인지 확인 */
export function isSupported(category: string): boolean {
  return category in EXPECTED_CATEGORIES;
}

/** 입력 카운트 객체에서 정규화된 카운트 조회 (`·`/`-` 모두 호환) */
export function getCountNormalized(
  photoCategories: Record<string, number> | null | undefined,
  catName: string,
): number {
  if (!photoCategories) return 0;
  const target = normalizeCatName(catName);
  for (const [k, v] of Object.entries(photoCategories)) {
    if (normalizeCatName(k) === target) return Number(v) || 0;
  }
  return 0;
}
