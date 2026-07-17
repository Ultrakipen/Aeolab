"""
services.blog_quality_scorer.score_posts_quality() 테스트 (2026-07-17)

실제 Anthropic API를 부르지 않도록 클라이언트·usage 로거를 mock. 서버에서 실제
API로 직접 검증한 적은 있으나(genuine=False/True 정확히 구분 확인), 회귀 방지를
위한 자동화 테스트는 없었음 — 이번에 신설.
"""
from unittest.mock import AsyncMock, patch

from services.blog_quality_scorer import score_posts_quality


def _fake_message(text: str, tokens_in: int = 100, tokens_out: int = 50):
    msg = AsyncMock()
    msg.content = [AsyncMock(text=text)]
    msg.usage = AsyncMock(input_tokens=tokens_in, output_tokens=tokens_out)
    return msg


async def test_empty_input_returns_empty_dict():
    result = await score_posts_quality([])
    assert result == {}


async def test_posts_with_no_text_are_skipped():
    result = await score_posts_quality([{"title": "", "text": ""}])
    assert result == {}


async def test_successful_response_maps_indices_correctly():
    fake_response = '[{"idx": 1, "genuine": true, "reason": "구체적 경험 서술"}, {"idx": 2, "genuine": false, "reason": "홍보성 인사만"}]'
    with patch(
        "services.anthropic_retry.create_message_with_retry",
        new=AsyncMock(return_value=_fake_message(fake_response)),
    ), patch("services.blog_quality_scorer.log_ai_usage"):
        result = await score_posts_quality([
            {"title": "3곳 방문 후기", "text": "가격은 45만원, 주차는 지하 2층"},
            {"title": "촬영 완료했습니다", "text": "감사합니다"},
        ])
    assert result[0]["genuine"] is True
    assert result[1]["genuine"] is False
    assert result[1]["reason"] == "홍보성 인사만"


async def test_malformed_response_returns_empty_dict():
    with patch(
        "services.anthropic_retry.create_message_with_retry",
        new=AsyncMock(return_value=_fake_message("이건 JSON이 아닙니다")),
    ), patch("services.blog_quality_scorer.log_ai_usage"):
        result = await score_posts_quality([{"title": "제목", "text": "내용"}])
    assert result == {}


async def test_api_exception_returns_empty_dict_not_raises():
    with patch(
        "services.anthropic_retry.create_message_with_retry",
        new=AsyncMock(side_effect=Exception("529 overloaded")),
    ):
        result = await score_posts_quality([{"title": "제목", "text": "내용"}])
    assert result == {}


async def test_only_first_five_posts_scored():
    """_MAX_POSTS_SCORED=5 — 6개를 넣어도 요청에는 5개만 포함돼야 함"""
    captured_prompt = {}

    async def _capture(client, **kwargs):
        captured_prompt["prompt"] = kwargs["messages"][0]["content"]
        return _fake_message('[{"idx": 1, "genuine": true, "reason": "ok"}]')

    posts = [{"title": f"제목{i}", "text": f"내용{i}"} for i in range(6)]
    with patch("services.anthropic_retry.create_message_with_retry", new=_capture), \
         patch("services.blog_quality_scorer.log_ai_usage"):
        await score_posts_quality(posts)

    assert "제목5" not in captured_prompt["prompt"]  # 6번째(인덱스5)는 제외돼야 함
    assert "제목4" in captured_prompt["prompt"]
