"""generate_action_plan 흐름 연결 시험 — Claude 호출만 가짜로 두고 나머지는 실제 코드 (2026-11-05).

- 사실 가드가 실제 가이드 생성 경로에 연결돼 이미 등록된 가게의 "스마트플레이스 등록" 처방을 뺀다
- 품질 재생성이 점수를 낮춰도 마지막이 아니라 가장 좋은 시도를 저장한다(2026-11-04: 68.7 → 43.7인데 낮은 쪽이 저장됨)
- 가드가 실패해도 가이드 생성은 막지 않는다
"""
import asyncio
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.guide_generator as gg  # noqa: E402


def _raw(summary: str, titles) -> str:
    return json.dumps({
        "summary": summary,
        "priority_items": [
            {"rank": i + 1, "category": "스마트플레이스", "title": t, "action": "실행 방법", "difficulty": "easy",
             "time_required": "10분", "competitor_example": None}
            for i, t in enumerate(titles)
        ],
        "quick_wins": [],
        "next_month_goal": "2026-11 기준 한 달 후",
        "weekly_roadmap": [],
        "this_week_mission": {"title": "t", "why": "소개글 Q&A는 현재 0개로 비어 있습니다.", "steps": ["1단계"], "time_required": "5분"},
    }, ensure_ascii=False)


def _dims(total60: int) -> dict:
    # diversity 25 / timeliness 15 / originality 20 — 합계가 total60(60점 만점)이 되게 나눈다
    d = min(25, total60)
    t = min(15, max(0, total60 - d))
    o = max(0, total60 - d - t)
    return {"diversity": {"score": d}, "timeliness": {"score": t}, "originality": {"score": o}}


@pytest.fixture
def run(monkeypatch):
    async def _no_json_ld(biz):
        return "{}"

    import services.action_tools as at
    monkeypatch.setattr(at, "_generate_json_ld", _no_json_ld)
    monkeypatch.setattr(gg, "build_industry_system_prompt", lambda c: "system")

    def _run(responses, dia_totals, biz, max_calls="3"):
        monkeypatch.setenv("MAX_CLAUDE_CALLS_PER_JOB", max_calls)
        calls = {"i": 0}
        g = gg.GuideGenerator.__new__(gg.GuideGenerator)

        async def _claude(prompt, system):
            r = responses[min(calls["i"], len(responses) - 1)]
            calls["i"] += 1
            return r

        monkeypatch.setattr(g, "_call_claude_async", _claude, raising=False)
        import services.content_validator as cv
        scores = {"i": 0}

        def _validate(text, keywords=None, lsi_keywords=None):
            v = _dims(dia_totals[min(scores["i"], len(dia_totals) - 1)])
            scores["i"] += 1
            return v

        monkeypatch.setattr(cv, "validate_intro_dia", _validate)
        plan = asyncio.run(g.generate_action_plan(
            biz=biz, score_data={"breakdown": {}, "context": "location_based"}, competitor_data=[], scan_id="s1",
            context="location_based",
        ))
        return plan, calls["i"]

    return _run


BIZ_REGISTERED = {"id": "b1", "name": "어니언 성수", "category": "cafe", "region": "서울 성동구", "keywords": ["카페"],
                  "naver_place_id": "38561949", "review_count": 2283, "phone": None, "address": "서울 성동구 아차산로9길 8"}
BIZ_UNKNOWN = {"id": "b2", "name": "새 가게", "category": "cafe", "region": "서울 성동구", "keywords": ["카페"],
               "naver_place_id": None, "review_count": 0, "phone": None, "address": None}


def test_guard_is_wired_registered_shop_loses_the_register_prescription(run):
    raw = _raw("요약", ["스마트플레이스 등록 (가장 먼저)", "소개글 하단에 Q&A 추가하기", "스마트플레이스 소식 첫 게시물 올리기"])
    plan, _ = run([raw], [50], BIZ_REGISTERED, max_calls="1")
    titles = [i.title for i in plan.items]
    assert not any("스마트플레이스 등록" in t for t in titles)
    assert "스마트플레이스 소식 게시물 올리기" in titles                 # 소식 미측정 → '첫' 단정 제거
    assert "현재 0개" not in (plan.this_week_mission or {}).get("why", "")
    assert [i.rank for i in plan.items] == list(range(1, len(plan.items) + 1))


def test_unknown_shop_keeps_the_register_prescription(run):
    raw = _raw("요약", ["스마트플레이스 등록 (가장 먼저)", "소개글 하단에 Q&A 추가하기"])
    plan, _ = run([raw], [50], BIZ_UNKNOWN, max_calls="1")
    assert plan.items[0].title == "스마트플레이스 등록 (가장 먼저)"       # 실제 미등록일 수 있으므로 처방 유지


def test_regeneration_keeps_the_best_attempt_not_the_last(run):
    first, second, third = _raw("첫 시도", ["A"]), _raw("둘째 시도", ["B"]), _raw("셋째 시도", ["C"])
    plan, n = run([first, second, third], [41, 26, 30], BIZ_REGISTERED, max_calls="3")   # 68 → 43 → 50
    assert n == 3
    assert plan.summary == "첫 시도"
    assert plan.dia_score == round(41 / 60 * 100, 1)
    assert plan.dia_regenerated == 2


def test_regeneration_that_improves_is_used(run):
    first, second = _raw("첫 시도", ["A"]), _raw("둘째 시도", ["B"])
    plan, _ = run([first, second], [30, 55], BIZ_REGISTERED, max_calls="2")
    assert plan.summary == "둘째 시도" and plan.dia_score == round(55 / 60 * 100, 1)


def test_guard_failure_does_not_block_guide_generation(run, monkeypatch):
    import services.guide_fact_guard as gf

    def _boom(*a, **k):
        raise RuntimeError("guard bug")

    monkeypatch.setattr(gf, "guard_guide", _boom)
    plan, _ = run([_raw("요약", ["소개글 하단에 Q&A 추가하기"])], [50], BIZ_REGISTERED, max_calls="1")
    assert plan.items and plan.items[0].title == "소개글 하단에 Q&A 추가하기"
