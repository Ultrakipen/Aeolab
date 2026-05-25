"""
네이버 지식인 언급 스캐너 (P3 선행 구현 — 2026-05-25)

네이버 검색 API kin.json으로 사업장 언급 여부·빈도를 측정.
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

_KIN_API_URL = "https://openapi.naver.com/v1/search/kin.json"
_DEFAULT_DISPLAY = 10  # 지식인은 결과 수가 적어 10개로도 충분
_REQUEST_TIMEOUT = 10.0


def _strip_tags(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


async def _search_kin(
    session: aiohttp.ClientSession,
    query: str,
    client_id: str,
    client_secret: str,
    display: int = _DEFAULT_DISPLAY,
) -> tuple[list[dict], int]:
    """단일 쿼리로 네이버 지식인 검색 → (항목 목록, total) 반환"""
    try:
        async with session.get(
            _KIN_API_URL,
            params={"query": query, "display": display, "sort": "sim"},
            headers={
                "X-Naver-Client-Id": client_id,
                "X-Naver-Client-Secret": client_secret,
            },
            timeout=aiohttp.ClientTimeout(total=_REQUEST_TIMEOUT),
        ) as resp:
            if resp.status != 200:
                _logger.warning("[jisik_scanner] API status=%s for query=%r", resp.status, query)
                return [], 0
            data = await resp.json()
    except asyncio.TimeoutError:
        _logger.warning("[jisik_scanner] timeout for query=%r", query)
        return [], 0
    except aiohttp.ClientError as e:
        _logger.warning("[jisik_scanner] request failed for query=%r: %s", query, e)
        return [], 0

    total = data.get("total", 0)
    items = data.get("items", [])
    return [
        {
            "title": _strip_tags(i.get("title", "")),
            "description": _strip_tags(i.get("description", "")),
            "link": i.get("link", ""),
        }
        for i in items
    ], total


def _count_mentions(items: list[dict], target: str) -> int:
    """결과 항목에서 사업장명 직접 언급 수를 카운트"""
    name_lower = target.lower()
    count = 0
    for item in items:
        text = (item.get("title", "") + " " + item.get("description", "")).lower()
        if name_lower in text:
            count += 1
    return count


class NaverJisikScanner:
    """네이버 지식인 언급 스캐너 — Naver 검색 API 기반, Playwright 미사용"""

    async def scan(
        self,
        queries: "str | list[str]",
        target: str,
    ) -> dict:
        """지식인 답변에서 사업장명 언급 여부·빈도 측정.

        지식인은 "이 동네 맛집 어디예요?" 같은 질문에 사업장이 추천 답변으로 등장하는 구조.
        실측값 위주 — 추정·점수 환산 없이 언급 건수 그대로 반환.

        Args:
            queries: 검색 쿼리 문자열 또는 리스트 (최대 2개 사용)
            target: 사업장명

        Returns:
            {
                "platform": "naver_jisik",
                "mentioned": bool,
                "mention_count": int,
                "total_api_results": int,     # API가 반환한 전체 인덱스 수 (추정치)
                "exposure_score": float,      # 0~100
                "top_excerpts": list[str],
                "error": str | None,
            }
        """
        client_id = os.getenv("NAVER_CLIENT_ID")
        client_secret = os.getenv("NAVER_CLIENT_SECRET")
        if not client_id or not client_secret:
            _logger.warning("[jisik_scanner] NAVER_CLIENT_ID/SECRET 미설정 — 스캔 건너뜀")
            return {
                "platform": "naver_jisik",
                "mentioned": False,
                "mention_count": 0,
                "total_api_results": 0,
                "exposure_score": 0.0,
                "top_excerpts": [],
                "error": "NAVER_CLIENT_ID/SECRET 미설정",
            }

        query_list: list[str] = [queries] if isinstance(queries, str) else list(queries)
        # 지식인은 단기 쿼리 2개로 충분 (긴 자연어 쿼리가 오히려 결과 감소)
        query_list = query_list[:2]

        all_items: list[dict] = []
        seen_links: set[str] = set()
        total_api = 0

        async with aiohttp.ClientSession() as session:
            tasks = [_search_kin(session, q, client_id, client_secret) for q in query_list]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                _logger.warning("[jisik_scanner] search task failed: %s", result)
                continue
            items, total = result
            total_api = max(total_api, total)
            for item in items:
                link = item.get("link", "")
                if link and link not in seen_links:
                    seen_links.add(link)
                    all_items.append(item)

        mention_count = _count_mentions(all_items, target)

        # 노출 점수: 지식인 언급은 고품질 신호 — 1건도 의미 있음
        if mention_count >= 2:
            exposure_score = 100.0
        elif mention_count == 1:
            exposure_score = 60.0
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
            "platform": "naver_jisik",
            "mentioned": mention_count > 0,
            "mention_count": mention_count,
            "total_api_results": total_api,
            "exposure_score": exposure_score,
            "top_excerpts": top_excerpts,
            "error": None,
        }
