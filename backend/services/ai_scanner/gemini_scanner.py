import asyncio
import json
import logging
import re
import os
import math
import google.generativeai as genai
from typing import Optional

_logger = logging.getLogger(__name__)


class GeminiScanner:
    def __init__(self):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = genai.GenerativeModel("gemini-2.0-flash-001")

    async def sample_n(self, queries: "str | list[str]", target: str, n: int = 50) -> dict:
        """n회 샘플링으로 AI 노출 빈도 측정 (일반화 버전).

        queries가 list인 경우 균등 분산 — 검색 의도 다양성 반영.
        예: ["강남 음식점 추천", "강남 음식점"] × n/2회씩
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
            "platform": "gemini",
            "exposure_freq": mention_count,
            "exposure_rate": mention_count / n,
            "citations": citations[:5],
            "confidence": self._wilson_ci(mention_count, n),
            "sample_size": n,
            "queries_used": query_list,
        }

    async def sample_100(self, queries: "str | list[str]", target: str) -> dict:
        """100회 샘플링 — Full 스캔·scan_by_keywords 등 하위 호환 wrapper."""
        return await self.sample_n(queries, target, n=100)

    async def sample_50(self, queries: "str | list[str]", target: str) -> dict:
        """50회 샘플링 — Basic 자동 스캔 A안 50/50 분할 전용."""
        return await self.sample_n(queries, target, n=50)

    async def _check(self, query: str, target: str) -> dict:
        prompt = f"""검색어: {query}
다음 사업장이 추천되는지 JSON으로만 답하세요: {target}
{{"mentioned": true/false, "rank": 순위또는null, "excerpt": "인용텍스트"}}"""
        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(self.model.generate_content, prompt),
                timeout=15.0,
            )
            m = re.search(r"\{.*?\}", resp.text, re.DOTALL)
            return json.loads(m.group()) if m else {"mentioned": False}
        except asyncio.TimeoutError:
            _logger.debug("gemini _check timed out (15s): query=%s", query[:50])
            return {"mentioned": False}
        except Exception as e:
            _logger.debug("gemini _check failed: %s", e)
            return {"mentioned": False}

    def _wilson_ci(self, k: int, n: int) -> dict:
        """Wilson 신뢰구간 계산 (95%)"""
        p, z = k / n, 1.96
        d = 1 + z**2 / n
        c = (p + z**2 / (2 * n)) / d
        m = (z * (p * (1 - p) / n + z**2 / (4 * n**2)) ** 0.5) / d
        return {"lower": round(max(0, c - m), 3), "upper": round(min(1, c + m), 3)}

    async def sample_10(self, query: str, target: str) -> dict:
        """10회 샘플링 — 수동 quick scan 전용 (비용 ~0.3원/회)

        trial 스캔과 달리 exposure_freq를 10 기준으로 반환.
        """
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
            "platform": "gemini",
            "exposure_freq": mention_count,
            "exposure_rate": mention_count / 10,
            "citations": citations[:3],
            "confidence": self._wilson_ci(mention_count, 10) if mention_count > 0 else {"lower": 0, "upper": 0.31},
            "sample_size": 10,
        }

    async def _natural_check(self, query: str, target: str) -> dict:
        """자연어 응답을 받아 가게명 매칭 여부 + 발췌문 보존 (trial 신뢰도 강화 2라운드).

        반환:
            {
                "query": str,         # 사용된 쿼리 텍스트
                "raw_text": str,      # AI 응답 원문 (최대 1500자)
                "mentioned": bool,    # 가게명(target) 등장 여부
                "excerpt": str,       # 가게명 등장 위치 ±60자 (없으면 첫 100~120자)
            }
        """
        prompt = (
            f"손님이 \"{query}\" 라고 검색했을 때 추천할 만한 곳을 한국어로 자연스럽게 2~3문장으로 답해주세요. "
            "추천 사유와 함께 가게 이름이 떠오른다면 본문에 자연스럽게 포함해 주세요. "
            "JSON이 아닌 일반 문장으로만 답하세요."
        )
        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(self.model.generate_content, prompt),
                timeout=15.0,
            )
            raw = (resp.text or "").strip()
        except asyncio.TimeoutError:
            _logger.debug("gemini _natural_check timed out (15s): query=%s", query[:50])
            return {"query": query, "raw_text": "", "mentioned": False, "excerpt": ""}
        except Exception as e:
            _logger.debug("gemini _natural_check failed: %s", e)
            return {"query": query, "raw_text": "", "mentioned": False, "excerpt": ""}

        raw_trim = raw[:1500]
        target_clean = (target or "").strip()
        idx = raw_trim.find(target_clean) if target_clean else -1
        mentioned = idx >= 0

        if mentioned:
            start = max(0, idx - 60)
            end = min(len(raw_trim), idx + len(target_clean) + 60)
            excerpt = raw_trim[start:end].strip()
        else:
            # 미언급: 응답 첫 100~120자를 그대로 발췌 (잘린 단어는 자연스럽게 정리)
            head = raw_trim[:120].strip()
            # 마지막 공백 기준 자르기 (단어 중간 끊김 방지)
            if len(raw_trim) > 120 and " " in head[-30:]:
                head = head.rsplit(" ", 1)[0]
            excerpt = head

        # UTF-8 기준 140자 truncate (한글 1자 = 1 character로 카운트)
        if len(excerpt) > 140:
            excerpt = excerpt[:139].rstrip() + "…"

        return {
            "query": query,
            "raw_text": raw_trim,
            "mentioned": mentioned,
            "excerpt": excerpt,
        }

    async def sample_10_with_evidence(self, query: str, target: str) -> dict:
        """trial 전용 10회 샘플링 — 점수 + AI 응답 원문 evidence 동시 보존.

        반환:
            {
                "platform": "gemini",
                "exposure_freq": int (0~10),
                "exposure_rate": float (0.0~1.0),
                "confidence": {"lower": float, "upper": float},
                "sample_size": 10,
                "evidence_items": [          # 10개 raw 결과 (선정 규칙은 호출부에서 적용)
                    {"query": str, "mentioned": bool, "excerpt": str, "raw_text": str},
                    ...
                ],
            }
        """
        tasks = [self._natural_check(query, target) for _ in range(10)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        evidence_items: list[dict] = []
        mention_count = 0
        for r in results:
            if isinstance(r, Exception):
                _logger.debug("gemini sample_10_with_evidence task failed: %s", r)
                continue
            evidence_items.append(r)
            if r.get("mentioned"):
                mention_count += 1
        sample_n = max(1, len(evidence_items))
        return {
            "platform": "gemini",
            "exposure_freq": mention_count,
            "exposure_rate": mention_count / sample_n,
            "confidence": self._wilson_ci(mention_count, sample_n) if mention_count > 0 else {"lower": 0, "upper": 0.31},
            "sample_size": sample_n,
            "evidence_items": evidence_items,
        }

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
            resp = await asyncio.wait_for(
                asyncio.to_thread(self.model.generate_content, prompt),
                timeout=15.0,
            )
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
        except (asyncio.TimeoutError, Exception) as e:
            _logger.debug("gemini single_check_with_competitors failed (%s): %s", type(e).__name__, e)
            # 파싱 실패 / 타임아웃 시 기본 single_check 결과 반환
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
        except Exception as e:
            _logger.debug("gemini analyze_mention_context failed: %s", e)
        return {"mentioned": True, "sentiment": "neutral", "excerpt": ""}
