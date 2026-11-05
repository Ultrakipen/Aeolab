"""미등록 키워드(경쟁사·갭 키워드)를 리뷰·글 제목으로 권하는 처방의 조건 가드 (2026-11-05).

픽스처는 같은 날 라이브 가이드(홍뮤직스튜디오작곡교습소)에서 실제로 나온 문구다. 등록 키워드: 작곡·편곡·연습실·녹음·우쿨렐레.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.guide_fact_guard import build_facts, guard_guide  # noqa: E402

REG = ["작곡", "편곡", "연습실", "녹음", "우쿨렐레"]
FACTS = {"registered": True, "reviews_known": True, "post_known": True, "keywords": REG}


def _guide():
    return {
        "priority_items": [
            {"rank": 1, "title": "'소수정예' 키워드 리뷰 확보",
             "action": "'소수정예' 또는 '레벨테스트' 등 직접 경험하신 내용을 리뷰로 남겨 주세요."},
            {"rank": 3, "title": "블로그 정보형 글 1편 작성",
             "action": "제목 예시 1: '창원 작곡 레슨, 소수정예로 배우면 뭐가 다를까?' 2단계: '소수정예' 키워드를 2~3번 포함하세요."},
            {"rank": 4, "title": "'작곡' 키워드 리뷰 확보", "action": "작곡 레슨 후기를 부탁하세요."},
        ],
        "this_week_mission": {"title": "소개글에 Q&A 추가", "why": "검색 연결", "steps": ["1단계"]},
    }


def test_unregistered_keyword_review_title_gets_condition():
    g, notes = guard_guide(_guide(), FACTS)
    assert g["priority_items"][0]["title"] == "'소수정예' 키워드 리뷰 확보 (실제로 해당한다면)"
    assert any("미등록 키워드 리뷰 처방 1개" in n for n in notes)


def test_registered_keyword_title_is_untouched():          # 오탐 방지: 등록 키워드에는 붙이지 않는다
    g, _ = guard_guide(_guide(), FACTS)
    assert g["priority_items"][2]["title"] == "'작곡' 키워드 리뷰 확보"


def test_blog_title_example_with_same_token_gets_note_once():
    g, _ = guard_guide(_guide(), FACTS)
    body = g["priority_items"][1]["action"]
    assert body.count("실제로 해당할 때만 쓰세요") == 1 and "'소수정예'" in body.split("※")[-1]
    g2, _ = guard_guide(g, FACTS)                             # 멱등
    assert g2["priority_items"][1]["action"].count("실제로 해당할 때만 쓰세요") == 1
    assert g2["priority_items"][0]["title"].count("실제로 해당한다면") == 1


def test_unknown_registered_keywords_changes_nothing():     # 등록 키워드를 모르면 건드리지 않는다
    facts = {k: v for k, v in FACTS.items() if k != "keywords"}
    g, _ = guard_guide(_guide(), facts)
    assert g["priority_items"][0]["title"] == "'소수정예' 키워드 리뷰 확보"
    assert "실제로 해당할 때만" not in g["priority_items"][1]["action"]


def test_related_to_registered_keyword_is_not_flagged():    # 지역+업종 조합("창원 작곡")은 등록 키워드를 포함하므로 대상 아님
    g = {"priority_items": [{"rank": 1, "title": "'창원 작곡 레슨' 키워드 리뷰 확보", "action": "x"}]}
    out, _ = guard_guide(g, FACTS)
    assert out["priority_items"][0]["title"] == "'창원 작곡 레슨' 키워드 리뷰 확보"


def test_title_without_review_is_not_flagged():
    g = {"priority_items": [{"rank": 1, "title": "'소수정예' 블로그 글 작성", "action": "x"}]}
    out, _ = guard_guide(g, FACTS)
    assert out["priority_items"][0]["title"] == "'소수정예' 블로그 글 작성"


def test_existing_condition_words_not_duplicated():
    g = {"priority_items": [{"rank": 1, "title": "'소수정예' 리뷰 (실제로 해당한다면)", "action": "x"}]}
    out, _ = guard_guide(g, FACTS)
    assert out["priority_items"][0]["title"] == "'소수정예' 리뷰 (실제로 해당한다면)"


def test_build_facts_exposes_keywords_only_when_known():
    assert build_facts({"keywords": ["작곡", " "], "custom_keywords": ["녹음"]})["keywords"] == ["작곡", "녹음"]
    assert "keywords" not in build_facts({"keywords": []})
    assert "keywords" not in build_facts({})


def test_note_is_not_appended_twice_when_a_new_title_reuses_the_token():   # 멱등 표식의 독립 검증(제목 조건 경로와 별개)
    g, _ = guard_guide(_guide(), FACTS)
    g["priority_items"].append({"rank": 9, "title": "'소수정예' 후기 리뷰 요청", "action": "x"})   # 같은 토큰의 새 제목 → 토큰 재수집
    g2, _ = guard_guide(g, FACTS)
    assert g2["priority_items"][1]["action"].count("실제로 해당할 때만 쓰세요") == 1
