"""score_history 최신 1행 조회는 순위 측정 행(total_score NULL)을 건너뛰어야 한다 (2026-10-28).

배경(실측): score_history에는 순위 측정만 기록한 행(context=keyword_rank, total_score NULL)이 매일 쌓인다. 최신 1행을
`.order(score_date desc).limit(1)`로 읽으면 그 행이 잡혀 `total_score or 0`이 0점이 된다. 하라식당 본점(네이버 리뷰 4,678개,
실제 마지막 점수 49.0)의 공개 공유 페이지·공유 카드가 "0점 · 시작 전 · D등급"으로 나오고 있었다(활성 8곳 중 2곳).
이미 고친 곳(scan.py·monthly_report·jobs 일부)은 `.not_.is_("total_score","null")`를 썼고, 이 테스트는 나머지 13곳과 새로 생기는 곳을 막는다.
"""
import asyncio
import os
import pathlib
import re
import sys

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _latest_row_chains():
    out = []
    for sub in ("routers", "services", "scheduler"):
        for f in sorted((ROOT / sub).glob("*.py")):
            src = f.read_text(encoding="utf-8", errors="ignore")
            for m in re.finditer(r'table\("score_history"\)', src):
                seg = src[m.start(): m.start() + 700]
                lim = re.search(r"\.limit\(1\)", seg)
                if not lim:
                    continue
                chain = seg[: lim.end()]
                sel = re.search(r'\.select\(\s*"([^"]*)"', chain)
                if not sel or not any(k in sel.group(1) for k in ("total_score", "unified_score", "track1_score")):
                    continue
                if "desc=True" not in chain:
                    continue
                out.append((f"{f.relative_to(ROOT).as_posix()}:{src[: m.start()].count(chr(10)) + 1}", chain))
    return out


def test_every_latest_score_history_read_excludes_null_rows():
    chains = _latest_row_chains()
    # 검사 정규식이 깨져 조회 지점을 못 찾는 경우를 막는 안전장치 — 2026-10-28 기준 19곳(이미 고친 6곳 + 이번 13곳). 조회가 줄어드는 정상 리팩터링은 허용
    assert len(chains) >= 15, "조회 지점을 거의 못 찾았다 — 검사 정규식이 깨졌을 가능성"
    missing = [
        where for where, chain in chains
        if not re.search(r'not_\.is_\(\s*"total_score"\s*,\s*"null"\s*\)', chain)
        and not re.search(r'\.(eq|in_)\(\s*"context"', chain)       # 문맥(context)으로 순위 행을 이미 제외하는 조회는 허용
    ]
    assert missing == [], f"최신 1행 조회가 순위 행(NULL)을 건너뛰지 않는다: {missing}"


# ── 동작 테스트: 최신 행이 NULL인 데이터로 공개 공유 페이지 엔드포인트를 실제로 호출 ──────────────────────
class _R:
    def __init__(self, data):
        self.data = data


class _Q:
    """supabase 체인의 최소 대체 — select/eq/not_.is_/order/limit/single을 실제로 적용한다."""

    def __init__(self, rows):
        self.rows = list(rows)
        self._single = False
        self._neg = False

    def select(self, *a, **k): return self
    def eq(self, col, val): self.rows = [r for r in self.rows if r.get(col) == val]; return self
    def lt(self, col, val): self.rows = [r for r in self.rows if str(r.get(col)) < str(val)]; return self
    def gte(self, col, val): self.rows = [r for r in self.rows if str(r.get(col)) >= str(val)]; return self
    def limit(self, n): self.rows = self.rows[:n]; return self
    def single(self): self._single = True; return self
    def maybe_single(self): self._single = True; return self

    @property
    def not_(self):
        self._neg = True
        return self

    def is_(self, col, val):
        keep_null = not self._neg
        self.rows = [r for r in self.rows if (r.get(col) is None) == keep_null]
        self._neg = False
        return self

    def order(self, col, desc=False):
        self.rows = sorted(self.rows, key=lambda r: str(r.get(col) or ""), reverse=desc)
        return self


class _SB:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return _Q(self.tables.get(name, []))


def _patch_report(monkeypatch, tables):
    from routers import report

    async def fake_execute(q):
        return _R((q.rows[0] if q.rows else None) if q._single else q.rows)

    monkeypatch.setattr(report, "get_client", lambda: _SB(tables))
    monkeypatch.setattr(report, "execute", fake_execute)
    return report


HARA = {"id": "b1", "name": "하라식당 본점", "category": "restaurant", "region": "창원시 의창구"}
HISTORY = [
    {"business_id": "b1", "score_date": "2026-10-28", "total_score": None, "exposure_freq": None, "context": "keyword_rank"},   # 순위 행(최신)
    {"business_id": "b1", "score_date": "2026-07-04", "total_score": 49.0, "exposure_freq": 9, "context": "location_based"},      # 실제 마지막 점수
]


def test_public_share_data_uses_last_real_score_not_the_null_ranking_row(monkeypatch):
    report = _patch_report(monkeypatch, {"businesses": [HARA], "score_history": HISTORY})
    out = asyncio.run(report.get_share_page_data("b1"))
    assert out["score"] == 49.0                       # 0이 아니다 — 하라식당이 "시작 전·D등급"으로 공개되던 결함
    assert out["scanned_at"] == "2026-07-04"          # 점수와 날짜가 같은 행이다(날짜를 최신 행으로 속이지 않는다)
    assert out["gemini_frequency"] == 9


def test_share_data_returns_404_only_when_no_scored_row_exists(monkeypatch):
    import pytest
    from fastapi import HTTPException

    only_null = [HISTORY[0]]
    report = _patch_report(monkeypatch, {"businesses": [HARA], "score_history": only_null})
    with pytest.raises(HTTPException) as e:
        asyncio.run(report.get_share_page_data("b1"))
    assert e.value.status_code == 404                  # 점수 행이 하나도 없으면 0점으로 꾸미지 않고 "측정 결과 없음"


# ── 공유 카드 PNG: 점수 숫자·등급 문자 비노출, 대시보드와 같은 단계 이름 ────────────────────────────────
def _real_share_card():
    """다른 테스트가 services.share_card를 가짜 모듈로 등록해 두는 경우가 있다 — 진짜 모듈을 격리 import 해 쓴다(전체 실행에서만 실패하던 오염 방지)."""
    import importlib
    from unittest.mock import patch

    with patch.dict(sys.modules):
        m = sys.modules.get("services.share_card")
        if m is not None and getattr(m, "__file__", None) is None:
            sys.modules.pop("services.share_card")
        return importlib.import_module("services.share_card")


def _card_texts(monkeypatch, history):
    from PIL import ImageDraw

    report = _patch_report(monkeypatch, {"businesses": [HARA], "score_history": history})
    monkeypatch.setitem(sys.modules, "services.share_card", _real_share_card())     # 카드가 함수 안에서 from-import 하는 모듈
    drawn = []

    class _Spy:
        def __init__(self, img):
            pass

        def text(self, xy, text, **k):
            drawn.append(str(text))

    monkeypatch.setattr(ImageDraw, "Draw", lambda img: _Spy(img))
    resp = asyncio.run(report.generate_share_card("b1"))
    assert resp.media_type == "image/png" and resp.body[:4] == bytes([0x89]) + b"PNG"
    return drawn


def test_share_card_draws_stage_name_without_score_number_or_grade_letter(monkeypatch):
    history = [
        {"business_id": "b1", "score_date": "2026-10-28", "total_score": None, "track1_score": None, "exposure_freq": None},
        {"business_id": "b1", "score_date": "2026-07-04", "total_score": 49.0, "track1_score": 52.9, "exposure_freq": 9},
    ]
    texts = _card_texts(monkeypatch, history)
    joined = " | ".join(texts)
    assert "AI 검색 준비도 · 보강 단계" in joined          # track1 52.9 → 보강 단계(<55), 순위 행(NULL)에 속지 않는다
    assert not re.search(r"\d+\s*/\s*100", joined) and "/100점" not in joined     # 점수 숫자 비노출
    assert not re.search(r"[A-D]등급", joined)                                       # 등급 문자 비노출
    assert "100회" not in joined                                                     # 분모를 알 수 없는 "100회 중" 단정 금지
    assert "AI 검색 측정에서 9회 언급" in joined
    assert "측정 시점·기기·로그인 상태에 따라" in joined                              # 변동 데이터 면책


def test_share_card_uses_the_same_score_as_the_dashboard_stage(monkeypatch):
    """통합 점수(total)가 75 이상('양호' 구간)이어도 대시보드가 쓰는 track1이 55~75면 '개선 중'이다 — 공유 카드가 '양호'로 부풀리지 않는다."""
    history = [{"business_id": "b1", "score_date": "2026-10-28", "total_score": 80.0, "track1_score": 60.0, "exposure_freq": 0}]   # 통합은 양호 구간, track1은 개선 중 구간
    joined = " | ".join(_card_texts(monkeypatch, history))
    assert "AI 검색 준비도 · 개선 중" in joined and "양호" not in joined
    assert "언급" not in joined                                                      # 0회는 줄 자체를 그리지 않는다


def test_share_data_stage_score_prefers_track1_and_falls_back_to_total(monkeypatch):
    report = _patch_report(monkeypatch, {"businesses": [HARA], "score_history": [
        {"business_id": "b1", "score_date": "2026-10-28", "total_score": 72.0, "track1_score": 60.0, "exposure_freq": 1}]})
    assert asyncio.run(report.get_share_page_data("b1"))["stage_score"] == 60.0
    report = _patch_report(monkeypatch, {"businesses": [HARA], "score_history": [
        {"business_id": "b1", "score_date": "2026-10-28", "total_score": 72.0, "track1_score": None, "exposure_freq": 1}]})
    assert asyncio.run(report.get_share_page_data("b1"))["stage_score"] == 72.0


def test_share_card_and_data_fall_back_to_total_when_track1_is_zero(monkeypatch):
    """실측(어니언 성수 10-26 행): total 39.6인데 track1·track2·unified가 0.0으로 남은 불완전한 행 — 그대로 쓰면 '시작 전'이 된다."""
    row = {"business_id": "b1", "score_date": "2026-10-26", "total_score": 39.6, "track1_score": 0.0, "exposure_freq": 8}
    report = _patch_report(monkeypatch, {"businesses": [HARA], "score_history": [row]})
    assert asyncio.run(report.get_share_page_data("b1"))["stage_score"] == 39.6
    joined = " | ".join(_card_texts(monkeypatch, [row]))
    assert "AI 검색 준비도 · 보강 단계" in joined and "시작 전" not in joined


def test_share_card_shows_korean_category_and_integer_count(monkeypatch):
    """공개 카드에 영문 업종 코드('restaurant')나 '9.0회'가 나오면 안 된다."""
    row = {"business_id": "b1", "score_date": "2026-07-04", "total_score": 49.0, "track1_score": 52.9, "exposure_freq": 9.0}
    joined = " | ".join(_card_texts(monkeypatch, [row]))
    assert "음식점 · 창원시 의창구" in joined and "restaurant" not in joined
    assert "AI 검색 측정에서 9회 언급" in joined and "9.0회" not in joined
