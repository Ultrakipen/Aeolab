"""키워드 순위 측정 회귀 테스트 (2026-10-26).

사고: naver_keyword_rank가 `local.json`을 넘겨 search_request가 ValueError →
모든 키워드가 error+None으로 저장되고, 화면은 "미노출"로 표시했다.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.naver_api_hub import search_request
from services import naver_keyword_rank as kr
from services.score_engine import calc_keyword_search_rank_score


def test_place_api_kind_is_valid(monkeypatch):
    """장소 순위 API가 search_request가 받아들이는 kind로 호출되는지."""
    seen = {}

    async def fake_get(kind, params):
        seen["kind"] = kind
        search_request(kind)  # 유효하지 않으면 ValueError
        return {"items": [{"title": "<b>어니언</b> 성수", "link": "https://x/38561949"}]}

    monkeypatch.setattr(kr, "_naver_open_api_get", fake_get)
    rank = asyncio.run(kr._measure_place_api("성수 카페", "어니언 성수", "38561949"))
    assert seen["kind"] == "local"
    assert rank == 1


def test_score_ignores_error_rows():
    """측정 실패 키워드는 0점으로 평균을 깎지 않는다."""
    ranks = {
        "a": {"pc_rank": 1, "mobile_rank": None, "place_rank": None},
        "b": {"pc_rank": None, "mobile_rank": None, "place_rank": None, "error": "ValueError"},
    }
    score, measured = calc_keyword_search_rank_score({"keyword_ranks": ranks})
    assert measured is True
    assert score == 100.0


def test_score_all_errors_is_unmeasured():
    ranks = {"a": {"pc_rank": None, "error": "ValueError"}}
    assert calc_keyword_search_rank_score({"keyword_ranks": ranks}) == (0.0, False)


class _FakePage:
    def __init__(self, cards):
        self.cards = cards

    async def wait_for_timeout(self, ms):
        return None

    async def evaluate(self, js):
        return self.cards


def test_card_rank_uses_card_order_not_html_presence():
    """ID가 카드 목록에 없으면 미노출(None) — HTML에 ID가 있다는 이유로 1위로 부풀리지 않는다."""
    cards = [{"id": "111111", "text": "다른 가게"}, {"id": "222222", "text": "내 가게"}]
    assert asyncio.run(kr._place_card_rank(_FakePage(cards), "내가게", "222222")) == 2
    assert asyncio.run(kr._place_card_rank(_FakePage(cards), "내가게", "999999")) is None
    # ID 없는 사업장은 카드 글자의 이름으로 찾는다
    assert asyncio.run(kr._place_card_rank(_FakePage(cards), "내가게", None)) == 2
