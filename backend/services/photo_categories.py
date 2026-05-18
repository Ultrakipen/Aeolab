"""사진 카테고리 단일 진실 소스.

백엔드 (score_engine.py:484-509)와 프론트 (PhotoCategoryCard.tsx)가
같은 카테고리 사전을 사용하도록 보장.

명칭 표준: `·` (중점) 사용. `-` (하이픈) 입력은 자동 정규화.
"""
from __future__ import annotations
from typing import Dict, List

# 업종별 기대 사진 카테고리 (네이버 스마트플레이스 표준 명칭 기준)
EXPECTED_PHOTO_CATS: Dict[str, List[str]] = {
    "restaurant":    ["음식·음료", "메뉴", "풍경"],
    "cafe":          ["음식·음료", "메뉴", "풍경"],
    "bakery":        ["음식·음료", "메뉴", "풍경"],
    "bar":           ["음식·음료", "메뉴", "분위기"],
    "accommodation": ["객실", "전망", "부대시설"],
    "beauty":        ["시술", "매장", "결과"],
    "nail":          ["시술", "디자인", "매장"],
    "fitness":       ["시설", "운동", "인테리어"],
    "pet":           ["반려동물", "시설", "서비스"],
}

# 카드를 표시할 업종 목록 (프론트 동기화용)
SUPPORTED_CATEGORIES = list(EXPECTED_PHOTO_CATS.keys())


def normalize_cat_name(name: str) -> str:
    """카테고리명 정규화: `-` → `·` 표준화."""
    return (name or "").replace("-", "·")


def get_expected_cats(category: str) -> List[str]:
    """업종별 기대 사진 카테고리 반환. 미지원 업종은 빈 리스트."""
    return EXPECTED_PHOTO_CATS.get(category, [])


def is_supported(category: str) -> bool:
    """사진 카테고리 카드를 노출할 업종인지 확인."""
    return category in EXPECTED_PHOTO_CATS


def find_missing(photo_categories: Dict[str, int], category: str) -> List[str]:
    """업종 기대 카테고리 중 사진 0장인 항목 반환.

    photo_categories 키는 `·` / `-` 모두 호환 (정규화 후 비교).
    """
    if not photo_categories:
        return get_expected_cats(category)
    # 입력 키 정규화
    normalized = {normalize_cat_name(k): v for k, v in photo_categories.items()}
    missing: List[str] = []
    for cat in get_expected_cats(category):
        if normalized.get(normalize_cat_name(cat), 0) == 0:
            missing.append(cat)
    return missing
