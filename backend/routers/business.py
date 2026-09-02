from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Literal
from models.schemas import BusinessCreate
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
import logging
import os
import re
import asyncio
import aiohttp
import utils.cache as _cache

router = APIRouter()
logger = logging.getLogger("aeolab")

# /intro-generate·/global-ai-intro-generate·/talktalk-faq-generate 3개 엔드포인트 +
# guide.py의 /{biz_id}/smartplace-faq까지 총 4개가 faq_monthly 한도를 공유(guides.context
# in intro_draft/faq_draft/talktalk_faq COUNT)하는데 "COUNT 체크 → Claude 호출(수 초~수십 초)
# → insert" 사이 동시요청이 같은 월별 한도를 여러 번 통과할 수 있는 TOCTOU 구조.
# 과거엔 이 파일 3곳만 로컬 set으로 방어하고 guide.py의 smartplace-faq는 락이 아예 없어
# 4번째 경로로 우회 가능했음 — plan_gate.py의 공유 락으로 4곳 전부 통일(2026-08-06).
from middleware.plan_gate import _faq_monthly_generation_locks as _intro_faq_generation_locks

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


def _extract_naver_place_id(url: str | None) -> str | None:
    """네이버 플레이스 URL에서 숫자 place_id 추출.

    지원 형식:
      - https://map.naver.com/p/entry/place/898503091?lng=...
      - https://map.naver.com/v5/entry/place/898503091
      - https://m.place.naver.com/place/898503091/home
      - https://m.place.naver.com/restaurant/898503091/home
    추출 실패(검색 URL·단축 URL 등) 시 None 반환 — 오추출 방지.
    """
    if not url:
        return None
    m = re.search(r"place/(\d+)", url)            # .../place/898503091
    if m:
        return m.group(1)
    m = re.search(r"/(\d{6,})(?:[/?]|$)", url)     # fallback: /restaurant/898503091/ 등 긴 숫자 세그먼트
    return m.group(1) if m else None


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

    from services.naver_api_hub import search_request
    _url, _headers = search_request("local")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _url,
                params={"query": query, "display": 10, "sort": "random"},
                headers=_headers,
                timeout=aiohttp.ClientTimeout(total=5),
            ) as res:
                if res.status != 200:
                    raise HTTPException(status_code=502, detail="네이버 API 호출 실패")
                data = await res.json(content_type=None)
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
async def lookup_business_registration(reg_no: str = Query(..., description="사업자등록번호 (숫자만 10자리)"), user=Depends(get_current_user)):
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
        "is_franchise": bool(req.is_franchise),
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

    # Trial 스캔 결과 자동 이전 (trial_scan_id 전달 시, 백그라운드)
    if req.trial_scan_id:
        try:
            asyncio.create_task(_import_trial_scan(biz["id"], req.trial_scan_id))
        except Exception as e:
            logger.warning(f"Trial import task failed to create: {e}")

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

    # 블로그 자동 분석 (blog_url 있을 때, 백그라운드)
    if req.blog_url:
        try:
            asyncio.create_task(
                _trigger_blog_analysis_bg(
                    business_id=str(biz["id"]),
                    blog_url=req.blog_url,
                    business_name=req.name,
                    category=req.category or "restaurant",
                    region=req.region or "",
                )
            )
            logger.info(f"blog auto-analysis scheduled: biz={biz['id']}")
        except Exception as e:
            logger.warning(f"Blog analysis task failed to create: {e}")

    # 웰컴 약속 이메일 (비동기, 실패해도 사업장 등록에 영향 없음)
    # email은 JWT(user dict)에 포함됨 — profiles 테이블에 email 컬럼 없음
    try:
        user_email = user.get("email", "")
        if user_email:
            from services.email_sender import send_welcome_promise_email
            asyncio.create_task(
                send_welcome_promise_email(
                    email=user_email,
                    biz_name=req.name,
                    category=req.category or "",
                    unified_score=None,
                    region=req.region or "",
                )
            )
            logger.info(f"welcome promise email scheduled: biz={biz['id']}")
    except Exception as e:
        logger.warning(f"Welcome email task failed to create: {e}")

    return biz


_BIZ_BASE_COLS = "id, name, category, region, address, phone, website_url, blog_url, naver_place_url, keywords, business_type, naver_place_id, google_place_id, kakao_place_id, review_count, avg_rating, receipt_review_count, visitor_review_count, is_active, created_at, has_faq, has_recent_post, has_intro, is_smart_place, review_sample, kakao_score, kakao_checklist, kakao_registered, business_registration_no, blog_mention_count"
_BIZ_OPTIONAL_COLS = ["ai_info_tab_status", "is_franchise", "naver_intro_draft", "naver_intro_generated_at", "global_intro_draft", "global_intro_generated_at", "talktalk_faq_draft", "talktalk_faq_generated_at", "awards_certifications", "signature_points"]


@router.get("/me")
async def get_my_businesses(user=Depends(get_current_user)):
    """내 사업장 목록"""
    x_user_id = user["id"]
    supabase = get_client()
    cols = _BIZ_BASE_COLS + ", " + ", ".join(_BIZ_OPTIONAL_COLS)
    try:
        result = await execute(supabase.table("businesses").select(cols).eq("user_id", x_user_id).eq("is_active", True))
        return result.data
    except Exception as e:
        msg = str(e).lower()
        if "ai_info_tab_status" in msg or "column" in msg or "does not exist" in msg:
            logger.warning(f"businesses.ai_info_tab_status missing — falling back. user={x_user_id}")
            result = await execute(supabase.table("businesses").select(_BIZ_BASE_COLS).eq("user_id", x_user_id).eq("is_active", True))
            return result.data
        raise


@router.get("/{biz_id}")
async def get_business(biz_id: str, user=Depends(get_current_user)):
    x_user_id = user["id"]
    supabase = get_client()
    cols = _BIZ_BASE_COLS + ", " + ", ".join(_BIZ_OPTIONAL_COLS)
    try:
        result = await execute(supabase.table("businesses").select(cols).eq("id", biz_id).eq("user_id", x_user_id).single())
    except Exception as e:
        msg = str(e).lower()
        if "ai_info_tab_status" in msg or "column" in msg or "does not exist" in msg:
            logger.warning(f"businesses.ai_info_tab_status missing — falling back. biz={biz_id}")
            result = await execute(supabase.table("businesses").select(_BIZ_BASE_COLS).eq("id", biz_id).eq("user_id", x_user_id).single())
        else:
            raise
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
    import asyncio
    from datetime import datetime, timezone
    x_user_id = user["id"]
    supabase = get_client()
    allowed = {"name", "category", "address", "phone", "website_url", "blog_url", "naver_place_url", "keywords", "naver_place_id", "google_place_id", "kakao_place_id", "business_type", "region", "receipt_review_count", "visitor_review_count", "review_count", "avg_rating", "kakao_score", "kakao_checklist", "kakao_registered", "is_smart_place", "has_faq", "has_recent_post", "has_intro", "has_photos", "has_review_response", "review_sample", "business_registration_no", "naver_blog_id", "ai_info_tab_status", "is_franchise", "awards_certifications", "signature_points"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        raise HTTPException(status_code=400, detail="변경할 필드가 없습니다")

    # 네이버 플레이스 URL 저장 시 place_id 자동 추출 — 리뷰 통계 동기화 활성화
    # (빠른수정 패널은 naver_place_url만 전송 → place_id 미추출 시 sync_naver_place_stats가
    #  스킵되어 review_count가 영원히 0으로 남던 버그 방지. 2026-06-11 수정)
    if filtered.get("naver_place_url") and not filtered.get("naver_place_id"):
        _extracted_pid = _extract_naver_place_id(filtered["naver_place_url"])
        if _extracted_pid:
            filtered["naver_place_id"] = _extracted_pid
            logger.info(f"extracted naver_place_id={_extracted_pid} from url on update biz={biz_id}")

    # has_recent_post=True 토글 시 last_post_at 자동 갱신 (소식 14일 알림 잡 연계)
    # 컬럼 없는 경우 graceful fallback — DB ALTER 미실행 시 에러 무시
    if filtered.get("has_recent_post") is True:
        filtered["last_post_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = await execute(supabase.table("businesses").update(filtered).eq("id", biz_id).eq("user_id", x_user_id))
    except Exception as e:
        # last_post_at / awards_certifications / signature_points 컬럼 미존재 시 폴백 — 재시도
        # (2026-09-02 SQL 미실행 구간 보호 — scripts/supabase_schema.sql 참조)
        _err_msg = str(e).lower()
        _optional_update_cols = ["last_post_at", "awards_certifications", "signature_points"]
        _missing = [c for c in _optional_update_cols if c in filtered and (c.lower() in _err_msg or "column" in _err_msg or "does not exist" in _err_msg)]
        if _missing:
            logger.warning(f"optional column(s) missing on business update — falling back without them {_missing}: {e}")
            for c in _missing:
                filtered.pop(c, None)
            if not filtered:
                raise HTTPException(status_code=400, detail="변경할 필드가 없습니다")
            result = await execute(supabase.table("businesses").update(filtered).eq("id", biz_id).eq("user_id", x_user_id))
        else:
            raise

    # naver_place_id 신규/변경 시 리뷰 통계 백그라운드 동기화 (URL 추출분 포함)
    # filtered는 변경 필드만 담으므로, place_id가 이번 업데이트에 포함된 경우에만 동기화 — 불필요한 크롤 방지
    if filtered.get("naver_place_id"):
        try:
            asyncio.create_task(_sync_naver_stats(biz_id, filtered["naver_place_id"]))
            logger.info(f"review stats sync scheduled on update: biz={biz_id}")
        except Exception as e:
            logger.warning(f"review sync task failed to create on update: {e}")

    # naver_blog_id 변경 시 blog_analysis 캐시 무효화 (is_mine 재판별 필요)
    if "naver_blog_id" in filtered:
        try:
            from utils import cache as _cache
            new_id = (filtered.get("naver_blog_id") or "").strip().lower()
            for suffix in ["none", new_id]:
                _cache.delete(_cache._make_key("blog_analysis", biz_id, suffix))
        except Exception as e:
            logger.warning(f"cache delete failed biz_id={biz_id}: {e}")

    # blog_url 변경 시 재분석 트리거 (백그라운드)
    if "blog_url" in filtered and filtered["blog_url"]:
        try:
            biz_info_res = await execute(
                supabase.table("businesses")
                .select("name, category, region")
                .eq("id", biz_id)
                .single()
            )
            biz_info = biz_info_res.data if biz_info_res and biz_info_res.data else {}
            asyncio.create_task(
                _trigger_blog_analysis_bg(
                    business_id=biz_id,
                    blog_url=filtered["blog_url"],
                    business_name=biz_info.get("name", ""),
                    category=biz_info.get("category", "restaurant"),
                    region=biz_info.get("region", ""),
                )
            )
            logger.info(f"blog re-analysis scheduled on update: biz={biz_id}")
        except Exception as e:
            logger.warning(f"Blog re-analysis task failed to create on update: {e}")

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

@router.post("/{biz_id}/capture-screenshots")
async def capture_screenshots(biz_id: str, user=Depends(get_current_user)):
    """Before 스크린샷 수동 캡처 (스크린샷이 없을 때 사용, 1시간 쿨다운)"""
    x_user_id = user["id"]
    supabase = get_client()

    # 쿨다운 체크
    cache_key = f"screenshot_cooldown:{biz_id}"
    if _cache.get(cache_key) is not None:
        raise HTTPException(
            status_code=429,
            detail="1시간에 1회만 스크린샷 캡처가 가능합니다.",
        )

    # 소유권 확인
    biz_result = await execute(
        supabase.table("businesses")
        .select("id, name, category, region, keywords, naver_place_id, website_url, blog_url, business_type")
        .eq("id", biz_id)
        .eq("user_id", x_user_id)
        .eq("is_active", True)
        .single()
    )
    if not biz_result.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz = biz_result.data

    # 이미 before 스크린샷이 있는지 확인
    existing = await execute(
        supabase.table("before_after")
        .select("id")
        .eq("business_id", biz_id)
        .limit(1)
    )
    capture_type_prefix = "before" if not (existing.data) else "after_manual"

    # 쿨다운 설정
    _cache.set(cache_key, 1, ttl=3600)

    # 백그라운드로 캡처 시작
    import asyncio
    asyncio.create_task(_capture_before_screenshot(biz))

    return {
        "success": True,
        "message": "스크린샷 캡처를 시작했습니다. 1~2분 후 변화 기록 페이지에서 확인하세요.",
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
    """Before 스크린샷 캡처 — 플랫폼별로 분리 저장
    capture_batch 대신 capture_ai_result를 직접 호출하여
    각 플랫폼(naver_blog, naver_ai, google)별 capture_type을 정확히 기록.
    """
    try:
        from services.screenshot import capture_ai_result, build_queries
        from db.supabase_client import get_client, execute
        import asyncio
        supabase = get_client()
        queries = build_queries(biz)
        biz_id = biz["id"]

        # 1. 네이버 블로그 (대표 쿼리 2개)
        for q in queries[:2]:
            try:
                url = await capture_ai_result("naver", q, biz_id, "before")
                if url:
                    await execute(
                        supabase.table("before_after").insert({
                            "business_id": biz_id,
                            "capture_type": "before",
                            "image_url": url,
                            "query_used": q,
                        })
                    )
                    logger.info(f"Before screenshot (naver_blog) saved: {biz.get('name')} / {q}")
            except Exception as e:
                logger.warning(f"Before screenshot (naver_blog) failed: {q} — {e}")
            await asyncio.sleep(3)

        # 2. 네이버 AI 브리핑 — ACTIVE/LIKELY 업종만
        from services.screenshot import _needs_naver_ai_shot
        if _needs_naver_ai_shot(biz.get("category", ""), bool(biz.get("is_franchise"))):
            for q in queries[:2]:
                try:
                    url = await capture_ai_result("naver_ai", q, biz_id, "before_naver_ai")
                    if url:
                        await execute(
                            supabase.table("before_after").insert({
                                "business_id": biz_id,
                                "capture_type": "before_naver_ai",
                                "image_url": url,
                                "query_used": q,
                            })
                        )
                        logger.info(f"Before screenshot (naver_ai) saved: {biz.get('name')} / {q}")
                except Exception as e:
                    logger.warning(f"Before screenshot (naver_ai) failed: {q} — {e}")
                await asyncio.sleep(3)
        else:
            logger.info(f"naver_ai screenshot skipped (INACTIVE): {biz.get('name')}")

        # Google: 제거 — 데이터센터 IP CAPTCHA 100%, 구독자 50명 이후 DataForSEO API 재도입

        logger.info(f"Before screenshot capture completed for: {biz.get('name')}")
    except Exception as e:
        logger.error(f"Before screenshot capture failed: {e}")


async def _sync_naver_stats(business_id: str, naver_place_id: str):
    try:
        from services.naver_place_stats import sync_naver_place_stats
        await sync_naver_place_stats(business_id, naver_place_id)
    except Exception as e:
        logger.warning(f"Naver place stats sync failed for {business_id}: {e}")


async def _trigger_blog_analysis_bg(
    business_id: str,
    blog_url: str,
    business_name: str,
    category: str,
    region: str,
) -> None:
    """블로그 자동 분석 백그라운드 태스크 — 사업장 등록/수정 시 자동 호출"""
    import asyncio
    from datetime import datetime, timezone
    from services.blog_analyzer import analyze_blog

    try:
        analysis = await asyncio.wait_for(
            analyze_blog(
                blog_url=blog_url,
                business_name=business_name,
                category=category,
                region=region,
            ),
            timeout=35,
        )
        now_iso = datetime.now(timezone.utc).isoformat()
        keyword_coverage = {
            "present": analysis.get("covered_keywords", []),
            "missing": analysis.get("missing_keywords", []),
            "competitor_only": [],
        }
        analysis_json = {
            "business_id": business_id,
            "blog_url": blog_url,
            "post_count": analysis.get("post_count", 0),
            "total_post_count": analysis.get("total_post_count", 0),
            "platform": analysis.get("platform"),
            "citation_score": analysis.get("ai_readiness_score", 0),
            "freshness_score": analysis.get("ai_readiness_score", 0),
            "keyword_coverage": keyword_coverage,
            "missing_keywords": analysis.get("missing_keywords", []),
            "top_recommendation": analysis.get("top_recommendation"),
            "analyzed_at": now_iso,
            "error": analysis.get("error"),
        }
        payload: dict = {
            "blog_analyzed_at": now_iso,
            "blog_keyword_coverage": analysis.get("keyword_coverage", 0.0),
            "blog_post_count": analysis.get("post_count", 0),
        }
        latest_date = analysis.get("latest_post_date")
        if latest_date:
            payload["blog_latest_post_date"] = latest_date

        supabase = get_client()
        # blog_analysis_json 컬럼이 있으면 전체 결과도 저장, 없으면 기본 필드만 저장
        full_payload = {**payload, "blog_analysis_json": analysis_json}
        try:
            await execute(
                supabase.table("businesses").update(full_payload).eq("id", business_id)
            )
        except Exception as err:
            err_str = str(err)
            if "blog_analysis_json" in err_str:
                logger.warning(
                    f"blog_analysis_json column not found — saving base fields only. "
                    f"Run: ALTER TABLE businesses ADD COLUMN IF NOT EXISTS blog_analysis_json JSONB;"
                )
                await execute(
                    supabase.table("businesses").update(payload).eq("id", business_id)
                )
            else:
                raise

        logger.info(
            f"blog auto-analysis done: biz={business_id}, "
            f"platform={analysis.get('platform')}, "
            f"coverage={analysis.get('keyword_coverage', 0):.1f}%"
        )
    except asyncio.TimeoutError:
        logger.warning(f"blog auto-analysis timeout: biz={business_id}")
    except Exception as e:
        logger.warning(f"blog auto-analysis failed: biz={business_id}, error={e}")


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
        .maybe_single()
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
        return {"count": count, "measured": True}
    except Exception as e:
        logger.warning(f"blog-mentions fetch failed [{biz_id}]: {e}")
        # 크롤러 실패와 실제 0건을 구분 — count는 하위호환용, measured로 실측 여부 판별
        return {"count": 0, "measured": False}

# ─── 업종 한글명 매핑 ─────────────────────────────────────────────────────────
_CATEGORY_LABELS = {
    "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리", "bar": "주점",
    "beauty": "미용실", "nail": "네일샵", "medical": "의료/병원", "pharmacy": "약국",
    "fitness": "헬스/피트니스", "yoga": "요가/필라테스", "pet": "반려동물",
    "education": "교육/학원", "tutoring": "과외", "legal": "법률/법무",
    "realestate": "부동산", "interior": "인테리어", "auto": "자동차",
    "cleaning": "청소/세탁", "shopping": "쇼핑", "fashion": "패션",
    "photo": "사진스튜디오", "video": "영상제작", "design": "디자인",
    "accommodation": "숙박", "other": "기타",
}

# ─── 소개글 / 톡톡 채팅방 메뉴 AI 생성 — Claude 호출은 guide_generator.py에 위임 ────────

def _count_qa_pairs(text: str) -> int:
    return len(re.findall(r"Q\.\s+\S", text))


def _count_keyword_matches(text: str, keywords: list) -> list:
    return [kw for kw in keywords if kw and kw in text]


class IntroGenerateRequest(BaseModel):
    biz_id: str
    style: Literal["standard", "qa_focused", "concise"] = "qa_focused"
    target_length: int = 400


class IntroGenerateResponse(BaseModel):
    intro_text: str
    char_count: int
    qa_count: int
    keywords_included: list[str]
    dia_score: dict | None = None  # D.I.A. 5요소 사후 검증 (0~100), AI 호출 0


class GlobalAiIntroResponse(BaseModel):
    intro: str
    char_count: int
    dia_score: dict | None = None


class TalktalkFAQItem(BaseModel):
    question: str
    answer: str
    category: str


class TalktalkFAQGenerateRequest(BaseModel):
    biz_id: str
    count: int = 10


class TalktalkFAQGenerateResponse(BaseModel):
    items: list[TalktalkFAQItem]
    chat_menus: list[str]
    is_fallback: bool = False


@router.post("/intro-generate", response_model=IntroGenerateResponse)
async def generate_intro(req: IntroGenerateRequest, user=Depends(get_current_user)):
    """소개글 AI 자동 생성 — Claude Sonnet 사용.

    Q&A 5개 포함된 300~500자 소개글 생성.
    플랜 게이트: free=불가, basic=월 5회(faq_monthly 공유), pro/biz=한도 내.
    """
    from middleware.plan_gate import get_user_plan, PLAN_LIMITS, _DEV_MODE
    from datetime import datetime, timezone

    user_id = user["id"]
    supabase = get_client()

    # 플랜 한도 체크 (faq_monthly 공유)
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("faq_monthly", 0)
    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "소개글 AI 생성은 Basic 이상 플랜에서 사용 가능합니다", "upgrade_url": "/pricing"},
        )

    # 소유권 검증
    biz_res = await execute(
        supabase.table("businesses")
        .select("id, name, category, region, keywords, user_id, address, phone, review_count, avg_rating")
        .eq("id", req.biz_id)
        .eq("is_active", True)
        .single()
    )
    if not biz_res.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    biz = biz_res.data
    if biz["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    # 동시 중복 생성 방지 — COUNT 체크~insert 사이 TOCTOU 레이스 방지
    # (intro-generate/global-ai-intro-generate/talktalk-faq-generate 공유 락)
    if user_id in _intro_faq_generation_locks:
        from utils.system_alert_log import record_alert
        asyncio.create_task(record_alert(
            "INTRO_GENERATION_IN_PROGRESS", "소개글·FAQ 생성 락 충돌(동시 요청)",
            level="info", source="lock_contention",
        ))
        raise HTTPException(
            status_code=409,
            detail={
                "code": "INTRO_GENERATION_IN_PROGRESS",
                "message": "이미 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _intro_faq_generation_locks.add(user_id)
    try:
        # 월별 사용 횟수 체크 — intro_draft + faq_draft 합산 (plan_gate faq_monthly 공유 한도)
        # DEV_MODE=true 시 한도 검사 전체 우회
        now = datetime.now(timezone.utc)
        if limit < 999 and not _DEV_MODE:
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
            used_res = await execute(
                supabase.table("guides")
                .select("id", count="exact")
                .eq("business_id", req.biz_id)
                .in_("context", ["intro_draft", "faq_draft", "talktalk_faq"])
                .gte("generated_at", month_start)
            )
            used = used_res.count or 0
            if used >= limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"이번 달 소개글·FAQ 합산 한도({limit}회)에 도달했습니다",
                )

        # Claude Sonnet 호출 — guide_generator.py 허용 경로로 위임
        from services.guide_generator import generate_naver_intro
        category_label = _CATEGORY_LABELS.get(biz.get("category", "other"), biz.get("category", ""))
        keywords = biz.get("keywords") or []

        try:
            intro_text = await generate_naver_intro(
                biz_name=biz.get("name", ""),
                category_label=category_label,
                region=biz.get("region", ""),
                keywords=keywords,
                target_length=req.target_length,
                category=biz.get("category"),  # LSI 키워드 자동 추출용
                address=biz.get("address"),
                phone=biz.get("phone"),
                review_count=biz.get("review_count"),
                avg_rating=biz.get("avg_rating"),
                awards=biz.get("awards_certifications"),
                signature=biz.get("signature_points"),
            )
        except Exception as e:
            logger.warning(f"intro-generate Claude call failed [biz={req.biz_id}]: {e}")
            raise HTTPException(status_code=502, detail="AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")

        # D.I.A. 품질 게이트 — 70점 미만 시 최대 2회 자동 재생성 (월 한도 추가 소비 없음)
        dia_score: dict | None = None
        try:
            from services.content_validator import validate_intro_dia
            from services.keyword_taxonomy import get_all_keywords_flat
            _lsi = get_all_keywords_flat(biz.get("category", "other"))[:8]
            dia_score = validate_intro_dia(intro_text, keywords=keywords, lsi_keywords=_lsi)
            _dia_cur = float(dia_score.get("score", 0))
            _MAX_DIA_RETRIES = 2
            for _retry in range(_MAX_DIA_RETRIES):
                if _dia_cur >= 70:
                    break
                logger.warning(
                    f"intro-generate D.I.A. {_dia_cur:.0f}/100 미달 — "
                    f"재생성 {_retry + 1}/{_MAX_DIA_RETRIES} [biz={req.biz_id}]"
                )
                try:
                    _regen = await generate_naver_intro(
                        biz_name=biz.get("name", ""),
                        category_label=category_label,
                        region=biz.get("region", ""),
                        keywords=keywords,
                        target_length=req.target_length,
                        category=biz.get("category"),
                        lsi_keywords=_lsi,
                        address=biz.get("address"),
                        phone=biz.get("phone"),
                        review_count=biz.get("review_count"),
                        avg_rating=biz.get("avg_rating"),
                        awards=biz.get("awards_certifications"),
                        signature=biz.get("signature_points"),
                    )
                    _regen_dia = validate_intro_dia(_regen, keywords=keywords, lsi_keywords=_lsi)
                    _regen_score = float(_regen_dia.get("score", 0))
                    if _regen_score > _dia_cur:
                        intro_text = _regen
                        dia_score = _regen_dia
                        _dia_cur = _regen_score
                except Exception as _re:
                    logger.warning(f"intro-generate 재생성 {_retry + 1}회 실패: {_re}")
                    break
            if _dia_cur < 70:
                logger.warning(
                    f"intro-generate D.I.A. 3회 시도 후 {_dia_cur:.0f}/100 미달 — "
                    f"마지막 결과 반환 [biz={req.biz_id}]"
                )
        except Exception as dia_err:
            logger.warning(f"intro-generate D.I.A. validate failed: {dia_err}")

        qa_count = _count_qa_pairs(intro_text)
        keywords_included = _count_keyword_matches(intro_text, keywords)

        # guides 테이블에 사용 이력 기록 + businesses 테이블에 최신 초안 저장
        try:
            await execute(
                supabase.table("guides").insert({
                    "business_id": req.biz_id,
                    "context": "intro_draft",
                    "items_json": {"intro_text": intro_text, "style": req.style},
                    "generated_at": now.isoformat(),
                })
            )
        except Exception as save_err:
            logger.warning(f"intro-generate guides 저장 실패: {save_err}")

        # businesses.naver_intro_draft 에 최신 초안 저장 (재방문 시 재로드용)
        try:
            await execute(
                supabase.table("businesses").update({
                    "naver_intro_draft": intro_text,
                    "naver_intro_generated_at": now.isoformat(),
                }).eq("id", req.biz_id)
            )
        except Exception as save_err:
            logger.warning(f"intro-generate businesses 저장 실패 (컬럼 없을 수 있음): {save_err}")

        return IntroGenerateResponse(
            intro_text=intro_text,
            char_count=len(intro_text),
            qa_count=qa_count,
            keywords_included=keywords_included,
            dia_score=dia_score,
        )
    finally:
        _intro_faq_generation_locks.discard(user_id)


@router.post("/global-ai-intro-generate", response_model=GlobalAiIntroResponse)
async def generate_global_ai_intro_endpoint(
    req: IntroGenerateRequest,
    user=Depends(get_current_user),
):
    """글로벌 AI 최적화 소개글 생성 (ChatGPT·Gemini·Google AI 노출 최적화). Basic+."""
    from middleware.plan_gate import get_user_plan, PLAN_LIMITS, _DEV_MODE
    from datetime import datetime, timezone

    user_id = user["id"]
    supabase = get_client()

    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("faq_monthly", 0)
    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "글로벌 AI 소개글 생성은 Basic 이상 플랜에서 사용 가능합니다", "upgrade_url": "/pricing"},
        )

    # 소유권 검증
    biz_res = await execute(
        supabase.table("businesses")
        .select("id, name, category, region, keywords, user_id, address, phone, review_count, avg_rating")
        .eq("id", req.biz_id)
        .eq("is_active", True)
        .single()
    )
    if not biz_res.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    biz = biz_res.data
    if biz["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    # 동시 중복 생성 방지 — intro-generate와 동일한 공유 락(같은 월별 한도를 씀)
    if user_id in _intro_faq_generation_locks:
        from utils.system_alert_log import record_alert
        asyncio.create_task(record_alert(
            "INTRO_GENERATION_IN_PROGRESS", "소개글·FAQ 생성 락 충돌(동시 요청)",
            level="info", source="lock_contention",
        ))
        raise HTTPException(
            status_code=409,
            detail={
                "code": "INTRO_GENERATION_IN_PROGRESS",
                "message": "이미 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _intro_faq_generation_locks.add(user_id)
    try:
        # 월별 사용 횟수 체크 — intro_draft + faq_draft 합산 (plan_gate faq_monthly 공유 한도)
        # DEV_MODE=true 시 한도 검사 전체 우회
        now = datetime.now(timezone.utc)
        if limit < 999 and not _DEV_MODE:
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
            used_res = await execute(
                supabase.table("guides")
                .select("id", count="exact")
                .eq("business_id", req.biz_id)
                .in_("context", ["intro_draft", "faq_draft", "talktalk_faq"])
                .gte("generated_at", month_start)
            )
            used = used_res.count or 0
            if used >= limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"이번 달 소개글·FAQ 합산 한도({limit}회)에 도달했습니다",
                )

        from services.guide_generator import generate_global_ai_intro
        category_label = _CATEGORY_LABELS.get(biz.get("category", "other"), biz.get("category", ""))
        keywords = biz.get("keywords") or []

        try:
            intro_text = await generate_global_ai_intro(
                biz_name=biz.get("name", ""),
                category_label=category_label,
                region=biz.get("region", ""),
                keywords=keywords,
                target_length=req.target_length,
                address=biz.get("address"),
                phone=biz.get("phone"),
                review_count=biz.get("review_count"),
                avg_rating=biz.get("avg_rating"),
            )
        except Exception as e:
            logger.warning(f"global-ai-intro-generate Claude call failed [biz={req.biz_id}]: {e}")
            raise HTTPException(status_code=502, detail="AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")

        # D.I.A. 사후 검증 (AI 호출 0)
        dia_score: dict | None = None
        try:
            from services.content_validator import validate_intro_dia
            dia_score = validate_intro_dia(intro_text, keywords=keywords)
        except Exception as dia_err:
            logger.warning(f"global-ai-intro D.I.A. validate failed: {dia_err}")

        # 사용 이력 기록
        try:
            await execute(
                supabase.table("guides").insert({
                    "business_id": req.biz_id,
                    "context": "intro_draft",
                    "items_json": {"intro_text": intro_text, "type": "global_ai"},
                    "generated_at": now.isoformat(),
                })
            )
        except Exception as save_err:
            logger.warning(f"global-ai-intro guides 저장 실패: {save_err}")

        # businesses.global_intro_draft 에 최신 초안 저장 (재방문 시 재로드용)
        try:
            await execute(
                supabase.table("businesses").update({
                    "global_intro_draft": intro_text,
                    "global_intro_generated_at": now.isoformat(),
                }).eq("id", req.biz_id)
            )
        except Exception as save_err:
            logger.warning(f"global-ai-intro businesses 저장 실패 (컬럼 없을 수 있음): {save_err}")

        return GlobalAiIntroResponse(
            intro=intro_text,
            char_count=len(intro_text),
            dia_score=dia_score,
        )
    finally:
        _intro_faq_generation_locks.discard(user_id)


@router.post("/talktalk-faq-generate", response_model=TalktalkFAQGenerateResponse)
async def generate_talktalk_faq(req: TalktalkFAQGenerateRequest, user=Depends(get_current_user)):
    """톡톡 채팅방 메뉴 콘텐츠 자동 생성.

    톡톡파트너센터 → 채팅방 메뉴관리에 등록할 메뉴 5개 + 자주 묻는 질문 자동 생성.
    플랜 게이트: free=불가, basic=월 5회(faq_monthly 공유), pro/biz/startup/enterprise는
    각 플랜 faq_monthly 한도 내(PLAN_LIMITS 참조 — enterprise 외엔 무제한 아님).
    """
    from middleware.plan_gate import get_user_plan, PLAN_LIMITS
    from datetime import datetime, timezone

    user_id = user["id"]
    supabase = get_client()

    # 플랜 한도 체크
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("faq_monthly", 0)
    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "톡톡 채팅방 메뉴 생성은 Basic 이상 플랜에서 사용 가능합니다", "upgrade_url": "/pricing"},
        )

    # 소유권 검증
    biz_res = await execute(
        supabase.table("businesses")
        .select("id, name, category, region, keywords, user_id")
        .eq("id", req.biz_id)
        .eq("is_active", True)
        .single()
    )
    if not biz_res.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    biz = biz_res.data
    if biz["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    # 동시 중복 생성 방지 — intro-generate·global-ai-intro-generate와 동일한 공유 락
    if user_id in _intro_faq_generation_locks:
        from utils.system_alert_log import record_alert
        asyncio.create_task(record_alert(
            "INTRO_GENERATION_IN_PROGRESS", "소개글·FAQ 생성 락 충돌(동시 요청)",
            level="info", source="lock_contention",
        ))
        raise HTTPException(
            status_code=409,
            detail={
                "code": "INTRO_GENERATION_IN_PROGRESS",
                "message": "이미 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _intro_faq_generation_locks.add(user_id)
    try:
        # 월별 사용 횟수 체크 (guides 테이블 context="talktalk_faq")
        now = datetime.now(timezone.utc)
        if limit < 999:
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
            used_res = await execute(
                supabase.table("guides")
                .select("id", count="exact")
                .eq("business_id", req.biz_id)
                .in_("context", ["intro_draft", "faq_draft", "talktalk_faq"])
                .gte("generated_at", month_start)
            )
            used = used_res.count or 0
            if used >= limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"이번 달 톡톡 채팅방 메뉴 생성 한도({limit}회)에 도달했습니다",
                )

        # Claude Sonnet 호출 — guide_generator.py 허용 경로로 위임
        from services.guide_generator import generate_talktalk_faq as _gen_talktalk
        count = max(5, min(20, req.count))
        category_label = _CATEGORY_LABELS.get(biz.get("category", "other"), biz.get("category", ""))
        keywords = biz.get("keywords") or []
        services_text = ", ".join(keywords[:6]) if keywords else "업종 기반 일반 서비스"

        _TALKTALK_FALLBACK = {
            "items": [
                {"question": f"{biz.get('name', '')} 가격이 어떻게 되나요?", "answer": "정확한 가격은 매장으로 문의해 주세요.", "category": "가격"},
                {"question": "예약은 어떻게 하나요?", "answer": "전화 또는 네이버 예약으로 미리 예약하시면 대기 없이 이용하실 수 있습니다.", "category": "예약"},
                {"question": "위치가 어디인가요?", "answer": f"{biz.get('region', '')}에 위치해 있습니다. 상세 주소는 네이버 지도를 확인해 주세요.", "category": "위치"},
                {"question": "주차가 가능한가요?", "answer": "주차 가능 여부는 매장으로 문의해 주세요.", "category": "위치"},
                {"question": "영업시간이 어떻게 되나요?", "answer": "영업시간은 매장으로 문의하거나 네이버 플레이스에서 확인해 주세요.", "category": "예약"},
            ],
            "chat_menus": ["가격 안내", "예약 방법", "위치/교통", "영업시간", "서비스 안내"],
        }

        is_fallback = False
        try:
            parsed = await _gen_talktalk(
                biz_name=biz.get("name", ""),
                category_label=category_label,
                region=biz.get("region", ""),
                services=services_text,
                count=count,
            )
        except Exception as e:
            logger.warning(f"talktalk-faq-generate Claude call failed [biz={req.biz_id}]: {e}. using fallback")
            parsed = _TALKTALK_FALLBACK
            is_fallback = True

        if not parsed or not isinstance(parsed.get("items"), list):
            logger.warning(f"talktalk-faq-generate invalid response, using fallback [biz={req.biz_id}]")
            parsed = _TALKTALK_FALLBACK
            is_fallback = True

        items = [
            TalktalkFAQItem(
                question=item.get("question", ""),
                answer=item.get("answer", ""),
                category=item.get("category", "서비스"),
            )
            for item in (parsed.get("items") or [])
            if item.get("question") and item.get("answer")
        ]
        chat_menus = (parsed.get("chat_menus") or [])[:5]

        # guides 테이블에 사용 이력 저장 (월 한도 소비) — AI가 실제로 생성한 경우에만.
        # 일반 템플릿 fallback은 사용자 요청에 응답하지 못한 것이므로 한도를 소비시키지 않는다.
        if not is_fallback:
            try:
                await execute(
                    supabase.table("guides").insert({
                        "business_id": req.biz_id,
                        "context": "talktalk_faq",
                        "items_json": {"items": [i.model_dump() for i in items], "chat_menus": chat_menus},
                        "generated_at": now.isoformat(),
                    })
                )
            except Exception as save_err:
                logger.warning(f"talktalk-faq-generate guides 저장 실패: {save_err}")

        # businesses.talktalk_faq_draft 에 최신 초안 저장 (재방문 시 재로드용)
        try:
            await execute(
                supabase.table("businesses").update({
                    "talktalk_faq_draft": {
                        "items": [i.model_dump() for i in items],
                        "chat_menus": chat_menus,
                        "is_fallback": is_fallback,
                    },
                    "talktalk_faq_generated_at": now.isoformat(),
                }).eq("id", req.biz_id)
            )
        except Exception as save_err:
            logger.warning(f"talktalk-faq-generate businesses 저장 실패 (컬럼 없을 수 있음): {save_err}")

        return TalktalkFAQGenerateResponse(items=items, chat_menus=chat_menus, is_fallback=is_fallback)
    finally:
        _intro_faq_generation_locks.discard(user_id)


async def _import_trial_scan(business_id: str, trial_scan_id: str):
    """무료 체험 스캔 결과를 사업장 스캔 결과로 이전.

    trial_scans 테이블의 total_score / track1_score 등을
    scan_results + score_history 에 복사하고,
    trial_scans.imported_business_id 를 업데이트한다.
    에러 발생 시 로그만 남기고 조용히 실패 (사업장 등록에 영향 없음).
    """
    try:
        from db.supabase_client import get_client, execute
        supabase = get_client()

        trial = (
            await execute(
                supabase.table("trial_scans")
                .select(
                    "id, business_name, category, region, "
                    "total_score, track1_score, track2_score, "
                    "unified_score, keyword_coverage, score_breakdown"
                )
                .eq("id", trial_scan_id)
                .is_("imported_business_id", "null")
                .maybe_single()
            )
        ).data
        if not trial:
            logger.info(f"Trial import skipped: id={trial_scan_id} (not found or already imported)")
            return

        from datetime import datetime
        now_str = datetime.utcnow().isoformat()

        _trial_unified = trial.get("unified_score")
        trial_unified_score = (
            float(_trial_unified) if _trial_unified is not None else float(trial.get("total_score") or 0)
        )

        scan_payload = {
            "business_id": business_id,
            "query_used": f"{trial.get('region', '')} {trial.get('category', '')} 추천".strip(),
            "total_score": trial.get("total_score") or 0,
            "unified_score": trial_unified_score,
            "track1_score": trial.get("track1_score"),
            "track2_score": trial.get("track2_score"),
            "keyword_coverage": trial.get("keyword_coverage"),
            "score_breakdown": trial.get("score_breakdown"),
            "scanned_at": now_str,
        }
        insert_res = await execute(supabase.table("scan_results").insert(scan_payload))
        if not (insert_res and insert_res.data):
            logger.warning(f"Trial import: scan_results insert failed for trial_id={trial_scan_id}")
            return

        # score_history 기록 (추세선 초기값)
        from datetime import date
        today_str = str(date.today())
        await execute(
            supabase.table("score_history").upsert(
                {
                    "business_id": business_id,
                    "score_date": today_str,
                    "total_score": trial.get("total_score") or 0,
                    "unified_score": trial_unified_score,
                    "track1_score": trial.get("track1_score"),
                    "track2_score": trial.get("track2_score"),
                    "weekly_change": 0.0,
                },
                on_conflict="business_id,score_date",
            )
        )

        # trial_scans에 imported_business_id 마킹
        await execute(
            supabase.table("trial_scans")
            .update({"imported_business_id": business_id})
            .eq("id", trial_scan_id)
        )
        logger.info(f"Trial import completed: trial_id={trial_scan_id} → business_id={business_id}")

    except Exception as e:
        logger.warning(f"Trial import failed (trial_id={trial_scan_id}, biz_id={business_id}): {e}")


# ════════════════════════════════════════════════════════════════
# 키워드 자동 추천 (Phase A-4 / service_unification_v1.0.md §4.2)
# ════════════════════════════════════════════════════════════════

class KeywordSuggestRequest(BaseModel):
    biz_id: str
    count: int = 10


class KeywordSuggestItem(BaseModel):
    keyword: str
    rationale: str = ""
    source: str = "ai"  # "ai" | "fallback"


class KeywordSuggestResponse(BaseModel):
    suggestions: list[KeywordSuggestItem]
    fallback_used: bool = False
    error: str | None = None


# 플랜별 키워드 자동 추천 월 한도 — plan_gate.py PLAN_LIMITS["keyword_suggest_monthly"]가
# 단일 소스(가격표 pricing/page.tsx에 노출되는 수치와 동일). 과거 여기 별도 하드코딩된
# _KEYWORD_SUGGEST_MONTHLY_LIMIT(basic=1/startup=4/pro=4/biz=10)이 PLAN_LIMITS(basic=5/
# startup=10/pro=20/biz=999)와 전혀 다른 값이었고, 그마저도 /keyword-suggest(등록된
# 사업장용 실사용 엔드포인트)에는 아예 연결이 안 돼 있어 사실상 전 플랜 무제한이었던
# 버그를 통합 수정(2026-08-06). free는 회원가입 유도용 "가입 시 1회 무료" 의도된 예외 유지.
_KEYWORD_SUGGEST_FREE_LIMIT = 1


async def _check_keyword_suggest_quota(user_id: str) -> tuple[bool, int, int]:
    """플랜별 월 한도 검증.
    반환: (allowed, used, limit)
    """
    from middleware.plan_gate import get_user_plan, PLAN_LIMITS

    supabase = get_client()
    plan = await get_user_plan(user_id, supabase)
    limit = (
        _KEYWORD_SUGGEST_FREE_LIMIT if plan == "free"
        else PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["keyword_suggest_monthly"]
    )

    # profiles.keyword_suggest_count_month + reset_at 사용 (graceful fallback)
    used = 0
    try:
        prof_res = await execute(
            supabase.table("profiles")
                .select("keyword_suggest_count_month, keyword_suggest_reset_at")
                .eq("user_id", user_id)
                .single()
        )
        if prof_res and prof_res.data:
            from datetime import datetime as _dt, timezone as _tz
            now_utc = _dt.now(_tz.utc)
            reset_at_str = prof_res.data.get("keyword_suggest_reset_at")
            stored_count = int(prof_res.data.get("keyword_suggest_count_month") or 0)
            if reset_at_str:
                reset_at = _dt.fromisoformat(reset_at_str.replace("Z", "+00:00"))
                # 30일 경과 시 카운터 리셋
                if (now_utc - reset_at).days >= 30:
                    used = 0
                else:
                    used = stored_count
            else:
                used = stored_count
    except Exception as e:
        logger.warning(f"keyword_suggest quota 조회 실패: {e}")

    return (used < limit, used, limit)


async def _increment_keyword_suggest_counter(user_id: str) -> None:
    """카운터 증분 (graceful — profiles 컬럼 미존재 시 무시)."""
    supabase = get_client()
    try:
        from datetime import datetime as _dt, timezone as _tz
        now_iso = _dt.now(_tz.utc).isoformat()
        prof_res = await execute(
            supabase.table("profiles")
                .select("keyword_suggest_count_month, keyword_suggest_reset_at")
                .eq("user_id", user_id)
                .single()
        )
        if not (prof_res and prof_res.data):
            return
        cur = int(prof_res.data.get("keyword_suggest_count_month") or 0)
        reset_at = prof_res.data.get("keyword_suggest_reset_at")
        # 30일 경과 시 리셋
        new_count = 1
        new_reset = now_iso
        if reset_at:
            from datetime import datetime as _dt2, timezone as _tz2
            reset_dt = _dt2.fromisoformat(reset_at.replace("Z", "+00:00"))
            if (_dt2.now(_tz2.utc) - reset_dt).days < 30:
                new_count = cur + 1
                new_reset = reset_at
        await execute(
            supabase.table("profiles").update({
                "keyword_suggest_count_month": new_count,
                "keyword_suggest_reset_at": new_reset,
            }).eq("user_id", user_id)
        )
    except Exception as e:
        logger.warning(f"keyword_suggest counter 증분 실패: {e}")


class KeywordSuggestPreviewRequest(BaseModel):
    """등록 폼용 — biz_id 없이 직접 사업장 정보 전달."""
    name: str
    category: str
    region: str = ""
    count: int = 10


@router.post("/keyword-suggest-preview", response_model=KeywordSuggestResponse)
async def keyword_suggest_preview(
    req: KeywordSuggestPreviewRequest,
    user=Depends(get_current_user),
):
    """등록 폼에서 사업장 등록 직전 키워드 추천 (biz_id 없음).
    Free 가입자 가입 시 1회 무료 (한도 강제는 Phase A-4 후속).
    """
    if not req.name.strip() or not req.category.strip():
        raise HTTPException(status_code=400, detail="name·category 필수")

    # 플랜별 월 한도 검증
    allowed, used, limit = await _check_keyword_suggest_quota(user["id"])
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"이번 달 자동 추천 한도 도달 ({used}/{limit}회). 다음 달 재설정 또는 상위 플랜으로 업그레이드하세요."
        )

    from services.keyword_suggester import generate_keyword_suggestions
    result = await generate_keyword_suggestions(
        name=req.name.strip(),
        category=req.category.strip(),
        region=(req.region or "").strip(),
        count=max(1, min(int(req.count or 10), 20)),
    )
    ctx = result.get("_context", {})
    # 폴백 아닌 경우만 카운터 증분 (실패 시 한도 안 깎이도록)
    if not ctx.get("fallback_used") and (result.get("suggestions") or []):
        await _increment_keyword_suggest_counter(user["id"])
    return KeywordSuggestResponse(
        suggestions=[KeywordSuggestItem(**s) for s in (result.get("suggestions") or [])],
        fallback_used=bool(ctx.get("fallback_used", False)),
        error=ctx.get("error"),
    )


@router.post("/keyword-suggest", response_model=KeywordSuggestResponse)
async def keyword_suggest(
    req: KeywordSuggestRequest,
    user=Depends(get_current_user),
):
    """사업장 정보(업종·지역·이름) 기반 키워드 자동 추천 10개 반환.

    플랜별 월 한도 — plan_gate.py PLAN_LIMITS["keyword_suggest_monthly"] 단일 소스
    (가격표 표시값과 동일). free는 가입 시 1회 무료.

    실패 시: keyword_taxonomy 베이스 키워드로 폴백 (가짜 추천 금지).
    """
    supabase = get_client()
    res = await execute(
        supabase.table("businesses")
            .select("id, user_id, name, category, region, keywords")
            .eq("id", req.biz_id)
            .single()
    )
    if not (res and res.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    biz = res.data
    if biz.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    # 플랜별 월 한도 검증 — 과거 이 체크 자체가 없어 전 플랜 무제한 호출 가능했던 버그(2026-08-06 수정)
    allowed, used, limit = await _check_keyword_suggest_quota(user["id"])
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"이번 달 자동 추천 한도 도달 ({used}/{limit}회). 다음 달 재설정 또는 상위 플랜으로 업그레이드하세요."
        )

    from services.keyword_suggester import generate_keyword_suggestions
    result = await generate_keyword_suggestions(
        name=biz.get("name") or "",
        category=biz.get("category") or "",
        region=biz.get("region") or "",
        count=max(1, min(int(req.count or 10), 20)),
        existing_keywords=biz.get("keywords") or [],
    )

    ctx = result.get("_context", {})
    # 폴백 아닌 경우만 카운터 증분 (실패 시 한도 안 깎이도록, keyword-suggest-preview와 동일 패턴)
    if not ctx.get("fallback_used") and (result.get("suggestions") or []):
        await _increment_keyword_suggest_counter(user["id"])
    return KeywordSuggestResponse(
        suggestions=[KeywordSuggestItem(**s) for s in (result.get("suggestions") or [])],
        fallback_used=bool(ctx.get("fallback_used", False)),
        error=ctx.get("error"),
    )
