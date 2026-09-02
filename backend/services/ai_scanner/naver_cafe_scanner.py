"""
네이버 카페 언급 스캐너 (P3 선행 구현 — 2026-05-25)

네이버 검색 API cafearticle.json으로 사업장 언급 여부·빈도를 측정.
Playwright 미사용 — API 기반, RAM 추가 부담 없음.

활성화 조건: NAVER_MULTICH_ENABLED=true (기본 false, 구독자 20명 도달 후 설정)
일 API 한도: 25,000건/일 공유 (NAVER_CLIENT_ID/NAVER_CLIENT_SECRET)
"""
import asyncio
import logging
import os
import re

import aiohttp

_logger = logging.getLogger("aeolab")

_DEFAULT_DISPLAY = 20  # 한 쿼리당 최대 결과 수 (API 최대 100, 비용 절약 위해 20)
_REQUEST_TIMEOUT = 10.0


def _strip_tags(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


async def _search_cafe(
    session: aiohttp.ClientSession,
    query: str,
    client_id: str,
    client_secret: str,
    display: int = _DEFAULT_DISPLAY,
) -> list[dict]:
    """단일 쿼리로 네이버 카페 기사 검색 → 항목 목록 반환"""
    from services.naver_api_hub import search_request
    url, headers = search_request("cafearticle")
    try:
        async with session.get(
            url,
            params={"query": query, "display": display, "sort": "sim"},
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=_REQUEST_TIMEOUT),
        ) as resp:
            if resp.status != 200:
                _logger.warning("[cafe_scanner] API status=%s for query=%r", resp.status, query)
                return []
            data = await resp.json()
    except asyncio.TimeoutError:
        _logger.warning("[cafe_scanner] timeout for query=%r", query)
        return []
    except aiohttp.ClientError as e:
        _logger.warning("[cafe_scanner] request failed for query=%r: %s", query, e)
        return []

    items = data.get("items", [])
    return [
        {
            "title": _strip_tags(i.get("title", "")),
            "description": _strip_tags(i.get("description", "")),
            "link": i.get("link", ""),
            "cafe_name": i.get("cafename", ""),
            "post_date": i.get("postdate", ""),
        }
        for i in items
    ]


def _count_mentions(items: list[dict], target: str) -> int:
    """결과 항목에서 사업장명 직접 언급 수를 카운트"""
    name_lower = target.lower()
    count = 0
    for item in items:
        text = (item.get("title", "") + " " + item.get("description", "")).lower()
        if name_lower in text:
            count += 1
    return count


class NaverCafeScanner:
    """네이버 카페 언급 스캐너 — Naver 검색 API 기반, Playwright 미사용"""

    async def scan(
        self,
        queries: "str | list[str]",
        target: str,
    ) -> dict:
        """카페 게시글에서 사업장명 언급 여부·빈도 측정.

        Args:
            queries: 검색 쿼리 문자열 또는 리스트 (최대 3개 사용)
            target: 사업장명 (정확한 언급 카운트에 사용)

        Returns:
            {
                "platform": "naver_cafe",
                "mentioned": bool,            # 1건 이상 직접 언급
                "mention_count": int,         # 직접 언급 건수
                "total_results": int,         # 검색 결과 총 수 (API 집계)
                "exposure_score": float,      # 0~100 (mention_count 기반 환산)
                "top_excerpts": list[str],    # 상위 인용 발췌 (최대 3건)
                "error": str | None,
            }
        """
        client_id = os.getenv("NAVER_CLIENT_ID")
        client_secret = os.getenv("NAVER_CLIENT_SECRET")
        if not client_id or not client_secret:
            _logger.warning("[cafe_scanner] NAVER_CLIENT_ID/SECRET 미설정 — 스캔 건너뜀")
            return {
                "platform": "naver_cafe",
                "mentioned": False,
                "mention_count": 0,
                "total_results": 0,
                "exposure_score": 0.0,
                "top_excerpts": [],
                "error": "NAVER_CLIENT_ID/SECRET 미설정",
            }

        query_list: list[str] = [queries] if isinstance(queries, str) else list(queries)
        # 카페 스캔은 최대 3쿼리 (API 비용 절약)
        query_list = query_list[:3]

        all_items: list[dict] = []
        seen_links: set[str] = set()

        async with aiohttp.ClientSession() as session:
            tasks = [_search_cafe(session, q, client_id, client_secret) for q in query_list]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                _logger.warning("[cafe_scanner] search task failed: %s", result)
                continue
            for item in result:
                link = item.get("link", "")
                if link and link not in seen_links:
                    seen_links.add(link)
                    all_items.append(item)

        mention_count = _count_mentions(all_items, target)
        total_results = len(all_items)

        # 노출 점수: mention_count 3+ → 100, 2 → 70, 1 → 40, 0 → 0
        if mention_count >= 3:
            exposure_score = 100.0
        elif mention_count == 2:
            exposure_score = 70.0
        elif mention_count == 1:
            exposure_score = 40.0
        else:
            exposure_score = 0.0

        # 직접 언급된 상위 발췌 3건
        top_excerpts: list[str] = []
        name_lower = target.lower()
        for item in all_items:
            if name_lower in (item.get("title", "") + " " + item.get("description", "")).lower():
                excerpt = item.get("description") or item.get("title", "")
                if excerpt:
                    top_excerpts.append(excerpt[:120])
            if len(top_excerpts) >= 3:
                break

        return {
            "platform": "naver_cafe",
            "mentioned": mention_count > 0,
            "mention_count": mention_count,
            "total_results": total_results,
            "exposure_score": exposure_score,
            "top_excerpts": top_excerpts,
            "error": None,
        }
