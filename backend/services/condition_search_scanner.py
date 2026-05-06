"""업종별 조건검색 쿼리로 Gemini AI 노출 여부 확인 (Pro+ 전용)"""
import asyncio
import logging
from typing import Optional
from services.keyword_taxonomy import get_condition_queries, normalize_category, KEYWORD_TAXONOMY
from services.ai_scanner.gemini_scanner import GeminiScanner

_logger = logging.getLogger("aeolab.condition_search")
_scanner = GeminiScanner()


def _build_gap_reason(
    query: str,
    category: str,
    effective_keywords: Optional[list[str]] = None,
) -> tuple[str, str | None]:
    """미언급 쿼리에 대한 gap_reason 문자열과 gap_missing_keyword 1개를 반환.

    쿼리 텍스트를 effective_keywords(우선) 또는 taxonomy(fallback)와 비교해
    가장 관련 있는 누락 키워드를 찾아 gap_reason 문자열을 생성합니다.

    effective_keywords: keyword_resolver.resolve_effective_keywords() 결과.
        None이면 taxonomy 전체 키워드 사용.

    Returns:
        (gap_reason: str, gap_missing_keyword: str | None)
    """
    # 쿼리에서 핵심 단어 추출 (공백 분리 후 2글자 이상)
    query_words = {w.strip() for w in query.split() if len(w.strip()) >= 2}

    best_keyword: str | None = None
    best_score = 0

    # effective_keywords 우선 사용 (사용자 맞춤 반영). 없으면 taxonomy 전체.
    if effective_keywords:
        kw_pool = [kw for kw in effective_keywords if isinstance(kw, str)]
        for kw in kw_pool:
            kw_words = set(kw.split())
            score = len(query_words & kw_words)
            if score > best_score:
                best_score = score
                best_keyword = kw
    else:
        cat_key = normalize_category(category)
        taxonomy = KEYWORD_TAXONOMY.get(cat_key, {})
        for cat_data in taxonomy.values():
            if not isinstance(cat_data, dict):
                continue
            for kw in cat_data.get("keywords", []):
                kw_words = set(kw.split())
                score = len(query_words & kw_words)
                if score > best_score:
                    best_score = score
                    best_keyword = kw

    # 매칭 키워드 없으면 쿼리 마지막 단어를 누락 키워드로 사용
    if not best_keyword:
        parts = [p for p in query.split() if len(p) >= 2]
        best_keyword = parts[-1] if parts else None

    if best_keyword:
        gap_reason = f"FAQ나 소개글에 '{best_keyword}' 키워드가 없습니다"
    else:
        gap_reason = "관련 키워드가 리뷰·소개글에 없습니다"

    return gap_reason, best_keyword


async def run_condition_search(
    business_name: str,
    category: str,
    region: str,
    queries: list[str] | None = None,
    business_id: Optional[str] = None,
) -> list[dict]:
    """
    조건검색 쿼리별로 내 가게가 AI에 노출되는지 확인.

    Args:
        business_name: 사업장명
        category: 업종 코드 (DB 저장값)
        region: 지역 (예: "서울 강남구")
        queries: 직접 쿼리 목록 전달 시 사용 (없으면 자동 생성)
        business_id: 사업장 ID — 있으면 custom/excluded 키워드 반영한 gap_reason 생성

    Returns:
        list of {
            "query": str,
            "mentioned": bool,
            "excerpt": str,
            "confidence": float,
            "gap_reason": str | null,       # 미언급 이유 (언급 시 null)
            "gap_missing_keyword": str | null  # 핵심 누락 키워드 (언급 시 null, /guide?keyword= 링크용)
        }
    """
    if not queries:
        queries = get_condition_queries(category, region)

    # 사용자 맞춤 키워드 반영한 effective keywords 해석 (gap_reason 계산용)
    _effective_kw: Optional[list[str]] = None
    if business_id:
        try:
            from services.keyword_resolver import resolve_effective_keywords
            _resolved = await resolve_effective_keywords(business_id, category)
            _effective_kw = _resolved.get("effective") or None
        except Exception as e:
            _logger.warning(f"condition_search keyword_resolver failed (biz={business_id}): {e}")

    results: list[dict] = []
    _sem = asyncio.Semaphore(2)  # Gemini API 동시 호출 2개 제한

    async def _limited_check(q: str, name: str):
        async with _sem:
            return await _scanner._check(q, name)

    for query in queries[:5]:  # 최대 5개 쿼리
        try:
            # _check: 단일 호출로 경량 노출 확인 (3회 샘플로 정확도 향상, 동시 2개 제한)
            checks = await asyncio.gather(
                *[_limited_check(query, business_name) for _ in range(3)],
                return_exceptions=True,
            )
            mentioned_count = sum(
                1 for c in checks
                if not isinstance(c, Exception) and c.get("mentioned")
            )
            mentioned = mentioned_count >= 2  # 3회 중 2회 이상 언급 시 노출 확정
            excerpt = next(
                (c.get("excerpt", "") for c in checks
                 if not isinstance(c, Exception) and c.get("excerpt")),
                "",
            )
            confidence = round(mentioned_count / 3, 2)

            # gap_reason / gap_missing_keyword: 미언급 시에만 생성
            if mentioned:
                gap_reason = None
                gap_missing_keyword = None
            else:
                gap_reason, gap_missing_keyword = _build_gap_reason(query, category, _effective_kw)

            results.append({
                "query": query,
                "mentioned": mentioned,
                "excerpt": excerpt or "",
                "confidence": confidence,
                "gap_reason": gap_reason,
                "gap_missing_keyword": gap_missing_keyword,
            })
        except Exception as e:
            _logger.warning("condition search failed for query=%r: %s", query, e)
            gap_reason, gap_missing_keyword = _build_gap_reason(query, category)
            results.append({
                "query": query,
                "mentioned": False,
                "excerpt": "",
                "confidence": 0.0,
                "gap_reason": gap_reason,
                "gap_missing_keyword": gap_missing_keyword,
            })
        await asyncio.sleep(0.5)  # Gemini API 레이트 리밋 대응

    return results
