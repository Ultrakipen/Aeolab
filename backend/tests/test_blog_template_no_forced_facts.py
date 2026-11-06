"""블로그 초안 구조 지시가 '사실 지어내기 금지' 규칙과 충돌하지 않는다 (2026-11-06 점검).

구조 템플릿이 '가격 정보'·'영업시간'을 필수 단계처럼 나열하면, 입력에 없는 값을 모델이 채워 사장님이 그대로 게시할 수 있다.
"""
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent / "services" / "guide_generator.py").read_text(encoding="utf-8")


def _line_with(token: str) -> str:
    return next(l for l in SRC.splitlines() if token in l)


def test_menu_template_price_step_is_conditional_on_input():
    line = _line_with("메뉴 설명→재료·특징→가격 정보")
    assert "있을 때만" in line and "스마트플레이스에서 확인해 주세요" in line


def test_open_template_hours_step_is_conditional_on_input():
    line = _line_with("위치·교통→영업시간")
    assert "있을 때만" in line and "스마트플레이스에서 확인해 주세요" in line
