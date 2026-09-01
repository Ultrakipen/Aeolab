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

    async def _fetch_raw(self, hint_terms: list[str]) -> dict[str, dict]:
        """SearchAd /keywordstool API 호출 → 파싱된 raw dict 반환 (내부 공용 헬퍼).

        hint_terms: 공백이 이미 제거된 키워드 리스트.
        반환 dict의 키도 API가 반환하는 relKeyword 그대로(공백 제거 형태).
        get_keyword_volumes / get_related_keywords 양쪽이 이 헬퍼를 공유한다.
        """
        if not self._is_configured():
            _logger.debug("NaverSearchAd: API 미설정, 빈 결과 반환")
            return {}
        if not hint_terms:
            return {}
        uri = "/keywordstool"
        hint_str = ",".join(hint_terms)
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
            _logger.warning(f"NaverSearchAd _fetch_raw 오류: {e}")
            return {}

    async def get_keyword_volumes(self, keywords: list[str]) -> dict[str, dict]:
        """
        키워드 월간 검색량 일괄 조회 (최대 100개 입력 허용, 내부에서 5개씩 나눠 호출).
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

        # 네이버 SearchAd API는 hintKeywords에 공백이 포함되면 HTTP 400 반환 —
        # 배치 하나에 공백 포함 키워드가 하나라도 있으면 요청 전체가 무너진다
        # (업종 키워드 사전에 "주차 가능" 같은 공백 포함 구문이 흔해 실사용 빈도가 높음).
        # 공백 제거 후 조회하고, 결과는 원본(공백 포함) 키워드로도 매핑해 돌려준다.
        stripped_to_originals: dict[str, list[str]] = {}
        hint_terms: list[str] = []
        for k in keywords:
            k = k.strip()
            if not k:
                continue
            stripped = k.replace(" ", "")
            if not stripped:
                continue
            if stripped not in stripped_to_originals:
                hint_terms.append(stripped)
                stripped_to_originals[stripped] = []
            stripped_to_originals[stripped].append(k)

        if not hint_terms:
            return {}

        # 네이버 SearchAd API는 hintKeywords가 5개를 초과하면 에러 없이(HTTP 200)
        # keywordList가 빈 배열로 조용히 무너진다(2026-09-01 실측 확인 — n=5는 정상,
        # n=6부터 0건). 5개씩 나눠 순차 호출 후 합친다.
        raw_result: dict[str, dict] = {}
        for i in range(0, len(hint_terms), 5):
            chunk_result = await self._fetch_raw(hint_terms[i : i + 5])
            raw_result.update(chunk_result)
        if not raw_result:
            return {}

        result = dict(raw_result)
        unmatched: list[str] = []
        for stripped, originals in stripped_to_originals.items():
            if stripped in raw_result:
                for orig in originals:
                    result[orig] = raw_result[stripped]
            else:
                unmatched.extend(originals)
        if unmatched:
            # SearchAd가 relKeyword에 요청 키워드를 그대로 반환하지 않고
            # 연관어만 준 경우 — 검색량이 조용히 None으로 빠지므로 빈도 모니터링용 로그
            _logger.info(
                "NaverSearchAd: relKeyword에 없어 검색량 매칭 실패한 키워드 %d개: %s",
                len(unmatched), unmatched[:10],
            )
        return result

    async def get_related_keywords(self, keyword: str, limit: int = 5) -> list[dict]:
        """단일 키워드로 SearchAd 조회 시 함께 반환되는 연관 키워드 상위 N개.

        SearchAd keywordstool API는 hintKeywords에 단일 키워드를 넣으면 해당 키워드와
        관련된 복수의 relKeyword를 keywordList에 함께 반환한다. 이 중 요청한 키워드
        자신(공백 제거 형태 일치)을 제외한 나머지가 "연관 키워드"다.

        API 미설정 시 빈 리스트 반환 (graceful degradation).

        Returns:
            [{"keyword": str, "monthly_volume": int, "competition": str}, ...]
            검색량 내림차순 정렬, 최대 limit개.
        """
        if not self._is_configured() or not keyword:
            return []
        stripped = keyword.strip().replace(" ", "")
        if not stripped:
            return []

        raw_result = await self._fetch_raw([stripped])
        if not raw_result:
            return []

        related = [
            {
                "keyword": kw,
                "monthly_volume": info.get("monthly_total", 0),
                "competition": info.get("competition", "unknown"),
            }
            for kw, info in raw_result.items()
            if kw != stripped  # 요청한 키워드 자신 제외
        ]
        related.sort(key=lambda x: x["monthly_volume"], reverse=True)
        return related[:limit]

    @staticmethod
    def _parse_qc_count(value) -> int:
        """monthlyPcQcCnt/monthlyMobileQcCnt 안전 파싱.

        네이버 API는 월 검색량이 10 미만이면 숫자 대신 "< 10" 문자열을 반환한다.
        정수 변환 실패 시 예외를 전파하면 배치 전체(_parse_keyword_response)가
        빈 결과로 무너지므로, 측정 불가/저검색량 케이스는 0으로 처리한다.
        """
        if value is None:
            return 0
        if isinstance(value, (int, float)):
            return int(value)
        try:
            return int(str(value).strip())
        except ValueError:
            return 0

    def _parse_keyword_response(self, data: dict) -> dict[str, dict]:
        """API 응답에서 키워드별 검색량 파싱"""
        result: dict[str, dict] = {}
        keyword_list = data.get("keywordList") or []

        for item in keyword_list:
            kw = item.get("relKeyword", "").strip()
            if not kw:
                continue

            monthly_pc = self._parse_qc_count(item.get("monthlyPcQcCnt"))
            monthly_mo = self._parse_qc_count(item.get("monthlyMobileQcCnt"))
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

        # 시계열 이력 적재 — 캐시가 실제로 갱신될 때(API 신규 호출)만 append.
        # 캐시 히트마다 쓰면 7일 내 같은 값이 중복 적재되므로, 갱신 주기(7일)와
        # 동일한 카덴스로만 기록해 자연스러운 추이 데이터를 만든다.
        try:
            history_rows = [
                {
                    "keyword": kw,
                    "category": category,
                    "monthly_pc": vol["monthly_pc"],
                    "monthly_mo": vol["monthly_mo"],
                    "monthly_total": vol["monthly_total"],
                    "competition": vol["competition"],
                    "recorded_at": now_iso,
                }
                for kw, vol in api_result.items()
            ]
            await execute(supabase.table("keyword_volume_history").insert(history_rows))
        except Exception as e:
            _logger.warning(f"keyword_volume_history 적재 실패: {e}")

        return {**cached_result, **api_result}

    async def get_volume_trend(
        self,
        keywords: list[str],
        category: str,
        supabase,
    ) -> dict[str, dict]:
        """
        키워드별 검색량 추이(최근 구간 대비 현재) 조회 — history 테이블에 2개 이상
        레코드가 쌓인 키워드만 반환. 신규 키워드는 이력이 없어 자연히 빠짐(허위 추이 방지).

        2026-07-18 재점검 발견·수정: "최초 이력 대비"로 계산하면 시간이 지날수록
        비교 시점이 계속 과거(예: 서비스 가입 시점)로 고정돼, 몇 달 뒤엔 "최근 추이"라는
        UI 문구와 실제 계산 범위가 어긋나는 문제가 있었음 — 최근 N개(캐시 갱신 주기
        7일 기준 약 6주 분량) 구간으로 제한해 "최근 추이"라는 표현과 실제 일치시킴.
        """
        _RECENT_WINDOW = 6
        from db.supabase_client import execute

        if not keywords:
            return {}
        try:
            rows = (
                await execute(
                    supabase.table("keyword_volume_history")
                    .select("keyword, monthly_total, recorded_at")
                    .in_("keyword", keywords)
                    .eq("category", category)
                    .order("recorded_at", desc=False)
                )
            ).data or []
        except Exception as e:
            _logger.warning(f"keyword_volume_history 조회 실패: {e}")
            return {}

        by_kw: dict[str, list[dict]] = {}
        for r in rows:
            by_kw.setdefault(r["keyword"], []).append(r)

        trends: dict[str, dict] = {}
        for kw, history in by_kw.items():
            if len(history) < 2:
                continue  # 이력 1개뿐이면 추이 계산 불가 — 표시 안 함(허위 추이 방지)
            recent = history[-_RECENT_WINDOW:]
            first, last = recent[0], recent[-1]
            first_vol = first.get("monthly_total") or 0
            last_vol = last.get("monthly_total") or 0
            pct_change = None
            if first_vol > 0:
                pct_change = round((last_vol - first_vol) / first_vol * 100)
            trends[kw] = {
                "from_date": first["recorded_at"][:10],
                "to_date": last["recorded_at"][:10],
                "from_volume": first_vol,
                "to_volume": last_vol,
                "pct_change": pct_change,
            }
        return trends


# 모듈 레벨 싱글톤 (환경변수는 런타임에 읽음)
_client: Optional[NaverSearchAdClient] = None


def get_searchad_client() -> NaverSearchAdClient:
    global _client
    if _client is None:
        _client = NaverSearchAdClient()
    return _client
