from fastapi import APIRouter, Depends, HTTPException, Query
from models.schemas import BusinessCreate
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
import logging
import os
import aiohttp

router = APIRouter()
logger = logging.getLogger("aeolab")

NTS_API_KEY = os.getenv("NTS_API_KEY", "")
NTS_STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status"

B_STT_LABELS = {"01": "계속사업자", "02": "휴업자", "03": "폐업자"}
TAX_TYPE_LABELS = {
    "01": "부가가치세 일반과세자",
    "02": "부가가치세 간이과세자",
    "03": "부가가치세 면세사업자",
    "04": "소득세 법인세 원천세 신고의무자(공익단체)",
}


def _get_user_id(user=Depends(get_current_user)) -> str:
    return user["id"]


@router.get("/search-address")
async def search_address(name: str = Query(...), region: str = Query("")):
    """네이버 지역 검색으로 사업장 주소·전화번호 후보 반환"""
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=503, detail="네이버 API 키가 설정되지 않았습니다")

    region_prefix = region.split()[0] if region else ""
    query = f"{region_prefix} {name}".strip()

    import re
    def strip_tags(text: str) -> str:
        return re.sub(r"<[^>]+>", "", text or "")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://openapi.naver.com/v1/search/local.json",
                params={"query": query, "display": 10, "sort": "random"},
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

    return [
        {
            "name": strip_tags(item.get("title", "")),
            "address": item.get("roadAddress") or item.get("address", ""),
            "phone": item.get("telephone", ""),
            "category": item.get("category", ""),
        }
        for item in data.get("items", [])
        if item.get("roadAddress") or item.get("address")
    ]


@router.get("/lookup")
async def lookup_business_registration(reg_no: str = Query(..., description="사업자등록번호 (숫자만 10자리)")):
    """국세청 API로 사업자등록번호 유효성 및 상태 조회"""
    digits = reg_no.replace("-", "").strip()
    if len(digits) != 10 or not digits.isdigit():
        raise HTTPException(status_code=400, detail="사업자등록번호는 10자리 숫자여야 합니다")

    if not NTS_API_KEY:
        raise HTTPException(status_code=503, detail="NTS_API_KEY가 설정되지 않았습니다")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                NTS_STATUS_URL,
                params={"serviceKey": NTS_API_KEY},
                json={"b_no": [digits]},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=502, detail="국세청 API 오류")
                data = await resp.json()
    except aiohttp.ClientError as e:
        logger.error(f"NTS API request failed: {e}")
        raise HTTPException(status_code=502, detail="국세청 API 연결 실패")

    items = data.get("data", [])
    if not items:
        raise HTTPException(status_code=404, detail="조회 결과가 없습니다")

    item = items[0]
    b_stt_cd = item.get("b_stt_cd", "")
    tax_type_cd = item.get("tax_type_cd", "")

    return {
        "reg_no": digits,
        "status_code": b_stt_cd,
        "status": B_STT_LABELS.get(b_stt_cd, item.get("b_stt", "알 수 없음")),
        "is_active": b_stt_cd == "01",
        "tax_type": TAX_TYPE_LABELS.get(tax_type_cd, item.get("tax_type", "")),
        "end_dt": item.get("end_dt") or None,
    }


@router.post("")
async def create_business(req: BusinessCreate, user=Depends(get_current_user)):
    """사업장 등록"""
    x_user_id = user["id"]
    supabase = get_client()
    result = await execute(supabase.table("businesses").insert({
        "user_id": x_user_id,
        "name": req.name,
        "category": req.category,
        "region": req.region or "",
        "address": req.address,
        "phone": req.phone,
        "naver_place_id": req.naver_place_id,
        "google_place_id": req.google_place_id,
        "kakao_place_id": req.kakao_place_id,
        "website_url": req.website_url,
        "keywords": req.keywords or [],
        "business_type": req.business_type or "location_based",
        "is_active": True,
    }))
    if not result.data:
        raise HTTPException(status_code=500, detail="사업장 등록 실패")

    biz = result.data[0]

    # Before 스크린샷 자동 캡처 (백그라운드)
    try:
        import asyncio
        asyncio.create_task(_capture_before_screenshot(biz))
    except Exception as e:
        logger.warning(f"Before screenshot task failed to create: {e}")

    # 네이버 플레이스 통계 동기화 (naver_place_id 있을 때, 백그라운드)
    if biz.get("naver_place_id"):
        try:
            import asyncio
            asyncio.create_task(_sync_naver_stats(biz["id"], biz["naver_place_id"]))
        except Exception as e:
            logger.warning(f"Naver place stats task failed to create: {e}")

    return biz


@router.get("/me")
async def get_my_businesses(user=Depends(get_current_user)):
    """내 사업장 목록"""
    x_user_id = user["id"]
    supabase = get_client()
    result = await execute(supabase.table("businesses").select("*").eq("user_id", x_user_id).eq("is_active", True))
    return result.data


@router.get("/{biz_id}")
async def get_business(biz_id: str, user=Depends(get_current_user)):
    x_user_id = user["id"]
    supabase = get_client()
    result = await execute(supabase.table("businesses").select("*").eq("id", biz_id).eq("user_id", x_user_id).single())
    if not result.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    return result.data


@router.delete("/{biz_id}")
async def delete_business(biz_id: str, user=Depends(get_current_user)):
    """사업장 삭제 (soft delete)"""
    x_user_id = user["id"]
    supabase = get_client()
    result = await execute(supabase.table("businesses").update({"is_active": False}).eq("id", biz_id).eq("user_id", x_user_id))
    if not result.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    return {"ok": True}


@router.patch("/{biz_id}")
async def update_business(biz_id: str, updates: dict, user=Depends(get_current_user)):
    x_user_id = user["id"]
    supabase = get_client()
    allowed = {"name", "address", "phone", "website_url", "keywords", "naver_place_id", "google_place_id", "kakao_place_id", "business_type", "region", "receipt_review_count", "visitor_review_count", "review_count", "avg_rating"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    result = await execute(supabase.table("businesses").update(filtered).eq("id", biz_id).eq("user_id", x_user_id))
    return result.data[0] if result.data else {}


async def _capture_before_screenshot(biz: dict):
    try:
        from services.screenshot import capture_batch, build_queries
        from db.supabase_client import get_client, execute
        supabase = get_client()
        queries = build_queries(biz)
        urls = await capture_batch(biz["id"], queries)
        for url in urls:
            if url:
                await execute(
                    supabase.table("before_after").insert({
                        "business_id": biz["id"],
                        "capture_type": "before",
                        "image_url": url,
                    })
                )
    except Exception as e:
        logger.error(f"Before screenshot capture failed: {e}")


async def _sync_naver_stats(business_id: str, naver_place_id: str):
    try:
        from services.naver_place_stats import sync_naver_place_stats
        await sync_naver_place_stats(business_id, naver_place_id)
    except Exception as e:
        logger.warning(f"Naver place stats sync failed for {business_id}: {e}")
