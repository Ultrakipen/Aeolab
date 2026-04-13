import httpx
import json
import logging
import re
import os

logger = logging.getLogger(__name__)


class PerplexityScanner:
    BASE_URL = "https://api.perplexity.ai"

    async def check(self, query: str, target: str) -> dict:
        """Perplexity 출처 기반 검색 노출 확인"""
        prompt = f"""검색어: {query}
다음 사업장이 추천 목록에 포함되는지 확인하고 JSON으로만 답하세요: {target}
{{"mentioned": true/false, "rank": 순위또는null, "excerpt": "인용된텍스트"}}"""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {os.getenv('PERPLEXITY_API_KEY')}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "sonar",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                    },
                )
                data = response.json()
                text = data["choices"][0]["message"]["content"]
                m = re.search(r"\{.*?\}", text, re.DOTALL)
                result = json.loads(m.group()) if m else {"mentioned": False}
                return {"platform": "perplexity", **result}
        except Exception as e:
            logger.warning("PerplexityScanner.check failed: query=%s target=%s error=%s", query, target, e)
            return {"platform": "perplexity", "mentioned": False}

    async def check_mention(self, query: str, target: str) -> dict:
        return await self.check(query, target)
