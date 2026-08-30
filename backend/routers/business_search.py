"""
backend/routers/business_search.py

GET /api/businesses/search?query=&region=

네이버 지역검색 + 카카오 로컬 API 병렬 실행 후 중복 제거하여 최대 10개 반환.
인증 불필요 — 경쟁사 등록 전 검색, 체험 사용자 모두 호출 가능.

검색 로직 본체는 services/local_search.py로 이동(2026-08-30) — startup_report.py 등
다른 서비스에서도 재사용하기 위함.
"""
import asyncio
from fastapi import APIRouter, HTTPException, Query
from services.local_search import search_kakao, search_naver, merge_results

router = APIRouter()


@router.get("/search")  # public — 인증 불필요 (체험 사용자 + 경쟁사 등록 전 검색 모두 허용)
async def search_businesses(
    query: str = Query(..., min_length=2, description="검색어 (최소 2글자)"),
    region: str = Query("", description="지역명 (예: 창원, 서울 강남구)"),
):
    """
    네이버 + 카카오 병렬 지역 검색 — 인증 불필요.

    중복 제거 후 최대 10개 반환. 카카오 데이터 우선.
    """
    if len(query.strip()) < 2:
        raise HTTPException(status_code=422, detail="query는 최소 2글자 이상이어야 합니다.")

    kakao_task = asyncio.create_task(search_kakao(query.strip(), region.strip()))
    naver_task = asyncio.create_task(search_naver(query.strip(), region.strip()))

    (kakao_results, _kakao_total_count), naver_results = await asyncio.gather(kakao_task, naver_task)

    merged = merge_results(kakao_results, naver_results)

    if not merged:
        raise HTTPException(
            status_code=503,
            detail="지역 검색 API 연결 오류. 잠시 후 다시 시도하세요.",
        )

    return merged[:10]
