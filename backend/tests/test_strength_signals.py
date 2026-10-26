"""강점 신호 규칙 테스트 — 0·NULL·오류·오래됨·ID 없음·경쟁사 부족·가게 이름 키워드 등 오탐 방지 중심."""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.strength_signals import build_strengths, is_brand_keyword

NOW = datetime(2026, 10, 27, 12, 0, tzinfo=timezone.utc)
FRESH = (NOW - timedelta(days=3)).isoformat()
STALE = (NOW - timedelta(days=45)).isoformat()


def biz(**kw):
    b = {"name": "어니언 성수", "naver_place_id": "38561949", "visitor_review_count": 2283, "avg_rating": 0.0}
    b.update(kw)
    return b


def comps(*counts):
    return [{"naver_review_count": c, "is_active": True} for c in counts]


def keys(res):
    return [i["key"] for i in res["items"]]


def run(b=None, scan=None, rank=None, cs=None):
    return build_strengths(b or biz(), scan, rank, cs or [], now=NOW)


# ── 방문자 리뷰 ──
def test_reviews_need_place_id_and_positive_count():
    assert "reviews" not in keys(run(biz(naver_place_id=None)))   # 입력값일 수 있음
    assert "reviews" not in keys(run(biz(naver_place_id="  ")))
    assert "reviews" not in keys(run(biz(visitor_review_count=0)))
    assert "reviews" not in keys(run(biz(visitor_review_count=None)))
    assert "reviews" in keys(run())


def test_rating_hidden_when_zero_shown_when_positive():
    assert "평점" not in run()["items"][0]["text"]
    assert "평점 4.86" in run(biz(avg_rating=4.86))["items"][0]["text"]


def test_competitor_compare_requires_three_synced():
    assert run(cs=comps(10, 20))["items"][0]["detail"] is None
    # 리뷰 0/None(미동기화)은 경쟁사 수에서 제외 → 3곳이 안 되면 비교 없음
    assert run(cs=comps(10, 20, 0, None))["items"][0]["detail"] is None
    d = run(biz(visitor_review_count=45), cs=comps(78, 23, 18, 4, 3))["items"][0]["detail"]
    assert "5곳" in d and "2번째" in d and "내가 등록한" in d


def test_competitor_rank_first_and_last():
    assert "1번째" in run(cs=comps(10, 20, 30))["items"][0]["detail"]
    assert "4번째" in run(biz(visitor_review_count=5), cs=comps(10, 20, 30))["items"][0]["detail"]


# ── ChatGPT ──
def chat(freq=25, size=50, **extra):
    r = {"exposure_freq": freq, "sample_size": size}
    r.update(extra)
    return {"scanned_at": FRESH, "chatgpt_result": r}


def test_chatgpt_needs_sample_and_positive_freq():
    assert "chatgpt" in keys(run(scan=chat()))
    assert "chatgpt" not in keys(run(scan=chat(size=5)))      # 표본 작음
    assert "chatgpt" not in keys(run(scan=chat(freq=0)))      # 0은 강점 아님
    assert "chatgpt" not in keys(run(scan=chat(freq=None)))
    assert "chatgpt" not in keys(run(scan={"scanned_at": STALE, "chatgpt_result": {"exposure_freq": 25, "sample_size": 50}}))


def test_chatgpt_error_is_unmeasured_not_miss():
    res = run(scan=chat(freq=0, size=50, error="insufficient_quota"))
    assert "chatgpt" not in keys(res)
    assert res["unmeasured"] == ["ChatGPT 추천 측정"]


def test_stale_error_not_reported_as_unmeasured():
    res = run(scan={"scanned_at": STALE, "chatgpt_result": {"error": "x"}, "naver_result": {"error": "y"}})
    assert res["unmeasured"] == []


# ── 네이버 AI 브리핑 ──
def naver(**r):
    return {"scanned_at": FRESH, "naver_result": r}


def test_briefing_true_fresh_only():
    assert "briefing" in keys(run(scan=naver(in_briefing=True)))
    assert "briefing" not in keys(run(scan=naver(in_briefing=False)))
    assert "briefing" not in keys(run(scan={"scanned_at": STALE, "naver_result": {"in_briefing": True}}))


def test_briefing_error_captcha_unrecognized_are_unmeasured():
    for r in ({"error": "PLAYWRIGHT_QUEUE_TIMEOUT", "mentioned": False}, {"captcha_detected": True}, {"briefing_unrecognized": True}):
        res = run(scan=naver(in_briefing=True, **r))   # 오류가 있으면 in_briefing=True여도 믿지 않는다
        assert "briefing" not in keys(res)
        assert res["unmeasured"] == ["네이버 AI 브리핑 측정"]


# ── 첫 화면 노출 키워드 ──
def ranks(**kw):
    d = {"_context": {"scanned_at": FRESH}}
    d.update(kw)
    return {"scanned_at": FRESH, "keyword_ranks": d}


def test_keywords_exclude_brand_error_and_meta():
    r = ranks(**{
        "어니언 성수": {"pc_rank": 1, "mobile_rank": 1, "place_rank": 1},       # 가게 이름 → 제외
        "성수 카페": {"pc_rank": None, "mobile_rank": None, "place_rank": None},  # 미노출
        "성수동 카페": {"pc_rank": 3, "error": "ValueError"},                      # 오류 행
        "성수 디저트": {"pc_rank": None, "mobile_rank": 2, "place_rank": None},
    })
    res = run(rank=r)
    it = [i for i in res["items"] if i["key"] == "keywords"][0]
    assert "1개" in it["text"] and "'성수 디저트'" in it["text"] and "어니언" not in it["text"]
    assert it["link"].startswith("https://search.naver.com/search.naver?query=")


def test_keywords_none_when_nothing_exposed_or_stale():
    assert "keywords" not in keys(run(rank=ranks(**{"a": {"pc_rank": None, "mobile_rank": None, "place_rank": None}})))
    stale = {"scanned_at": STALE, "keyword_ranks": {"_context": {"scanned_at": STALE}, "a": {"pc_rank": 1}}}
    assert "keywords" not in keys(run(rank=stale))
    assert "keywords" not in keys(run(rank={"scanned_at": FRESH, "keyword_ranks": None}))


def test_keywords_name_cap():
    r = ranks(**{f"키워드{i}": {"pc_rank": 1} for i in range(5)})
    it = [i for i in run(rank=r)["items"] if i["key"] == "keywords"][0]
    assert "5개" in it["text"] and "외 2개" in it["text"]


# ── 카카오·구글 ──
def test_kakao_and_google_rules():
    assert "kakao" in keys(run(scan={"scanned_at": FRESH, "kakao_result": {"is_on_kakao": True}}))
    assert "kakao" not in keys(run(scan={"scanned_at": FRESH, "kakao_result": {"is_on_kakao": False}}))
    # mentioned=True여도 AI 개요 노출이 아니면 쓰지 않는다
    assert "google_ai" not in keys(run(scan={"scanned_at": FRESH, "google_result": {"mentioned": True, "in_ai_overview": False}}))
    assert "google_ai" in keys(run(scan={"scanned_at": FRESH, "google_result": {"in_ai_overview": True}}))


# ── 개수 제한·빈 상태 ──
def test_max_items_cap_and_total():
    scan = {"scanned_at": FRESH, "chatgpt_result": {"exposure_freq": 25, "sample_size": 50},
            "naver_result": {"in_briefing": True}, "kakao_result": {"is_on_kakao": True},
            "google_result": {"in_ai_overview": True}}
    res = run(scan=scan, rank=ranks(a={"pc_rank": 1}))
    assert len(res["items"]) == 4 and res["total_found"] == 6
    assert keys(res)[0] == "reviews"


def test_empty_reasons():
    assert run(biz(naver_place_id=None))["empty_reason"] == "no_place_id"
    assert run(biz(visitor_review_count=0))["empty_reason"] == "none"
    assert run()["empty_reason"] is None


# ── 가게 이름 키워드 (프론트 lib/keywordBrand.ts와 같은 15케이스) ──
def test_is_brand_keyword_cases():
    cases = [
        ("어니언 성수", "어니언 성수", True), ("서울 성동구 어니언 성수", "어니언 성수", True),
        ("성수 카페", "어니언 성수", False), ("성수동 카페", "어니언 성수", False),
        ("원천맥주 광교", "원천맥주 광교점", True), ("수원시 영통구 치킨", "원천맥주 광교점", False),
        ("창원 치킨", "치킨", False), ("하라식당 본점 예약", "하라식당 본점", True),
        ("창원 규동", "하라식당 본점", False), ("홍뮤직스튜디오작곡교습소", "홍뮤직스튜디오작곡교습소", True),
        ("창원 작곡", "홍뮤직스튜디오작곡교습소", False), ("아르결", "아르결 성수점", True),
        ("성동구 미용실", "아르결 성수점", False), ("", "어니언", False), ("어니언", None, False),
    ]
    for k, n, exp in cases:
        assert is_brand_keyword(k, n) is exp, (k, n)


def test_rating_format_and_needs_place_id():
    assert "평점 5.0" in run(biz(avg_rating=5.0))["items"][0]["text"]
    assert "평점 4.3" in run(biz(avg_rating=4.3))["items"][0]["text"]
    assert run()["needs_place_id"] is False
    assert run(biz(naver_place_id=None))["needs_place_id"] is True
