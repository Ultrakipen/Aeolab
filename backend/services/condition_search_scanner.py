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
    intro: str = "",
) -> tuple[str, str | None]:
    """미언급 쿼리에 대한 gap_reason 문자열과 gap_missing_keyword 1개를 반환.

    쿼리 텍스트를 effective_keywords(우선) 또는 taxonomy(fallback)와 비교해
    가장 관련 있는 키워드를 찾고, 소개글 실제 포함 여부에 따라 메시지를 분기한다.

    effective_keywords: keyword_resolver.resolve_effective_keywords() 결과.
        None이면 taxonomy 전체 키워드 사용.
    intro: 사업장 소개글 텍스트 — 키워드 실제 보유 여부 확인용.

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
        # 소개글에 실제로 포함된 경우 → 콘텐츠 부족이 아닌 온라인 노출 부족 안내
        if intro and best_keyword in intro:
            gap_reason = f"소개글에 '{best_keyword}'가 있지만 AI가 인식하려면 블로그·리뷰 등 온라인 노출이 더 필요합니다"
        else:
            gap_reason = f"소개글·Q&A 섹션에 '{best_keyword}' 키워드를 추가하세요"
    else:
        gap_reason = "관련 키워드가 리뷰·소개글에 없습니다"

    return gap_reason, best_keyword


async def run_condition_search(
    business_name: str,
    category: str,
    region: str,
    queries: list[str] | None = None,
    business_id: Optional[str] = None,
    intro: str = "",
    keywords: list[str] | None = None,
) -> list[dict]:
    """
    조건검색 쿼리별로 내 가게가 AI에 노출될 자격이 있는지 확인.

    Args:
        business_name: 사업장명
        category: 업종 코드 (DB 저장값)
        region: 지역 (예: "서울 강남구")
        queries: 직접 쿼리 목록 전달 시 사용 (없으면 자동 생성)
        business_id: 사업장 ID — 있으면 custom/excluded 키워드 반영한 gap_reason 생성
        intro: 소개글 텍스트 — Gemini 컨텍스트 주입용 (있으면 _check_with_context 사용)
        keywords: 등록 키워드 목록 — Gemini 컨텍스트 주입용

    Returns:
        list of {
            "query": str,
            "mentioned": bool,
            "excerpt": str,
            "confidence": float,
            "gap_reason": str | null,
            "gap_missing_keyword": str | null
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
    _sem = asyncio.Semaphore(2)

    def _keyword_match(query: str, kws: list[str]) -> tuple[bool, str]:
        """등록 키워드가 검색어에 직접 포함되면 즉시 노출 확정 (Gemini 불필요)."""
        q_lower = query.lower()
        for kw in (kws or []):
            kw_lower = kw.lower().strip()
            if kw_lower and (kw_lower in q_lower or q_lower in kw_lower):
                return True, kw
        return False, ""

    async def _limited_check(q: str, name: str):
        async with _sem:
            if intro:
                return await _scanner._check_with_context(q, name, intro=intro, keywords=keywords)
            return await _scanner._check(q, name)

    for query in queries[:5]:  # 최대 5개 쿼리
        try:
            # 1단계: 등록 키워드 직접 매칭 확인
            kw_hit, matched_kw = _keyword_match(query, keywords or [])
            if kw_hit:
                # 2단계: 소개글 콘텐츠가 검색 의도와 관련 있는지 Gemini 검증
                if intro:
                    content_check = await _scanner._check_with_context(
                        query, business_name, intro=intro, keywords=keywords
                    )
                    content_ok = content_check.get("mentioned", False)
                    excerpt = content_check.get("excerpt", "")
                else:
                    content_ok = True  # 소개글 없으면 키워드 매칭만으로 판정
                    excerpt = ""

                if content_ok:
                    results.append({
                        "query": query,
                        "mentioned": True,
                        "excerpt": excerpt or f"등록 키워드 '{matched_kw}'와 소개글 콘텐츠가 이 검색 의도에 적합합니다",
                        "confidence": 1.0,
                        "gap_reason": None,
                        "gap_missing_keyword": None,
                    })
                else:
                    results.append({
                        "query": query,
                        "mentioned": False,
                        "excerpt": "",
                        "confidence": 0.3,
                        "gap_reason": f"키워드 '{matched_kw}'는 적합하지만 소개글에 이 검색 의도를 뒷받침할 콘텐츠가 부족합니다",
                        "gap_missing_keyword": matched_kw,
                    })
                await asyncio.sleep(0)
                continue

            # 키워드 미매칭 → 소개글 기반 Gemini 판단
            checks = await asyncio.gather(
                *[_limited_check(query, business_name) for _ in range(3)],
                return_exceptions=True,
            )
            mentioned_count = sum(
                1 for c in checks
                if not isinstance(c, Exception) and c.get("mentioned")
            )
            mentioned = mentioned_count >= 2
            excerpt = next(
                (c.get("excerpt", "") for c in checks
                 if not isinstance(c, Exception) and c.get("excerpt")),
                "",
            )
            confidence = round(mentioned_count / 3, 2)

            if mentioned:
                gap_reason = None
                gap_missing_keyword = None
            else:
                gap_reason, gap_missing_keyword = _build_gap_reason(query, category, _effective_kw, intro=intro)

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
            gap_reason, gap_missing_keyword = _build_gap_reason(query, category, intro=intro)
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
