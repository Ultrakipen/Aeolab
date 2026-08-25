"""
경쟁사 점수 급등 감지 — falsy-zero 회귀 테스트.

2026-07-06 발견(project_falsy_zero_sweep): _detect_competitor_score_spike() 가
competitor_scores JSONB 딕셔너리에서 "unified_score" / "total_score" 라는 존재하지
않는 키를 읽어 항상 0 을 반환해 스파이크 판정이 영구 무력화됐던 버그.
현재 코드는 .get("score") 만 읽도록 수정됨(jobs.py:4178-4179).

이 테스트는 두 가지를 검증한다:
  A. 정상 데이터 ("score" 키): delta ≥ 15 → notifications 테이블에 insert 발생
  B. 회귀 데이터 ("unified_score" 키만): get("score") → 0 → 스파이크 미감지, insert 없음

외부 의존성(Supabase, Kakao)은 전부 mock 처리, 실제 API 호출 없음.
"""
import asyncio
import sys
import types
from types import SimpleNamespace
from unittest.mock import patch


# ── 테스트 전 sys.modules 에 내부 의존성 선주입 ────────────────────────────────────
# _detect_competitor_score_spike() 안에서 아래 모듈을 지역 import 하므로,
# 실제 구현에 의존하지 않도록 미리 가짜 모듈을 등록한다.

_mock_share_card = types.ModuleType("services.share_card")
_mock_share_card._score_stage_label = lambda score: "양호"
sys.modules.setdefault("services.share_card", _mock_share_card)

_mock_kakao_notify = types.ModuleType("services.kakao_notify")
_mock_kakao_notify.KakaoNotifier = type("KN", (), {})
sys.modules.setdefault("services.kakao_notify", _mock_kakao_notify)

from scheduler import jobs  # noqa: E402 — sys.modules 선주입 후 import


# ── Supabase 유창 API 체이닝 Mock ─────────────────────────────────────────────────

class _MockSupa:
    """
    supabase.table(…).select(…).eq(…).…execute  체이닝을 흉내낸다.

    execute 는 "bound method" 로 asyncio.to_thread(chain.execute) 에 전달되고,
    to_thread 내부에서 chain.execute() 로 호출된다.
    _responses 에서 순서대로 응답을 반환하며, inserts 에 insert 호출 인자를 기록한다.
    """

    def __init__(self, responses: list):
        self._responses = responses
        self._idx = 0
        self.inserts: list[dict] = []

    # ── 체이닝 메서드 (모두 self 반환) ────────────────────────────────────────
    def table(self, _name): return self
    def select(self, *a, **kw): return self
    def eq(self, *a, **kw): return self
    def gte(self, *a, **kw): return self
    def lt(self, *a, **kw): return self
    def order(self, *a, **kw): return self
    def limit(self, _n): return self
    def maybe_single(self): return self

    def insert(self, data: dict):
        self.inserts.append(data)
        return self

    # ── execute: to_thread 에 bound method 로 전달되어 동기 스레드에서 호출됨 ──
    def execute(self):
        resp = self._responses[self._idx] if self._idx < len(self._responses) else None
        self._idx += 1
        return SimpleNamespace(data=resp)


# ── 시나리오 공통 설정 ─────────────────────────────────────────────────────────────

_BIZ_ROW = {"id": "biz1", "user_id": "user1", "name": "내가게", "category": "restaurant"}
_PROFILE_ROW = {"phone": "01012345678", "kakao_competitor_notify": True}
_EMPTY_NOTIF = []   # 중복 알림 없음


def _run(coro):
    """비동기 코루틴을 동기 테스트에서 실행하는 헬퍼."""
    return asyncio.run(coro)


# ── 시나리오 A: 정상 "score" 키 — 스파이크 감지 및 insert 발생 ──────────────────

def test_spike_detected_with_correct_key():
    """
    competitor_scores 에 "score" 키가 있고 delta(40-20=20) ≥ threshold(15) 이면
    notifications 테이블에 "competitor_spike" 타입의 행이 insert 돼야 한다.
    """
    responses = [
        [_BIZ_ROW],                                                            # 0: businesses
        [{"competitor_scores": {"c1": {"name": "경쟁사A", "score": 40.0}},    # 1: 이번 주 스캔
          "created_at": "2026-08-25T02:00:00"}],
        [{"competitor_scores": {"c1": {"name": "경쟁사A", "score": 20.0}},    # 2: 지난 주 스캔
          "created_at": "2026-08-18T02:00:00"}],
        _EMPTY_NOTIF,                                                           # 3: dup check
        _PROFILE_ROW,                                                           # 4: profile (maybe_single)
        {},                                                                     # 5: notifications insert
    ]
    mock_client = _MockSupa(responses)

    with patch("db.supabase_client.get_client", return_value=mock_client):
        _run(jobs._detect_competitor_score_spike())

    # 핵심 검증: insert 가 실제로 호출됐어야 한다
    assert len(mock_client.inserts) == 1, (
        f"insert 호출 횟수={len(mock_client.inserts)}, 예상=1. "
        "스파이크가 감지됐을 때 notifications 에 insert 해야 합니다."
    )
    notif = mock_client.inserts[0]
    assert notif.get("type") == "competitor_spike", (
        f"insert type={notif.get('type')!r}, 예상='competitor_spike'"
    )
    assert notif.get("business_id") == "biz1"


# ── 시나리오 B: 회귀 데이터 — 잘못된 키 "unified_score" 만 있음 ───────────────────

def test_no_spike_with_wrong_key_unified_score():
    """
    competitor_scores 에 "score" 가 아닌 "unified_score" 키만 있으면
    get("score") → None → float(None or 0) = 0.0 → 스파이크 조건 불충족.
    과거 버그는 이 잘못된 키를 읽어 항상 0점 비교를 했었고,
    현재 코드가 .get("score") 만 읽는다는 것을 확인하는 회귀 방지 테스트.
    """
    responses = [
        [_BIZ_ROW],
        [{"competitor_scores": {"c1": {"name": "경쟁사A", "unified_score": 40.0}},
          "created_at": "2026-08-25T02:00:00"}],
        [{"competitor_scores": {"c1": {"name": "경쟁사A", "unified_score": 20.0}},
          "created_at": "2026-08-18T02:00:00"}],
        # 스파이크 미감지 → 이후 호출 없음 (dup check, profile, insert 모두 불필요)
    ]
    mock_client = _MockSupa(responses)

    with patch("db.supabase_client.get_client", return_value=mock_client):
        _run(jobs._detect_competitor_score_spike())

    assert len(mock_client.inserts) == 0, (
        "'unified_score' 키만 있을 때 스파이크가 오감지되면 안 됩니다. "
        f"insert 호출={len(mock_client.inserts)}회"
    )


# ── 시나리오 C: 임계값 경계 — delta = 15 (정확히 threshold) ─────────────────────

def test_spike_at_exact_threshold():
    """delta == threshold(15.0) 는 스파이크로 판정돼야 한다 (>=)."""
    responses = [
        [_BIZ_ROW],
        [{"competitor_scores": {"c1": {"name": "경쟁사B", "score": 35.0}},
          "created_at": "2026-08-25T02:00:00"}],
        [{"competitor_scores": {"c1": {"name": "경쟁사B", "score": 20.0}},
          "created_at": "2026-08-18T02:00:00"}],
        _EMPTY_NOTIF,
        _PROFILE_ROW,
        {},
    ]
    mock_client = _MockSupa(responses)

    with patch("db.supabase_client.get_client", return_value=mock_client):
        _run(jobs._detect_competitor_score_spike())

    assert len(mock_client.inserts) == 1, (
        "delta=15(=threshold) 는 스파이크로 판정해야 합니다. "
        f"insert 호출={len(mock_client.inserts)}회"
    )


# ── 시나리오 D: delta < threshold — 스파이크 미감지 ─────────────────────────────

def test_no_spike_below_threshold():
    """delta = 14 < threshold(15) 면 스파이크가 아니다."""
    responses = [
        [_BIZ_ROW],
        [{"competitor_scores": {"c1": {"name": "경쟁사C", "score": 34.0}},
          "created_at": "2026-08-25T02:00:00"}],
        [{"competitor_scores": {"c1": {"name": "경쟁사C", "score": 20.0}},
          "created_at": "2026-08-18T02:00:00"}],
    ]
    mock_client = _MockSupa(responses)

    with patch("db.supabase_client.get_client", return_value=mock_client):
        _run(jobs._detect_competitor_score_spike())

    assert len(mock_client.inserts) == 0, (
        "delta=14 < threshold=15 이면 insert 가 없어야 합니다."
    )
