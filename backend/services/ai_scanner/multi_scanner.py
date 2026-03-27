import asyncio
from typing import AsyncIterator
from .gemini_scanner import GeminiScanner
from .chatgpt_scanner import ChatGPTScanner
from .perplexity_scanner import PerplexityScanner
from .grok_scanner import GrokScanner
from .naver_scanner import NaverAIBriefingScanner
from .claude_scanner import ClaudeScanner
from .zeta_scanner import ZetaScanner
from .google_scanner import GoogleAIOverviewScanner

# Playwright 인스턴스 1개 = RAM 300~500MB → 최대 2개 동시 실행으로 제한 (서버 RAM 4GB 보호)
PLAYWRIGHT_SEMAPHORE = asyncio.Semaphore(2)


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
        self.zeta = ZetaScanner()
        self.google = GoogleAIOverviewScanner()

    async def scan_single(self, query: str, target: str) -> dict:
        """무료 원샷 체험: Gemini Flash 단일 스캔"""
        result = await self.gemini.single_check(query, target)
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
        playwright_keys = ["naver", "zeta", "google"]
        playwright_fns = [
            (self.naver.check_mention, query, target),
            (self.zeta.check_mention, query, target),
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

    async def scan_with_progress(self, req) -> AsyncIterator[dict]:
        """SSE 실시간 진행률 스트리밍 — Playwright 계열은 세마포어 제한"""
        query = f"{req.region} {req.category} 추천"
        # (name, message, fn, is_playwright)
        platforms = [
            ("gemini",     "Gemini AI 100회 샘플링 중...",    self.gemini.sample_100,        False),
            ("chatgpt",    "ChatGPT 결과 확인 중...",          self.chatgpt.check_mention,    False),
            ("perplexity", "Perplexity 검색 중...",            self.perplexity.check,         False),
            ("grok",       "Grok AI 검색 중...",               self.grok.check,               False),
            ("claude",     "Claude AI 확인 중...",             self.claude.check_mention,     False),
            ("naver",      "네이버 AI 브리핑 파싱 중...",       self.naver.check_mention,      True),
            ("zeta",       "뤼튼(Zeta) AI 확인 중...",         self.zeta.check_mention,       True),
            ("google",     "Google AI Overview 확인 중...",    self.google.check_mention,     True),
        ]
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
