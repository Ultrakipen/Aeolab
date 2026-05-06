"""
네이버 DataLab 검색어 트렌드 API 클라이언트
기존 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 사용 (별도 발급 불필요)

API 문서: https://developers.naver.com/docs/serviceapi/datalab/search/search.md
엔드포인트: POST https://openapi.naver.com/v1/datalab/search
"""
import logging
import os
from datetime import datetime, timedelta, timezone

import aiohttp

_logger = logging.getLogger(__name__)

DATALAB_URL = "https://openapi.naver.com/v1/datalab/search"
_TIMEOUT = aiohttp.ClientTimeout(total=10)

# 캐시 유효 기간 (7일)
_CACHE_TTL_SECONDS = 7 * 24 * 3600


class NaverDataLabClient:
    def __init__(self) -> None:
        self.client_id = os.getenv("NAVER_CLIENT_ID", "")
        self.client_secret = os.getenv("NAVER_CLIENT_SECRET", "")

    def _is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    async def get_search_trend(
        self,
        keyword_groups: list[dict],
        start_date: str,
        end_date: str,
        device: str = "mo",
        time_unit: str = "month",
    ) -> dict:
        """
        네이버 DataLab 검색어 트렌드 API 호출.

        Args:
            keyword_groups: [{"groupName": "카페", "keywords": ["카페", "커피숍"]}]
            start_date: "2026-01-01"
            end_date: "2026-04-01"
            device: "mo" | "pc" | "" (전체)
            time_unit: "date" | "week" | "month"

        Returns:
            DataLab API 응답 (results 포함) 또는 {"error": "..."} on failure
        """
        if not self._is_configured():
            _logger.debug("NaverDataLab: API 미설정, 빈 결과 반환")
            return {}

        if not keyword_groups:
            return {}

        payload = {
            "startDate": start_date,
            "endDate": end_date,
            "timeUnit": time_unit,
            "keywordGroups": keyword_groups,
        }
        if device:
            payload["device"] = device

        headers = {
            "X-Naver-Client-Id": self.client_id,
            "X-Naver-Client-Secret": self.client_secret,
            "Content-Type": "application/json",
        }

        try:
            async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
                async with session.post(
                    DATALAB_URL,
                    headers=headers,
                    json=payload,
                ) as resp:
                    if resp.status == 401:
                        _logger.warning("NaverDataLab: 인증 실패")
                        return {"error": "unauthorized"}
                    if resp.status == 429:
                        _logger.warning("NaverDataLab: 요청 한도 초과")
                        return {"error": "rate_limited"}
                    if resp.status != 200:
                        _logger.warning(f"NaverDataLab: HTTP {resp.status}")
                        return {"error": f"http_{resp.status}"}
                    return await resp.json()

        except aiohttp.ClientError as e:
            _logger.warning(f"NaverDataLab 네트워크 오류: {e}")
            return {"error": str(e)}
        except Exception as e:
            _logger.warning(f"NaverDataLab 오류: {e}")
            return {"error": str(e)}

    async def get_category_trend(
        self,
        category: str,
        region: str | None = None,
        months: int = 3,
    ) -> dict:
        """
        keyword_taxonomy.py의 업종별 키워드 기반 DataLab 트렌드 조회.

        업종별 가중치 상위 카테고리에서 대표 키워드 3~5개 선택 후 단일 그룹으로 조회.

        Returns:
            {
                category: str,
                region: str | None,
                trend_data: [{"period": "2026-01", "ratio": 85.3}],
                trend_direction: "rising" | "falling" | "stable",
                trend_delta: float  # 최근 1개월 vs 3개월 전 비교 (%)
            }
        """
        from services.keyword_taxonomy import get_industry_keywords, normalize_category

        norm_cat = normalize_category(category)
        industry = get_industry_keywords(norm_cat)

        # 가중치 높은 순으로 정렬 → 상위 카테고리에서 키워드 선택
        sorted_cats = sorted(industry.items(), key=lambda x: x[1]["weight"], reverse=True)

        # 상위 카테고리에서 각 1~2개씩 대표 키워드 수집 (총 3~5개)
        rep_keywords: list[str] = []
        for _cat_name, cat_data in sorted_cats:
            kws = cat_data.get("keywords", [])
            # 공백 없는 단어 우선 (DataLab은 단어 단위 검색이 더 정확)
            short_kws = [k for k in kws if len(k) <= 6 and " " not in k]
            picks = short_kws[:1] or kws[:1]
            rep_keywords.extend(picks)
            if len(rep_keywords) >= 5:
                break

        if not rep_keywords:
            rep_keywords = [norm_cat]  # fallback: 업종명 자체

        # DataLab은 최대 5개 키워드/그룹
        rep_keywords = rep_keywords[:5]

        # 날짜 범위 계산
        end_dt = datetime.now(timezone.utc).replace(day=1)
        start_dt = end_dt - timedelta(days=months * 31)
        start_date = start_dt.strftime("%Y-%m-%d")
        end_date = end_dt.strftime("%Y-%m-%d")

        group_name = f"{norm_cat}_trend"
        keyword_groups = [{"groupName": group_name, "keywords": rep_keywords}]

        raw = await self.get_search_trend(
            keyword_groups=keyword_groups,
            start_date=start_date,
            end_date=end_date,
            device="mo",  # 모바일 우선 (소상공인 소비자 행동 기준)
            time_unit="month",
        )

        if not raw or raw.get("error"):
            return {
                "category": category,
                "region": region,
                "trend_data": [],
                "trend_direction": "stable",
                "trend_delta": 0.0,
                "keywords_used": rep_keywords,
                "error": raw.get("error") if raw else "no_data",
            }

        # 결과 파싱
        trend_data: list[dict] = []
        results = raw.get("results", [])
        if results:
            for item in results[0].get("data", []):
                trend_data.append({
                    "period": item.get("period", ""),
                    "ratio": float(item.get("ratio", 0)),
                })

        # 트렌드 방향 분석
        trend_direction = "stable"
        trend_delta = 0.0
        if len(trend_data) >= 2:
            recent = trend_data[-1]["ratio"]
            past = trend_data[0]["ratio"]
            if past > 0:
                trend_delta = round((recent - past) / past * 100, 1)
            else:
                trend_delta = 0.0

            if trend_delta > 10:
                trend_direction = "rising"
            elif trend_delta < -10:
                trend_direction = "falling"
            else:
                trend_direction = "stable"

        return {
            "category": category,
            "region": region,
            "trend_data": trend_data,
            "trend_direction": trend_direction,
            "trend_delta": trend_delta,
            "keywords_used": rep_keywords,
            "start_date": start_date,
            "end_date": end_date,
        }

    async def get_trend_with_cache(
        self,
        category: str,
        region: str | None,
        supabase,
    ) -> dict:
        """
        DB 캐시 레이어: 7일 이내 캐시가 있으면 DB에서 반환.
        캐시 미스 시 API 호출 후 industry_trends 테이블에 저장.

        DB 테이블: industry_trends
          columns: category TEXT, region TEXT, trend_data JSONB,
                   trend_direction TEXT, trend_delta FLOAT, cached_at TIMESTAMPTZ
        """
        from db.supabase_client import execute
        import json

        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=_CACHE_TTL_SECONDS)).isoformat()

        # 1. DB 캐시 조회
        try:
            q = (
                supabase.table("industry_trends")
                .select("trend_data, trend_direction, trend_delta, keywords_used, cached_at")
                .eq("category", category)
                .gte("cached_at", cutoff)
            )
            if region:
                q = q.eq("region", region)
            else:
                q = q.is_("region", "null")

            cached = (await execute(q.order("cached_at", desc=True).limit(1))).data
            if cached:
                row = cached[0]
                _logger.debug(f"DataLab 캐시 히트: {category}/{region}")
                return {
                    "category": category,
                    "region": region,
                    "trend_data": row.get("trend_data") or [],
                    "trend_direction": row.get("trend_direction", "stable"),
                    "trend_delta": float(row.get("trend_delta") or 0),
                    "keywords_used": row.get("keywords_used") or [],
                    "cached": True,
                }
        except Exception as e:
            _logger.warning(f"industry_trends 캐시 조회 실패: {e}")

        # 2. API 호출
        result = await self.get_category_trend(category, region)

        # 3. DB 저장 (에러 없는 경우만)
        # INSERT 방식 사용 — 기존 UNIQUE(category,region,period_start,period_end) 제약과 충돌 방지
        # 조회 시 cached_at DESC 기준으로 최신 행을 사용
        if not result.get("error") and result.get("trend_data") is not None:
            try:
                now_iso = datetime.now(timezone.utc).isoformat()
                today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                insert_data = {
                    "category": category,
                    "region": region,
                    "period_start": today,
                    "period_end": today,
                    "trend_data": result["trend_data"],
                    "trend_direction": result["trend_direction"],
                    "trend_delta": result["trend_delta"],
                    "keywords_used": result.get("keywords_used", []),
                    "cached_at": now_iso,
                    "synced_at": now_iso,
                }
                await execute(
                    supabase.table("industry_trends").insert(insert_data)
                )
            except Exception as e:
                _logger.warning(f"industry_trends 캐시 저장 실패: {e}")

        return result


    async def get_keyword_trends(
        self,
        keywords: list[str],
        period: str = "1month",
    ) -> dict:
        """
        특정 키워드 목록의 DataLab 트렌드 조회.
        키워드별 개별 그룹으로 조회해 상대 비교가 가능하도록 합니다.

        Args:
            keywords: 조회할 키워드 목록 (최대 5개)
            period: "1month" | "3month" | "6month" | "1year"

        Returns:
            {
                "keywords": [
                    {
                        "keyword": str,
                        "trend": [{"period": str, "ratio": float}],
                        "monthly_volume": int | null   # SearchAd 연동 시 채워짐
                    }
                ],
                "period": str,
                "start_date": str,
                "end_date": str,
                "available": bool
            }
        """
        # 최대 5개 제한 (DataLab API 그룹 최대 5개)
        keywords = keywords[:5]
        if not keywords:
            return {"keywords": [], "available": False, "period": period}

        # 기간 계산
        now = datetime.now(timezone.utc).replace(day=1)
        period_map = {"1month": 1, "3month": 3, "6month": 6, "1year": 12}
        months_back = period_map.get(period, 1)
        start_dt = now - timedelta(days=months_back * 31)
        start_date = start_dt.strftime("%Y-%m-%d")
        end_date = now.strftime("%Y-%m-%d")

        # 키워드별 개별 그룹 생성
        keyword_groups = [
            {"groupName": kw, "keywords": [kw]}
            for kw in keywords
        ]

        raw = await self.get_search_trend(
            keyword_groups=keyword_groups,
            start_date=start_date,
            end_date=end_date,
            device="mo",
            time_unit="month",
        )

        if not raw or raw.get("error") or not raw.get("results"):
            return {
                "keywords": [{"keyword": kw, "trend": [], "monthly_volume": None} for kw in keywords],
                "period": period,
                "start_date": start_date,
                "end_date": end_date,
                "available": False,
            }

        result_list: list[dict] = []
        for item in raw.get("results", []):
            kw = item.get("title", "")
            trend = [
                {"period": d.get("period", ""), "ratio": float(d.get("ratio", 0))}
                for d in item.get("data", [])
            ]
            result_list.append({
                "keyword": kw,
                "trend": trend,
                "monthly_volume": None,  # SearchAd 연동 시 report.py에서 병합
            })

        return {
            "keywords": result_list,
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "available": bool(result_list),
        }


# 모듈 레벨 싱글톤
_datalab_client: NaverDataLabClient | None = None


def get_datalab_client() -> NaverDataLabClient:
    global _datalab_client
    if _datalab_client is None:
        _datalab_client = NaverDataLabClient()
    return _datalab_client
