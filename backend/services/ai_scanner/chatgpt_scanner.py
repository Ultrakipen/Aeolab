import asyncio
import json
import logging
import os
import re
from openai import AsyncOpenAI

_logger = logging.getLogger(__name__)


class ChatGPTScanner:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def check_citation(self, query: str, target: str) -> dict:
        """ChatGPT에서 사업장 인용 여부 확인 (gpt-4o-mini 저비용, 1회 호출)"""
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
            text = response.choices[0].message.content or ""
            m = re.search(r"\{.*?\}", text, re.DOTALL)
            result = json.loads(m.group()) if m else {"mentioned": False}
            return {"platform": "chatgpt", **result}
        except Exception as e:
            _logger.debug("chatgpt check_citation failed: %s", e)
            return {"platform": "chatgpt", "mentioned": False}

    async def check_mention(self, query: str, target: str) -> dict:
        """check_citation alias for multi_scanner compatibility"""
        return await self.check_citation(query, target)

    async def _check(self, query: str, target: str) -> dict:
        """내부 호출용 — 통계 집계에 사용"""
        prompt = f"""검색어: {query}
다음 사업장이 추천되는지 JSON으로만 답하세요: {target}
{{"mentioned": true/false, "rank": 순위또는null, "excerpt": "인용텍스트"}}"""
        try:
            resp = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=1.0,
                    max_tokens=200,
                ),
                timeout=15.0,
            )
            text = resp.choices[0].message.content or ""
            m = re.search(r"\{.*?\}", text, re.DOTALL)
            return json.loads(m.group()) if m else {"mentioned": False}
        except asyncio.TimeoutError:
            _logger.debug("chatgpt _check timed out (15s): query=%s", query[:50])
            return {"mentioned": False}
        except Exception as e:
            _logger.debug("chatgpt _check failed: %s", e)
            return {"mentioned": False}

    def _wilson_ci(self, k: int, n: int) -> dict:
        """Wilson 신뢰구간 (95%)"""
        if n <= 0:
            return {"lower": 0, "upper": 0}
        p, z = k / n, 1.96
        d = 1 + z**2 / n
        c = (p + z**2 / (2 * n)) / d
        m = (z * (p * (1 - p) / n + z**2 / (4 * n**2)) ** 0.5) / d
        return {"lower": round(max(0, c - m), 3), "upper": round(min(1, c + m), 3)}

    async def sample_n(self, queries: "str | list[str]", target: str, n: int = 50) -> dict:
        """n회 샘플링으로 ChatGPT 노출 빈도 측정 (일반화 버전).

        비용: gpt-4o-mini n회 (50회 ≈ 25원/회, 100회 ≈ 50원/회)
        queries가 list인 경우 균등 분산 (Gemini와 동형).
        batch_size는 10 고정.
        """
        query_list = [queries] if isinstance(queries, str) else [q for q in queries if q]
        if not query_list:
            query_list = [""]
        q_count = len(query_list)
        base, rem = divmod(n, q_count)
        task_queries: list[str] = []
        for i, q in enumerate(query_list):
            task_queries.extend([q] * (base + (1 if i < rem else 0)))

        mention_count = 0
        citations = []
        for batch_start in range(0, n, 10):
            batch = task_queries[batch_start:batch_start + 10]
            tasks = [self._check(q, target) for q in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, Exception):
                    continue
                if r.get("mentioned"):
                    mention_count += 1
                    if r.get("excerpt"):
                        citations.append(r["excerpt"])
            await asyncio.sleep(0.5)

        return {
            "platform": "chatgpt",
            "exposure_freq": mention_count,
            "exposure_rate": mention_count / n,
            "citations": citations[:5],
            "confidence": self._wilson_ci(mention_count, n),
            "sample_size": n,
            "queries_used": query_list,
        }

    async def sample_100(self, queries: "str | list[str]", target: str) -> dict:
        """100회 샘플링 — Full 스캔 하위 호환 wrapper."""
        return await self.sample_n(queries, target, n=100)

    async def sample_50(self, queries: "str | list[str]", target: str) -> dict:
        """50회 샘플링 — Basic 자동 스캔 A안 50/50 분할 전용."""
        return await self.sample_n(queries, target, n=50)

    async def sample_5(self, query: str, target: str) -> dict:
        """5회 샘플링 — Quick 수동 스캔 전용 (1회 → 5회 격상으로 변동성 1/√5 감소).

        비용: gpt-4o-mini 5회 ≈ 2.5원/회 (1회 ~0.5원 대비 +2원)
        응답 시간: 5회 병렬 호출이라 1회와 거의 동일 (~2~3초).
        """
        return await self.sample_n(query, target, n=5)

    async def sample_10(self, query: str, target: str) -> dict:
        """10회 샘플링 — Trial/Quick scan 전용 (비용 ~5원/회)"""
        mention_count = 0
        citations = []
        tasks = [self._check(query, target) for _ in range(10)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                continue
            if r.get("mentioned"):
                mention_count += 1
                if r.get("excerpt"):
                    citations.append(r["excerpt"])
        return {
            "platform": "chatgpt",
            "exposure_freq": mention_count,
            "exposure_rate": mention_count / 10,
            "citations": citations[:3],
            "confidence": self._wilson_ci(mention_count, 10) if mention_count > 0 else {"lower": 0, "upper": 0.31},
            "sample_size": 10,
        }
