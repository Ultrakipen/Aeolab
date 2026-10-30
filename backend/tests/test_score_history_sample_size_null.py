"""score_history.sample_size — Gemini를 측정하지 못한 스캔을 '50회 중 0회'로 기록하지 않는다 (2026-10-30, 컬럼은 NULL 허용 확인)."""
import pathlib


def test_score_history_sample_size_not_faked_as_50():
    src = (pathlib.Path(__file__).resolve().parent.parent / "routers" / "scan.py").read_text(encoding="utf-8")
    assert '"sample_size": (results.get("gemini") or {}).get("sample_size") or 50' not in src
    assert '"sample_size": (result.get("gemini") or {}).get("sample_size") or 50' not in src
    assert 'result.get("gemini", {}).get("sample_size") or 50' not in src
    assert src.count('.get("sample_size") or None') >= 3
