"""
네이버 검색광고 키워드도구 API 클라이언트
HMAC-SHA256 서명 기반 인증 — 환경변수 미설정 시 graceful degradation (빈 결과 반환)

API 문서: https://naver.github.io/searchad-apidoc/
엔드포인트: GET /keywordstool?hintKeywords=키워드1,키워드2&showDetail=1
헤더: X-Timestamp, X-API-KEY, X-Customer, X-Signature
"""
import asyncio
import base64
import hashlib
import hmac
import logging
import os
import time
from typing import Optional

import aiohttp

_logger = logging.getLogger(__name__)

SEARCHAD_BASE = "https://api.searchad.naver.com"
_TIMEOUT = aiohttp.ClientTimeout(total=10)

# 키워드 캐시 유효 기간 (7일, 초 단위)
_CACHE_TTL_SECONDS = 7 * 24 * 3600


class NaverSearchAdClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("NAVER_SEARCHAD_API_KEY", "")
        self.secret_key = os.getenv("NAVER_SEARCHAD_SECRET_KEY", "")
        self.customer_id = os.getenv("NAVER_SEARCHAD_CUSTOMER_ID", "")

    def _is_configured(self) -> bool:
        return bool(self.api_key and self.secret_key and self.customer_id)

    def _sign(self, timestamp: str, method: str, uri: str) -> str:
        """HMAC-SHA256 서명 생성
        message = "{timestamp}.{METHOD}.{uri}"
        """
        message = f"{timestamp}.{method}.{uri}"
        signature = hmac.new(
            self.secret_key.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(signature).decode("utf-8")

    def _build_headers(self, method: str, uri: str) -> dict:
        timestamp = str(int(time.time() * 1000))
        return {
            "X-Timestamp": timestamp,
            "X-API-KEY": self.api_key,
            "X-Customer": self.customer_id,
            "X-Signature": self._sign(timestamp, method, uri),
            "Content-Type": "application/json; charset=UTF-8",
        }

    async def get_keyword_volumes(self, keywords: list[str]) -> dict[str, dict]:
        """
        키워드 월간 검색량 일괄 조회 (배치 최대 100개).
        API 미설정 시 빈 dict 반환 (graceful degradation).

        Returns:
            {
                "키워드": {
                    "monthly_pc": int,
                    "monthly_mo": int,
                    "monthly_total": int,
                    "competition": "high" | "medium" | "low" | "unknown"
                }
            }
        """
        if not self._is_configured():
            _logger.debug("NaverSearchAd: API 미설정, 빈 결과 반환")
            return {}

        if not keywords:
            return {}

        # 최대 100개 제한
        keywords = keywords[:100]

        uri = "/keywordstool"
        hint_str = ",".join(k.strip() for k in keywords if k.strip())
        params = {"hintKeywords": hint_str, "showDetail": "1"}

        try:
            async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
                async with session.get(
                    f"{SEARCHAD_BASE}{uri}",
                    headers=self._build_headers("GET", uri),
                    params=params,
                ) as resp:
                    if resp.status == 401:
                        _logger.warning("NaverSearchAd: 인증 실패 (API 키/서명 확인 필요)")
                        return {}
                    if resp.status == 429:
                        _logger.warning("NaverSearchAd: 요청 한도 초과")
                        return {}
                    if resp.status != 200:
                        _logger.warning(f"NaverSearchAd: HTTP {resp.status}")
                        return {}

                    data = await resp.json()
                    return self._parse_keyword_response(data)

        except asyncio.TimeoutError:
            _logger.warning("NaverSearchAd: 요청 타임아웃 (10초)")
            return {}
        except Exception as e:
            _logger.warning(f"NaverSearchAd get_keyword_volumes 오류: {e}")
            return {}

    def _parse_keyword_response(self, data: dict) -> dict[str, dict]:
        """API 응답에서 키워드별 검색량 파싱"""
        result: dict[str, dict] = {}
        keyword_list = data.get("keywordList") or []

        for item in keyword_list:
            kw = item.get("relKeyword", "").strip()
            if not kw:
                continue

            monthly_pc = int(item.get("monthlyPcQcCnt", 0) or 0)
            monthly_mo = int(item.get("monthlyMobileQcCnt", 0) or 0)
            monthly_total = monthly_pc + monthly_mo

            # 경쟁도: "높음" / "중간" / "낮음" / 기타 → 영문 매핑
            competition_raw = item.get("compIdx", "") or ""
            competition_map = {"높음": "high", "중간": "medium", "낮음": "low"}
            competition = competition_map.get(competition_raw, "unknown")

            result[kw] = {
                "monthly_pc": monthly_pc,
                "monthly_mo": monthly_mo,
                "monthly_total": monthly_total,
                "competition": competition,
            }

        return result

    async def get_volumes_with_cache(
        self,
        keywords: list[str],
        category: str,
        supabase,
    ) -> dict[str, dict]:
        """
        DB 캐시 레이어: 7일 이내 캐시가 있으면 DB에서 반환.
        캐시 미스 키워드만 API 호출 후 DB에 저장.

        DB 테이블: keyword_volumes
          columns: keyword TEXT, category TEXT, monthly_pc INT, monthly_mo INT,
                   monthly_total INT, competition TEXT, cached_at TIMESTAMPTZ
        """
        if not keywords:
            return {}

        from db.supabase_client import execute
        from datetime import datetime, timedelta, timezone

        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=_CACHE_TTL_SECONDS)).isoformat()

        # 1. DB에서 유효한 캐시 조회 (단일 IN 쿼리)
        try:
            cached_rows = (
                await execute(
                    supabase.table("keyword_volumes")
                    .select("keyword, monthly_pc, monthly_mo, monthly_total, competition")
                    .in_("keyword", keywords)
                    .eq("category", category)
                    .gte("cached_at", cutoff)
                )
            ).data or []
        except Exception as e:
            _logger.warning(f"keyword_volumes 캐시 조회 실패: {e}")
            cached_rows = []

        cached_result: dict[str, dict] = {
            row["keyword"]: {
                "monthly_pc": row["monthly_pc"],
                "monthly_mo": row["monthly_mo"],
                "monthly_total": row["monthly_total"],
                "competition": row["competition"],
            }
            for row in cached_rows
        }

        # 2. 캐시 미스 키워드 추출
        missing_keywords = [kw for kw in keywords if kw not in cached_result]
        if not missing_keywords:
            return cached_result

        # 3. API 호출 (미설정 시 graceful degradation)
        api_result = await self.get_keyword_volumes(missing_keywords)
        if not api_result:
            return cached_result

        # 4. DB에 새 결과 저장 (upsert)
        now_iso = datetime.now(timezone.utc).isoformat()
        upsert_rows = [
            {
                "keyword": kw,
                "category": category,
                "monthly_pc": vol["monthly_pc"],
                "monthly_mo": vol["monthly_mo"],
                "monthly_total": vol["monthly_total"],
                "competition": vol["competition"],
                "cached_at": now_iso,
            }
            for kw, vol in api_result.items()
        ]
        try:
            await execute(
                supabase.table("keyword_volumes")
                .upsert(upsert_rows, on_conflict="keyword,category")
            )
        except Exception as e:
            _logger.warning(f"keyword_volumes 캐시 저장 실패: {e}")

        return {**cached_result, **api_result}


# 모듈 레벨 싱글톤 (환경변수는 런타임에 읽음)
_client: Optional[NaverSearchAdClient] = None


def get_searchad_client() -> NaverSearchAdClient:
    global _client
    if _client is None:
        _client = NaverSearchAdClient()
    return _client
