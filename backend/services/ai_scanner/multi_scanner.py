import asyncio
from typing import AsyncIterator
from .gemini_scanner import GeminiScanner
from .chatgpt_scanner import ChatGPTScanner
from .naver_scanner import NaverAIBriefingScanner
from .google_scanner import GoogleAIOverviewScanner

# 업종 영문 코드 → 한국어 검색 키워드 (scan.py의 _CATEGORY_KO와 동일)
_CATEGORY_KO: dict[str, str] = {
    "restaurant": "음식점", "cafe": "카페", "chicken": "치킨", "bbq": "고기집",
    "seafood": "횟집", "bakery": "베이커리", "bar": "술집", "snack": "분식",
    "delivery": "배달음식", "health_food": "건강식",
    "medical": "병원", "dental": "치과", "oriental": "한의원", "pharmacy": "약국",
    "skincare": "피부과", "eye": "안과", "mental": "심리상담", "rehab": "물리치료",
    "hair": "미용실", "nail": "네일샵", "massage": "마사지", "spa": "스파",
    "fitness": "헬스장", "yoga": "요가", "pilates": "필라테스", "golf": "골프",
    "academy": "학원", "kids": "어린이집", "tutoring": "과외",
    "legal": "법무사", "tax": "세무사", "real_estate": "부동산",
    "photo": "사진·영상", "pet": "동물병원", "car": "자동차정비",
    "shopping": "쇼핑", "interior": "인테리어", "cleaning": "청소",
}

# Playwright 인스턴스 1개 = RAM 300~500MB → 동시 1개로 제한 (RAM 4GB 서버 OOM 방지)
PLAYWRIGHT_SEMAPHORE = asyncio.Semaphore(1)


class MultiAIScanner:
    def __init__(self, mode: str = "full"):
        """
        mode: 'trial' (Gemini 단일), 'full' (4개 AI 병렬), 'daily' (일일 자동)
        """
        self.mode = mode
        self.gemini = GeminiScanner()
        self.chatgpt = ChatGPTScanner()
        self.naver = NaverAIBriefingScanner()
        self.google = GoogleAIOverviewScanner()

    async def scan_single(self, query: str, target: str) -> dict:
        """무료 원샷 체험: ChatGPT(GPT-4o-mini) 단일 스캔 — 소상공인 인지도 최고"""
        result = await self.chatgpt.check_mention(query, target)
        return {"chatgpt": result}

    async def _run_playwright(self, fn, *args):
        """Playwright 기반 스캐너 세마포어 제한 (최대 동시 1개) + 40초 타임아웃"""
        async with PLAYWRIGHT_SEMAPHORE:
            return await asyncio.wait_for(fn(*args), timeout=40.0)

    async def scan_all(self, queries: "str | list[str]", target: str) -> dict:
        """전체 4개 AI 병렬 스캔 — Gemini·ChatGPT·Naver·Google

        API 기반 스캐너는 동시 실행, Playwright 기반은 세마포어 제한 직렬 실행.
        queries가 list인 경우 Gemini·ChatGPT 100회를 쿼리별 균등 분산.
        """
        primary_query = queries if isinstance(queries, str) else (queries[0] if queries else "")
        # API 기반 스캐너: 동시 실행 (다중 쿼리 분산 샘플링)
        api_tasks = [
            self.gemini.sample_100(queries, target),
            self.chatgpt.sample_100(queries, target),
        ]
        api_keys = ["gemini", "chatgpt"]
        api_results = await asyncio.gather(*api_tasks, return_exceptions=True)

        # Playwright 기반 스캐너: 세마포어로 동시성 제한 후 직렬 실행
        playwright_results = []
        playwright_keys = ["naver", "google"]
        playwright_fns = [
            (self.naver.check_mention, primary_query, target),
            (self.google.check_mention, primary_query, target),
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

    async def scan_basic(self, queries: "str | list[str]", target: str) -> dict:
        """A안 50/50 분할: Gemini 50회 + ChatGPT 50회 + 네이버 AI 브리핑.

        비용: ~25원/회 (Gemini 50회 ~5원 + ChatGPT 50회 ~10원 + 네이버 0원)
        용도: Basic 플랜 평일 자동 스캔.
        queries가 list인 경우 각 모델 50회를 쿼리별 균등 분산.
        """
        primary_query = queries if isinstance(queries, str) else (queries[0] if queries else "")
        gemini_result, chatgpt_result, naver_result = await asyncio.gather(
            self.gemini.sample_50(queries, target),
            self.chatgpt.sample_50(queries, target),
            self._run_playwright(self.naver.check_mention, primary_query, target),
            return_exceptions=True,
        )
        return {
            "gemini": gemini_result if not isinstance(gemini_result, Exception)
                      else {"platform": "gemini", "mentioned": False, "error": str(gemini_result)},
            "chatgpt": chatgpt_result if not isinstance(chatgpt_result, Exception)
                       else {"platform": "chatgpt", "mentioned": False, "error": str(chatgpt_result)},
            "naver":  naver_result  if not isinstance(naver_result,  Exception)
                      else {"platform": "naver",  "mentioned": False, "error": str(naver_result)},
        }

    async def scan_quick(self, query: str, target: str) -> dict:
        """수동 Quick scan: ChatGPT 5회 샘플링 + 네이버 AI 브리핑

        _run_quick_scan()에서 호출. 비용: ~5.5원/회 (ChatGPT 5회 2.5원 + Naver 0원)
        2026-05-05 변경: ChatGPT 1회 → 5회 격상 (변동성 1/√5 감소, 응답 시간 동일)
        """
        chatgpt_result, naver_result = await asyncio.gather(
            self.chatgpt.sample_5(query, target),
            self._run_playwright(self.naver.check_mention, query, target),
            return_exceptions=True,
        )
        return {
            "chatgpt": chatgpt_result if not isinstance(chatgpt_result, Exception)
                       else {"platform": "chatgpt", "mentioned": False, "error": str(chatgpt_result)},
            "naver":   naver_result   if not isinstance(naver_result,   Exception)
                       else {"platform": "naver",   "mentioned": False, "error": str(naver_result)},
        }

    async def scan_quick_with_progress(self, req) -> AsyncIterator[dict]:
        """수동 스캔 전용 SSE 진행률 스트리밍 — 4종 AI(Gemini sample_10 + ChatGPT sample_5 + Naver + Google) 빠른 모드

        NOTE: Quick(scan_quick=ChatGPT5+Naver 2종)과 다른 SSE 4종 스캔.
        사용처는 /api/scan/stream 빠른 진단용.
        sample_10 사용: 35초→4초 단축, 총 스캔 ~50초 내 완료.
        """
        region = getattr(req, "region", None) or ""
        category = getattr(req, "category", "")
        business_type = getattr(req, "business_type", "location_based") or "location_based"
        keywords = getattr(req, "keywords", None) or []
        valid_kw = [k.strip() for k in keywords if k.strip() and len(k.strip()) >= 2]
        category_ko = _CATEGORY_KO.get(category, category)
        # 등록 키워드 전체 + 카테고리 fallback → 중복 제거 → 최대 4개
        if business_type == "non_location" or not region:
            query = f"{valid_kw[0]} 추천" if valid_kw else f"{category_ko} 추천"
            _raw = [f"{kw} 추천" for kw in valid_kw] + ([f"{category_ko} 추천"] if category_ko else [])
            all_kw_queries = list(dict.fromkeys(_raw))[:4] or [query]
        else:
            query = f"{region} {valid_kw[0]} 추천" if valid_kw else f"{region} {category_ko} 추천"
            _raw = [f"{region} {kw} 추천" for kw in valid_kw] + ([f"{region} {category_ko} 추천"] if category_ko else [])
            all_kw_queries = list(dict.fromkeys(_raw))[:4] or [query]

        platforms = [
            ("gemini",  "Gemini AI 확인 중...",             self.gemini.sample_10,         False),
            ("chatgpt", "ChatGPT 5회 샘플링 중...",         self.chatgpt.sample_5,         False),
            ("naver",   "네이버 AI 브리핑 파싱 중...",       self.naver.check_mention,      True),
            ("google",  "Google AI Overview 확인 중...",    self.google.check_mention,     True),
        ]
        total = len(platforms)
        for i, (name, msg, fn, is_playwright) in enumerate(platforms):
            yield {"step": name, "status": "running", "message": msg, "progress": int(i / total * 80)}
            try:
                if name == "naver":
                    # 항상 check_mention_multi — 키워드별 결과를 keyword_results로 반환
                    result = await self._run_playwright(
                        self.naver.check_mention_multi, all_kw_queries, req.business_name
                    )
                    await asyncio.sleep(2)
                elif is_playwright:
                    result = await self._run_playwright(fn, query, req.business_name)
                    await asyncio.sleep(2)
                else:
                    result = await fn(query, req.business_name)
                yield {"step": name, "status": "done", "result": result, "progress": int((i + 1) / total * 80)}
            except Exception as e:
                yield {"step": name, "status": "error", "error": str(e), "progress": int((i + 1) / total * 80)}
        yield {"step": "complete", "status": "done", "progress": 100}

    async def scan_with_progress(self, req) -> AsyncIterator[dict]:
        """SSE 실시간 진행률 스트리밍 — Playwright 계열은 세마포어 제한

        4개 AI (Gemini·ChatGPT·Naver·Google)
        """
        region = getattr(req, "region", None) or ""
        category = getattr(req, "category", "")
        business_type = getattr(req, "business_type", "location_based") or "location_based"
        keywords = getattr(req, "keywords", None) or []
        valid_kw = [k.strip() for k in keywords if k.strip() and len(k.strip()) >= 2]
        category_ko = _CATEGORY_KO.get(category, category)
        # 등록 키워드 전체 + 카테고리 fallback → 중복 제거 → 최대 4개
        if business_type == "non_location" or not region:
            query = f"{valid_kw[0]} 추천" if valid_kw else f"{category_ko} 추천"
            _raw = [f"{kw} 추천" for kw in valid_kw] + ([f"{category_ko} 추천"] if category_ko else [])
            all_kw_queries = list(dict.fromkeys(_raw))[:4] or [query]
        else:
            query = f"{region} {valid_kw[0]} 추천" if valid_kw else f"{region} {category_ko} 추천"
            _raw = [f"{region} {kw} 추천" for kw in valid_kw] + ([f"{region} {category_ko} 추천"] if category_ko else [])
            all_kw_queries = list(dict.fromkeys(_raw))[:4] or [query]
        # (name, message, fn, is_playwright)
        platforms = [
            ("gemini",     "Gemini AI 100회 샘플링 중...",    self.gemini.sample_100,        False),
            ("chatgpt",    "ChatGPT 100회 샘플링 중...",       self.chatgpt.sample_100,       False),
            ("naver",      "네이버 AI 브리핑 파싱 중...",       self.naver.check_mention,      True),
            ("google",     "Google AI Overview 확인 중...",    self.google.check_mention,     True),
        ]
        total = len(platforms)
        for i, (name, msg, fn, is_playwright) in enumerate(platforms):
            yield {"step": name, "status": "running", "message": msg, "progress": int(i / total * 80)}
            try:
                if name == "naver":
                    result = await self._run_playwright(
                        self.naver.check_mention_multi, all_kw_queries, req.business_name
                    )
                    await asyncio.sleep(2)
                elif is_playwright:
                    result = await self._run_playwright(fn, query, req.business_name)
                    await asyncio.sleep(2)
                elif name in ("gemini", "chatgpt"):
                    # 다중 쿼리 분산 샘플링
                    result = await fn(all_kw_queries, req.business_name)
                else:
                    result = await fn(query, req.business_name)
                yield {"step": name, "status": "done", "result": result, "progress": int((i + 1) / total * 80)}
            except Exception as e:
                yield {"step": name, "status": "error", "error": str(e), "progress": int((i + 1) / total * 80)}
        yield {"step": "complete", "status": "done", "progress": 100}
