import asyncio
import json
import re
import os
import math
import google.generativeai as genai
from typing import Optional


class GeminiScanner:
    def __init__(self):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = genai.GenerativeModel("gemini-2.0-flash")

    async def sample_100(self, query: str, target: str) -> dict:
        """100회 샘플링으로 AI 노출 빈도 측정 (핵심 차별화)"""
        mention_count = 0
        citations = []

        # 10개씩 배치 병렬 실행 (레이트 리밋 고려)
        for batch_start in range(0, 100, 10):
            tasks = [self._check(query, target) for _ in range(10)]
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
            "platform": "gemini",
            "exposure_freq": mention_count,
            "exposure_rate": mention_count / 100,
            "citations": citations[:5],
            "confidence": self._wilson_ci(mention_count, 100),
        }

    async def _check(self, query: str, target: str) -> dict:
        prompt = f"""검색어: {query}
다음 사업장이 추천되는지 JSON으로만 답하세요: {target}
{{"mentioned": true/false, "rank": 순위또는null, "excerpt": "인용텍스트"}}"""
        try:
            resp = await asyncio.to_thread(self.model.generate_content, prompt)
            m = re.search(r"\{.*?\}", resp.text, re.DOTALL)
            return json.loads(m.group()) if m else {"mentioned": False}
        except Exception:
            return {"mentioned": False}

    def _wilson_ci(self, k: int, n: int) -> dict:
        """Wilson 신뢰구간 계산 (95%)"""
        p, z = k / n, 1.96
        d = 1 + z**2 / n
        c = (p + z**2 / (2 * n)) / d
        m = (z * (p * (1 - p) / n + z**2 / (4 * n**2)) ** 0.5) / d
        return {"lower": round(max(0, c - m), 3), "upper": round(min(1, c + m), 3)}

    async def single_check(self, query: str, target: str) -> dict:
        """무료 원샷 체험용 단일 스캔"""
        result = await self._check(query, target)
        return {
            "platform": "gemini",
            "exposure_freq": 1 if result.get("mentioned") else 0,
            "exposure_rate": 1.0 if result.get("mentioned") else 0.0,
            "citations": [result.get("excerpt")] if result.get("excerpt") else [],
            "confidence": {"lower": 0, "upper": 1},
        }

    async def single_check_with_competitors(self, query: str, target: str) -> dict:
        """무료 원샷 체험용 — 경쟁 가게 목록 포함 스캔"""
        prompt = f"""검색어: "{query}"

손님이 AI에게 이 검색어로 물어봤을 때의 답변을 시뮬레이션하세요.
아래 JSON 형식으로만 답하세요 (다른 텍스트 없이):

{{
  "mentioned": true 또는 false,
  "rank": 순위(정수) 또는 null,
  "excerpt": "{target}이(가) 언급된 문장 (없으면 null)",
  "competitors": ["이 검색에서 실제로 추천될 법한 동종 업체명 3~5개"],
  "answer_summary": "AI가 이 검색에 실제로 답한다면 1~2문장 요약"
}}

확인 대상 가게: {target}
competitors는 실제 해당 지역에 존재할 법한 업체명으로 작성하세요."""

        try:
            resp = await asyncio.to_thread(self.model.generate_content, prompt)
            m = re.search(r"\{.*\}", resp.text, re.DOTALL)
            data = json.loads(m.group()) if m else {}
            mentioned = bool(data.get("mentioned"))
            return {
                "platform": "gemini",
                "mentioned": mentioned,
                "rank": data.get("rank"),
                "excerpt": data.get("excerpt") or "",
                "competitors": [
                    c for c in (data.get("competitors") or [])
                    if isinstance(c, str) and c.strip() and c.strip() != target
                ][:5],
                "answer_summary": data.get("answer_summary") or "",
                "exposure_freq": 1 if mentioned else 0,
                "exposure_rate": 1.0 if mentioned else 0.0,
                "confidence": {"lower": 0, "upper": 1},
            }
        except Exception:
            # 파싱 실패 시 기본 single_check 결과 반환
            fallback = await self._check(query, target)
            return {
                "platform": "gemini",
                "mentioned": bool(fallback.get("mentioned")),
                "rank": fallback.get("rank"),
                "excerpt": fallback.get("excerpt") or "",
                "competitors": [],
                "answer_summary": "",
                "exposure_freq": 1 if fallback.get("mentioned") else 0,
                "exposure_rate": 1.0 if fallback.get("mentioned") else 0.0,
                "confidence": {"lower": 0, "upper": 1},
            }

    async def scan_by_keywords(
        self,
        business_info: dict,
        keywords: list[str],
        max_concurrent: int = 2,
    ) -> list[dict]:
        """키워드별 100회 Gemini 스캔 (Pro+ 전용, 최대 5개 키워드)"""
        sem = asyncio.Semaphore(max_concurrent)

        async def scan_keyword(keyword: str) -> dict:
            async with sem:
                query = f"{business_info.get('region', '')} {keyword} {business_info.get('name', '')}"
                result = await self.sample_100(query, business_info.get("name", ""))
                return {
                    "keyword": keyword,
                    "query_used": query,
                    "gemini_frequency": result.get("exposure_freq", 0),
                    "exposure_rate": result.get("exposure_rate", 0.0),
                    "confidence": result.get("confidence", {}),
                }

        tasks = [scan_keyword(kw) for kw in keywords[:5]]
        return await asyncio.gather(*tasks)

    async def analyze_mention_context(self, business_name: str, ai_response: str) -> dict:
        """AI 응답 내 사업장 언급 맥락 분석 (Pro+)"""
        if business_name not in ai_response:
            return {"mentioned": False}

        prompt = f"""다음 AI 응답에서 '{business_name}'에 대한 언급을 분석하세요.
JSON으로만 응답하세요.

AI 응답:
{ai_response[:2000]}

분석 결과 형식:
{{"sentiment": "positive|neutral|negative", "mention_type": "recommendation|information|comparison|warning", "mentioned_attributes": ["속성1", "속성2"], "excerpt": "언급된 원문 발췌(최대 100자)", "position": "top3|middle|bottom"}}"""

        try:
            resp = await asyncio.to_thread(self.model.generate_content, prompt)
            m = re.search(r"\{.*?\}", resp.text, re.DOTALL)
            if m:
                return json.loads(m.group())
        except Exception:
            pass
        return {"mentioned": True, "sentiment": "neutral", "excerpt": ""}
