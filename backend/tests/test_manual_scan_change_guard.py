"""수동 스캔 경로의 '측정 빠진 스캔과의 비교' 가드와 스캔 완료 알림의 등급 메모 (2026-11-02, T-5 후속 누락 점검).

야간 스캔에만 적용했던 가드(8ac0798)를 수동 스캔 3경로(stream·quick·full)에도 적용한다.
또 수동 스캔의 스캔 완료 알림(AEOLAB_SCAN_01)은 '이전 등급' 자리에 score["grade"](A~D 문자)를 넘겨 한글 단계명과 항상 달라 보였다 —
"(B → 개선 중)" 같은 메모가 매번 나갔다.
"""
import ast
import asyncio
import inspect
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import change_signal_guard as csg  # noqa: E402
from tests.test_naver_block_drill import _BLOCKED, _OK, _SB, _patch_db  # noqa: E402


# ── 판정 (저장 전 호출) ─────────────────────────────────────────────────────────
def _decide(monkeypatch, tonight, rows, guard_query_fails=False):
    _patch_db(monkeypatch, {"scan_results": [{"naver_result": r} for r in rows]}, guard_query_fails=guard_query_fails)
    return asyncio.run(csg.comparable_to_previous_scan(_SB(), "b1", tonight))


def test_both_measured_is_comparable(monkeypatch):
    assert _decide(monkeypatch, _OK, [_OK]) is True


def test_tonight_unmeasured_is_not_comparable_even_without_reading_the_db(monkeypatch):
    # DB가 실패해도(=읽지 않아도) 오늘 측정 실패만으로 결론이 난다
    assert _decide(monkeypatch, _BLOCKED, [_OK], guard_query_fails=True) is False
    assert _decide(monkeypatch, {"captcha_detected": True}, [_OK]) is False
    assert _decide(monkeypatch, {"error": "page_load_failed"}, [_OK]) is False


def test_previous_unmeasured_is_not_comparable(monkeypatch):
    """차단이 풀린 다음 날의 수동 스캔 — 낮았던 직전 점수와의 비교는 가짜 '개선'이다."""
    assert _decide(monkeypatch, _OK, [_BLOCKED]) is False


def test_only_the_most_recent_scan_counts_as_previous(monkeypatch):
    # 저장 전이라 가장 최근 1건이 직전이다 — 그 앞의 오래된 실패는 상관없다
    assert _decide(monkeypatch, _OK, [_OK, _BLOCKED]) is True


def test_first_ever_scan_is_comparable(monkeypatch):
    assert _decide(monkeypatch, _OK, []) is True        # 비교 대상이 없으면 어차피 prev_history가 없어 0.0이다


def test_unreadable_history_is_not_comparable(monkeypatch):
    assert _decide(monkeypatch, _OK, [_OK], guard_query_fails=True) is False


def test_never_raises():
    class Boom:
        def table(self, *_a, **_k):
            raise RuntimeError("client broken")

    assert asyncio.run(csg.comparable_to_previous_scan(Boom(), "b1", _OK)) is False


def test_outer_safety_net_returns_false_when_the_inner_lookup_itself_raises(monkeypatch):
    """안쪽 조회 함수가 자체적으로 예외를 삼키므로 위 테스트로는 바깥 except에 닿지 않는다 — 안쪽이 예외를 올리는 경우를 직접 만든다."""
    async def raising(*_a, **_k):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(csg, "recent_naver_unmeasured_flags", raising)
    assert asyncio.run(csg.comparable_to_previous_scan(_SB(), "b1", _OK)) is False


# ── 알림 본문의 등급 메모 ─────────────────────────────────────────────────────────
def _scan_complete_vars(grade_arg, score=62.0, weekly=5.0):
    from services.kakao_notify import KakaoNotifier
    n = KakaoNotifier()
    captured = {}

    async def fake_send(phone, kind, variables, *a, **k):
        captured.update(variables)
        return True

    n._send = fake_send
    asyncio.run(n.send_scan_complete("01012345678", "가게", score, grade_arg, weekly, "ChatGPT", "가이드에서 확인"))
    return captured


def test_old_behavior_letter_grade_always_looked_like_a_change():
    """이전 버그의 재현 — 현재 등급을 문자("B")로 넘기면 같은 등급이어도 '(B → …)'가 나간다."""
    v = _scan_complete_vars("B")
    assert "→" in v["#{등급변화메모}"] and "B" in v["#{등급변화메모}"]


def test_previous_stage_name_gives_a_truthful_memo():
    from services.kakao_notify import _grade
    assert _scan_complete_vars(_grade(62.0))["#{등급변화메모}"] == "(유지)"            # 같은 단계
    assert _scan_complete_vars(_grade(20.0))["#{등급변화메모}"] == f"({_grade(20.0)} → {_grade(62.0)})"   # 실제로 단계가 올랐을 때만
    assert _scan_complete_vars("")["#{등급변화메모}"] == "(유지)"                       # 비교 대상 없음(첫 스캔·비교 보류)


# ── 구조: 세 경로 모두 가드를 거치고, 알림은 가드와 올바른 이전 등급을 쓴다 ─────────────────────
def _src():
    import routers.scan as rs
    return inspect.getsource(rs)


def test_all_three_manual_paths_guard_weekly_change():
    s = _src()
    assert s.count("_cmp_ok = await _cmp_prev(") == 3
    assert s.count('if _cmp_ok and prev_history and prev_history[0].get("score_date") != str(_date.today()) else 0.0') == 3
    # 가드 없는 옛 형태가 남아 있지 않다
    assert ') if prev_history and prev_history[0].get("score_date") != str(_date.today()) else 0.0' not in s


def test_scan_complete_notification_is_gated_and_uses_previous_stage_name():
    s = _src()
    assert "if phone and notify_on and _cmp_ok:" in s
    assert "grade=_prev_grade_label," in s
    assert 'grade=score["grade"],' not in s


def test_guard_variables_are_defined_in_the_function_that_uses_them():
    """알림 블록은 try/except 안이라 NameError가 조용히 삼켜진다 — 같은 함수에서 정의되는지 AST로 확인."""
    import routers.scan as rs
    tree = ast.parse(inspect.getsource(rs))
    fn = next(n for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef) and n.name == "_save_scan_results")
    stores = {n.id for n in ast.walk(fn) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store)}
    loads = {n.id for n in ast.walk(fn) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load)}
    for name in ("_cmp_ok", "_prev_grade_label", "weekly_change"):
        assert name in stores and name in loads
    src = inspect.getsource(rs._save_scan_results)
    assert src.index("_cmp_ok = await _cmp_prev(") < src.index("if phone and notify_on and _cmp_ok:")
    assert src.index("_prev_grade_label = (") < src.index("grade=_prev_grade_label,")
