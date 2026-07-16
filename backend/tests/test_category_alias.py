"""
업종 코드 정합성 자동 테스트 (M1-5)
25→59개 업종 확장 후 taxonomy·eligibility 누락 방지.
"""
import pytest
from services.score_engine import (
    get_briefing_eligibility,
    get_ai_tab_eligibility,
    BRIEFING_ACTIVE_CATEGORIES,
    BRIEFING_LIKELY_CATEGORIES,
    BRIEFING_INACTIVE_CATEGORIES,
)
from services.keyword_taxonomy import normalize_category, get_all_keywords_flat

# 현재 59개 whitelist (2026-05-18 v5.8)
WHITELIST_59 = [
    # ACTIVE
    "restaurant", "cafe", "bakery", "bar", "accommodation",
    # LIKELY
    "beauty", "nail", "skincare", "massage", "spa", "dance", "ballet", "semi_permanent",
    "pet", "fitness", "yoga", "pharmacy",
    # INACTIVE
    "medical", "legal", "accounting", "education", "tutoring",
    "photo", "video", "design", "realestate", "interior",
    "auto", "cleaning", "laundry", "shopping", "fashion", "clothing",
    "flower", "kids", "study", "workshop", "music_class", "music_lesson", "music_studio",
    "cooking", "experience", "other",
    "dental", "oriental_medicine", "optics",
    "martial_arts", "climbing", "art_class", "childcare",
    "car_wash", "electronics_repair", "footwear", "stationery",
    "norebang", "billiards", "golf", "swim", "jjimjil", "escape",
]


def test_whitelist_count():
    assert len(WHITELIST_59) == 60, f"WHITELIST_59 count: {len(WHITELIST_59)}"  # music_studio 추가로 60개 (2026-07-17)


def test_all_have_eligibility():
    for cat in WHITELIST_59:
        result = get_briefing_eligibility(cat)
        assert result in ("active", "likely", "inactive"), f"{cat} -> {result}"


def test_all_have_ai_tab_eligibility():
    for cat in WHITELIST_59:
        result = get_ai_tab_eligibility(cat)
        assert result == "beta", f"{cat} ai_tab -> {result}"


def test_all_have_taxonomy():
    skip = {"other", "bakery", "bar"}  # normalize alias -> parent
    for cat in WHITELIST_59:
        if cat in skip:
            continue
        keywords = get_all_keywords_flat(cat)
        assert keywords, f"{cat} taxonomy missing or empty"


def test_nail_not_mapped_to_beauty():
    assert normalize_category("nail") == "nail", "nail should not alias to beauty"
    assert normalize_category("네일아트") == "nail"


def test_yoga_not_mapped_to_fitness():
    assert normalize_category("yoga") == "yoga", "yoga should not alias to fitness"


def test_cleaning_not_mapped_to_living():
    assert normalize_category("cleaning") == "cleaning", "cleaning should not alias to living"


def test_no_coverage_gaps():
    """WHITELIST_59의 모든 업종이 BRIEFING_* 중 하나에 있어야 함."""
    all_classified = (
        set(BRIEFING_ACTIVE_CATEGORIES)
        | set(BRIEFING_LIKELY_CATEGORIES)
        | set(BRIEFING_INACTIVE_CATEGORIES)
    )
    for cat in WHITELIST_59:
        assert cat in all_classified, f"{cat} not in any BRIEFING_* list"
