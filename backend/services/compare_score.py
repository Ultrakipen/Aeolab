"""내 가게의 "비교용 점수" — 경쟁사 점수와 같은 공식 (2026-10-30).

문제: 경쟁사 페이지의 순위·막대는 내 점수(`scan_results.total_score`, Track1·Track2 가중 합산)와 경쟁사 점수
(`compute_competitor_score`, 항목 평균)를 한 줄에 놓고 비교했다. 공식이 달라 같은 "AI 노출 0"이어도 크롤링된 경쟁사는 54점대,
내 가게는 키워드 순위·AI 브리핑이 0이면 훨씬 낮게 나와 "내 가게가 꼴찌"로 보이는 착시가 생길 수 있다.

해결: 내 가게도 `compute_competitor_score`로 같은 입력(리뷰·평점·소개글·메뉴·소식·블로그·웹사이트·AI 등장 비율)을 넣어 계산한
비교용 점수를 만들어 순위·막대 비교에만 쓴다. 대시보드의 종합 점수·성장 단계는 그대로다.

원칙(신뢰도): 비교에 필요한 실측 값이 없으면 점수를 만들지 않는다(None) — 0으로 채워 "꼴찌"로 만들지 않는다.
- 리뷰가 수집된 적 없음(`score_engine._is_review_unmeasured`) → None
- 비추천 표본(`probe == "recommend_v1"`) 기반 AI 측정이 없음 → None(과거 유도형 결과는 쓰지 않는다)
- 스마트플레이스 항목(소개글·메뉴·소식)을 한 번도 읽지 못했고 사용자 입력도 없음 → None
"""
from __future__ import annotations

from services.competitor_ai_exposure import FREQ_SCALE
from services.competitor_place_crawler import compute_competitor_score
from services.score_engine import _is_review_unmeasured

BASIS = "same_formula_v1"


def own_ai_signal(gemini_result: dict | None, chatgpt_result: dict | None) -> dict | None:
    """내 가게의 비유도 표본 노출 — 경쟁사 대조(`competitor_exposure`)와 같은 근거 우선순위(Gemini → ChatGPT)."""
    for name, res in (("gemini", gemini_result), ("chatgpt", chatgpt_result)):
        if (
            isinstance(res, dict)
            and res.get("probe") == "recommend_v1"
            and (res.get("sample_size") or 0) > 0
        ):
            n = int(res["sample_size"])
            count = min(int(res.get("exposure_freq") or 0), n)
            return {"source": name, "count": count, "sample_size": n,
                    "mentioned": count > 0, "exposure_freq": round(count / n * FREQ_SCALE, 2)}
    return None


def my_compare_score(biz: dict, scan: dict, sp_auto: dict | None = None) -> dict | None:
    """비교용 점수와 근거를 돌려준다. 입력이 부족하면 None."""
    if not isinstance(biz, dict) or not isinstance(scan, dict):
        return None
    if _is_review_unmeasured(biz):
        return None
    ai = own_ai_signal(scan.get("gemini_result"), scan.get("chatgpt_result"))
    if ai is None:
        return None

    sp = sp_auto or {}
    has_intro = bool(biz.get("has_intro")) or bool((biz.get("naver_intro_draft") or "").strip()) or bool(sp.get("has_intro"))
    has_recent_post = bool(biz.get("has_recent_post")) or bool(sp.get("has_recent_post"))
    has_menu = bool(sp.get("has_menu"))
    if not (sp or has_intro or has_recent_post):
        return None   # 스마트플레이스 항목을 한 번도 읽지 못했고 입력도 없다 — 0으로 채우지 않는다

    website = scan.get("website_check_result") or {}
    seo = website.get("score") if isinstance(website, dict) else None
    row = {
        "detail_synced_at": "own",   # compute_competitor_score가 실측 항목(리뷰 등)을 평균에 넣는 조건 — 위에서 실측 여부를 이미 확인
        "naver_review_count": biz.get("review_count") or 0,
        "naver_avg_rating": biz.get("avg_rating") or 0.0,
        "has_intro": has_intro,
        "has_menu": has_menu,
        "has_recent_post": has_recent_post,
        "blog_mention_count": biz.get("blog_mention_count") or 0,
        "website_seo_score": seo if isinstance(seo, (int, float)) else None,
    }
    score, _breakdown = compute_competitor_score(row, ai["mentioned"], ai["exposure_freq"], "")
    return {
        "score": round(float(score), 1),
        "basis": BASIS,
        "ai_source": ai["source"],
        "ai_count": ai["count"],
        "ai_sample_size": ai["sample_size"],
    }
