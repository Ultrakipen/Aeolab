import httpx
import json
import re
import os


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
                        "model": "llama-3.1-sonar-small-128k-online",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                    },
                )
                data = response.json()
                text = data["choices"][0]["message"]["content"]
                m = re.search(r"\{.*?\}", text, re.DOTALL)
                result = json.loads(m.group()) if m else {"mentioned": False}
                return {"platform": "perplexity", **result}
        except Exception:
            return {"platform": "perplexity", "mentioned": False}

    async def check_mention(self, query: str, target: str) -> dict:
        return await self.check(query, target)
