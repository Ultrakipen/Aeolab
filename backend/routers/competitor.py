import os
import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from models.schemas import CompetitorCreate
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user

router = APIRouter()


@router.get("/search")
async def search_local_businesses(query: str, region: str, user=Depends(get_current_user)):
    """네이버 지역 검색 API 기반 지역 사업장 검색"""
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=503, detail="네이버 API 키가 설정되지 않았습니다.")

    # 지역 + 검색어 조합 (예: "강남구 치킨")
    region_prefix = region.split()[0] if region else ""
    full_query = f"{region_prefix} {query}".strip()

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://openapi.naver.com/v1/search/local.json",
                params={"query": full_query, "display": 15, "sort": "random"},
                headers={
                    "X-Naver-Client-Id": client_id,
                    "X-Naver-Client-Secret": client_secret,
                },
                timeout=aiohttp.ClientTimeout(total=5),
            ) as res:
                if res.status != 200:
                    raise HTTPException(status_code=502, detail="네이버 API 호출 실패")
                data = await res.json()
    except aiohttp.ClientError:
        raise HTTPException(status_code=502, detail="네이버 API 연결 오류")

    import re
    def strip_tags(text: str) -> str:
        """네이버 응답의 HTML 태그 제거 (<b>, </b> 등)"""
        return re.sub(r"<[^>]+>", "", text or "")

    return [
        {
            "name": strip_tags(item.get("title", "")),
            "address": item.get("roadAddress") or item.get("address", ""),
            "category": item.get("category", ""),
            "phone": item.get("telephone", ""),
            "naver_url": item.get("link", ""),
        }
        for item in data.get("items", [])
    ]


@router.get("/{biz_id}")
async def list_competitors(biz_id: str):
    """경쟁사 목록 조회"""
    supabase = get_client()
    result = await execute(
        supabase.table("competitors")
        .select("*")
        .eq("business_id", biz_id)
        .eq("is_active", True)
    )
    return result.data


@router.post("")
async def add_competitor(req: CompetitorCreate, user=Depends(get_current_user)):
    """경쟁사 등록"""
    x_user_id = user["id"]
    supabase = get_client()

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
    limits = {"free": 0, "basic": 5, "pro": 10, "biz": 999, "startup": 5, "enterprise": 999}
    if (existing.count or 0) >= limits.get(plan, 0):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": f"{plan} 플랜 경쟁사 한도 초과", "upgrade_url": "/pricing"},
        )

    result = await execute(supabase.table("competitors").insert({
        "business_id": req.business_id,
        "name": req.name,
        "address": req.address,
        "is_active": True,
    }))
    return result.data[0] if result.data else {}


@router.get("/suggest/list")
async def suggest_competitors(category: str, region: str, business_id: str):
    """업종·지역 기반 경쟁사 자동 추천 (동일 카테고리 상위 점수 사업장)"""
    supabase = get_client()

    # 같은 카테고리·지역의 다른 사업장 중 점수 높은 순
    candidates = (
        await execute(
            supabase.table("businesses")
            .select("id, name, address, region")
            .eq("category", category)
            .ilike("region", f"%{region.split()[0]}%")
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

    # 최신 점수만 추출
    latest: dict = {}
    for s in scores:
        if s["business_id"] not in latest:
            latest[s["business_id"]] = s["total_score"]

    # 이미 등록된 경쟁사 제외
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
        })

    result.sort(key=lambda x: x["score"], reverse=True)
    return result[:5]


@router.delete("/{competitor_id}")
async def remove_competitor(competitor_id: str, user=Depends(get_current_user)):
    """경쟁사 삭제 (soft delete)"""
    supabase = get_client()
    await execute(supabase.table("competitors").update({"is_active": False}).eq("id", competitor_id))
    return {"status": "deleted"}
