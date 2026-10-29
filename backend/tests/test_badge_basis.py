"""인증 배지: 네이버가 정상 측정된 마지막 스캔 기준 + 등급 문자·'현재 월' 날짜 제거 (2026-10-29)."""
import asyncio

import pytest
from fastapi import HTTPException

from routers import report


class _Res:
    def __init__(self, data): self.data = data


class _T:
    def select(self, *_): return self
    def eq(self, *_): return self
    def order(self, *_a, **_k): return self
    def limit(self, *_): return self
    @property
    def not_(self): return self
    def is_(self, *_): return self


class _DB:
    def table(self, _): return _T()


def _patch(monkeypatch, rows):
    async def fake(_q): return _Res(rows)
    monkeypatch.setattr(report, "execute", fake)
    monkeypatch.setattr(report, "get_client", lambda: _DB())


def _run(coro):
    return asyncio.run(coro)


MEASURED_OK = {"in_briefing": True}
FAILED = {"error": "PLAYWRIGHT_QUEUE_TIMEOUT"}


def test_basis_skips_failed_scans_and_uses_last_measured(monkeypatch):
    _patch(monkeypatch, [
        {"total_score": 30, "scanned_at": "2026-10-28T09:00:00", "naver_result": FAILED},     # 측정 실패 → 낮은 점수, 건너뜀
        {"total_score": 74, "scanned_at": "2026-10-26T09:00:00", "naver_result": MEASURED_OK},
    ])
    b = _run(report._badge_basis(_DB(), "b"))
    assert b == {"score": 74, "measured_on": "2026-10-26"}


def test_basis_none_when_every_recent_scan_failed(monkeypatch):
    _patch(monkeypatch, [{"total_score": 30, "scanned_at": "2026-10-28T09:00:00", "naver_result": FAILED}])
    assert _run(report._badge_basis(_DB(), "b")) is None


def test_svg_is_issued_from_measured_scan_not_from_latest_failure(monkeypatch):
    _patch(monkeypatch, [
        {"total_score": 30, "scanned_at": "2026-10-28T09:00:00", "naver_result": FAILED},
        {"total_score": 74, "scanned_at": "2026-10-26T09:00:00", "naver_result": MEASURED_OK},
    ])
    resp = _run(report.get_badge_svg("b"))
    body = resp.body.decode("utf-8")
    assert "2026.10.26 측정" in body                 # 요청 시점의 현재 월이 아니라 측정일
    assert "등급" not in body and ">A<" not in body and ">B<" not in body   # 등급 문자 없음
    assert "74" not in body                          # 점수 숫자 없음


def test_svg_403_when_measured_score_below_70_or_no_basis(monkeypatch):
    _patch(monkeypatch, [{"total_score": 69, "scanned_at": "2026-10-26T09:00:00", "naver_result": MEASURED_OK}])
    with pytest.raises(HTTPException) as e:
        _run(report.get_badge_svg("b"))
    assert e.value.status_code == 403
    _patch(monkeypatch, [])
    with pytest.raises(HTTPException) as e2:
        _run(report.get_badge_svg("b"))
    assert e2.value.status_code == 403


def test_json_endpoint_has_no_grade_and_uses_measured_date(monkeypatch):
    _patch(monkeypatch, [{"total_score": 80, "scanned_at": "2026-10-26T09:00:00", "naver_result": MEASURED_OK}])

    async def own(*_a, **_k): return None
    monkeypatch.setattr(report, "_verify_biz_ownership", own)
    out = _run(report.get_badge("b", user={"id": "u"}))
    assert "grade" not in out and out["issued_at"] == "2026.10.26" and out["eligible"] is True


def test_public_svg_route_is_registered_before_the_json_route():
    """"/badge/{biz_id}"가 먼저면 "xxx.svg"가 biz_id로 매칭돼 공개 SVG가 401로 막힌다(실제로 막혀 있었다)."""
    scope = {"type": "http", "method": "GET", "path": "/badge/abc123.svg", "root_path": "", "query_string": b"", "headers": []}
    matching = [r for r in report.router.routes if getattr(r, "path", "").startswith("/badge/") and r.matches(scope)[0].name == "FULL"]
    assert matching and matching[0].path == "/badge/{biz_id}.svg", [r.path for r in matching]
    # 일반 JSON 경로는 그대로 JSON 라우트로 간다
    scope_json = {**scope, "path": "/badge/abc123"}
    first = [r for r in report.router.routes if getattr(r, "path", "").startswith("/badge/") and r.matches(scope_json)[0].name == "FULL"]
    assert first and first[0].path == "/badge/{biz_id}"
