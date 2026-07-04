import asyncio
import logging
import os
import random
from typing import AsyncIterator

_logger = logging.getLogger("aeolab")
from .gemini_scanner import GeminiScanner
from .chatgpt_scanner import ChatGPTScanner
from .naver_scanner import NaverAIBriefingScanner
from .google_scanner import GoogleAIOverviewScanner
from . import naver_ai_tab_scanner as _naver_ai_tab  # P2: NAVER_AI_TAB_ENABLED=true 시 활성화
from .naver_cafe_scanner import NaverCafeScanner as _NaverCafeScanner  # P3: NAVER_MULTICH_ENABLED=true 시 활성화
from .naver_jisik_scanner import NaverJisikScanner as _NaverJisikScanner  # P3: NAVER_MULTICH_ENABLED=true 시 활성화

# 업종 영문 코드 → 한국어 검색 키워드
# 25개 정규 업종(DB whitelist)을 scan.py와 동일한 값으로 먼저 선언하여 우선 적용
_CATEGORY_KO: dict[str, str] = {
    # ── 25개 정규 업종 (scan.py와 동기화) ───────────────────────────────
    "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리", "bar": "술집",
    "beauty": "미용실", "nail": "네일샵", "medical": "병원", "pharmacy": "약국",
    "fitness": "헬스장", "yoga": "요가 필라테스", "pet": "반려동물",
    "education": "학원", "tutoring": "과외", "legal": "법률사무소",
    "realestate": "부동산", "interior": "인테리어", "auto": "자동차정비",
    "cleaning": "청소대행", "shopping": "쇼핑몰", "fashion": "의류",
    "photo": "사진·영상", "video": "영상제작", "design": "디자인",
    "accommodation": "숙박 펜션", "other": "",
    # ── 하위 호환 (구버전 카테고리 키) ──────────────────────────────────
    "chicken": "치킨", "bbq": "고기집", "seafood": "횟집", "snack": "분식",
    "delivery": "배달음식", "health_food": "건강식",
    "dental": "치과", "oriental": "한의원", "skincare": "피부과",
    "eye": "안과", "mental": "심리상담", "rehab": "물리치료",
    "hair": "미용실", "massage": "마사지", "spa": "스파",
    "pilates": "필라테스", "golf": "골프",
    "academy": "학원", "kids": "어린이집",
    "tax": "세무사", "real_estate": "부동산", "car": "자동차정비",
}

# Playwright 동시성 — PLAYWRIGHT_MAX_CONCURRENCY 환경변수로 제어 (기본 1)
# RAM 4GB 서버: 1 유지. 업그레이드 후 서버 .env에 PLAYWRIGHT_MAX_CONCURRENCY=2 추가
PLAYWRIGHT_SEMAPHORE = asyncio.Semaphore(int(os.getenv("PLAYWRIGHT_MAX_CONCURRENCY", "1")))


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

    async def scan_trial(self, query: str, target: str) -> dict:
        """Trial 체험: ChatGPT(GPT-4o-mini) 5회 샘플링 — 1회 boolean 대비 신뢰도 향상.

        비용: gpt-4o-mini 5회 ≈ 2.5원/회 (1회 ~0.5원 대비 +2원)
        응답 시간: 5회 병렬 실행이라 1회와 거의 동일 (~2~3초).
        2026-05-09 Trial 1회 → 5회 격상 (변동성 1/√5 감소, "5회 중 N회 언급" 표시 가능)

        반환값에 `mentioned` 필드를 보정하여 기존 scan_single() 하위 호환 보장:
        - mentioned = exposure_freq > 0
        - excerpt = citations[0] (첫 번째 발췌문, 없으면 None)
        """
        result = await self.chatgpt.sample_5(query, target)
        # 하위 호환: mentioned 필드 보정 (exposure_freq 기반)
        result["mentioned"] = result.get("exposure_freq", 0) > 0
        result["excerpt"] = (result.get("citations") or [None])[0]
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

        # ── AI탭 스캐너 (P2) ──────────────────────────────────────────────
        # 트리거: 6월 네이버 AI탭 전체 확대 후 NAVER_AI_TAB_ENABLED=true 설정
        # PLAYWRIGHT_SEMAPHORE 공유 — naver_ai_tab_scanner.scan()이 내부에서 동일 세마포어 획득하므로
        # 여기서는 세마포어를 직접 획득하지 않고 scan()에 위임 (중복 acquire 방지)
        if os.getenv("NAVER_AI_TAB_ENABLED", "false").lower() == "true":
            _queries = queries if isinstance(queries, list) else [queries]
            _ai_tab_results: dict = {}
            # 사업장별 배치 스캔 시각을 분산 — 여러 사업장이 짧은 시간에 몰려 스캔되면
            # 자동화 패턴으로 보여 차단 유발 가능(2026-07-02/07-03 실측) — 시작 전 랜덤 대기
            await asyncio.sleep(random.uniform(20, 240))
            for _q in _queries[:4]:
                try:
                    _r = await _naver_ai_tab.scan(_q, target)
                    if _r:
                        _ai_tab_results[_q] = _r
                    await asyncio.sleep(random.uniform(3, 8))  # 인간 편차 딜레이
                except Exception as _tab_e:
                    _logger.warning("[multi_scanner] ai_tab scan skip [%r]: %s", _q, _tab_e)
            if _ai_tab_results:
                all_keys.append("naver_ai_tab")
                all_results.append(_ai_tab_results)

        # ── 멀티채널 스캐너 (P3) — 카페·지식인 ───────────────────────────────
        # 트리거: 구독자 20명 도달 후 NAVER_MULTICH_ENABLED=true 설정
        # API 기반 (Playwright 없음) — RAM 추가 부담 없음, 일 25,000건 공유 한도 주의
        if os.getenv("NAVER_MULTICH_ENABLED", "false").lower() == "true":
            _cafe = _NaverCafeScanner()
            _jisik = _NaverJisikScanner()
            try:
                _cafe_result, _jisik_result = await asyncio.gather(
                    _cafe.scan(queries, target),
                    _jisik.scan(queries, target),
                    return_exceptions=True,
                )
                if not isinstance(_cafe_result, Exception):
                    all_keys.append("naver_cafe")
                    all_results.append(_cafe_result)
                else:
                    _logger.warning("[multi_scanner] cafe scan failed: %s", _cafe_result)
                if not isinstance(_jisik_result, Exception):
                    all_keys.append("naver_jisik")
                    all_results.append(_jisik_result)
                else:
                    _logger.warning("[multi_scanner] jisik scan failed: %s", _jisik_result)
            except Exception as _mc_e:
                _logger.warning("[multi_scanner] multich scan failed: %s", _mc_e)

        return {
            k: (v if not isinstance(v, Exception) else {"platform": k, "mentioned": False, "error": str(v)})
            for k, v in zip(all_keys, all_results)
        }

    async def scan_basic(self, queries: "str | list[str]", target: str) -> dict:
        """A안 50/50 분할: Gemini 50회 + ChatGPT 50회 + 네이버 AI 브리핑 + Google AI Overview.

        비용: ~25원/회 (Gemini 50회 ~5원 + ChatGPT 50회 ~10원 + 네이버 0원 + Google DataForSEO ~0.3원)
        용도: Basic 플랜 평일 자동 스캔.
        queries가 list인 경우 각 모델 50회를 쿼리별 균등 분산.
        Google은 DataForSEO 백엔드 사용 (GOOGLE_SCANNER_BACKEND=dataforseo).
        """
        primary_query = queries if isinstance(queries, str) else (queries[0] if queries else "")
        gemini_result, chatgpt_result, naver_result, google_result = await asyncio.gather(
            self.gemini.sample_50(queries, target),
            self.chatgpt.sample_50(queries, target),
            self._run_playwright(self.naver.check_mention, primary_query, target),
            self.google.check_mention(primary_query, target),
            return_exceptions=True,
        )
        return {
            "gemini": gemini_result if not isinstance(gemini_result, Exception)
                      else {"platform": "gemini", "mentioned": False, "error": str(gemini_result)},
            "chatgpt": chatgpt_result if not isinstance(chatgpt_result, Exception)
                       else {"platform": "chatgpt", "mentioned": False, "error": str(chatgpt_result)},
            "naver":  naver_result  if not isinstance(naver_result,  Exception)
                      else {"platform": "naver",  "mentioned": False, "error": str(naver_result)},
            "google": google_result if not isinstance(google_result, Exception)
                      else {"platform": "google", "mentioned": False, "error": str(google_result)},
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
