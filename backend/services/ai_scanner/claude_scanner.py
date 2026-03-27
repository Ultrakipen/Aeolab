import anthropic
import os
import logging

logger = logging.getLogger("aeolab")


class ClaudeScanner:
    """Claude를 AI 스캐너로 사용 (가이드 생성과 별개로 노출 확인용)"""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    async def check_mention(self, query: str, target: str) -> dict:
        import asyncio
        try:
            result = await asyncio.to_thread(self._call, query, target)
            return result
        except Exception as e:
            logger.warning(f"ClaudeScanner error: {e}")
            return {"platform": "claude", "mentioned": False, "error": str(e)}

    def _call(self, query: str, target: str) -> dict:
        message = self.client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"한국 소비자가 '{query}'를 검색할 때 '{target}'이(가) 추천 목록에 나오나요?\n"
                        "JSON으로만 답하세요: "
                        '{"mentioned": true/false, "rank": 순위또는null, "excerpt": "언급된텍스트또는빈문자열"}'
                    ),
                }
            ],
        )
        import json, re
        text = message.content[0].text
        m = re.search(r"\{.*?\}", text, re.DOTALL)
        result = json.loads(m.group()) if m else {"mentioned": False}
        return {"platform": "claude", **result}
