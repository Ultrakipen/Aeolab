import asyncio
import os
from openai import AsyncOpenAI


class ChatGPTScanner:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def check_citation(self, query: str, target: str) -> dict:
        """ChatGPT에서 사업장 인용 여부 확인 (gpt-4o-mini 저비용)"""
        prompt = f"""검색어: {query}
다음 사업장이 추천 목록에 포함되는지 확인하고 JSON으로만 답하세요: {target}
{{"mentioned": true/false, "rank": 순위또는null, "excerpt": "인용된텍스트"}}"""

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=1.0,
                max_tokens=200,
            )
            import json, re
            text = response.choices[0].message.content or ""
            m = re.search(r"\{.*?\}", text, re.DOTALL)
            result = json.loads(m.group()) if m else {"mentioned": False}
            return {"platform": "chatgpt", **result}
        except Exception:
            return {"platform": "chatgpt", "mentioned": False}

    async def check_mention(self, query: str, target: str) -> dict:
        """check_citation alias for multi_scanner compatibility"""
        return await self.check_citation(query, target)
