"""경쟁사 역전 기록·알림(COMP_02) 규칙 (2026-11-02).

- 경쟁사 점수는 간이 추정치라 기록·알림에 점수 숫자를 쓰지 않는다(화면: "N점 앞서 있습니다" 제거).
- 경쟁사 등급 구간이 내 가게보다 높을 때, 새 측정 방식(ai_basis) 항목일 때만 남기고 알린다.
- 격차설명 변수는 "추정상"(항상 "큰 격차로"였던 값 대체).
"""
import asyncio
import inspect
import os
import re
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scheduler import jobs  # noqa: E402
from services import kakao_notify  # noqa: E402

NEW = {"score": 60.0, "name": "라움", "ai_basis": "recommend_v1"}


def _run(my, comp, item, monkeypatch, phone="01000000000"):
    sb = MagicMock()
    sent = []

    async def fake_db(q, *a, **k):
        return SimpleNamespace(data=[])          # 오늘 기록·최근 7일 알림 모두 없음

    class FakeNotifier:
        async def send_competitor_overtake(self, *args, **kw):
            sent.append(args)

    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(kakao_notify, "KakaoNotifier", FakeNotifier)
    asyncio.run(jobs._auto_log_competitor_overtake(sb, "biz-1", "라움", my, comp, phone=phone, biz_name="내가게", comp_item=item))
    calls = sb.table.return_value.insert.call_args_list
    return (calls[0].args[0] if calls else None), sent


def test_new_basis_higher_stage_is_logged_and_alerted_without_numbers(monkeypatch):
    row, sent = _run(20.0, 60.0, NEW, monkeypatch)             # 시작 전 vs 개선 중, 격차 40
    assert row and row["action_type"] == "competitor_ahead"
    assert row["action_label"].startswith("경쟁사 '라움'가")      # 중복 방지 ilike 필터와 같은 접두어
    assert "(추정)" in row["action_label"] and not re.search(r"\d", row["action_label"])
    assert len(sent) == 1


def test_legacy_basis_item_is_not_logged_or_alerted(monkeypatch):
    row, sent = _run(20.0, 60.0, {"score": 60.0, "name": "라움"}, monkeypatch)   # ai_basis 없음 = 옛 방식(가짜 역전 위험)
    assert row is None and sent == []


def test_same_stage_is_not_logged_even_if_gap_is_20(monkeypatch):
    row, sent = _run(31.0, 54.0, NEW, monkeypatch)             # 둘 다 보강 단계, 격차 23
    assert row is None and sent == []


def test_small_gap_is_not_logged(monkeypatch):
    row, sent = _run(20.0, 35.0, NEW, monkeypatch)             # 단계는 다르지만 격차 15 < 20
    assert row is None and sent == []


def test_old_call_without_item_still_works(monkeypatch):
    row, _ = _run(20.0, 60.0, None, monkeypatch)
    assert row is not None


def test_nightly_call_site_passes_the_competitor_item():
    src = inspect.getsource(jobs.daily_scan_all)
    assert "comp_item=_cdata" in src


def test_alimtalk_gap_variable_has_no_size_claim_or_digits(monkeypatch):
    captured = {}

    async def fake_send(self, phone, key, params):
        captured.update(params)

    monkeypatch.setattr(kakao_notify.KakaoNotifier, "_send", fake_send)
    n = kakao_notify.KakaoNotifier.__new__(kakao_notify.KakaoNotifier)
    asyncio.run(n.send_competitor_overtake("01000000000", "내가게", "라움", 20.0, 60.0, 40.0))
    assert captured["#{격차설명}"] == "추정상"
    assert not re.search(r"\d", "".join(str(v) for k, v in captured.items() if k != "#{사업장명}"))
    assert all(len(str(v)) <= 14 for v in captured.values() if v != "내가게")
