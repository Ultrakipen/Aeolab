"""고객 리뷰 본문의 연락처는 AI 업체(Anthropic)로 보내지 않는다 (2026-11-02).

방침 5항은 붙여 넣은 고객 리뷰가 Anthropic으로 전송된다고 고지했고 약관 제7조 5항은 타인 개인정보를 입력하지 않게 한다. 그래도 리뷰에 섞인 전화번호·이메일은 지운다.
**사업장 자신의 정보(이름·키워드·업종)는 그대로 보낸다** — 11-01 결정(사업장 연락처는 개인정보가 아니라 유지)과 소개글 생성 결과를 지키려면 공통 관문에서 일괄 제거하면 안 된다.
적용 지점은 고객 리뷰 본문을 프롬프트에 넣는 두 곳(review-reply·crisis-reply)뿐이다 — 설정의 '고객 리뷰 샘플'은 로컬 키워드 분석에만 쓰이고 AI로 가지 않는다.
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

REVIEW = "음식 맛있어요. 사장님 연락 주세요 010-1234-5678 / owner@example.com 사업자 123-45-67890 다음에 또 올게요"


class _Msg:
    class usage:
        input_tokens = 1
        output_tokens = 1

    class _C:
        text = 'sentiment: positive\nreply: 감사합니다 {"public_reply":"감사합니다","ai_impact_tips":[],"do_not_do":[],"offline_steps":[]}'
    content = [_C()]


@pytest.fixture
def captured(monkeypatch):
    import services.anthropic_retry as ar
    seen = {}

    async def fake(client, **kwargs):
        seen["prompt"] = kwargs["messages"][0]["content"]
        return _Msg()
    monkeypatch.setattr(ar, "create_message_with_retry", fake)
    return seen


def _assert_review_is_clean(prompt):
    for leaked in ("010-1234-5678", "1234-5678", "owner@example.com", "123-45-67890"):
        assert leaked not in prompt, leaked
    assert "음식 맛있어요" in prompt and "다음에 또 올게요" in prompt                 # 리뷰 내용 자체는 남는다(답변 품질 유지)


def test_review_reply_prompt_has_no_contact_info_but_keeps_business_data(monkeypatch, captured):
    import routers.guide as g
    monkeypatch.setattr(g, "_get_guide_ai_client", lambda key: object())
    biz = {"name": "홍길동식당", "category": "restaurant", "keywords": ["창원 맛집", "점심"]}
    asyncio.run(g._generate_reply(biz, REVIEW))
    p = captured["prompt"]
    _assert_review_is_clean(p)
    assert "홍길동식당" in p and "창원 맛집" in p                                     # 사업장 정보는 지우지 않는다


def test_crisis_reply_prompt_has_no_contact_info(monkeypatch, captured):
    import services.crisis_guide as cg
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")
    monkeypatch.setattr(cg, "_get_client", lambda key: object())
    asyncio.run(cg.generate_crisis_reply(REVIEW, "홍길동식당", "restaurant", 2))
    p = captured["prompt"]
    _assert_review_is_clean(p)
    assert "홍길동식당" in p


def test_business_phone_in_the_prompt_is_not_scrubbed(monkeypatch, captured):
    """사업장 이름·키워드에 든 연락처 형태는 사업장 자신의 정보라 그대로 둔다(11-01 결정) — 제거는 리뷰 본문에만."""
    import routers.guide as g
    monkeypatch.setattr(g, "_get_guide_ai_client", lambda key: object())
    biz = {"name": "홍길동식당 02-123-4567", "category": "restaurant", "keywords": ["문의 031-555-1234"]}
    asyncio.run(g._generate_reply(biz, "맛있어요"))
    assert "02-123-4567" in captured["prompt"] and "031-555-1234" in captured["prompt"]


def test_scrub_function_is_a_single_shared_source():
    from services import privacy_scrub
    from services.ai_scanner import gemini_scanner
    assert gemini_scanner.scrub_personal is privacy_scrub.scrub_personal               # Gemini 경로와 같은 규칙(한 곳만 고치면 된다)
    assert gemini_scanner._PII_PATTERNS is privacy_scrub._PII_PATTERNS


def test_year_ranges_and_prices_in_reviews_are_kept():
    from services.privacy_scrub import scrub_personal
    t = "2020-2024년 동안 다녔고 12,000원이 적당해요 3-4일 걸려요"
    assert scrub_personal(t) == t


def test_stored_original_review_is_not_modified_by_the_prompt_scrub():
    """저장하는 리뷰 원문(guides.review_text)은 사용자의 데이터라 그대로 두고, 프롬프트에만 적용한다."""
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "routers", "guide.py"), encoding="utf-8").read()
    assert '"review_text": req.review_text' in src
    assert "review_text = scrub_personal(review_text)" in src


def test_review_input_tells_the_user_what_is_sent_and_what_is_removed():
    """입력란 안내는 실제 동작과 같아야 한다 — 전송 대상(방침 5항: Anthropic)과 자동 제거 범위(전화번호·이메일)만 말하고, 이름·주소까지 지운다고 하지 않는다."""
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "app", "(dashboard)", "review-inbox", "page.tsx"), encoding="utf-8").read()
    assert "고객 이름·연락처처럼 개인을 알아볼 수 있는 정보는 지우고 붙여 넣어 주세요" in src
    assert "AI 처리 업체(Anthropic)로 전송되며, 전화번호·이메일은 자동으로 제거됩니다" in src
    assert "이름·주소는 자동으로 제거" not in src and "개인정보를 모두 제거" not in src            # 과장 금지
