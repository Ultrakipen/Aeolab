"""가이드 AI 출력 사실 가드 (services/guide_fact_guard.py, 2026-11-05).

픽스처는 2026-11-04 어니언 성수 가입 후 체험에서 실제로 나온 AI 출력 문구다(지어낸 형식이 결함을 가리지 않도록).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.guide_fact_guard import build_facts, guard_guide  # noqa: E402

REGISTERED_FAMOUS = {"registered": True, "reviews_known": True, "post_known": False}
UNKNOWN_SHOP = {"registered": False, "reviews_known": False, "post_known": False}


def _guide():
    # 실제 관측 문구 4종: 등록(가장 먼저)·첫 리뷰·첫 게시물·Q&A 현재 0개
    return {
        "summary": "현재 AI 검색에서 1.0회/100회 노출되고 있으며, 네이버 AI 브리핑에 이미 등장하고 있습니다.",
        "priority_items": [
            {"rank": 1, "title": "스마트플레이스 등록 (가장 먼저)", "action": "place.naver.com 접속"},
            {"rank": 2, "title": "첫 리뷰 확보", "action": "QR 카드로 리뷰 요청. 리뷰가 아직 없어 신뢰가 부족합니다."},
            {"rank": 3, "title": "스마트플레이스 소식 첫 게시물 올리기", "action": "소식 탭에서 첫 소식을 올리세요."},
            {"rank": 4, "title": "소개글 하단에 Q&A 추가하기", "action": "소개글 맨 아래에 붙여넣으세요."},
        ],
        "quick_wins": ["스마트플레이스 등록하기", "소개글에 Q&A 3개 추가"],
        "this_week_mission": {
            "title": "소개글 Q&A 추가",
            "why": "소개글 Q&A는 현재 0개로 비어 있으며, '노트북 가능한가요' 같은 목적형 검색에 직접 연결되는 핵심 정보이기 때문입니다.",
            "steps": ["1단계: 접속", "2단계: 소개글 클릭"],
        },
        "weekly_roadmap": [{"week": 1, "title": "1주차", "tasks": ["첫 게시물 작성"], "expected_result": "정보가 늘어납니다"}],
    }


def test_registered_famous_shop_drops_register_item_and_renumbers():
    g, notes = guard_guide(_guide(), REGISTERED_FAMOUS)
    titles = [i["title"] for i in g["priority_items"]]
    assert not any("스마트플레이스 등록" in t for t in titles)
    assert [i["rank"] for i in g["priority_items"]] == [1, 2, 3]
    assert "스마트플레이스 등록하기" not in g["quick_wins"] and "소개글에 Q&A 3개 추가" in g["quick_wins"]
    assert any("등록 처방" in n for n in notes)


def test_first_review_and_no_review_claims_are_fixed_only_when_reviews_are_known():
    g, _ = guard_guide(_guide(), REGISTERED_FAMOUS)
    second = [i for i in g["priority_items"] if "리뷰" in i["title"]][0]
    assert "첫 리뷰" not in second["title"] and second["title"] == "리뷰 확보"
    assert "리뷰가 아직 없" not in second["action"]
    # 리뷰 수를 모르면(미측정) 건드리지 않는다
    g2, _ = guard_guide(_guide(), UNKNOWN_SHOP)
    assert any(i["title"] == "첫 리뷰 확보" for i in g2["priority_items"])


def test_first_post_claim_is_softened_only_while_the_post_is_unmeasured():
    g, _ = guard_guide(_guide(), REGISTERED_FAMOUS)
    blob = str(g)
    assert "첫 게시물" not in blob and "첫 소식" not in blob
    assert any(i["title"] == "스마트플레이스 소식 게시물 올리기" for i in g["priority_items"])
    # 소식을 실제로 읽었다면(post_known) 그대로 둔다
    g2, _ = guard_guide(_guide(), {**REGISTERED_FAMOUS, "post_known": True})
    assert any("첫 게시물" in i["title"] for i in g2["priority_items"])


def test_qa_count_claim_is_always_removed_because_the_count_is_unknowable():
    for facts in (REGISTERED_FAMOUS, UNKNOWN_SHOP):
        g, notes = guard_guide(_guide(), facts)
        why = g["this_week_mission"]["why"]
        assert "현재 0개" not in why and "비어 있" not in why
        assert why                                              # 비워 두지 않고 중립 문장으로 대체
        assert any("Q&A 개수" in n for n in notes)


def test_a_truly_unregistered_shop_keeps_the_register_prescription():
    g, notes = guard_guide(_guide(), UNKNOWN_SHOP)
    assert g["priority_items"][0]["title"] == "스마트플레이스 등록 (가장 먼저)"
    assert not any("등록 처방" in n for n in notes)


def test_guard_never_empties_the_priority_list_and_does_not_mutate_the_input():
    only_register = {"priority_items": [{"rank": 1, "title": "스마트플레이스 등록"}]}
    g, _ = guard_guide(only_register, REGISTERED_FAMOUS)
    assert len(g["priority_items"]) == 1                        # 전부 걸리면 원본 유지(빈 가이드 방지)
    original = _guide()
    snapshot = str(original)
    guard_guide(original, REGISTERED_FAMOUS)
    assert str(original) == snapshot


def test_non_dict_and_missing_fields_do_not_raise():
    assert guard_guide(None, REGISTERED_FAMOUS) == (None, [])
    g, _ = guard_guide({"summary": "요약"}, REGISTERED_FAMOUS)
    assert g == {"summary": "요약"}


def test_build_facts_reads_only_confirmed_values():
    f = build_facts({"naver_place_id": "38561949", "review_count": 2283,
                     "sp_completeness_json": {"recent_post_measured": False, "recent_post_state": "unmeasured"}})
    assert f == {"registered": True, "reviews_known": True, "post_known": False}
    assert build_facts({"is_smart_place": True})["registered"] is True
    assert build_facts({"naver_place_id": "", "review_count": 0, "avg_rating": 0.0}) == {
        "registered": False, "reviews_known": False, "post_known": False}
    # 소식을 실제로 읽은 경우만 '확인됨'
    assert build_facts({"sp_completeness_json": {"recent_post_measured": True, "recent_post_state": "present"}})["post_known"] is True
    assert build_facts({"sp_completeness_json": '{"recent_post_measured": true}'})["post_known"] is True     # JSON 문자열도
    assert build_facts({"sp_completeness_json": {"error": "home_load_failed"}})["post_known"] is False
    assert build_facts(None) == {"registered": False, "reviews_known": False, "post_known": False}


def test_similar_but_harmless_sentences_are_not_removed():
    """오탐 방지: '리뷰 없이도'·'Q&A 없이도' 같은 정상 문장은 지우지 않는다."""
    g = {"summary": "광고 없이도 리뷰 없이도 시작할 수 있고 Q&A 없이도 소개글은 중요합니다.",
         "priority_items": [{"rank": 1, "title": "리뷰 요청", "action": "리뷰가 있으면 답글을 달고, Q&A가 있으면 보강하세요."}]}
    out, notes = guard_guide(g, REGISTERED_FAMOUS)
    assert out == g and notes == []


def test_qa_zero_variants_are_caught():
    for sent in ("소개글 Q&A는 현재 0개입니다.", "현재 Q&A 0개로 비어 있습니다.", "Q&A가 없습니다.", "Q&A가 비어 있어요."):
        out, notes = guard_guide({"summary": sent + " 다른 문장입니다."}, UNKNOWN_SHOP)
        assert "0개" not in out["summary"] and "비어" not in out["summary"] and "없습니다" not in out["summary"], sent
        assert "다른 문장입니다." in out["summary"], sent


def test_absolute_negative_wording_is_softened_to_this_measurement():
    """실제 가이드 요약: '네이버 AI 브리핑에 전혀 등장하지 않고 있습니다' — 측정 0을 절대 표현으로 쓰지 않는다(11-01 방침)."""
    g, notes = guard_guide({"summary": "AI 노출 0회로, 네이버 AI 브리핑에 전혀 등장하지 않고 있습니다. 소개글을 보강하세요."}, UNKNOWN_SHOP)
    assert g["summary"] == "AI 노출 0회로, 네이버 AI 브리핑에 이번 측정에서는 등장하지 않았습니다. 소개글을 보강하세요."
    assert any("절대 표현" in n for n in notes)
    g2, _ = guard_guide({"summary": "ChatGPT에는 전혀 노출되지 않습니다."}, UNKNOWN_SHOP)
    assert g2["summary"] == "ChatGPT에는 이번 측정에서는 노출되지 않았습니다."


def test_absolute_wording_filter_does_not_touch_unrelated_sentences():
    g = {"summary": "전혀 다른 방법으로 접근하세요. 전혀 문제없습니다. 전혀 등장하지 않던 키워드를 추가하세요. 두 방식은 전혀 다르지 않습니다."}
    out, notes = guard_guide(g, UNKNOWN_SHOP)
    assert out == g and notes == []


# ── deep_link 정리 ────────────────────────────────────────────────────────────
from services.guide_fact_guard import sanitize_deep_link  # noqa: E402


def test_broken_smartplace_deep_links_fall_back_to_the_root():
    """2026-11-04~05 가이드 실출력: '.../places/업체정보'·'.../places/' — 프롬프트 자리표시자를 AI가 잘못 채운 깨진 주소."""
    root = "https://smartplace.naver.com/"
    for bad in ("https://smartplace.naver.com/places/업체정보", "https://smartplace.naver.com/places/",
                "https://smartplace.naver.com/places/{place_id}/profile", "https://new.smartplace.naver.com/bizes/place/123",
                "https://smartplace.naver.com/places/38561949/profile"):
        assert sanitize_deep_link(bad) == root, bad


def test_other_links_are_kept_only_when_allowed_and_well_formed():
    assert sanitize_deep_link("https://map.naver.com/p/entry/place/38561949") == "https://map.naver.com/p/entry/place/38561949"
    assert sanitize_deep_link("https://business.google.com/") == "https://business.google.com/"
    assert sanitize_deep_link("https://business.google.com/{id}/profile") == "https://business.google.com"
    assert sanitize_deep_link("https://map.naver.com/p/한글경로") == "https://map.naver.com"
    for dropped in ("https://example.com/x", "http://smartplace.naver.com/", "javascript:alert(1)", "", "   ", None, 123):
        assert sanitize_deep_link(dropped) is None, dropped


def test_guard_cleans_deep_links_in_items_and_mission_without_touching_other_fields():
    g = {"priority_items": [{"rank": 1, "title": "소개글 Q&A 추가", "deep_link": "https://smartplace.naver.com/places/업체정보"},
                            {"rank": 2, "title": "리뷰 요청", "deep_link": None}],
         "this_week_mission": {"title": "Q&A", "deep_link": "https://smartplace.naver.com/places/"}}
    out, notes = guard_guide(g, UNKNOWN_SHOP)
    assert out["priority_items"][0]["deep_link"] == "https://smartplace.naver.com/"
    assert out["priority_items"][1]["deep_link"] is None
    assert out["this_week_mission"]["deep_link"] == "https://smartplace.naver.com/"
    assert out["priority_items"][0]["title"] == "소개글 Q&A 추가"
    assert any("deep_link 2개" in n for n in notes)
    # 이미 정상인 값은 그대로(메모도 없음)
    ok = {"this_week_mission": {"title": "x", "deep_link": "https://smartplace.naver.com/"}}
    assert guard_guide(ok, UNKNOWN_SHOP) == (ok, [])


# ── 시설·서비스형 키워드 리뷰 유도 ───────────────────────────────────────────────
def _titles(guide):
    return [i["title"] for i in guide["priority_items"]]


def test_facility_keyword_review_prescription_gets_a_condition():
    """실제 가이드(음식점 6회 중 6회): "'단체석 있음' 키워드 리뷰 확보" — 단체석이 없는 가게에는 맞지 않는 처방."""
    g = {"priority_items": [
        {"rank": 1, "title": "'단체석 있음' 키워드 리뷰 확보"},
        {"rank": 2, "title": "‘주차 가능’ 리뷰 유도"},                        # 곡선 따옴표
        {"rank": 3, "title": "\"예약 가능\" 후기·리뷰 요청"},
    ]}
    out, notes = guard_guide(g, UNKNOWN_SHOP)
    assert _titles(out) == ["'단체석 있음' 키워드 리뷰 확보 (실제로 있다면)", "‘주차 가능’ 리뷰 유도 (실제로 있다면)", "\"예약 가능\" 후기·리뷰 요청 (실제로 있다면)"]
    assert any("시설형 키워드 리뷰 처방 3개" in n for n in notes)


def test_facility_condition_is_not_added_to_unrelated_or_already_conditional_titles():
    """오탐 방지: 감성 키워드·리뷰와 무관한 안내·이미 조건이 있는 제목은 그대로 둔다."""
    keep = ["'감성 인테리어' 키워드 리뷰 확보", "'주차 가능' 안내 문구 추가", "'단체석 있음' 리뷰 확보 (실제로 해당할 때만)",
            "실제로 있는 '단체석 있음' 리뷰 확보", "소개글 하단에 Q&A 추가", "단체석 있음 리뷰 확보"]   # 마지막: 따옴표 없는 일반 문장
    g = {"priority_items": [{"rank": i + 1, "title": t} for i, t in enumerate(keep)]}
    out, notes = guard_guide(g, UNKNOWN_SHOP)
    assert _titles(out) == keep and notes == []


def test_facility_condition_is_idempotent_and_applies_to_the_mission_title():
    g = {"priority_items": [{"rank": 1, "title": "'단체석 있음' 키워드 리뷰 확보"}],
         "this_week_mission": {"title": "'주차 가능' 리뷰 유도하기"}}
    once, _ = guard_guide(g, UNKNOWN_SHOP)
    twice, notes2 = guard_guide(once, UNKNOWN_SHOP)
    assert once["priority_items"][0]["title"].count("(실제로 있다면)") == 1
    assert once["this_week_mission"]["title"] == "'주차 가능' 리뷰 유도하기 (실제로 있다면)"
    assert twice == once and notes2 == []
