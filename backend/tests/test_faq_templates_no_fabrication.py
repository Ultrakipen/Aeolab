"""가이드의 FAQ 템플릿(services/action_tools.py)은 확인되지 않은 사실을 단정하지 않는다 (2026-11-05 감사).

사고: build_faq_list·build_smart_place_faq_answers가 "고객 만족도 높은 서비스"·"정평이 나 있습니다"·"인근 공영주차장도 이용 가능"·"단체 예약을 받고 있습니다"·
"건강보험 적용 가능한 진료를 제공하고 있습니다"·"저자극 제품을 사용합니다" 등을 업종별로 그대로 내보냈고, 화면(소개글 하단 추가용 Q&A·AI 검색 개선 FAQ)에 복사 버튼과 함께
경고 없이 노출됐다(v3.0 이후 점검 없음). 사장님이 그대로 게시하는 텍스트이므로 지침 7번(사실 지어내기 금지)을 따른다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.action_tools import build_faq_list, build_smart_place_faq_answers  # noqa: E402

CATEGORIES = ["restaurant", "cafe", "bakery", "bar", "beauty", "nail", "medical", "pharmacy", "fitness", "yoga",
              "education", "tutoring", "pet", "other", "legal", "shopping"]

# 과거 템플릿에 실제로 있던 단정 문구(그리고 같은 유형) — 하나라도 나오면 안 된다
BANNED = [
    "사랑받", "정평이", "고객 만족도 높은", "고객 만족을 최우선", "합리적인 가격", "친절한 서비스",
    "네, ", "운영하고 있습니다", "제공하고 있습니다", "받고 있습니다", "사용합니다",
    "평균 1~2시간", "건강보험 적용 가능", "저자극", "예약제를", "대기 시간 없이", "대기 없이", "당일 방문도 가능",
    "단체 예약을", "10인 이상", "체험 수업을", "레벨별로", "초급·중급·고급", "소형·중형", "다년간", "자격증과 다수", "풍부한 경험",
    "전국 어디서나", "비대면·온라인 서비스도 제공", "AI 검색 노출 상위를 기록", "인근 공영주차장", "주말에는 사전 예약", "주말·공휴일은 반드시",
    "None",
]
# 확인된 사실만 쓰는 안전한 질문(영업시간·주차는 '스마트플레이스/지도에서 확인' 안내, 위치는 등록 주소) — 빈칸 없이 허용
# 포트폴리오는 사장님이 등록한 홈페이지 주소가 있으면 그 주소(확인된 값), 없으면 빈칸 — 어느 쪽이든 지어낸 사실이 아니다
SAFE_QUESTIONS = ("영업시간", "진료시간", "주차 가능한가요", "주차가 가능한가요", "포트폴리오")

BIZ = {"name": "어니언 성수", "region": "서울 성동구", "keywords": ["카페", "베이커리"], "phone": "0507-0000-0000",
       "address": "서울특별시 성동구 아차산로9길 8 1, 2층", "website_url": "https://example.com"}


def _all_faqs():
    for cat in CATEGORIES:
        biz = {**BIZ, "category": cat}
        for f in build_smart_place_faq_answers(biz):
            yield ("smart_place_faq", cat, f)
        for ctx in ("location_based", "non_location"):
            for f in build_faq_list(biz, ctx):
                yield (f"faq_list/{ctx}", cat, f)


def test_no_banned_assertion_in_any_category_or_builder():
    bad = [(src, cat, f.question, ph) for src, cat, f in _all_faqs() for ph in BANNED if ph in f.answer]
    assert not bad, bad[:8]


def test_every_non_safe_answer_has_a_blank_for_the_owner_to_fill():
    """확인할 수 없는 사실은 [ ] 빈칸 — 답변이 빈칸도 없고 안전 질문도 아니면 단정 문장일 가능성이 크다."""
    bad = []
    for src, cat, f in _all_faqs():
        is_safe_q = any(k in f.question for k in SAFE_QUESTIONS) or "위치는 어디" in f.question
        if not is_safe_q and not ("[" in f.answer and "]" in f.answer):
            bad.append((src, cat, f.question, f.answer[:60]))
    assert not bad, bad[:8]


def test_missing_phone_address_website_never_print_none_or_empty_contact():
    for cat in ("restaurant", "medical", "other"):
        for k in ("phone", "address", "website_url"):
            biz = {**BIZ, "category": cat, k: None}
            for ctx in ("location_based", "non_location"):
                for f in build_faq_list(biz, ctx) + build_smart_place_faq_answers(biz):
                    assert "None" not in f.answer and "None" not in f.question
                    assert "문의: 문의" not in f.answer and "문의: )" not in f.answer
        biz_no_contact = {"name": "가게", "region": "서울 성동구", "category": cat, "keywords": []}
        for f in build_faq_list(biz_no_contact, "location_based") + build_smart_place_faq_answers(biz_no_contact):
            assert "문의:" not in f.answer, "전화번호를 모르면 문의처 문장을 붙이지 않는다"


def test_known_contact_and_address_are_used_as_facts():
    f = build_faq_list({**BIZ, "category": "cafe"}, "location_based")
    loc = [x for x in f if "위치는 어디" in x.question][0]
    assert "서울특별시 성동구 아차산로9길 8 1, 2층" in loc.answer
    assert any("문의: 0507-0000-0000" in x.answer for x in f)
    nl = build_faq_list({**BIZ, "category": "legal"}, "non_location")
    assert any("https://example.com" in x.answer for x in nl)


def test_medical_and_insurance_claims_are_always_left_blank():
    """의료광고·보험 문구는 사장님 확인 내용으로만 — 자동 문구로 '적용 가능'을 단정하지 않는다."""
    for cat in ("medical", "pharmacy"):
        qa = {f.question: f.answer for f in build_smart_place_faq_answers({**BIZ, "category": cat})}
        ins = [a for q, a in qa.items() if "건강보험" in q][0]
        assert "[" in ins and "확인되지 않은 내용은 쓰지 마세요" in ins


def test_first_question_of_faq_list_is_stable_for_the_dashboard():
    """대시보드가 faq_list[0].question을 '소개글 하단에 ○○ Q&A를 추가하세요'에 쓴다 — 질문 문장은 유지한다."""
    f = build_faq_list({**BIZ, "category": "cafe"}, "location_based")
    assert f[0].question == "성동구 카페 어디가 좋아?" or f[0].question.endswith("카페 어디가 좋아?")
    assert len(f) == 7


def test_no_josa_error_with_vowel_ending_category_labels():
    """'카페으로'처럼 받침 없는 업종명 뒤에 '으로'가 붙던 조사 오류(옛 템플릿에서 가져온 문구)가 없다."""
    import re
    for src, cat, f in _all_faqs():
        assert not re.search(r"(?:카페|베이커리|바|숍|샵)으로", f.answer), (src, cat, f.answer)
