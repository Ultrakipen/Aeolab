import asyncio
from typing import AsyncIterator
from .gemini_scanner import GeminiScanner
from .chatgpt_scanner import ChatGPTScanner
from .perplexity_scanner import PerplexityScanner
from .grok_scanner import GrokScanner
from .naver_scanner import NaverAIBriefingScanner
from .claude_scanner import ClaudeScanner
from .google_scanner import GoogleAIOverviewScanner

# Playwright 인스턴스 1개 = RAM 300~500MB → 동시 1개로 제한 (RAM 4GB 서버 OOM 방지)
PLAYWRIGHT_SEMAPHORE = asyncio.Semaphore(1)


class MultiAIScanner:
    def __init__(self, mode: str = "full"):
        """
        mode: 'trial' (Gemini 단일), 'full' (8개 AI 병렬), 'daily' (일일 자동)
        """
        self.mode = mode
        self.gemini = GeminiScanner()
        self.chatgpt = ChatGPTScanner()
        self.perplexity = PerplexityScanner()
        self.grok = GrokScanner()
        self.naver = NaverAIBriefingScanner()
        self.claude = ClaudeScanner()
        self.google = GoogleAIOverviewScanner()

    async def scan_single(self, query: str, target: str) -> dict:
        """무료 원샷 체험: Gemini Flash 단일 스캔 (경쟁 가게 포함)"""
        result = await self.gemini.single_check_with_competitors(query, target)
        return {"gemini": result}

    async def _run_playwright(self, fn, *args):
        """Playwright 기반 스캐너 세마포어 제한 (최대 동시 2개)"""
        async with PLAYWRIGHT_SEMAPHORE:
            return await fn(*args)

    async def scan_all(self, query: str, target: str) -> dict:
        """전체 8개 AI 병렬 스캔 — API 계열은 동시, Playwright 계열은 세마포어 제한"""
        # API 기반 스캐너: 동시 실행
        api_tasks = [
            self.gemini.sample_100(query, target),
            self.chatgpt.check_mention(query, target),
            self.perplexity.check(query, target),
            self.grok.check(query, target),
            self.claude.check_mention(query, target),
        ]
        api_keys = ["gemini", "chatgpt", "perplexity", "grok", "claude"]
        api_results = await asyncio.gather(*api_tasks, return_exceptions=True)

        # Playwright 기반 스캐너: 세마포어로 동시성 제한 후 직렬 실행
        playwright_results = []
        playwright_keys = ["naver", "google"]
        playwright_fns = [
            (self.naver.check_mention, query, target),
            (self.google.check_mention, query, target),
        ]
        for fn, *args in playwright_fns:
            try:
                result = await self._run_playwright(fn, *args)
            except Exception as e:
                result = e
            playwright_results.append(result)
            await asyncio.sleep(2)  # 인스턴스 해제 대기

        all_keys = api_keys + playwright_keys
        all_results = list(api_results) + playwright_results
        return {
            k: (v if not isinstance(v, Exception) else {"platform": k, "mentioned": False, "error": str(v)})
            for k, v in zip(all_keys, all_results)
        }

    async def scan_basic(self, query: str, target: str) -> dict:
        """Basic 플랜 경량 자동 스캔: Gemini(100회) + 네이버 AI 브리핑만.

        비용: ~15원/회 (풀스캔 대비 절반 이하)
        용도: Basic 플랜 평일 자동 스캔 (핵심 지표 매일 업데이트)
        """
        gemini_result, naver_result = await asyncio.gather(
            self.gemini.sample_100(query, target),
            self._run_playwright(self.naver.check_mention, query, target),
            return_exceptions=True,
        )
        return {
            "gemini": gemini_result if not isinstance(gemini_result, Exception)
                      else {"platform": "gemini", "mentioned": False, "error": str(gemini_result)},
            "naver":  naver_result  if not isinstance(naver_result,  Exception)
                      else {"platform": "naver",  "mentioned": False, "error": str(naver_result)},
        }

    async def scan_all_no_perplexity(self, query: str, target: str) -> dict:
        """7개 AI 병렬 스캔 — Perplexity 제외 (수동 스캔·비월요일 자동 스캔용)

        비용: ~15원/회 (풀스캔 대비 40% 절감, Perplexity ~25원 제외)
        """
        api_tasks = [
            self.gemini.sample_100(query, target),
            self.chatgpt.check_mention(query, target),
            self.grok.check(query, target),
            self.claude.check_mention(query, target),
        ]
        api_keys = ["gemini", "chatgpt", "grok", "claude"]
        api_results = await asyncio.gather(*api_tasks, return_exceptions=True)

        playwright_results = []
        playwright_keys = ["naver", "google"]
        playwright_fns = [
            (self.naver.check_mention, query, target),
            (self.google.check_mention, query, target),
        ]
        for fn, *args in playwright_fns:
            try:
                result = await self._run_playwright(fn, *args)
            except Exception as e:
                result = e
            playwright_results.append(result)
            await asyncio.sleep(2)

        all_keys = api_keys + playwright_keys
        all_results = list(api_results) + playwright_results
        return {
            k: (v if not isinstance(v, Exception) else {"platform": k, "mentioned": False, "error": str(v)})
            for k, v in zip(all_keys, all_results)
        }

    async def scan_with_progress(self, req, include_perplexity: bool = False) -> AsyncIterator[dict]:
        """SSE 실시간 진행률 스트리밍 — Playwright 계열은 세마포어 제한

        include_perplexity: True면 Perplexity 포함 (월요일 자동 스캔 전용)
        """
        region = getattr(req, "region", None) or ""
        category = getattr(req, "category", "")
        business_type = getattr(req, "business_type", "location_based") or "location_based"
        if business_type == "non_location" or not region:
            query = f"{category} 추천"
        else:
            query = f"{region} {category} 추천"
        # (name, message, fn, is_playwright)
        platforms = [
            ("gemini",     "Gemini AI 100회 샘플링 중...",    self.gemini.sample_100,        False),
            ("chatgpt",    "ChatGPT 결과 확인 중...",          self.chatgpt.check_mention,    False),
            ("grok",       "Grok AI 검색 중...",               self.grok.check,               False),
            ("claude",     "Claude AI 확인 중...",             self.claude.check_mention,     False),
            ("naver",      "네이버 AI 브리핑 파싱 중...",       self.naver.check_mention,      True),
            ("google",     "Google AI Overview 확인 중...",    self.google.check_mention,     True),
        ]
        if include_perplexity:
            platforms.insert(2, ("perplexity", "Perplexity 검색 중...", self.perplexity.check, False))
        total = len(platforms)
        for i, (name, msg, fn, is_playwright) in enumerate(platforms):
            yield {"step": name, "status": "running", "message": msg, "progress": int(i / total * 80)}
            try:
                if is_playwright:
                    result = await self._run_playwright(fn, query, req.business_name)
                    await asyncio.sleep(2)  # 인스턴스 해제 대기
                else:
                    result = await fn(query, req.business_name)
                yield {"step": name, "status": "done", "result": result, "progress": int((i + 1) / total * 80)}
            except Exception as e:
                yield {"step": name, "status": "error", "error": str(e), "progress": int((i + 1) / total * 80)}
        yield {"step": "complete", "status": "done", "progress": 100}
