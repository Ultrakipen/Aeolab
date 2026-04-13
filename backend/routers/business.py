from fastapi import APIRouter, Depends, HTTPException, Query
from models.schemas import BusinessCreate
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
import logging
import os
import aiohttp
import utils.cache as _cache

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
    import asyncio
    from middleware.plan_gate import get_user_plan, PLAN_LIMITS
    from services.kakao_geocoding import get_coordinates
    x_user_id = user["id"]
    supabase = get_client()

    # 플랜별 사업장 등록 한도 체크
    plan = await get_user_plan(x_user_id, supabase)
    biz_limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["businesses"]
    existing_count = (await execute(
        supabase.table("businesses").select("id", count="exact").eq("user_id", x_user_id).eq("is_active", True)
    )).count or 0
    if existing_count >= biz_limit:
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": f"{plan} 플랜은 사업장 최대 {biz_limit}개까지 등록 가능합니다", "upgrade_url": "/pricing"},
        )

    # 주소 → 좌표 변환 (실패해도 등록은 정상 진행)
    lat, lng = None, None
    try:
        lat, lng = await get_coordinates(req.address)
    except Exception as e:
        logger.warning(f"Geocoding skipped for business '{req.name}': {e}")

    insert_payload: dict = {
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
        "blog_url": req.blog_url,
        "keywords": req.keywords or [],
        "business_type": req.business_type or "location_based",
        "review_count": req.review_count or 0,
        "avg_rating": req.avg_rating or 0,
        "is_active": True,
    }
    if req.business_registration_no:
        insert_payload["business_registration_no"] = req.business_registration_no
    if lat is not None:
        insert_payload["lat"] = lat
    if lng is not None:
        insert_payload["lng"] = lng

    result = await execute(supabase.table("businesses").insert(insert_payload))
    if not result.data:
        raise HTTPException(status_code=500, detail="사업장 등록 실패")

    biz = result.data[0]

    # Before 스크린샷 자동 캡처 (백그라운드)
    try:
        asyncio.create_task(_capture_before_screenshot(biz))
    except Exception as e:
        logger.warning(f"Before screenshot task failed to create: {e}")

    # 네이버 플레이스 통계 동기화 (naver_place_id 있을 때, 백그라운드)
    if biz.get("naver_place_id"):
        try:
            asyncio.create_task(_sync_naver_stats(biz["id"], biz["naver_place_id"]))
        except Exception as e:
            logger.warning(f"Naver place stats task failed to create: {e}")

    return biz


@router.get("/me")
async def get_my_businesses(user=Depends(get_current_user)):
    """내 사업장 목록"""
    x_user_id = user["id"]
    supabase = get_client()
    result = await execute(supabase.table("businesses").select("id, name, category, region, address, phone, website_url, blog_url, naver_place_url, keywords, business_type, naver_place_id, google_place_id, kakao_place_id, review_count, avg_rating, receipt_review_count, visitor_review_count, is_active, created_at, has_faq, has_recent_post, has_intro, is_smart_place, review_sample, kakao_score, kakao_checklist, kakao_registered, business_registration_no").eq("user_id", x_user_id).eq("is_active", True))
    return result.data


@router.get("/{biz_id}")
async def get_business(biz_id: str, user=Depends(get_current_user)):
    x_user_id = user["id"]
    supabase = get_client()
    result = await execute(supabase.table("businesses").select("id, name, category, region, address, phone, website_url, blog_url, naver_place_url, keywords, business_type, naver_place_id, google_place_id, kakao_place_id, review_count, avg_rating, receipt_review_count, visitor_review_count, is_active, created_at, has_faq, has_recent_post, has_intro, is_smart_place, review_sample, kakao_score, kakao_checklist, kakao_registered, business_registration_no").eq("id", biz_id).eq("user_id", x_user_id).single())
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
    allowed = {"name", "address", "phone", "website_url", "blog_url", "naver_place_url", "keywords", "naver_place_id", "google_place_id", "kakao_place_id", "business_type", "region", "receipt_review_count", "visitor_review_count", "review_count", "avg_rating", "kakao_score", "kakao_checklist", "kakao_registered", "is_smart_place", "has_faq", "has_recent_post", "has_intro", "has_photos", "has_review_response", "review_sample", "business_registration_no"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    result = await execute(supabase.table("businesses").update(filtered).eq("id", biz_id).eq("user_id", x_user_id))
    return result.data[0] if result.data else {}



_REVIEW_SYNC_COOLDOWN = 3600  # 1시간 (초)
_ADMIN_USER_IDS: set[str] = set(
    uid.strip() for uid in os.getenv("ADMIN_USER_IDS", "").split(",") if uid.strip()
)


@router.post("/{biz_id}/sync-review-stats")
async def sync_review_stats(biz_id: str, user=Depends(get_current_user)):
    """네이버 플레이스에서 리뷰 통계 자동 불러오기 (관리자 제외 1시간 쿨다운)"""
    x_user_id = user["id"]
    is_admin = x_user_id in _ADMIN_USER_IDS
    supabase = get_client()

    # 쿨다운 체크 (관리자 제외)
    if not is_admin:
        cache_key = f"review_sync_cooldown:{biz_id}"
        if _cache.get(cache_key) is not None:
            raise HTTPException(
                status_code=429,
                detail="1시간에 1회만 자동 불러오기가 가능합니다. 잠시 후 다시 시도해주세요.",
            )

    # 소유권 검증 + naver_place_id 조회
    biz_result = await execute(
        supabase.table("businesses")
        .select("id, user_id, naver_place_id")
        .eq("id", biz_id)
        .eq("is_active", True)
        .single()
    )
    if not biz_result.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz = biz_result.data
    if biz["user_id"] != x_user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    naver_place_id = biz.get("naver_place_id")
    if not naver_place_id:
        raise HTTPException(
            status_code=422,
            detail="네이버 플레이스 ID를 먼저 등록해주세요",
        )

    try:
        from services.naver_place_stats import sync_naver_place_stats
        stats = await sync_naver_place_stats(biz_id, naver_place_id)
    except Exception as e:
        logger.warning(f"sync_review_stats failed for {biz_id}: {e}")
        return {
            "success": False,
            "error": "네이버 플레이스 통계 불러오기에 실패했습니다",
        }

    if stats.get("error"):
        return {
            "success": False,
            "error": stats["error"],
        }

    # 성공 시 쿨다운 설정 (관리자 제외)
    if not is_admin:
        _cache.set(f"review_sync_cooldown:{biz_id}", 1, ttl=_REVIEW_SYNC_COOLDOWN)

    return {
        "success": True,
        "visitor_review_count": stats.get("visitor_review_count", 0),
        "receipt_review_count": stats.get("receipt_review_count", 0),
        "avg_rating": stats.get("avg_rating", 0.0),
        "place_name": stats.get("place_name", ""),
    }

@router.post("/{biz_id}/sync-smartplace-completeness")
async def sync_smartplace_completeness(biz_id: str, user=Depends(get_current_user)):
    """네이버 스마트플레이스에서 FAQ·소식·소개글 자동 확인 (관리자 제외 1시간 쿨다운)"""
    x_user_id = user["id"]
    is_admin = x_user_id in _ADMIN_USER_IDS
    supabase = get_client()

    if not is_admin:
        cache_key = f"smartplace_sync_cooldown:{biz_id}"
        if _cache.get(cache_key) is not None:
            raise HTTPException(
                status_code=429,
                detail="1시간에 1회만 자동 확인이 가능합니다. 잠시 후 다시 시도해주세요.",
            )

    biz_result = await execute(
        supabase.table("businesses")
        .select("id, user_id, naver_place_url, naver_place_id")
        .eq("id", biz_id)
        .eq("is_active", True)
        .single()
    )
    if not biz_result.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz = biz_result.data
    if biz["user_id"] != x_user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    naver_place_url = biz.get("naver_place_url")
    naver_place_id = biz.get("naver_place_id")

    # naver_place_url 없으면 naver_place_id로 URL 구성
    if not naver_place_url and naver_place_id:
        naver_place_url = f"https://map.naver.com/p/entry/place/{naver_place_id}"
    if not naver_place_url:
        raise HTTPException(
            status_code=422,
            detail="네이버 플레이스 URL 또는 플레이스 ID를 먼저 등록해주세요",
        )

    try:
        from services.naver_place_stats import check_smart_place_completeness
        result = await check_smart_place_completeness(naver_place_url)
    except Exception as e:
        logger.warning(f"sync_smartplace_completeness failed for {biz_id}: {e}")
        return {"success": False, "error": "스마트플레이스 확인 중 오류가 발생했습니다"}

    if result.get("error"):
        return {"success": False, "error": result["error"]}

    # DB 업데이트
    update_data = {
        "has_faq": result.get("has_faq", False),
        "has_recent_post": result.get("has_recent_post", False),
        "has_intro": result.get("has_intro", False),
    }
    try:
        supabase.table("businesses").update(update_data).eq("id", biz_id).execute()
    except Exception as e:
        logger.warning(f"smartplace completeness DB update failed: {e}")

    if not is_admin:
        _cache.set(f"smartplace_sync_cooldown:{biz_id}", 1, ttl=_REVIEW_SYNC_COOLDOWN)

    return {
        "success": True,
        **update_data,
        "completeness_score": result.get("completeness_score", 0),
    }


async def _capture_before_screenshot(biz: dict):
    try:
        from services.screenshot import capture_batch, build_queries
        from db.supabase_client import get_client, execute
        import asyncio
        supabase = get_client()
        queries = build_queries(biz)
        for q in queries[:3]:
            try:
                urls = await capture_batch(biz["id"], [q])
                url = urls[0] if urls else None
                if url:
                    await execute(
                        supabase.table("before_after").insert({
                            "business_id": biz["id"],
                            "capture_type": "before",
                            "image_url": url,
                            "query_used": q,
                        })
                    )
            except Exception as inner_e:
                logger.warning(f"Before screenshot failed for query '{q}': {inner_e}")
            await asyncio.sleep(2)
    except Exception as e:
        logger.error(f"Before screenshot capture failed: {e}")


async def _sync_naver_stats(business_id: str, naver_place_id: str):
    try:
        from services.naver_place_stats import sync_naver_place_stats
        await sync_naver_place_stats(business_id, naver_place_id)
    except Exception as e:
        logger.warning(f"Naver place stats sync failed for {business_id}: {e}")


@router.get("/{biz_id}/blog-mentions")
async def get_my_blog_mentions(biz_id: str, user=Depends(get_current_user)):
    """내 가게 이름으로 네이버 블로그 언급 수 조회 (경쟁사와 동일 방식)"""
    x_user_id = user["id"]
    supabase = get_client()

    biz_result = await execute(
        supabase.table("businesses")
        .select("id, name, region")
        .eq("id", biz_id)
        .eq("user_id", x_user_id)
        .eq("is_active", True)
        .maybeSingle()
    )
    if not biz_result.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")

    biz = biz_result.data
    try:
        from services.competitor_place_crawler import fetch_competitor_blog_mentions
        count = await fetch_competitor_blog_mentions(
            biz["name"],
            biz.get("region", "")
        )
        return {"count": count}
    except Exception as e:
        logger.warning(f"blog-mentions fetch failed [{biz_id}]: {e}")
        return {"count": 0}
