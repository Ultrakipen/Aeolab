"""query_exposure 유도형 추가 호출(가게 이름을 질문에 넣는 single_check 3회) 재유입 방지 (2026-10-30)."""
import pathlib


def test_scan_router_has_no_name_guided_query_exposure_calls():
    src = (pathlib.Path(__file__).resolve().parent.parent / "routers" / "scan.py").read_text(encoding="utf-8")
    assert "맛집\", biz_name_qd" not in src and "예약\", biz_name_qd" not in src
    assert "gemini_qd" not in src
    assert src.count('"recommend": bool(') >= 2   # 비유도 본 스캔 결과는 계속 기록
