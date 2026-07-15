import asyncio
import json
import logging
import os
import re
from openai import AsyncOpenAI

from services.ai_usage_logger import log_ai_usage

_logger = logging.getLogger(__name__)


_CHATGPT_SEM = asyncio.Semaphore(5)  # OpenAI rate limit 대응: 동시 호출 5개 상한


class ChatGPTScanner:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def check_citation(self, query: str, target: str) -> dict:
        """ChatGPT에서 사업장 인용 여부 확인 (gpt-4.1-mini 저비용, 1회 호출)"""
        prompt = f"""검색어: {query}
다음 사업장이 추천 목록에 포함되는지 확인하고 JSON으로만 답하세요: {target}
{{"mentioned": true/false, "rank": 순위또는null, "excerpt": "인용된텍스트"}}"""

        try:
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model="gpt-4.1-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=1.0,
                    max_tokens=200,
                ),
                timeout=20.0,
            )
            self._log_usage(response, "check_citation")
            text = response.choices[0].message.content or ""
            m = re.search(r"\{.*?\}", text, re.DOTALL)
            result = json.loads(m.group()) if m else {"mentioned": False}
            return {"platform": "chatgpt", **result}
        except Exception as e:
            _logger.debug("chatgpt check_citation failed: %s", e)
            self._log_failure("check_citation", e)
            return {"platform": "chatgpt", "mentioned": False}

    async def check_mention(self, query: str, target: str) -> dict:
        """check_citation alias for multi_scanner compatibility"""
        return await self.check_citation(query, target)

    async def _check(self, query: str, target: str) -> dict:
        """내부 호출용 — 통계 집계에 사용"""
        prompt = f"""검색어: {query}
다음 사업장이 추천되는지 JSON으로만 답하세요: {target}
{{"mentioned": true/false, "rank": 순위또는null, "excerpt": "인용텍스트"}}"""
        # 429(rate limit) 한정 1회 재시도(2026-07-15) — 동시 스캔이 겹치면 OpenAI API가
        # 순간 429를 반환할 수 있는데, 재시도 없이 그 샘플만 조용히 _measured=False로
        # 빠져 유효 샘플 수가 줄어들었음. 다른 오류(타임아웃·파싱실패 등)는 재시도하지 않음.
        async with _CHATGPT_SEM:
            for attempt in range(2):
                try:
                    resp = await asyncio.wait_for(
                        self.client.chat.completions.create(
                            model="gpt-4.1-mini",
                            messages=[{"role": "user", "content": prompt}],
                            temperature=1.0,
                            max_tokens=200,
                        ),
                        timeout=20.0,
                    )
                    self._log_usage(resp, "scan_check")
                    text = resp.choices[0].message.content or ""
                    m = re.search(r"\{.*?\}", text, re.DOTALL)
                    if m:
                        return json.loads(m.group())
                    _logger.debug("chatgpt _check unparseable response: query=%s", query[:50])
                    return {"mentioned": False, "_measured": False, "_error": "unparseable"}
                except asyncio.TimeoutError as e:
                    _logger.debug("chatgpt _check timed out (20s): query=%s", query[:50])
                    self._log_failure("scan_check", e)
                    return {"mentioned": False, "_measured": False, "_error": "timeout"}
                except Exception as e:
                    is_rate_limit = type(e).__name__ == "RateLimitError" or "429" in str(e)
                    if is_rate_limit and attempt == 0:
                        _logger.debug("chatgpt _check rate-limited, retrying in 1.5s: query=%s", query[:50])
                        await asyncio.sleep(1.5)
                        continue
                    _logger.debug("chatgpt _check failed: %s", e)
                    self._log_failure("scan_check", e)
                    return {"mentioned": False, "_measured": False, "_error": str(e)}

    def _log_usage(self, resp, purpose: str) -> None:
        """gpt-4.1-mini는 reasoning 모델이 아니라 thinking 토큰 개념 없음 — prompt/completion만 기록."""
        try:
            usage = getattr(resp, "usage", None)
            if not usage:
                return
            log_ai_usage("chatgpt", "gpt-4.1-mini", purpose, usage.prompt_tokens or 0, usage.completion_tokens or 0)
        except Exception as e:
            _logger.debug("chatgpt usage 로깅 실패(무시): %s", e)

    def _log_failure(self, purpose: str, error: Exception) -> None:
        """API 호출 실패 기록 — 2026-07-12 OpenAI 결제 미등록 장애가 예외를 삼키고 조용히
        폴백되던 걸 로그로 감지 못 했던 사고 이후 신설."""
        log_ai_usage("chatgpt", "gpt-4.1-mini", f"{purpose}:FAILED:{type(error).__name__}", 0, 0)

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

        비용: gpt-4.1-mini n회 (50회 ≈ 25원/회, 100회 ≈ 50원/회)
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
        success_count = 0
        citations = []
        for batch_start in range(0, n, 10):
            batch = task_queries[batch_start:batch_start + 10]
            tasks = [self._check(q, target) for q in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, Exception) or not r.get("_measured", True):
                    continue
                success_count += 1
                if r.get("mentioned"):
                    mention_count += 1
                    if r.get("excerpt"):
                        citations.append(r["excerpt"])
            await asyncio.sleep(1.0)

        # sample_size는 실제 성공 측정 건수 — 실패(타임아웃·API 오류·파싱 실패) 건은
        # "측정 안 됨"으로 분모에서 제외한다 (실패를 "언급 안 됨"으로 오집계 방지)
        return {
            "platform": "chatgpt",
            # ResultTable/PlatformDistributionChart/ChannelScoreCards가 노출여부 판정에
            # mentioned를 직접 참조 — 누락 시 exposure_freq가 있어도 "미노출"로 잘못 표시됨
            # (2026-07-13 발견: scan_basic/scan_all 전 구간에서 mentioned 누락 확인)
            "mentioned": mention_count > 0,
            "exposure_freq": mention_count,
            "exposure_rate": (mention_count / success_count) if success_count > 0 else 0.0,
            "citations": citations[:5],
            "confidence": self._wilson_ci(mention_count, success_count),
            "sample_size": success_count,
            "requested_size": n,
            "failed_count": n - success_count,
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

        비용: gpt-4.1-mini 5회 ≈ 2.5원/회 (1회 ~0.5원 대비 +2원)
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
