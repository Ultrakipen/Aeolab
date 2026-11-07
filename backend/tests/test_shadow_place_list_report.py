"""섀도 표본 리포트의 분류 규칙 (scripts/shadow_place_list_report.py) — 점수 반영 판단의 근거가 되는 숫자라 규칙을 고정한다."""
import importlib.util
from pathlib import Path

_p = Path(__file__).resolve().parents[1] / "scripts" / "shadow_place_list_report.py"
_spec = importlib.util.spec_from_file_location("shadow_place_list_report", _p)
rep = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rep)


def _nr(**k):
    base = {"platform": "naver", "mentioned": False, "in_briefing": False, "rank": None,
            "place_list_found": True, "place_list_rank": None, "place_list_names": ["a"]}
    base.update(k)
    return base


def test_classification_covers_each_case():
    assert rep.classify(_nr(mentioned=True, place_list_rank=2)) == "both"
    assert rep.classify(_nr(mentioned=False, place_list_rank=3)) == "old_missed"       # 기존이 목록 안 가게를 놓침
    assert rep.classify(_nr(mentioned=True)) == "text_only"                            # 텍스트 폴백만
    assert rep.classify(_nr(mentioned=True, in_briefing=True)) == "in_list_only"       # 브리핑 노출은 text_only가 아니다
    assert rep.classify(_nr()) == "absent_both"


def test_unreadable_and_unmeasured_and_old_rows_are_not_compared():
    assert rep.classify(_nr(place_list_found=False)) == "unreadable"
    assert rep.classify(_nr(place_list_found=None)) == "unreadable"                    # 못 읽음 ≠ 목록 밖
    for bad in ({"error": "captcha_or_blocked"}, {"captcha_detected": True}, {"quota_skipped": True}):
        assert rep.classify({**_nr(mentioned=True), **bad}) == "skip_unmeasured"
    assert rep.classify({"mentioned": True, "in_briefing": False}) == "no_shadow"      # 섀도 반영 이전 행
    assert rep.classify({}) == "no_shadow" and rep.classify(None) == "no_shadow"


def test_summary_counts_only_comparable_rows():
    rows = [{"naver_result": x} for x in (
        _nr(mentioned=True, place_list_rank=1), _nr(mentioned=True), _nr(place_list_found=False),
        {"mentioned": True}, {"error": "page_load_failed"})]
    s = rep.summarize(rows)
    assert s["rows"] == 5 and s["comparable_rows"] == 2
    assert s["counts"]["unreadable"] == 1 and s["counts"]["no_shadow"] == 1 and s["counts"]["skip_unmeasured"] == 1
