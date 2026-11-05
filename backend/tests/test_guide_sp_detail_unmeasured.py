"""가이드 프롬프트의 스마트플레이스 분석 문단은 값이 None이거나 읽지 못한 항목을 '확인 전'으로 쓴다 (2026-11-04).

사고: 가입 후 체험에서 플레이스 ID가 처음 확정되어 점검이 성공하자 photo_count=None인 결과가 가이드 생성에 들어가
`photo_count_sp >= 5`(None >= 5)가 TypeError를 내 가이드가 통째로 저장되지 않았다(.get(key, 0)은 키가 있고 값이 None이면 기본값을 주지 못한다).
또 읽지 못한 소식(recent_post_measured=false)을 '소식 없음'으로 AI에 넘겨 인기 가게에도 '소식을 올리세요'를 단정하게 했다.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.guide_generator import format_smart_place_detail as fmt  # noqa: E402

# 2026-11-04 어니언 성수 가입 후 체험에서 실제로 저장된 smart_place_completeness_result (가이드 생성이 이 값에서 실패)
REAL_FAILING = {
    "has_faq": False, "has_menu": True, "faq_count": 0, "has_hours": True, "has_intro": True, "photo_count": None,
    "menu_measured": True, "intro_measured": True, "has_recent_post": False, "has_reservation": False,
    "intro_char_count": 500, "photo_categories": {}, "recent_post_date": None, "recent_post_state": "unmeasured",
    "completeness_score": 40, "recent_post_measured": False,
}


def test_real_failing_value_does_not_raise_and_marks_unread_items():
    out = fmt(REAL_FAILING)
    assert "소개글 길이: 500자 ✅" in out
    assert "소개글 Q&A: 자동으로 확인하지 못하는 항목" in out and "Q&A 수" not in out   # faq_count는 감지 중단으로 항상 0인 상수
    assert "사진 수: 확인 전" in out
    assert "최근 소식: 확인 전" in out
    assert "소식 없음" not in out                      # 읽지 못한 항목을 '없음'으로 단정하지 않는다
    assert "단정하지 말고" in out                      # AI에게 단정 금지를 지시


def test_fully_measured_value_keeps_the_original_wording():
    out = fmt({"faq_count": 4, "intro_char_count": 150, "recent_post_date": "2026-11-01", "photo_count": 7,
               "intro_measured": True, "recent_post_measured": True})
    assert "소개글 Q&A: 자동으로 확인하지 못하는 항목" in out        # 개수(0이든 4든)는 AI에 넘기지 않는다
    assert "Q&A 수" not in out and "4개" not in out
    assert "소개글 길이: 150자 ❌ 50자 부족 (최소 200자 권장)" in out
    assert "최근 소식: 2026-11-01 ✅" in out
    assert "사진 수: 7장 ✅" in out
    assert "확인 전" not in out and "단정하지 말고" not in out


def test_measured_zero_and_missing_post_are_stated_as_facts():
    out = fmt({"faq_count": 0, "intro_char_count": 0, "recent_post_date": None, "photo_count": 0,
               "intro_measured": True, "recent_post_measured": True})
    assert "소개글 길이: 0자 ❌ 200자 부족" in out
    assert "최근 소식: 없음 ❌ 소식 없음" in out      # 실제로 읽었고 없을 때만 '없음'
    assert "사진 수: 0장 ⚠️ 5장 이상 권장" in out


def test_none_numbers_in_any_field_never_raise():
    out = fmt({"faq_count": None, "intro_char_count": None, "photo_count": None, "recent_post_date": None})
    assert out.count("확인 전") >= 2


def test_non_numeric_values_are_unknown_not_compared():
    """문자열·불리언이 숫자 자리에 들어와도(스키마 변경·저장 오류) 비교하다 실패하지 않고 '확인 전'으로 쓴다."""
    out = fmt({"faq_count": "3", "intro_char_count": True, "photo_count": "7", "recent_post_date": "2026-11-01"})
    assert "소개글 길이: 확인 전" in out and "사진 수: 확인 전" in out


def test_unmeasured_intro_is_not_asserted_as_missing():
    out = fmt({"faq_count": 0, "intro_char_count": 0, "photo_count": 3, "intro_measured": False,
               "recent_post_date": "2026-11-01", "recent_post_measured": True})
    assert "소개글 길이: 확인 전" in out and "200자 부족" not in out


def test_empty_or_error_payload_gives_empty_section():
    assert fmt({}) == "" and fmt(None) == "" and fmt({"error": "home_load_failed"}) == ""


def test_prompt_builder_no_longer_compares_raw_get_defaults():
    """가이드 프롬프트 코드가 .get(key, 0)로 읽은 값을 직접 숫자 비교하는 옛 패턴으로 돌아가지 않게 한다."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "services", "guide_generator.py")
    src = open(path, encoding="utf-8").read()
    assert re.search(r'photo_count_sp\s*=\s*sp_json\.get\(', src) is None
    assert "photo_count_sp >= 5" not in src
    assert "sp_detail_section = format_smart_place_detail(sp_json)" in src


def test_prompt_forbids_fabricated_example_text_and_unmeasured_claims():
    """가이드 프롬프트는 복사·붙여넣기 예시 텍스트에 확인 안 된 사실을 쓰지 못하게 하고, '확인 전'·Q&A를 '0개'로 단정하지 못하게 한다."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "services", "guide_generator.py")
    src = open(path, encoding="utf-8").read()
    assert "★ 사실 지어내기 금지: 복사·붙여넣기 예시 텍스트" in src
    assert "[사장님이 실제 내용을 직접 적어 주세요]" in src
    assert '★ "확인 전"으로 표시된 항목과 소개글 Q&A는 "현재 0개"' in src
    # 키워드 격차 섹션은 '확보해야 할 검색어'이지 가게의 특징이 아님을 AI에 알린다(가이드가 '감성 인테리어와 아늑한 분위기를 갖춘 카페입니다'로 단정했다)
    assert "확보해야 할 검색어" in src and "가게의 특징으로 단정하지 말고" in src
    # 등록 여부가 확인되지 않은 채널은 "등록하세요"로 단정하지 않고, 측정 0은 절대 표현으로 쓰지 않는다
    assert "등록돼 있는지 먼저 확인하고, 없으면 등록" in src
    assert '"전혀"·"절대" 같은 절대 표현을 쓰지 말고' in src


# ── 스마트플레이스 소식 템플릿(사장님이 그대로 게시) ──────────────────────────────────
from services.action_tools import build_naver_post_template as post_tpl  # noqa: E402


def test_post_template_never_prints_none_and_omits_unknown_contact():
    out = post_tpl({"name": "어니언 성수", "category": "cafe", "region": "서울 성동구", "keywords": ["카페"],
                    "phone": None, "address": "서울특별시 성동구 아차산로9길 8 1, 2층"})
    assert "None" not in out
    assert "📞" not in out                                 # 전화번호를 모르면 줄 자체를 뺀다
    assert "📍 위치: 서울특별시 성동구 아차산로9길 8 1, 2층" in out


def test_post_template_does_not_claim_reservation_or_popularity_without_evidence():
    base = {"name": "어니언 성수", "category": "cafe", "region": "서울 성동구", "keywords": ["카페"], "phone": "0507-0000-0000"}
    out = post_tpl(base)
    assert "📌 예약" not in out                             # 예약 연동을 확인하지 않았다
    assert "사랑받고 있습니다" not in out                    # 근거 없는 평판 주장
    assert "📞 문의: 0507-0000-0000" in out
    assert "📌 예약: 네이버 예약" in post_tpl({**base, "naver_reservation_linked": True})   # 연동이 확인된 경우에만


def test_post_template_with_no_address_and_region_omits_location():
    out = post_tpl({"name": "가게", "category": "cafe", "region": "", "keywords": [], "phone": None, "address": None})
    assert "None" not in out and "📍" not in out
