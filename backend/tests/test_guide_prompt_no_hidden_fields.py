"""가이드 프롬프트가 화면에 쓰이지 않는 필드를 요청하지 않는다 — 출력 토큰이 비용의 약 80%이고,
`expected_result`("이 주를 마치면 기대할 수 있는 변화")는 화면 어디에서도 렌더링되지 않으면서 보장처럼 읽힐 수 있는 서술이었다(2026-11-05)."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
GEN = (ROOT / "backend" / "services" / "guide_generator.py").read_text(encoding="utf-8")


def test_prompt_does_not_request_expected_result():
    schema = GEN[GEN.index('"weekly_roadmap": ['):GEN.index('"this_week_mission": {{')]
    assert '"week": 1' in schema          # 스키마 구간을 제대로 잘랐는지(빈 문자열 통과 방지)
    assert "expected_result" not in schema


def test_frontend_never_renders_expected_result():
    tsx = (ROOT / "frontend" / "app" / "(dashboard)" / "guide" / "GuideClient.tsx").read_text(encoding="utf-8")
    assert "expected_result" not in tsx and "expectedResult" not in tsx   # 화면이 쓰기 시작하면 이 테스트와 프롬프트를 함께 재검토
