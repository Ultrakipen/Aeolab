import os
import re
import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from models.schemas import CompetitorCreate
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user, PLAN_LIMITS

router = APIRouter()

_KAKAO_LOCAL_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
_NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json"


def _strip_tags(text: str) -> str:
    """HTML 태그 제거 (<b>, </b> 등)"""
    return re.sub(r"<[^>]+>", "", text or "")


async def _search_kakao(query: str, region: str) -> list[dict]:
    """카카오 로컬 REST API 기반 지역 사업장 검색.
    https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
    """
    rest_key = os.getenv("KAKAO_REST_API_KEY")
    if not rest_key:
        return []

    full_query = f"{region.split()[0]} {query}".strip() if region else query

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _KAKAO_LOCAL_URL,
                params={"query": full_query, "size": 15},
                headers={"Authorization": f"KakaoAK {rest_key}"},
                timeout=aiohttp.ClientTimeout(total=5),
            ) as res:
                if res.status != 200:
                    return []
                data = await res.json()

        return [
            {
                "name": doc.get("place_name", ""),
                "address": doc.get("road_address_name") or doc.get("address_name", ""),
                "category": doc.get("category_name", ""),
                "phone": doc.get("phone", ""),
                "naver_url": "",
                "kakao_url": doc.get("place_url", ""),
                "kakao_place_id": doc.get("id", ""),
                "lat": doc.get("y", ""),
                "lng": doc.get("x", ""),
                "source": "kakao",
            }
            for doc in data.get("documents", [])
        ]
    except aiohttp.ClientError:
        return []


async def _search_naver(query: str, region: str) -> list[dict]:
    """네이버 지역 검색 API (카카오 실패 시 Fallback)"""
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        return []

    full_query = f"{region.split()[0]} {query}".strip() if region else query

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _NAVER_LOCAL_URL,
                params={"query": full_query, "display": 15, "sort": "random"},
                headers={
                    "X-Naver-Client-Id": client_id,
                    "X-Naver-Client-Secret": client_secret,
                },
                timeout=aiohttp.ClientTimeout(total=5),
            ) as res:
                if res.status != 200:
                    return []
                data = await res.json()

        return [
            {
                "name": _strip_tags(item.get("title", "")),
                "address": item.get("roadAddress") or item.get("address", ""),
                "category": item.get("category", ""),
                "phone": item.get("telephone", ""),
                "naver_url": item.get("link", ""),
                "kakao_url": "",
                "kakao_place_id": "",
                "source": "naver",
            }
            for item in data.get("items", [])
        ]
    except aiohttp.ClientError:
        return []


@router.get("/search")
async def search_local_businesses(query: str, region: str, user=Depends(get_current_user)):
    """카카오 로컬 REST API 기반 지역 사업장 검색 (카카오 우선 → 네이버 Fallback)"""
    results = await _search_kakao(query, region)

    # 카카오 결과가 없을 때 네이버 Fallback
    if not results:
        results = await _search_naver(query, region)

    if not results:
        raise HTTPException(status_code=503, detail="지역 검색 API 연결 오류. 잠시 후 다시 시도하세요.")

    return results


@router.post("")
async def add_competitor(req: CompetitorCreate, user=Depends(get_current_user)):
    """경쟁사 등록"""
    x_user_id = user["id"]
    supabase = get_client()

    # 사업장 소유권 검증
    biz_check = await execute(
        supabase.table("businesses")
        .select("user_id")
        .eq("id", req.business_id)
        .maybe_single()
    )
    if not biz_check.data or biz_check.data.get("user_id") != x_user_id:
        raise HTTPException(status_code=403, detail="해당 사업장에 접근 권한이 없습니다.")

    # 플랜별 경쟁사 수 제한 확인
    existing = await execute(
        supabase.table("competitors")
        .select("id", count="exact")
        .eq("business_id", req.business_id)
        .eq("is_active", True)
    )
    sub = await execute(
        supabase.table("subscriptions")
        .select("plan")
        .eq("user_id", x_user_id)
        .eq("status", "active")
        .maybe_single()
    )
    plan = sub.data["plan"] if sub.data else "free"
    limits = {k: v["competitors"] for k, v in PLAN_LIMITS.items()}
    if (existing.count or 0) >= limits.get(plan, 0):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": f"{plan} 플랜 경쟁사 한도 초과", "upgrade_url": "/pricing"},
        )

    insert_data = {
        "business_id": req.business_id,
        "name": req.name,
        "address": req.address,
        "is_active": True,
    }
    # kakao_place_id 있으면 저장 (competitors 테이블에 컬럼 추가 필요)
    kakao_id = getattr(req, "kakao_place_id", None)
    if kakao_id:
        insert_data["kakao_place_id"] = kakao_id

    result = await execute(supabase.table("competitors").insert(insert_data))
    return result.data[0] if result.data else {}


@router.get("/suggest/list")
async def suggest_competitors(category: str, region: str, business_id: str, user: dict = Depends(get_current_user)):
    """업종·지역 기반 경쟁사 자동 추천 (동일 카테고리 상위 점수 사업장)"""
    supabase = get_client()

    candidates = (
        await execute(
            supabase.table("businesses")
            .select("id, name, address, region")
            .eq("category", category)
            .ilike("region", f"{region.split()[0]}%")
            .eq("is_active", True)
            .neq("id", business_id)
            .limit(20)
        )
    ).data or []

    if not candidates:
        return []

    biz_ids = [b["id"] for b in candidates]
    scores = (
        await execute(
            supabase.table("score_history")
            .select("business_id, total_score")
            .in_("business_id", biz_ids)
            .order("score_date", desc=True)
            .limit(len(biz_ids) * 2)
        )
    ).data or []

    latest: dict = {}
    for s in scores:
        if s["business_id"] not in latest:
            latest[s["business_id"]] = s["total_score"]

    existing = (
        await execute(
            supabase.table("competitors")
            .select("name")
            .eq("business_id", business_id)
            .eq("is_active", True)
        )
    ).data or []
    existing_names = {c["name"] for c in existing}

    result = []
    for biz in candidates:
        if biz["name"] in existing_names:
            continue
        result.append({
            "name": biz["name"],
            "address": biz.get("address", ""),
            "region": biz.get("region", ""),
            "score": latest.get(biz["id"], 0),
            "source": "aeolab",
        })

    result.sort(key=lambda x: x["score"], reverse=True)
    return result[:5]


@router.get("/{biz_id}")
async def list_competitors(biz_id: str, user=Depends(get_current_user)):
    """경쟁사 목록 조회 — 본인 사업장만"""
    supabase = get_client()
    # 소유권 검증: 타인의 사업장 biz_id 직접 입력 방지
    biz = await execute(
        supabase.table("businesses")
        .select("id")
        .eq("id", biz_id)
        .eq("user_id", user["id"])
        .maybe_single()
    )
    if not biz.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    result = await execute(
        supabase.table("competitors")
        .select("id, name, address, is_active, created_at, kakao_place_id")
        .eq("business_id", biz_id)
        .eq("is_active", True)
    )
    return result.data


@router.delete("/{competitor_id}")
async def remove_competitor(competitor_id: str, user=Depends(get_current_user)):
    """경쟁사 삭제 (soft delete) — 소유권 검증 필수"""
    supabase = get_client()

    # 소유권 검증: competitor → business_id → user_id 확인
    comp = await execute(
        supabase.table("competitors")
        .select("business_id")
        .eq("id", competitor_id)
        .maybe_single()
    )
    if not comp.data:
        raise HTTPException(status_code=404, detail="경쟁사를 찾을 수 없습니다")

    biz = await execute(
        supabase.table("businesses")
        .select("user_id")
        .eq("id", comp.data["business_id"])
        .maybe_single()
    )
    if not biz.data or biz.data["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    await execute(supabase.table("competitors").update({"is_active": False}).eq("id", competitor_id))
    return {"status": "deleted"}
