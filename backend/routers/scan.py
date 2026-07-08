import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from models.schemas import ScanRequest, TrialScanRequest, TrialClaimRequest, TrialAttachRequest
from services.ai_scanner.multi_scanner import MultiAIScanner
from services.score_engine import calculate_score
from services.keyword_taxonomy import build_ai_scan_queries as _build_ai_scan_queries
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
from utils.scan_errors import make_scan_error, classify_exception
import utils.cache as _cache

_logger = logging.getLogger("aeolab")


async def _calc_rank_in_category(supabase, category: str, my_business_id: str, my_score: float) -> tuple[int, int]:
    """카테고리 내 순위 계산 — 각 사업장의 '최신' score_history 기준(당일 스캔 여부 무관).
    당일에 스캔한 업체끼리만 비교하면 자동 스캔(새벽 일괄) 미대상 업체가 전부 빠져
    표본이 부당하게 좁아지므로, 카테고리 내 전 사업장의 가장 최근 점수와 비교한다."""
    same_cat_biz_ids = [
        b["id"] for b in (
            await execute(
                supabase.table("businesses")
                .select("id")
                .eq("category", category)
                .eq("is_active", True)
            )
        ).data or []
    ]
    if not same_cat_biz_ids:
        return 1, 1
    scores_raw = (
        await execute(
            supabase.table("score_history")
            .select("business_id, total_score")
            .in_("business_id", same_cat_biz_ids)
            .order("score_date", desc=True)
            .limit(len(same_cat_biz_ids) * 3)
        )
    ).data or []
    latest: dict = {}
    for r in scores_raw:
        bid = r["business_id"]
        if bid not in latest:
            latest[bid] = float(r["total_score"])
    latest[my_business_id] = my_score  # 방금 저장한 내 최신 점수로 갱신 (읽기 지연 대비)
    total_in_category = len(latest)
    rank_in_category = sum(1 for v in latest.values() if v > my_score) + 1
    return rank_in_category, total_in_category

# 업종 value → 한국어 검색 키워드 매핑
_CATEGORY_KO: dict[str, str] = {
    "restaurant": "음식점", "cafe": "카페", "chicken": "치킨", "bbq": "고기집",
    "seafood": "횟집", "bakery": "베이커리", "bar": "술집", "snack": "분식",
    "delivery": "배달음식", "health_food": "건강식",
    "medical": "병원", "dental": "치과", "oriental": "한의원", "pharmacy": "약국",
    "eye": "안과", "mental": "심리상담", "rehab": "물리치료",
    "checkup": "건강검진", "fitness": "헬스장", "yoga": "요가 필라테스", "swimming": "수영장",
    "academy": "학원", "language": "영어학원", "coding": "코딩학원", "daycare": "어린이집",
    "tutoring": "과외", "music_edu": "음악학원", "art_studio": "미술학원",
    "art_edu": "미술공예학원", "sports_edu": "태권도학원", "driving": "운전학원",
    "legal": "법률사무소", "tax": "세무회계", "realestate": "부동산", "architecture": "건축설계",
    "insurance": "보험", "it": "IT개발", "design": "디자인", "marketing": "마케팅",
    "photo": "사진·영상", "photo_wedding": "웨딩 스튜디오", "video": "영상제작",
    "consulting": "컨설팅", "translation": "번역통역", "funeral": "장례",
    "beauty": "미용실", "nail": "네일샵", "makeup": "메이크업", "spa": "마사지 스파",
    "massage": "마사지", "skincare": "피부관리", "accounting": "세무사",
    "study": "스터디카페",
    "clothing": "의류", "shoes": "신발", "eyewear": "안경", "sportswear": "스포츠웨어",
    "shopping": "쇼핑몰", "grocery": "식자재", "electronics": "전자제품", "furniture": "가구",
    "stationery": "문구", "book": "서점", "instrument": "악기", "supplement": "건강식품",
    "baby": "유아용품", "interior": "인테리어", "auto": "자동차정비", "auto_trade": "중고차",
    "laundry": "세탁소", "pet": "반려동물", "vet": "동물병원", "cleaning": "청소대행",
    "moving": "이사", "repair": "가전수리", "locksmith": "열쇠", "flower": "꽃집",
    "funeral_supp": "장례용품", "music_live": "라이브공연", "music_cafe": "뮤직카페",
    "recording": "녹음실", "perform_plan": "공연기획", "instrument_lesson": "악기레슨",
    "karaoke_pro": "노래방", "wedding_hall": "웨딩홀 예식장", "wedding_plan": "웨딩플래너",
    "event_plan": "이벤트 행사기획", "party_room": "파티룸", "catering": "케이터링",
    "photo_event": "행사 사진촬영", "flower_event": "플라워 꽃장식", "mc_dj": "MC DJ",
    "accommodation": "숙박 펜션", "guesthouse": "게스트하우스", "camping": "캠핑 글램핑",
    "travel": "여행사", "sports": "스포츠 레저", "jjimjil": "찜질방", "entertainment": "노래방 PC방",
    "kids": "키즈카페", "study_cafe": "스터디카페", "workshop": "공방 클래스",
    "culture": "공연 전시", "agriculture": "농업", "manufacturing": "제조", "other": "",
}

# 업종별 AI 질의 접미어 — 속성 키워드 단독으로는 업종 맥락 없음 → 접미어로 보완
# "창원 단체 예약 가능 추천" → "창원 단체 예약 가능 맛집 추천"
_CATEGORY_QUERY_SUFFIX: dict[str, str] = {
    "restaurant": "맛집", "cafe": "카페", "bakery": "빵집",
    "bar": "술집", "beauty": "미용실", "nail": "네일샵",
    "medical": "병원", "pharmacy": "약국", "fitness": "헬스장",
    "yoga": "요가원", "pet": "반려동물", "education": "학원",
    "tutoring": "과외", "legal": "법무사", "realestate": "부동산",
    "interior": "인테리어", "auto": "자동차", "cleaning": "청소",
    "shopping": "쇼핑", "fashion": "의류", "photo": "스튜디오",
    "video": "영상제작", "design": "디자인", "accommodation": "숙박",
}

_PLATFORM_LABELS = {
    "gemini": "Gemini", "chatgpt": "ChatGPT",
    "naver": "Naver AI 브리핑", "google": "Google AI Overview",
}

router = APIRouter()

# ── 무료 체험 IP 레이트 리밋 설정 ─────────────────────────────────────────
# 개발 중 무제한: DEV_TRIAL_UNLIMITED=true 환경변수로 제어
_DEV_TRIAL_UNLIMITED = os.getenv("DEV_TRIAL_UNLIMITED", "false").lower() == "true"
_TRIAL_LIMIT_PER_DAY = int(os.getenv("TRIAL_DAY_LIMIT", "3"))
_TRIAL_WINDOW_SEC    = 86_400     # 24시간

# 관리자 우회: ADMIN_IPS 환경변수 (쉼표 구분) 또는 X-Admin-Key 헤더
_ADMIN_IPS: set[str] = {
    ip.strip()
    for ip in os.getenv("ADMIN_IPS", "127.0.0.1,::1").split(",")
    if ip.strip()
}


def _get_client_ip(request: Request) -> str:
    """실제 클라이언트 IP 추출 (Nginx X-Real-IP 우선 — 스푸핑 방지)"""
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _is_admin_request(request: Request) -> bool:
    """관리자 요청 여부 확인: IP 화이트리스트 또는 Admin 헤더 키 일치"""
    ip = _get_client_ip(request)
    if ip in _ADMIN_IPS:
        return True
    admin_key = request.headers.get("X-Admin-Key", "")
    secret = os.getenv("ADMIN_SECRET_KEY", "")
    if not secret:
        return False  # ADMIN_SECRET_KEY 미설정 시 빈 문자열 헤더로 우회 방지
    if admin_key and secrets.compare_digest(admin_key, secret):
        return True
    return False


async def _recover_naver_place_id(business_name: str, region: str) -> str:
    """네이버 Local Search API로 place_id 복구 + 이름 유사도 검증.

    trial-search와 동일 API 사용 — 모바일 HTML 스크래핑 대비 오인식 방지.
    이름 유사도 0.6 미만이고 부분 포함도 아니면 "" 반환 (잘못된 가게 차단).
    """
    import re as _re
    import difflib
    if not business_name:
        return ""

    client_id = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return ""

    # 행정구역 정밀 파싱 — naver_visibility._build_region_prefix 동일 로직
    _parts = (region or "").strip().split()
    if not _parts:
        region_prefix = ""
    else:
        _city = _re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도)$", "", _parts[0]).strip()
        if len(_parts) == 1:
            region_prefix = _city
        elif len(_parts) == 2:
            region_prefix = f"{_city} {_parts[1]}".strip()
        elif len(_parts) == 3:
            region_prefix = f"{_parts[1]} {_parts[2]}".strip()
        else:  # 4파트 이상 (도+시+구+동): "경상남도 창원시 성산구 상남동" → "성산구 상남동"
            region_prefix = f"{_parts[2]} {_parts[3]}".strip()

    query = f"{region_prefix} {business_name}".strip() if region_prefix else business_name.strip()
    if not query:
        return ""

    def _strip_html(t: str) -> str:
        t = _re.sub(r"<[^>]+>", "", t or "")
        return (
            t.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", '"').replace("&#39;", "'").strip()
        )

    try:
        import aiohttp as _aiohttp
        timeout = _aiohttp.ClientTimeout(total=5)
        api_headers = {
            "X-Naver-Client-Id": client_id,
            "X-Naver-Client-Secret": client_secret,
        }
        async with _aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                "https://openapi.naver.com/v1/search/local.json",
                params={"query": query, "display": 5, "sort": "comment"},
                headers=api_headers,
            ) as res:
                if res.status != 200:
                    _logger.debug(f"_recover_naver_place_id: API HTTP {res.status} for '{business_name}'")
                    return ""
                data = await res.json()
    except Exception as _e:
        _logger.debug(f"_recover_naver_place_id failed for '{business_name}': {_e}")
        return ""

    _name_clean = _re.sub(r"\s+", "", business_name).lower()

    for item in (data.get("items") or []):
        title = _strip_html(item.get("title", ""))
        if not title:
            continue
        link = item.get("link") or ""
        m = _re.search(r"place/(\d+)", link)
        if not m:
            continue
        place_id = m.group(1)
        title_clean = _re.sub(r"\s+", "", title).lower()

        # 이름 포함 검사 (체인점 접미사 처리 포함)
        if _name_clean in title_clean or title_clean in _name_clean:
            _logger.info(
                f"[trial] place_id recovered via Local API: "
                f"'{business_name}' → '{title}' place_id={place_id}"
            )
            return place_id

        # 유사도 검사
        ratio = difflib.SequenceMatcher(None, _name_clean, title_clean).ratio()
        if ratio >= 0.6:
            _logger.info(
                f"[trial] place_id recovered via Local API (ratio={ratio:.2f}): "
                f"'{business_name}' → '{title}' place_id={place_id}"
            )
            return place_id

    _logger.debug(f"_recover_naver_place_id: no name match for '{business_name}' in region '{region}'")
    return ""


def _check_trial_rate_limit(ip: str) -> None:
    """IP 기반 무료 체험 횟수 초과 시 429 반환"""
    if _DEV_TRIAL_UNLIMITED:
        return
    key = f"trial_ip:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _TRIAL_LIMIT_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "TRIAL_LIMIT",
                "message": f"하루 {_TRIAL_LIMIT_PER_DAY}회 무료 체험 한도에 도달했습니다. 내일 다시 시도하거나 회원가입 후 이용하세요.",
                "retry_after": _TRIAL_WINDOW_SEC,
            },
        )
    # 첫 요청이면 TTL=24h로 신규 생성, 이후엔 카운트만 증가 (TTL 유지)
    if count == 0:
        _cache.set(key, 1, _TRIAL_WINDOW_SEC)
    else:
        _cache.set(key, count + 1, _TRIAL_WINDOW_SEC)


# ── SSE stream 단기 OTP 토큰 저장소 (실운영은 Redis 권장) ──────────────────
_stream_tokens: dict[str, dict] = {}

# ── 진행 중 스캔 추적 (중복 실행 방지, 실운영은 Redis 권장) ────────────────
_active_scans: set[str] = set()


def cleanup_expired_stream_tokens() -> int:
    """만료된 SSE 토큰 정리. 삭제된 수 반환 (스케줄러에서 주기 호출)"""
    now = datetime.now(timezone.utc)
    expired = [t for t, d in list(_stream_tokens.items()) if d["expires_at"] < now]
    for t in expired:
        _stream_tokens.pop(t, None)
    if expired:
        _logger.debug(f"Cleaned up {len(expired)} expired stream tokens")
    return len(expired)


def _josa(word: str, josa_pair: tuple) -> str:
    """종성 여부에 따라 조사 선택. josa_pair = (받침있음, 받침없음)"""
    if not word:
        return josa_pair[0]
    last = word[-1]
    code = ord(last) - 0xAC00
    if 0 <= code < 11172:
        has_jongseong = (code % 28) != 0
        return josa_pair[0] if has_jongseong else josa_pair[1]
    return josa_pair[0]  # 한글 아닌 경우 받침 있음으로 기본 처리



@router.get("/trial-count")
async def get_trial_count(request: Request):
    """무료 체험 누적 건수 (공개, 캐시 5분) — 랜딩 페이지 소셜 프루프용.

    Rate limit: IP당 분당 30회 (5분 캐시이므로 일반 사용에는 충분, 남용 방지) — 2026-05-19 P1
    """
    if not _is_admin_request(request):
        ip = _get_client_ip(request)
        key = f"trial_count_ip:{ip}"
        count: int = _cache.get(key) or 0
        if count >= 30:
            raise HTTPException(
                status_code=429,
                detail={"code": "TRIAL_COUNT_RATE_LIMIT", "message": "잠시 후 다시 시도해 주세요.", "retry_after": 60},
            )
        _cache.set(key, count + 1, 60)
    cached = _cache.get("trial_count_public")
    if cached:
        return cached
    supabase = get_client()
    try:
        from datetime import date
        r = await execute(supabase.table("trial_scans").select("id", count="exact").limit(1))
        count = r.count if hasattr(r, "count") and r.count else 0
        today_start = date.today().isoformat() + "T00:00:00+00:00"
        today_r = await execute(
            supabase.table("trial_scans").select("id", count="exact")
            .gte("scanned_at", today_start).limit(1)
        )
        today_count = today_r.count if hasattr(today_r, "count") and today_r.count else 0
        result = {"count": count, "today": today_count}
        _cache.set("trial_count_public", result, ttl=300)
        return result
    except Exception as e:
        _logger.warning(f"trial_count fetch error: {e}")
        return {"count": 0, "today": 0}

# ── 트라이얼 가게 검색 (v3.3 — 신뢰도 강화 1라운드) ─────────────────────────
# IP당 분당 10회 제한 — 입력 자동완성 용도로 다회 호출되므로 일별 한도가 아닌 분당 한도 사용
_TRIAL_SEARCH_LIMIT_PER_MIN = 10
_TRIAL_SEARCH_WINDOW_SEC    = 60


def _check_trial_search_rate_limit(ip: str) -> None:
    """무료 체험 가게 검색: IP당 분당 10회 제한"""
    key = f"trial_search_ip:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _TRIAL_SEARCH_LIMIT_PER_MIN:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "SEARCH_RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요 (분당 10회 제한).",
                "retry_after": _TRIAL_SEARCH_WINDOW_SEC,
            },
        )
    if count == 0:
        _cache.set(key, 1, _TRIAL_SEARCH_WINDOW_SEC)
    else:
        _cache.set(key, count + 1, _TRIAL_SEARCH_WINDOW_SEC)


@router.get("/trial-search")
async def trial_search(request: Request, query: str, region: str = ""):
    """비로그인 무료 체험: 네이버 지역검색으로 실제 가게 후보 최대 5개 반환.

    트라이얼 신뢰도 강화: 사용자가 텍스트로 입력한 가게명을 실제 네이버 등록 데이터와
    매칭해 "내 가게가 진단됐다"는 증거를 제공한다.
    """
    import re as _re

    if not _is_admin_request(request):
        ip = _get_client_ip(request)
        _check_trial_search_rate_limit(ip)

    q = (query or "").strip()
    if not q:
        return {"items": [], "fallback_to_manual": True}

    client_id = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        _logger.warning("trial_search: NAVER_CLIENT_ID/SECRET not configured")
        return {"items": [], "fallback_to_manual": True}

    # 행정구역 정밀 파싱 — naver_visibility._build_region_prefix 동일 로직
    _r_parts = (region or "").strip().split()
    if not _r_parts:
        region_prefix = ""
    else:
        _r_city = _re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도)$", "", _r_parts[0]).strip()
        if len(_r_parts) == 1:
            region_prefix = _r_city
        elif len(_r_parts) == 2:
            region_prefix = f"{_r_city} {_r_parts[1]}".strip()
        elif len(_r_parts) == 3:
            region_prefix = f"{_r_parts[1]} {_r_parts[2]}".strip()
        else:  # 4파트 이상 (도+시+구+동): "경상남도 창원시 성산구 상남동" → "성산구 상남동"
            region_prefix = f"{_r_parts[2]} {_r_parts[3]}".strip()
    search_q = f"{region_prefix} {q}".strip() if region_prefix else q

    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }

    try:
        import aiohttp as _aiohttp
        timeout = _aiohttp.ClientTimeout(total=6)
        async with _aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                "https://openapi.naver.com/v1/search/local.json",
                params={"query": search_q, "display": 5, "sort": "comment"},
                headers=headers,
            ) as res:
                if res.status != 200:
                    _logger.warning(f"trial_search naver API HTTP {res.status}")
                    return {"items": [], "fallback_to_manual": True}
                data = await res.json()
    except Exception as e:
        _logger.warning(f"trial_search naver API error: {e}")
        return {"items": [], "fallback_to_manual": True}

    def _strip_html(t: str) -> str:
        t = _re.sub(r"<[^>]+>", "", t or "")
        return (
            t.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", '"').replace("&#39;", "'").strip()
        )

    import urllib.parse as _urlparse

    _TEST_PATTERNS = _re.compile(r"테스트|_test_|_테스트_|test\d+", _re.IGNORECASE)

    items_out: list[dict] = []
    for item in (data.get("items") or [])[:5]:
        link = item.get("link") or ""
        m = _re.search(r"place/(\d+)", link)
        place_id = m.group(1) if m else ""
        title = _strip_html(item.get("title", ""))
        if not title:
            continue
        if _TEST_PATTERNS.search(title):
            continue
        # mapx/mapy: WGS84 × 1e7 (네이버 표준)
        try:
            mapx = int(item["mapx"]) / 1e7 if item.get("mapx") else None
            mapy = int(item["mapy"]) / 1e7 if item.get("mapy") else None
        except (ValueError, TypeError):
            mapx, mapy = None, None
        # naver_place_url 우선순위:
        #   1) 응답 link가 m.place.naver.com / map.naver.com place 경로면 그대로
        #   2) place_id 추출 가능하면 entry URL
        #   3) 그 외(체인점 홈페이지 등) → 지역+상호명 검색 URL (사용자가 가게를 식별할 수 있게)
        if "place" in link and ("naver.com" in link):
            naver_place_url = link
        elif place_id:
            naver_place_url = f"https://map.naver.com/p/entry/place/{place_id}"
        else:
            search_q = f"{region_prefix} {title}".strip() if region_prefix else title
            naver_place_url = "https://map.naver.com/v5/search/" + _urlparse.quote(search_q)
        items_out.append({
            "title":            title,
            "address":          item.get("roadAddress") or item.get("address", ""),
            "phone":            item.get("telephone") or None,
            "category":         item.get("category", ""),
            "naver_place_id":   place_id,
            "naver_place_url":  naver_place_url,
            "mapx":             mapx,
            "mapy":             mapy,
        })

    return {
        "items": items_out,
        "fallback_to_manual": len(items_out) == 0,
    }


async def _run_trial_gemini(query: str, business_name: str) -> Optional[dict]:
    """trial 신뢰도 강화 2라운드 — Gemini 10회 샘플링 + AI 응답 원문 evidence 보존.

    실패 시 None 반환 (trial 본 응답에는 영향 없음).
    """
    try:
        from services.ai_scanner.gemini_scanner import GeminiScanner
        scanner = GeminiScanner()
        return await scanner.sample_10_with_evidence(query, business_name)
    except Exception as e:
        _logger.warning(f"_run_trial_gemini failed: {e}")
        return None


def _build_trial_ai_evidence(gemini_data: Optional[dict], query_text: str) -> Optional[dict]:
    """Gemini 10회 evidence를 trial 응답용 ai_evidence 객체로 빌드.

    선정 규칙:
        - 미언급 쿼리 우선 최대 3개 + 언급 쿼리 최대 2개 = 총 최대 5개
        - 미언급이 부족하면 언급으로, 언급이 부족하면 미언급으로 채움
        - 동일 query 텍스트는 1개만 (중복 제거)
    """
    if not gemini_data:
        return None
    items = gemini_data.get("evidence_items") or []
    if not isinstance(items, list) or not items:
        return None

    # 동일 query 텍스트 중복 제거 (첫 번째 발생만 유지)
    seen_queries: set[str] = set()
    deduped: list[dict] = []
    for it in items:
        q = (it.get("query") or "").strip()
        if not q or q in seen_queries:
            continue
        seen_queries.add(q)
        deduped.append(it)

    not_mentioned = [it for it in deduped if not it.get("mentioned")]
    mentioned = [it for it in deduped if it.get("mentioned")]

    # 우선: 미언급 3개 + 언급 2개
    pick_not = not_mentioned[:3]
    pick_yes = mentioned[:2]

    # 부족분 보충
    remaining_slots = 5 - len(pick_not) - len(pick_yes)
    if remaining_slots > 0:
        # 미언급 더 채우기
        extra_not = not_mentioned[3:3 + remaining_slots]
        pick_not.extend(extra_not)
        remaining_slots = 5 - len(pick_not) - len(pick_yes)
    if remaining_slots > 0:
        extra_yes = mentioned[2:2 + remaining_slots]
        pick_yes.extend(extra_yes)

    selected = (pick_not + pick_yes)[:5]
    queries_out = [
        {
            "query": (it.get("query") or query_text or "").strip(),
            "mentioned": bool(it.get("mentioned")),
            "excerpt": (it.get("excerpt") or "").strip(),
        }
        for it in selected
    ]
    mentioned_total = sum(1 for it in deduped if it.get("mentioned"))
    return {
        "platform": "Gemini 2.0 Flash",
        "total_queries": len(items),
        "mentioned_count": mentioned_total,
        "queries": queries_out,
    }


@router.post("/trial")
async def trial_scan(req: TrialScanRequest, request: Request, bg: BackgroundTasks):
    """랜딩 무료 체험: ChatGPT + (location: 네이버+카카오 / non_location: 웹사이트) 병렬 스캔
    도메인 모델 v2.1 § 10.1 — ScanContext별 분기
    """
    import asyncio, hashlib
    _endpoint = "trial"

    _is_authenticated = bool(request.headers.get("Authorization", "").startswith("Bearer "))
    if not _is_admin_request(request) and not _DEV_TRIAL_UNLIMITED:
        if _is_authenticated:
            # 로그인 사용자: user_id 기반 일별 5회 한도 (API 비용 보호)
            auth_header = request.headers.get("Authorization", "")
            _auth_key = f"trial_user:{hashlib.sha256(auth_header.encode()).hexdigest()[:16]}"
            _auth_count: int = _cache.get(_auth_key) or 0
            if _auth_count >= 5:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "TRIAL_LIMIT",
                        "message": "오늘 무료 체험 한도(5회)에 도달했습니다. 내일 다시 시도하세요.",
                        "retry_after": _TRIAL_WINDOW_SEC,
                    },
                )
            _cache.set(_auth_key, _auth_count + 1, _TRIAL_WINDOW_SEC)
        else:
            # 비로그인: IP 기반 3회 한도
            ip = _get_client_ip(request)
            _check_trial_rate_limit(ip)

    scanner = MultiAIScanner(mode="trial")
    # 키워드 우선순위: keywords 리스트[0] > keyword 단일(추가 입력) > 카테고리 한글명
    # keywords = 사용자가 선택한 개별 태그, keyword = 추가 직접 입력
    _trial_kw_list = [k.strip() for k in (req.keywords or []) if k.strip() and len(k.strip()) >= 2]
    if _trial_kw_list:
        keyword_ko = _trial_kw_list[0]
    elif req.keyword and req.keyword.strip():
        keyword_ko = req.keyword.strip().split()[0]  # 복합 문자열 방지: 첫 토큰만
    else:
        keyword_ko = _CATEGORY_KO.get(req.category, req.category)
    # keyword_ko가 req.region의 일부 접미사로 시작하면 제거 (이중 지역 방지)
    # 예: region="경상남도 창원시 성산구 상남동", keyword_ko="창원시 성산구 상남동 베이커리카페"
    # → keyword_ko="베이커리카페"
    if req.region and keyword_ko:
        _region_parts = req.region.strip().split()
        for _rlen in range(len(_region_parts), 0, -1):
            _prefix = " ".join(_region_parts[-_rlen:])
            if keyword_ko.startswith(_prefix + " "):
                keyword_ko = keyword_ko[len(_prefix) + 1:].strip()
                break
            elif keyword_ko == _prefix:
                keyword_ko = _CATEGORY_KO.get(req.category, req.category)
                break

    is_non_location = (req.business_type == "non_location") or not req.region

    # 속성 키워드(공백 포함)일 때 업종 접미어 추가로 AI 질의 현실화
    # 예: "창원 단체 예약 가능 추천" → "창원 단체 예약 가능 맛집 추천"
    _cat_ko_base = _CATEGORY_KO.get(req.category, "")
    _cat_suffix = _CATEGORY_QUERY_SUFFIX.get(req.category or "", "")
    _is_attribute_kw = bool(_trial_kw_list) and " " in keyword_ko and keyword_ko != _cat_ko_base
    _suffix = f" {_cat_suffix}" if (_cat_suffix and _is_attribute_kw and _cat_suffix not in keyword_ko) else ""

    if is_non_location:
        query = f"{keyword_ko}{_suffix} 추천"
    else:
        query = f"{req.region} {keyword_ko}{_suffix} 추천"

    # ── context별 병렬 실행 ──────────────────────────────────────────
    if is_non_location:
        # non_location: ChatGPT 5회 + Gemini(10회 evidence) + 웹사이트 체크 (naver/kakao 생략)
        coros = [
            scanner.scan_trial(query, req.business_name),
            _run_trial_gemini(query, req.business_name),
        ]
        if req.website_url:
            from services.website_checker import check_website_seo
            import ipaddress, urllib.parse as _urlparse
            def _is_safe_url(raw: str) -> bool:
                try:
                    p = _urlparse.urlparse(raw)
                    if p.scheme not in ("http", "https"):
                        return False
                    host = p.hostname or ""
                    try:
                        addr = ipaddress.ip_address(host)
                        return addr.is_global
                    except ValueError:
                        return True  # 도메인명 — 허용
                except Exception:  # noqa: intentional-fallback — URL 파싱 오류 시 안전하게 차단
                    return False
            if _is_safe_url(req.website_url):
                coros.append(check_website_seo(req.website_url))
            else:
                coros.append(asyncio.sleep(0))
        else:
            coros.append(asyncio.sleep(0))  # placeholder

        results = await asyncio.gather(*coros, return_exceptions=True)
        _ai_exc = results[0] if isinstance(results[0], Exception) else None
        ai_result = results[0] if not isinstance(results[0], Exception) else {}
        gemini_evidence_data = results[1] if not isinstance(results[1], Exception) else None
        website_data = results[2] if (req.website_url and not isinstance(results[2], Exception)) else None
        naver_data = None
        kakao_data = None

        # AI 완전 실패(ChatGPT + Gemini 모두 예외) 시 503 반환
        if _ai_exc and not ai_result and gemini_evidence_data is None:
            raise make_scan_error(
                classify_exception(_ai_exc),
                endpoint=_endpoint,
                biz_id=None,
                original_exc=_ai_exc,
            )
    else:
        # location_based: Gemini + 네이버(멀티쿼리) + 카카오
        from services.naver_visibility import get_naver_visibility_multi as _naver_multi
        from services.kakao_visibility import get_kakao_visibility

        # trial: 등록 키워드 최대 3개 + 카테고리 fallback → 최대 4개 병렬
        # normalize_category로 alias 정규화 후 한국어 변환 (e.g. "professional" → "photo" → "사진·영상")
        from services.keyword_taxonomy import normalize_category as _norm_cat
        _cat_canonical = _norm_cat(req.category)
        _cat_ko_fallback = _CATEGORY_KO.get(_cat_canonical, _CATEGORY_KO.get(req.category, req.category))
        _trial_multi_kws = list(dict.fromkeys(
            _trial_kw_list[:3] + [_cat_ko_fallback]
        ))[:4]
        # 경쟁사 검색 키워드: 단어형(공백 없음) 키워드 우선 사용
        # 우선순위: 1) 단어형 사용자 키워드 → 2) 가게명에서 음식 종류 추출 → 3) 업종 카테고리 fallback
        # 예) "대호흑돼지" + "단체 예약 가능" → "흑돼지" (가게명 힌트) → "창원 흑돼지" 검색
        _BIZ_NAME_FOOD_HINTS = [
            "흑돼지", "삼겹살", "항정살", "갈매기살", "목살", "갈비", "곱창", "막창", "대창",
            "순대", "국밥", "설렁탕", "곰탕", "냉면", "막국수", "칼국수", "수제비",
            "치킨", "피자", "파스타", "라멘", "초밥", "스시", "횟집", "회",
            "족발", "보쌈", "감자탕", "해물", "낙지", "꼼장어", "장어", "오리",
            "닭갈비", "불고기", "육회", "쭈꾸미", "오징어", "두부", "순두부",
        ]
        _name_hint = next(
            (p for p in _BIZ_NAME_FOOD_HINTS if req.business_name and p in req.business_name),
            "",
        )
        _comp_category_ko = next(
            (kw for kw in _trial_kw_list if " " not in kw and len(kw) >= 2),
            _name_hint or _cat_ko_fallback,
        )
        _gather_results = await asyncio.gather(
            scanner.scan_trial(query, req.business_name),
            _run_trial_gemini(query, req.business_name),
            _naver_multi(req.business_name, _trial_multi_kws, req.region or "", category_ko=_comp_category_ko),
            get_kakao_visibility(req.business_name, keyword_ko, req.region or ""),
            return_exceptions=True,
        )
        ai_result, gemini_evidence_data, naver_data, kakao_data = _gather_results
        _ai_exc_loc = ai_result if isinstance(ai_result, Exception) else None
        if isinstance(ai_result, Exception):
            _logger.warning("[scan/trial] location_based AI scan exception: %s", ai_result)
            ai_result = {}
        if isinstance(gemini_evidence_data, Exception):
            gemini_evidence_data = None
        if isinstance(naver_data, Exception):
            _logger.warning("[scan/trial] naver_visibility exception: %s", naver_data)
            naver_data = None
        if isinstance(kakao_data, Exception):
            _logger.warning("[scan/trial] kakao_visibility exception: %s", kakao_data)
            kakao_data = None

        # AI 완전 실패(ChatGPT + Gemini 모두 예외) 시 503 반환
        if _ai_exc_loc and not ai_result and gemini_evidence_data is None:
            raise make_scan_error(
                classify_exception(_ai_exc_loc),
                endpoint=_endpoint,
                original_exc=_ai_exc_loc,
            )

        website_data = None

        # 사용자 직접 체크 → Naver API 결과보다 우선 적용
        if req.is_smart_place is True and isinstance(naver_data, dict):
            naver_data = {**naver_data, "is_smart_place": True}
            _logger.debug(f"[trial] is_smart_place overridden by user input for '{req.business_name}'")

    # ── v3.3: naver_place_id가 있으면 스마트플레이스 자동 진단 ──────────────
    # 자동 진단 결과는 사용자 자가체크(req.has_faq/has_recent_post/has_intro/is_smart_place)를
    # **덮어쓴다** — 신뢰도 강화 1라운드의 핵심.
    smart_place_check_data: Optional[dict] = None
    # Local Search API가 place_id를 못 가져온 경우(체인점·신규 등록 가게 등) 모바일 검색 HTML로 2차 복구
    _place_id_recovered = False
    if not req.naver_place_id and req.business_name:
        _recovered = await _recover_naver_place_id(req.business_name, req.region or "")
        if _recovered:
            req.naver_place_id = _recovered
            _place_id_recovered = True
            _logger.info(
                f"[trial] naver_place_id recovered via m.search fallback: "
                f"name='{req.business_name}' place_id={_recovered}"
            )
    if req.naver_place_id:
        try:
            from services.smart_place_auto_check import auto_check_smart_place
            smart_place_check_data = await auto_check_smart_place(req.naver_place_id)
            if smart_place_check_data and not smart_place_check_data.get("error"):
                # 스코어 엔진에 전달할 biz_ctx에 자동 진단 결과 반영
                req.is_smart_place = bool(smart_place_check_data.get("is_smart_place"))
                req.has_faq        = bool(smart_place_check_data.get("has_faq"))
                _v_hr = smart_place_check_data.get("has_recent_post")
                req.has_recent_post = bool(_v_hr) if _v_hr is not None else req.has_recent_post
                _v_hi = smart_place_check_data.get("has_intro")
                req.has_intro = bool(_v_hi) if _v_hi is not None else req.has_intro
                # naver_data의 is_smart_place도 자동 진단 값으로 동기화
                if isinstance(naver_data, dict):
                    naver_data = {**naver_data, "is_smart_place": req.is_smart_place}
                _logger.info(
                    f"[trial] smart_place_auto_check: place_id={req.naver_place_id} "
                    f"is_smart_place={req.is_smart_place} has_faq={req.has_faq} "
                    f"has_recent_post={req.has_recent_post} has_intro={req.has_intro} "
                    f"has_reservation={smart_place_check_data.get('has_reservation')} "
                    f"photo_count={smart_place_check_data.get('photo_count', 0)}"
                )
            else:
                _logger.warning(
                    f"[trial] smart_place_auto_check failed: place_id={req.naver_place_id} "
                    f"error={smart_place_check_data.get('error') if smart_place_check_data else 'unknown'}"
                )
        except Exception as e:
            _logger.warning(f"[trial] smart_place_auto_check exception: {e}")
            smart_place_check_data = None

    # 카카오 결과 병합 (채널 점수 계산용)
    combined_result = {**ai_result}
    # trial Gemini 10회 evidence → 점수 계산 및 breakdown.exposure_freq에 반영
    # gemini_evidence_data는 exposure_freq/sample_size 필드를 포함하므로 calc_multi_ai_exposure 호환
    if gemini_evidence_data and isinstance(gemini_evidence_data, dict):
        combined_result["gemini"] = gemini_evidence_data
    if kakao_data:
        combined_result["kakao"] = kakao_data
    if website_data:
        combined_result["website_check"] = website_data

    biz_ctx = {
        "category": req.category or "",   # dual_track_ratio 업종 비율 계산에 필요
        "business_type": req.business_type or "location_based",
        "website_url": req.website_url,
        "has_faq": req.has_faq,
        "has_recent_post": req.has_recent_post,
        "has_intro": req.has_intro,
        "review_text": req.review_text or "",
        "description": getattr(req, "description", None) or "",
    }
    score = calculate_score(
        combined_result,
        biz=biz_ctx,
        naver_data=naver_data or {},
        context=req.business_type or "location_based",
    )

    # 이메일 수집 (대기자 명단)
    if req.email:
        try:
            supabase = get_client()
            await execute(
                supabase.table("waitlist").upsert(
                    {"email": req.email, "business_name": req.business_name, "category": req.category}
                )
            )
        except Exception as e:
            # 이메일 마스킹: 개인정보 로그 노출 방지
            _email = req.email or ""
            _parts = _email.split("@")
            _masked = (_email[:3] + "***@" + _parts[1]) if len(_parts) == 2 and len(_parts[0]) > 3 else "***"
            _logger.warning(f"Waitlist upsert failed for {_masked}: {e}")

    # ── v3.3-fix: place_match 객체 빌드 (임의 매칭 금지) ─────────────────
    # 원칙: 사용자가 명시적으로 검색 후보를 선택한 경우(req.place_match)에만 채운다.
    # naver_competitors에서 my_rank 기반 자동 매칭은 금지 (전혀 다른 가게 표시 위험).
    # req.place_match가 없으면 응답 place_match도 None → 프론트에서 카드 자체 미렌더링.
    place_match_data: Optional[dict] = None
    # 복구된 place_id가 있고 사용자가 후보 미선택 상태라면 최소 정보로 place_match 구성
    if _place_id_recovered and req.naver_place_id and not (isinstance(req.place_match, dict) and req.place_match):
        place_match_data = {
            "name":             req.business_name,
            "address":          "",
            "phone":            None,
            "rating":           None,
            "review_count":     None,
            "category":         req.category or "",
            "business_status":  None,
            "naver_place_id":   req.naver_place_id,
            "naver_place_url":  f"https://map.naver.com/p/entry/place/{req.naver_place_id}",
            "recovered":        True,
        }
    if isinstance(req.place_match, dict) and req.place_match:
        _pm = req.place_match
        _pid = (_pm.get("naver_place_id") or req.naver_place_id or "").strip()
        _link = _pm.get("naver_place_url") or (
            f"https://map.naver.com/p/entry/place/{_pid}" if _pid else ""
        )
        place_match_data = {
            "name":             _pm.get("title") or _pm.get("name") or "",
            "address":          _pm.get("address") or "",
            "phone":            _pm.get("phone") or _pm.get("telephone") or None,
            "rating":           None,
            "review_count":     None,
            "category":         _pm.get("category") or "",
            "business_status":  None,
            "naver_place_id":   _pid,
            "naver_place_url":  _link,
        }
        _logger.info(
            f"[trial] place_match from user selection: name='{place_match_data['name']}' "
            f"place_id={_pid or '(none)'}"
        )

    # ── v3.4: Gemini 10회 evidence → ai_evidence 응답 객체 빌드 ─────────
    ai_evidence_data = _build_trial_ai_evidence(gemini_evidence_data, query)

    # ── v3.6: trial_id 사전 생성 (응답 + claim 깔때기 매칭용)
    trial_id = str(uuid.uuid4())

    # trial_scans DB 저장 (백그라운드)
    async def _save():
        try:
            ip = _get_client_ip(request)
            ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]
            naver = naver_data or {}
            kakao = kakao_data or {}
            ai_mentioned = bool(ai_result.get("chatgpt", {}).get("mentioned"))
            supabase = get_client()
            await execute(supabase.table("trial_scans").insert({
                "id": trial_id,
                "business_name": req.business_name,
                "category": req.category,
                "region": req.region,
                "keyword": keyword_ko,
                "email": req.email,
                "is_smart_place": naver.get("is_smart_place"),
                "naver_rank": naver.get("my_rank"),
                "blog_mentions": naver.get("blog_mentions"),
                "search_query": naver.get("search_query") or query,
                "naver_competitors": naver.get("naver_competitors"),
                "top_competitor_name": naver.get("top_competitor_name"),
                "top_competitor_blog_count": naver.get("top_competitor_blog_count"),
                "kakao_rank": kakao.get("my_rank"),
                "is_on_kakao": kakao.get("is_on_kakao"),
                "kakao_competitors": kakao.get("kakao_competitors"),
                "ai_mentioned": ai_mentioned,
                "total_score": score.get("total_score"),
                "grade": score.get("grade"),
                "score_breakdown": score.get("breakdown"),
                "ip_hash": ip_hash,
                # v3.0 듀얼트랙 필드
                "track1_score": score.get("track1_score"),
                "track2_score": score.get("track2_score"),
                "unified_score": score.get("unified_score"),
                "naver_weight": score.get("naver_weight"),
                "global_weight": score.get("global_weight"),
                "growth_stage": score.get("growth_stage"),
                # top_missing_keywords는 score dict에 없고 별도 로컬 변수 — 클로저로 접근
                "top_missing_keywords": (top_missing_keywords if isinstance(top_missing_keywords, list) else []),
                "keyword_coverage": score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100,
                "naver_result": naver if isinstance(naver, dict) and naver else None,
                "kakao_result": kakao if isinstance(kakao, dict) and kakao else None,
                "website_check_result": website_data if isinstance(website_data, dict) else None,
                "smart_place_completeness": score.get("breakdown", {}).get("smart_place_completeness"),
                # smart_place_auto_check 실측값 우선 (req는 자동진단 결과로 이미 업데이트됨)
                "has_faq": getattr(req, "has_faq", None),
                "has_recent_post": getattr(req, "has_recent_post", None),
                "has_intro": getattr(req, "has_intro", None),
                # v3.3 — 트라이얼 신뢰도 강화 (place 매칭 + 자동 진단)
                "place_data": place_match_data,
                "smart_place_check": smart_place_check_data,
                # v3.4 — 트라이얼 신뢰도 강화 2라운드 (Gemini 10회 evidence)
                "ai_evidence": ai_evidence_data,
            }))
            # 스캔 완료 즉시 1회 이메일 발송
            if req.email:
                try:
                    from services.email_sender import send_trial_followup as _send_result_email
                    await _send_result_email(
                        email=req.email,
                        business_name=req.business_name or "",
                        category=req.category or "",
                        region=req.region or "",
                        score=float(score.get("total_score") or 0),
                        day=1,
                        naver_rank=naver.get("my_rank"),
                        blog_mentions=naver.get("blog_mentions"),
                        top_competitor_name=naver.get("top_competitor_name"),
                        ai_mentioned=ai_mentioned,
                        top_missing_keywords=top_missing_keywords if isinstance(top_missing_keywords, list) else [],
                        has_recent_post=getattr(req, "has_recent_post", None),
                        has_intro=getattr(req, "has_intro", None),
                        track1_score=score.get("track1_score"),
                        track2_score=score.get("track2_score"),
                        growth_stage=score.get("growth_stage"),
                        smart_place_completeness=score.get("breakdown", {}).get("smart_place_completeness"),
                    )
                except Exception as _e:
                    _logger.warning(f"trial 즉시 이메일 발송 실패: {_e}")
        except Exception as e:
            _logger.warning(f"trial_scans save failed: {e}")

        # scan_analytics 저장 (익명화 통계)
        try:
            platform_mentioned = {
                "ChatGPT": bool((ai_result.get("chatgpt") or {}).get("mentioned"))
            }
            await execute(supabase.table("scan_analytics").insert({
                "scan_type": "trial",
                "category": req.category,
                "region": req.region,
                "track1_score": score.get("track1_score"),
                "track2_score": score.get("track2_score"),
                "unified_score": score.get("unified_score"),
                "naver_weight": score.get("naver_weight"),
                "global_weight": score.get("global_weight"),
                "growth_stage": score.get("growth_stage"),
                "top_missing_keywords": score.get("top_missing_keywords") or [],
                "keyword_coverage": score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100,
                "platform_mentioned": platform_mentioned,
                "smart_place_score": score.get("breakdown", {}).get("smart_place_completeness"),
            }))
        except Exception as e:
            _logger.warning(f"scan_analytics insert failed (trial): {e}")
    bg.add_task(_save)

    competitors = ai_result.get("chatgpt", {}).get("competitors", [])

    # ── v3.0 필드: 키워드 갭 + 성장 단계를 최상위 응답에 노출 ──────────────
    # 성장 단계 전체 객체 빌드 (trial 체크박스 반영)
    try:
        from services.gap_analyzer import _build_growth_stage as _bgs
        _biz_data_stage = {
            "is_smart_place": True,
            "review_count": 1 if (req.review_text and req.review_text.strip()) else 0,
            "has_faq": req.has_faq,
            "has_intro": req.has_intro,
            "has_recent_post": req.has_recent_post,
        }
        _gs_obj = _bgs(
            total_score=score.get("unified_score") or score.get("total_score") or 0,
            track1_score=score.get("track1_score"),
            biz_data=_biz_data_stage,
        )
        _growth_stage_full = _gs_obj.model_dump()
    except Exception as _gse:
        _logger.warning(f"trial growth_stage build failed: {_gse}")
        _growth_stage_full = None

    _intro_analyzed: bool = False  # 소개글 분석 여부 — try 블록 전 초기화 (except/응답 참조용)
    try:
        from services.keyword_taxonomy import get_all_keywords_flat, analyze_keyword_coverage, _CATEGORY_ALIASES
        import re as _re

        # 카테고리 정확도 보정: 사용자 선택 서비스 태그에서 더 정확한 업종 유추
        _tag_hints = [t.lower().replace(" ", "") for t in (_trial_kw_list or []) + [keyword_ko]]
        _inferred_cat = _CATEGORY_ALIASES.get((req.category or "").lower(), None)
        if not _inferred_cat or _inferred_cat == "restaurant":
            # 서비스 태그로 재추론 — "웨딩스냅"→photo, "영상"→video 등
            for _hint in _tag_hints:
                _alt = _CATEGORY_ALIASES.get(_hint)
                if _alt and _alt != "restaurant":
                    _inferred_cat = _alt
                    break
        _effective_cat = _inferred_cat or "restaurant"

        all_kws = get_all_keywords_flat(_effective_cat)

        # 소개글 텍스트 수집 — 4계층 폴백
        # 1순위: 스마트플레이스 크롤링 결과 (smart_place_check_data)
        # 2순위: req.description (trial 폼 사업 설명)
        # 3순위: req.review_text (사용자 수동 입력 리뷰)
        # 4순위: 없음 (evidence only)
        _intro_text_raw: str = ""
        _intro_analyzed: bool = False  # 소개글 실제 분석 여부 플래그
        if smart_place_check_data and smart_place_check_data.get("intro_text"):
            _intro_text_raw = smart_place_check_data["intro_text"]
            _intro_analyzed = True
        elif getattr(req, "description", None) and str(req.description).strip():
            _intro_text_raw = str(req.description).strip()
            _intro_analyzed = True
        elif req.review_text and req.review_text.strip():
            _intro_text_raw = req.review_text.strip()
            # review_text는 소개글이 아니므로 intro_analyzed=False 유지

        # review_text를 문장 단위로 분리해 발췌문 리스트 생성 (cold start 방지)
        _review_excerpts: list = []
        # 소개글 텍스트를 covered 분석에 포함 (가장 중요한 신호)
        if _intro_text_raw:
            _intro_sentences = _re.split(r"[.\n!?]+", _intro_text_raw)
            _review_excerpts.extend([s.strip() for s in _intro_sentences if len(s.strip()) > 5])
        # 리뷰 텍스트가 별도로 있으면 추가 (소개글과 중복 허용)
        if req.review_text and req.review_text.strip() and req.review_text.strip() != _intro_text_raw:
            _sentences = _re.split(r"[.\n!?]+", req.review_text)
            _review_excerpts.extend([s.strip() for s in _sentences if len(s.strip()) > 5])
        # 사용자가 선택/직접 입력한 키워드는 가게가 보유한 핵심 강점 키워드로 간주
        # → 분석 시 covered로 인식되도록 review_excerpts 끝에 합류 (cold start 시 유일한 신호)
        _user_keyword_evidence: list[str] = []
        if _trial_kw_list:
            _user_keyword_evidence.extend(_trial_kw_list)
        if req.keyword and req.keyword.strip():
            _user_keyword_evidence.append(req.keyword.strip())
        if _user_keyword_evidence:
            _review_excerpts.append(" ".join(_user_keyword_evidence))
        kw_analysis = analyze_keyword_coverage(
            _effective_cat,
            _review_excerpts,
            business_keywords=_user_keyword_evidence or None,
        )
        # 사용자 입력 태그 기반 관련도 정렬: 태그와 문자 겹치는 키워드 우선
        _all_missing = kw_analysis.get("missing", all_kws[:8])
        if _user_keyword_evidence and _all_missing:
            def _kw_relevance(kw: str) -> int:
                for tag in _user_keyword_evidence:
                    if tag in kw or kw in tag:
                        return 2
                    if len(tag) >= 2 and any(tag[i:i+2] in kw for i in range(len(tag)-1)):
                        return 1
                return 0
            _all_missing = sorted(_all_missing, key=_kw_relevance, reverse=True)

        # 키워드 → 서브카테고리·weight 메타 빌드 (추천 근거 표시용)
        # KEYWORD_TAXONOMY를 직접 조회하지 않고, 동일 모듈의 industry dict를 활용
        try:
            from services.keyword_taxonomy import KEYWORD_TAXONOMY as _TAXONOMY
            _industry = _TAXONOMY.get(_effective_cat, _TAXONOMY.get("restaurant", {}))
        except Exception as _e:
            _logger.warning(f"[scan] KEYWORD_TAXONOMY import failed — {_e}")
            _industry = {}
        _kw_to_meta: dict[str, dict] = {}
        for _sub_name, _sub_data in (_industry or {}).items():
            _sub_weight = _sub_data.get("weight", 0)
            for _kw in _sub_data.get("keywords", []):
                if _kw not in _kw_to_meta:
                    _kw_to_meta[_kw] = {
                        "subcategory": _sub_name,
                        "weight": _sub_weight,
                        "source": "업종_표준",
                    }

        # 다양성 보강: 사용자 신호 없을 때 weight 1·2순위 서브카테고리에서 골고루 추출
        # → 동일 카테고리(예: 단체모임)만으로 8개가 채워지는 편향 방지
        if not _user_keyword_evidence and _all_missing and _industry:
            _by_subcat: dict[str, list[str]] = {}
            for _kw in _all_missing:
                _sub = _kw_to_meta.get(_kw, {}).get("subcategory", "_etc")
                _by_subcat.setdefault(_sub, []).append(_kw)
            # weight 내림차순으로 서브카테고리 순회하며 1개씩 round-robin
            _sorted_subs = sorted(
                _by_subcat.keys(),
                key=lambda s: _industry.get(s, {}).get("weight", 0),
                reverse=True,
            )
            _diversified: list[str] = []
            _max_rounds = max((len(v) for v in _by_subcat.values()), default=0)
            for _round in range(_max_rounds):
                for _sub in _sorted_subs:
                    _lst = _by_subcat.get(_sub) or []
                    if _round < len(_lst):
                        _diversified.append(_lst[_round])
                if len(_diversified) >= 8:
                    break
            if _diversified:
                _all_missing = _diversified

        # 서브카테고리별 최대 2개 제한 — 동일 카테고리 편향 방지
        # _etc(taxonomy 미등록 커스텀 키워드)는 제한 없이 통과
        _subcat_count: dict[str, int] = {}
        _capped: list[str] = []
        for _kw in _all_missing:
            _sub = _kw_to_meta.get(_kw, {}).get("subcategory", "_etc")
            if _sub == "_etc" or _subcat_count.get(_sub, 0) < 2:
                _capped.append(_kw)
                if _sub != "_etc":
                    _subcat_count[_sub] = _subcat_count.get(_sub, 0) + 1
        _all_missing = _capped

        # 사업장명 기반 안전 필터: 빵/제과류 업체에 공간·뷰 관련 키워드 제거
        # taxonomy alias가 잘못 분류됐을 때 최후 방어선
        _BAKERY_NAME_SIGNALS = {"빵", "제과", "베이커리", "케이크", "마카롱", "스콘", "타르트", "크루아상"}
        _VENUE_AMBIANCE_KWS = {"뷰 좋음", "루프탑 있음", "야외석 있음", "인스타 감성", "포토존", "루프탑"}
        _biz_lower = (req.business_name or "").replace(" ", "")
        if any(s in _biz_lower for s in _BAKERY_NAME_SIGNALS):
            _all_missing = [kw for kw in _all_missing if kw not in _VENUE_AMBIANCE_KWS]

        top_missing_keywords = _all_missing[:8]
        pioneer_keywords = kw_analysis.get("pioneer", [])[:2]
        # 응답에 함께 내려보낼 키워드 메타 (해당 키워드만)
        keyword_meta = {
            kw: _kw_to_meta[kw] for kw in top_missing_keywords if kw in _kw_to_meta
        }
    except Exception as _e:
        _logger.warning(f"trial keyword analysis failed: {_e}")
        top_missing_keywords = []
        pioneer_keywords = []
        keyword_meta = {}
        _intro_analyzed = False  # 예외 시 False 확정


    # FAQ 복사 텍스트 -- 업종 1순위 키워드 기반 기본 템플릿
    faq_copy_text = ""
    if top_missing_keywords:
        kw1 = top_missing_keywords[0]
        biz_nm = req.business_name
        if keyword_ko and kw1 and keyword_ko.strip() == kw1.strip():
            q_line = "Q: " + biz_nm + _josa(biz_nm, ("은", "는")) + " " + kw1 + _josa(kw1, ("을", "를")) + " 잘하나요?"
            a_line = "A: 네, 저희 " + biz_nm + _josa(biz_nm, ("은", "는")) + " " + kw1 + _josa(kw1, ("을", "를")) + " 전문으로 합니다. 직접 방문하시거나 문의 주시면 자세히 안내해 드리겠습니다."
            faq_copy_text = q_line + "\n" + a_line
        else:
            kw_display = keyword_ko or kw1
            q_line = "Q: " + kw_display + " 중에서 " + kw1 + _josa(kw1, ("이", "가")) + " 좋은 곳인가요?"
            a_line = "A: 네, 저희 " + biz_nm + _josa(biz_nm, ("은", "는")) + " " + kw1 + _josa(kw1, ("을", "를")) + " 강점으로 하고 있습니다. 방문하시면 직접 확인하실 수 있습니다."
            faq_copy_text = q_line + "\n" + a_line

    # 리뷰 요청 메시지 생성 (briefing_engine 모듈 함수 직접 사용)
    review_copy_text = ""
    try:
        from services.briefing_engine import _make_review_response_content
        _review_kws = list(top_missing_keywords[:2]) if top_missing_keywords else []
        review_copy_text = _make_review_response_content(
            target_keywords=_review_kws,
            business_name=req.business_name,
            category=req.category or "restaurant",
        )
    except Exception as _rce:
        _logger.warning(f"trial review_copy_text build failed: {_rce}")

    # 측정 쿼리 리스트 — trial: 실제 사용 1개 + 구독 변형 미리보기 포함
    _trial_scan_queries = _build_ai_scan_queries(req.region or "", keyword_ko)

    return {
        # v3.6: trial_id (claim 깔때기에서 사용)
        "trial_id": trial_id,
        # v3.0 핵심 필드 (프론트엔드 trial/page.tsx에서 직접 참조)
        "track1_score": score.get("track1_score"),
        "track2_score": score.get("track2_score"),
        "unified_score": score.get("unified_score"),
        "naver_weight": score.get("naver_weight"),
        "global_weight": score.get("global_weight"),
        # growth_stage: GrowthStage 객체 전체 반환 (trial/page.tsx에서 stage_label, focus_message 등 직접 사용)
        "growth_stage": _growth_stage_full if _growth_stage_full else score.get("growth_stage"),
        "growth_stage_label": (_growth_stage_full or {}).get("stage_label") or score.get("growth_stage_label"),
        "top_missing_keywords": top_missing_keywords,
        "keyword_meta": keyword_meta,
        "pioneer_keywords": pioneer_keywords,
        "intro_analyzed": _intro_analyzed,
        "faq_copy_text": faq_copy_text,
        "review_copy_text": review_copy_text,
        # AI 플랫폼별 결과 (프론트엔드 플랫폼 카드에서 직접 참조)
        "chatgpt_result": ai_result.get("chatgpt"),
        # 기존 필드 (하위호환)
        "score": score,
        "result": ai_result,
        "query": query,
        "competitors": competitors,
        "naver": naver_data,
        "keyword_ranks": (naver_data or {}).get("keyword_ranks", []),
        "keyword_blog_comparison": (naver_data or {}).get("keyword_blog_comparison", []),
        "kakao": kakao_data,
        "website_health": website_data,
        "context": req.business_type or "location_based",
        # v3.3 — 신뢰도 강화 1라운드 (둘 다 nullable)
        "place_match": place_match_data,
        "smart_place_check": smart_place_check_data,
        # v3.4 — 신뢰도 강화 2라운드 (Gemini 10회 AI 응답 evidence, nullable)
        "ai_evidence": ai_evidence_data,
        # gemini_result: 프론트엔드 ScanConclusionCard가 읽는 키 (gemini_evidence_data 직접 전달)
        "gemini_result": gemini_evidence_data,
        "scan_queries": _trial_scan_queries,
        "message": "무료 원샷 체험 결과입니다. 100회 샘플링 전체 분석은 구독 후 이용 가능합니다.",
    }


# ── 네이버 AI 브리핑 체험 엔드포인트 ─────────────────────────────────────────

class NaverBriefingRequest(BaseModel):
    business_name: str
    region: str = ""
    category: str = ""
    keyword: str = ""


_NAVER_BRIEFING_LIMIT = 2       # IP당 1시간 최대 횟수 (Playwright 무거움)
_NAVER_BRIEFING_WINDOW = 3600   # 1시간


def _check_naver_briefing_rate_limit(ip: str) -> None:
    """IP 기반 네이버 브리핑 체험 횟수 초과 시 429 반환"""
    key = f"naver_briefing_ip:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _NAVER_BRIEFING_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "BRIEFING_LIMIT",
                "message": f"네이버 브리핑 확인은 1시간에 {_NAVER_BRIEFING_LIMIT}회까지 무료로 제공됩니다. 잠시 후 다시 시도하세요.",
                "retry_after": _NAVER_BRIEFING_WINDOW,
            },
        )
    if count == 0:
        _cache.set(key, 1, _NAVER_BRIEFING_WINDOW)
    else:
        _cache.set(key, count + 1, _NAVER_BRIEFING_WINDOW)


class _TrialEmailRequest(BaseModel):
    email: str = Field(..., max_length=200)


@router.post("/trial/{trial_id}/save-email")
async def trial_save_email(trial_id: str, req: _TrialEmailRequest, request: Request):
    """무료 체험 결과 이메일 저장 — 개선 플랜 발송 + 14일 후 재측정 링크용"""
    import re
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', req.email):
        raise HTTPException(status_code=400, detail="이메일 형식이 올바르지 않습니다")
    try:
        supabase = get_client()
        res = await execute(supabase.table("trial_scans").select("id").eq("id", trial_id).limit(1))
        if not (res and res.data):
            raise HTTPException(status_code=404, detail="체험 결과를 찾을 수 없습니다")
        await execute(
            supabase.table("trial_scans").update({"email": req.email}).eq("id", trial_id)
        )
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("trial_save_email error trial_id=%s: %s", trial_id, e)
        raise HTTPException(status_code=500, detail="저장 중 오류가 발생했습니다")


@router.post("/trial/naver-briefing")
async def trial_naver_briefing(req: NaverBriefingRequest, request: Request):
    """2단계: 네이버 AI 브리핑 실제 노출 여부 SSE 스트리밍"""

    async def _generate():
        import asyncio

        try:
            if not _is_admin_request(request):
                ip = _get_client_ip(request)
                _check_naver_briefing_rate_limit(ip)

            yield f"data: {json.dumps({'type':'progress','message':'네이버 검색 준비 중...','pct':10}, ensure_ascii=False)}\n\n"

            kw = req.keyword or _CATEGORY_KO.get(req.category, "가게")
            query = f"{req.region} {kw} 추천".strip()
            # 경쟁사 지역 검색은 항상 카테고리 키워드 사용 — 특징 키워드(단체 예약 가능 등)로
            # 검색 시 이종 업종(건강원, 의원 등)이 경쟁사로 오탐되는 문제 방지
            vis_kw = _CATEGORY_KO.get(req.category, kw)

            yield f"data: {json.dumps({'type':'progress','message':'AI 브리핑 영역 분석 중...','pct':40}, ensure_ascii=False)}\n\n"

            from services.ai_scanner.naver_scanner import NaverAIBriefingScanner
            from services.naver_visibility import get_naver_visibility
            from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE

            # get_naver_visibility는 Playwright 미사용 — create_task로 병렬 시작
            # check_mention은 PLAYWRIGHT_SEMAPHORE로 보호 (multi_scanner._run_playwright와 동일 패턴)
            vis_task = asyncio.create_task(
                get_naver_visibility(req.business_name, vis_kw, req.region)
            )
            try:
                async with PLAYWRIGHT_SEMAPHORE:
                    naver_result = await asyncio.wait_for(
                        NaverAIBriefingScanner().check_mention(
                            query, req.business_name, category=req.category
                        ),
                        timeout=40.0,
                    )
            except Exception as e:
                _logger.warning(f"naver_briefing scanner error: {e}")
                naver_result = {"mentioned": False, "in_briefing": False, "rank": None}
            try:
                vis = await vis_task
            except Exception as e:
                _logger.warning(f"naver_briefing visibility error: {e}")
                vis = {}

            yield f"data: {json.dumps({'type':'progress','message':'결과 정리 중...','pct':85}, ensure_ascii=False)}\n\n"

            # 캡챠 차단 시 미노출 오판 방지 — captcha_detected면 exposed/in_briefing 판정 보류
            _captcha_blocked = isinstance(naver_result, dict) and naver_result.get("captcha_detected")
            if _captcha_blocked:
                _logger.warning("trial naver_scanner: captcha detected — treating as unknown")
            exposed = False if _captcha_blocked else bool(naver_result.get("mentioned") or naver_result.get("in_briefing"))
            in_briefing = False if _captcha_blocked else bool(naver_result.get("in_briefing"))
            rank = naver_result.get("rank")
            naver_competitors_list = vis.get("naver_competitors") or []
            competitor_count = len(naver_competitors_list) if isinstance(naver_competitors_list, list) else 0

            if in_briefing:
                hint = "이미 AI 브리핑에 노출 중입니다! 더 많은 키워드로 확장하려면 Basic 구독을 시작하세요."
            elif exposed and rank:
                hint = f"네이버 플레이스 {rank}위에 노출 중입니다. 소개글 Q&A 추가로 AI 브리핑 인용 후보까지 진출할 수 있습니다."
            else:
                hint = f"소개글 안 Q&A 섹션에 '{kw} 관련 질문'을 추가하면 AI 브리핑 인용 후보 가능성이 높아집니다."

            result = {
                "type": "result",
                "exposed": exposed,
                "in_briefing": in_briefing,
                "rank": rank,
                "competitor_count": competitor_count,
                "improvement_hint": hint,
                "query": query,
            }
            yield f"data: {json.dumps(result, ensure_ascii=False)}\n\n"

        except HTTPException as e:
            detail = e.detail if isinstance(e.detail, str) else str(e.detail)
            yield f"data: {json.dumps({'type':'error','message':detail}, ensure_ascii=False)}\n\n"
        except Exception as e:
            _logger.warning(f"naver_briefing SSE error: {e}")
            yield f"data: {json.dumps({'type':'error','message':'네이버 브리핑 확인 중 오류가 발생했습니다.'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _is_full_scan_plan(plan: str) -> bool:
    """수동 스캔은 전 플랜 quick scan으로 통일 (자동 스캔만 full)
    biz 정책 변경: 수동 스캔은 quick scan, 자동 스캔(scheduler)만 full scan 유지
    """
    return False  # 수동 스캔은 전 플랜 quick scan으로 통일


async def _get_user_plan(user_id: str, supabase) -> str:
    """사용자 구독 플랜 조회 — middleware.plan_gate.get_user_plan()에 위임.
    해지(cancelled) 후 end_at 이전 잔여기간에도 기존 플랜을 유지하는 로직을 이 파일에서
    직접 중복 구현하지 않고 단일 소스를 그대로 재사용한다(2026-07-06 competitor.py와 동일 원칙)."""
    from middleware.plan_gate import get_user_plan
    return await get_user_plan(user_id, supabase)


# ── Basic 1회 무료 체험 (회원가입 후 결제 없이 Full Scan + 가이드 1회) ─────────
class BasicTrialRequest(BaseModel):
    business_id: str


@router.get("/basic-trial/status")
async def get_basic_trial_status(user=Depends(get_current_user)):
    """Basic 체험 사용 가능 여부 조회.
    활성 구독자는 정식 API 사용 경로가 있으므로 can_use=False 반환.
    """
    supabase = get_client()
    user_id = str(user["id"])

    prof = await execute(
        supabase.table("profiles")
        .select("basic_trial_used, basic_trial_used_at")
        .eq("user_id", user_id)
        .maybe_single()
    )
    prof_data = prof.data if (prof and prof.data) else {}
    used = bool(prof_data.get("basic_trial_used"))
    used_at = prof_data.get("basic_trial_used_at")

    sub = await execute(
        supabase.table("subscriptions")
        .select("status")
        .eq("user_id", user_id)
        .in_("status", ["active", "grace_period"])
        .maybe_single()
    )
    has_active_subscription = bool(sub and sub.data)

    return {
        "used": used,
        "used_at": used_at,
        "can_use": (not used) and (not has_active_subscription),
        "has_active_subscription": has_active_subscription,
    }


@router.post("/basic-trial")
async def run_basic_trial(req: BasicTrialRequest, user=Depends(get_current_user)):
    """Basic 1회 무료 Full Scan 체험 (동기, 약 1분 소요).

    - 활성 구독자 차단 (정식 API 경로 사용 유도)
    - profiles.basic_trial_used=True 이면 차단
    - business_id 소유권 검증
    - 동시 요청 방지 (scan_key 기반 409)
    - 내부적으로 _run_full_scan() 재사용 → DB 저장·가이드 자동생성까지 완료
    - rate_limit / manual_scan_daily 체크 우회 (체험은 별도 카운터)
    """
    supabase = get_client()
    user_id = str(user["id"])
    biz_id = req.business_id

    # 활성 구독자 차단
    sub = await execute(
        supabase.table("subscriptions")
        .select("status")
        .eq("user_id", user_id)
        .in_("status", ["active", "grace_period"])
        .maybe_single()
    )
    if sub and sub.data:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "ALREADY_SUBSCRIBED",
                "message": "이미 구독 중입니다. 정상 스캔 기능을 사용하세요.",
            },
        )

    # 체험 이미 사용 여부
    prof = await execute(
        supabase.table("profiles")
        .select("basic_trial_used")
        .eq("user_id", user_id)
        .maybe_single()
    )
    if prof and prof.data and prof.data.get("basic_trial_used"):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "BASIC_TRIAL_USED",
                "message": "Basic 무료 체험을 이미 사용했습니다. 구독 후 이용하세요.",
                "upgrade_url": "/pricing",
            },
        )

    # 소유권 검증 + 사업장 정보 조회
    biz = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, keywords")
        .eq("id", biz_id)
        .eq("user_id", user_id)
        .maybe_single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    # 동시 실행 차단
    scan_key = f"{user_id}:{biz_id}"
    if scan_key in _active_scans:
        raise HTTPException(
            status_code=409,
            detail={"code": "SCAN_IN_PROGRESS", "message": "이미 스캔이 진행 중입니다"},
        )

    # trial 선사용 마킹 (실패 시 롤백) — 중복 호출 방지
    from datetime import datetime as _dt, timezone as _tz
    now_iso = _dt.now(_tz.utc).isoformat()
    await execute(supabase.table("profiles").upsert({
        "user_id": user_id,
        "basic_trial_used": True,
        "basic_trial_used_at": now_iso,
        "basic_trial_business_id": biz_id,
    }))

    _active_scans.add(scan_key)
    scan_id = str(uuid.uuid4())
    req_scan = ScanRequest(
        business_name=biz["name"],
        category=biz.get("category") or "",
        region=biz.get("region") or "",
        business_id=biz_id,
        keywords=biz.get("keywords") or [],
    )
    try:
        await _run_full_scan(scan_id, req_scan)
    except Exception as e:
        # 실패 시 체험 상태 롤백 (사용자가 재시도 가능하도록)
        _logger.error(f"basic_trial scan failed user={user_id} biz={biz_id}: {e}")
        try:
            await execute(supabase.table("profiles").update({
                "basic_trial_used": False,
                "basic_trial_used_at": None,
                "basic_trial_business_id": None,
            }).eq("user_id", user_id))
        except Exception as rollback_e:
            _logger.warning(f"basic_trial rollback failed: {rollback_e}")
        raise HTTPException(status_code=500, detail="체험 스캔 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.")
    finally:
        _active_scans.discard(scan_key)

    return {
        "scan_id": scan_id,
        "business_id": biz_id,
        "message": "Basic 무료 체험 스캔이 완료되었습니다. 대시보드에서 결과를 확인하세요.",
    }


@router.post("/full")
async def full_scan(req: ScanRequest, bg: BackgroundTasks, user=Depends(get_current_user)):
    """수동 AI 스캔 (구독자 전용, 백그라운드)
    - 전 플랜 quick scan으로 통일 (Gemini 10회 + 네이버, 비용 ~3원)
    - 자동 스캔(scheduler)만 full scan 유지
    """
    _endpoint = "full"
    if not req.business_id:
        raise make_scan_error(
            "BUSINESS_NOT_FOUND",
            message="business_id가 필요합니다.",
            endpoint=_endpoint,
        )

    x_user_id = str(user["id"])
    supabase = get_client()

    # 사업장 소유권 검증
    _biz_check = (await execute(
        supabase.table("businesses").select("id").eq("id", req.business_id).eq("user_id", x_user_id).maybe_single()
    )).data
    if not _biz_check:
        raise make_scan_error(
            "BUSINESS_NOT_FOUND",
            endpoint=_endpoint,
            biz_id=req.business_id,
        )

    try:
        from middleware.rate_limit import check_monthly_scan_limit
        await check_monthly_scan_limit(x_user_id, supabase)
    except HTTPException as e:
        _logger.warning("[scan/full] rate_limit blocked: user=%s detail=%s", x_user_id, e.detail)
        raise make_scan_error(
            "PLAN_LIMIT_EXCEEDED",
            message="월간 스캔 한도에 도달했습니다.",
            endpoint=_endpoint,
            biz_id=req.business_id,
        )

    try:
        from middleware.plan_gate import check_manual_scan_limit
        await check_manual_scan_limit(x_user_id, supabase, business_id=req.business_id)
    except HTTPException as e:
        _logger.warning("[scan/full] manual_scan_limit blocked: user=%s detail=%s", x_user_id, e.detail)
        raise make_scan_error(
            "PLAN_LIMIT_EXCEEDED",
            message="일별 수동 스캔 한도에 도달했습니다. 내일 다시 시도해 주세요.",
            endpoint=_endpoint,
            biz_id=req.business_id,
        )

    # 중복 스캔 방지
    scan_key = f"{x_user_id}:{req.business_id}"
    if scan_key in _active_scans:
        raise make_scan_error(
            "SCAN_IN_PROGRESS",
            endpoint=_endpoint,
            biz_id=req.business_id,
        )

    _active_scans.add(scan_key)
    scan_id = str(uuid.uuid4())

    async def _scan_and_cleanup():
        try:
            await _run_quick_scan(scan_id, req)
        except Exception as e:
            _logger.error(
                "[scan/full] background scan failed: endpoint=%s biz_id=%s scan_id=%s exc=%s",
                _endpoint, req.business_id, scan_id, repr(e),
            )
        finally:
            _active_scans.discard(scan_key)

    bg.add_task(_scan_and_cleanup)
    return {"scan_id": scan_id, "status": "started", "scan_mode": "quick", "scan_type": "quick"}


@router.post("/stream/prepare")
async def prepare_stream(biz_id: str, selected_keyword: str = "", user=Depends(get_current_user)):
    """SSE 스트림 시작 전 단기 토큰 발급 (60초 유효) — Bearer 인증"""
    # 만료된 토큰 정리
    now = datetime.now(timezone.utc)
    expired = [t for t, d in _stream_tokens.items() if d["expires_at"] < now]
    for t in expired:
        _stream_tokens.pop(t, None)

    supabase = get_client()
    user_id = str(user["id"])

    # 사업장 소유권 확인
    biz_check = (await execute(
        supabase.table("businesses").select("id").eq("id", biz_id).eq("user_id", user_id).maybe_single()
    )).data
    if not biz_check:
        raise HTTPException(
            status_code=404,
            detail={"code": "BIZ_NOT_FOUND", "message": "사업장을 찾을 수 없습니다"},
        )

    # 중복 스캔 확인 (SSE 연결 전에 확인)
    scan_key = f"{user_id}:{biz_id}"
    if scan_key in _active_scans:
        raise HTTPException(
            status_code=409,
            detail={"code": "SCAN_IN_PROGRESS", "message": "이미 스캔이 진행 중입니다"},
        )

    # 월간 한도 체크
    from middleware.rate_limit import check_monthly_scan_limit
    await check_monthly_scan_limit(user_id, supabase)

    # 일별 수동 스캔 한도 체크
    from middleware.plan_gate import check_manual_scan_limit
    await check_manual_scan_limit(user_id, supabase, business_id=biz_id)

    try:
        plan = await _get_user_plan(user_id, supabase)
    except Exception as e:
        _logger.warning(f"_get_user_plan failed for user {user_id}, fallback to free: {e}")
        plan = "free"
    _effective_kw = selected_keyword.strip()

    token = secrets.token_urlsafe(32)
    _stream_tokens[token] = {
        "user_id": user["id"],
        "biz_id": biz_id,
        "plan": plan,
        "selected_keyword": _effective_kw,
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=60),
    }
    return {"stream_token": token, "expires_in": 60}


@router.get("/stream")
async def stream_scan(stream_token: str):
    """SSE 실시간 진행률 스트리밍 — /stream/prepare 발급 토큰 필수"""
    token_data = _stream_tokens.get(stream_token)
    if not token_data or datetime.now(timezone.utc) > token_data["expires_at"]:
        _logger.warning(
            f"Stream token not found or expired: {stream_token[:10]}... "
            f"(tokens_count={len(_stream_tokens)})"
        )
        _stream_tokens.pop(stream_token, None)
        raise HTTPException(status_code=401, detail="Invalid or expired stream token")
    _stream_tokens.pop(stream_token, None)

    user_id = token_data["user_id"]
    biz_id = token_data["biz_id"]
    _stream_selected_kw = token_data.get("selected_keyword", "")
    # 수동 스캔은 전 플랜 quick scan으로 통일 (plan 분기 불필요)

    # 사업장 정보 조회
    supabase = get_client()
    biz = (await execute(supabase.table("businesses").select("id, name, category, region, business_type, website_url, keywords").eq("id", biz_id).eq("user_id", user_id).maybe_single())).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    _biz_keywords = biz.get("keywords") or []
    if _stream_selected_kw:
        # 선택 키워드를 첫 번째로 배치 → multi_scanner가 valid_kw[0]으로 쿼리 구성
        _rest_kws = [k for k in _biz_keywords if k.strip() != _stream_selected_kw.strip()]
        _biz_keywords = [_stream_selected_kw] + _rest_kws

    req = ScanRequest(
        business_name=biz["name"],
        category=biz["category"],
        region=biz.get("region") or "",
        business_id=biz_id,
        keywords=_biz_keywords,
    )

    async def gen():
        _stream_endpoint = "stream"
        # 중복 스캔 방지
        scan_key = f"{user_id}:{biz_id}"
        if scan_key in _active_scans:
            _err = {"code": "SCAN_IN_PROGRESS", "message": "이미 스캔이 진행 중입니다. 완료 후 다시 시도해 주세요.", "support": "contact@aeolab.co.kr"}
            yield f"data: {json.dumps({'error': _err}, ensure_ascii=False)}\n\n"
            return
        _active_scans.add(scan_key)

        try:
            from middleware.rate_limit import check_monthly_scan_limit
            try:
                await check_monthly_scan_limit(user_id, get_client())
            except HTTPException as e:
                _logger.warning("[scan/stream] rate_limit blocked: user=%s detail=%s", user_id, e.detail)
                _err = {"code": "PLAN_LIMIT_EXCEEDED", "message": "월간 스캔 한도에 도달했습니다.", "support": "contact@aeolab.co.kr"}
                yield f"data: {json.dumps({'error': _err}, ensure_ascii=False)}\n\n"
                return
            from middleware.plan_gate import check_manual_scan_limit
            try:
                await check_manual_scan_limit(user_id, get_client(), business_id=biz_id)
            except HTTPException as e:
                _logger.warning("[scan/stream] manual_limit blocked: user=%s detail=%s", user_id, e.detail)
                _err = {"code": "PLAN_LIMIT_EXCEEDED", "message": "일별 수동 스캔 한도에 도달했습니다. 내일 다시 시도해 주세요.", "support": "contact@aeolab.co.kr"}
                yield f"data: {json.dumps({'error': _err}, ensure_ascii=False)}\n\n"
                return

            scanner = MultiAIScanner(mode="quick")
            scan_results: dict = {}
            # 전 플랜 quick scan으로 통일 (수동 스캔 정책 변경 2026-04-03)
            progress_iter = scanner.scan_quick_with_progress(req)

            try:
                async for progress in progress_iter:
                    if progress.get("step") == "complete":
                        # complete는 DB 저장 완료 후 전송 — 먼저 넘어가지 않음
                        continue
                    yield f"data: {json.dumps(progress, ensure_ascii=False)}\n\n"
                    if progress.get("status") == "done" and "result" in progress:
                        scan_results[progress["step"]] = progress["result"]
            except Exception as scan_exc:
                _err_code = classify_exception(scan_exc)
                _logger.error(
                    "[scan/stream] scanner exception: endpoint=%s biz_id=%s code=%s exc=%s",
                    _stream_endpoint, biz_id, _err_code, repr(scan_exc),
                )
                _msg_map = {
                    "PLAYWRIGHT_TIMEOUT": "네이버·Google 페이지 로딩 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.",
                    "AI_SERVICE_UNAVAILABLE": "AI 서비스 일시 응답 지연입니다. 잠시 후 다시 시도해 주세요.",
                    "INTERNAL_ERROR": "스캔 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
                }
                _err = {
                    "code": _err_code,
                    "message": _msg_map.get(_err_code, "일시적인 오류가 발생했습니다."),
                    "support": "contact@aeolab.co.kr",
                }
                yield f"data: {json.dumps({'error': _err}, ensure_ascii=False)}\n\n"
                return

            # DB 저장 중 표시 (progress 90%)
            yield f"data: {json.dumps({'step': 'saving', 'status': 'running', 'message': '결과를 저장하는 중...', 'progress': 90}, ensure_ascii=False)}\n\n"

            # DB 저장 완료 후 complete 전송 (결과가 반드시 DB에 있음을 보장)
            if biz_id and scan_results:
                try:
                    await _save_scan_results(biz_id, req, scan_results, selected_keyword=_stream_selected_kw)
                except Exception as e:
                    _logger.error(
                        "[scan/stream] save failed: endpoint=%s biz_id=%s exc=%s",
                        _stream_endpoint, biz_id, repr(e),
                    )

            # complete 이벤트 전송
            yield f"data: {json.dumps({'step': 'complete', 'status': 'done', 'progress': 100, 'scan_type': 'quick'}, ensure_ascii=False)}\n\n"
        finally:
            _active_scans.discard(scan_key)

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(gen(), media_type="text/event-stream", headers=headers)




# -- ClaimGate 소셜 프루프 통계 (공개, 30분 캐시) --

_claim_stats_cache: dict = {"data": None, "updated_at": None}
_CLAIM_STATS_CACHE_SEC = 1800  # 30분

_CLAIM_STATS_RATE_LIMIT_PER_MIN = 30
_CLAIM_STATS_WINDOW_SEC = 60


def _check_claim_stats_rate_limit(ip: str) -> None:
    key = f"claim_stats_ip:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _CLAIM_STATS_RATE_LIMIT_PER_MIN:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요.",
                "retry_after": _CLAIM_STATS_WINDOW_SEC,
            },
        )
    if count == 0:
        _cache.set(key, 1, _CLAIM_STATS_WINDOW_SEC)
    else:
        _cache.set(key, count + 1, _CLAIM_STATS_WINDOW_SEC)


@router.get("/claim-stats")
async def get_claim_stats(request: Request):
    """ClaimGate 소셜 프루프용 공개 통계 (인증 불필요, 분당 30회 제한).

    trial_scans 테이블에서 claimed_at IS NOT NULL인 행 수를 반환한다.
    30분 메모리 캐시 적용. 에러 시 graceful 기본값 반환.
    """
    if not _is_admin_request(request):
        ip = _get_client_ip(request)
        _check_claim_stats_rate_limit(ip)

    now = datetime.now(timezone.utc)

    # 캐시 유효 여부 확인
    if (
        _claim_stats_cache["data"] is not None
        and _claim_stats_cache["updated_at"] is not None
        and (now - _claim_stats_cache["updated_at"]).total_seconds() < _CLAIM_STATS_CACHE_SEC
    ):
        return _claim_stats_cache["data"]

    supabase = get_client()
    try:
        res = await execute(
            supabase.table("trial_scans")
            .select("id", count="exact")
            .not_.is_("claimed_at", "null")
        )
        total = res.count if (res and hasattr(res, "count") and res.count is not None) else 0
        result = {
            "total_claims": total,
            "last_updated": now.isoformat(),
        }
        _claim_stats_cache["data"] = result
        _claim_stats_cache["updated_at"] = now
        return result
    except Exception as e:
        _logger.warning(f"claim_stats fetch error: {e}")
        return {
            "total_claims": 0,
            "last_updated": None,
        }


@router.get("/{scan_id}")
async def get_scan(scan_id: str, user: dict = Depends(get_current_user)):
    """스캔 결과 조회 (인증 + 소유권 검증)"""
    supabase = get_client()
    result = await execute(supabase.table("scan_results").select("id, business_id, scanned_at, query_used, exposure_freq, total_score, score_breakdown, naver_channel_score, global_channel_score, gemini_result, chatgpt_result, naver_result, google_result, kakao_result, website_check_result, competitor_scores, rank_in_query").eq("id", scan_id).single())
    if not result.data:
        raise HTTPException(status_code=404, detail="Scan not found")
    # 소유권 검증: scan이 속한 business의 user_id 확인
    biz_check = await execute(supabase.table("businesses").select("user_id").eq("id", result.data["business_id"]).single())
    if not biz_check.data or biz_check.data.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="접근 권한 없음")
    return result.data


async def _save_scan_results(business_id: str, req: ScanRequest, results: dict, selected_keyword: str = ""):
    """스트림 스캔 완료 후 DB 저장 — 빠른 경로 (~3~5초) + 느린 백그라운드 분리

    빠른 경로: kakao + website_check 병렬 → 점수 계산 → scan_results INSERT →
               ai_citations → keyword_diversity → score_history → review_snapshots →
               rank_in_category → 카카오 알림 (create_task)

    느린 백그라운드: smart_place Playwright, competitor Gemini 스캔, query_exposure,
                   competitor_snapshots, scan_analytics → scan_results / score_history UPDATE
    """
    import asyncio as _asyncio
    from datetime import date as _date
    from services.kakao_visibility import get_kakao_visibility
    from services.website_checker import check_website_seo

    supabase = get_client()
    biz = (await execute(supabase.table("businesses").select(
        "id, name, user_id, category, region, business_type, website_url, naver_place_url, "
        "keywords, naver_place_id, google_place_id, kakao_place_id, "
        "review_count, avg_rating, keyword_diversity, receipt_review_count, "
        "has_faq, has_recent_post, has_intro, review_sample, "
        "blog_keyword_coverage, blog_analysis_json, blog_latest_post_date, blog_analyzed_at"
    ).eq("id", business_id).single())).data

    keyword_ko = _CATEGORY_KO.get((biz or {}).get("category", req.category), req.category)
    naver_place_url = (biz or {}).get("naver_place_url", "") or ""
    naver_place_id_val = (biz or {}).get("naver_place_id", "") or ""
    # place_url이 없으면 place_id로 URL 자동 구성
    if not naver_place_url and naver_place_id_val:
        naver_place_url = f"https://map.naver.com/p/entry/place/{naver_place_id_val}"

    # ── 빠른 경로: kakao + website_check + naver_visibility(멀티쿼리) 병렬 ──
    from services.naver_visibility import get_naver_visibility_multi as _get_naver_vis

    _biz_data = biz or {}

    # 스트림 스캔용 멀티쿼리 키워드 구성 (최대 4개)
    _stream_biz_keywords = (_biz_data.get("keywords") or [])
    _stream_valid_kw = [k.strip() for k in _stream_biz_keywords if k.strip() and len(k.strip()) >= 2]
    _stream_keyword_ko = _CATEGORY_KO.get((_biz_data.get("category") or req.category), req.category)

    # Pro+ 선택 키워드 반영
    _selected_kw = (selected_keyword or "").strip()
    _logger.info(f"stream scan: selected_keyword={_selected_kw!r}, biz_id={business_id}")
    if _selected_kw:
        _stream_keyword_ko = _selected_kw
        _rest = [k for k in _stream_valid_kw if k != _selected_kw]
        _stream_multi_kws = list(dict.fromkeys([_selected_kw] + _rest))[:4]
    else:
        _stream_multi_kws = list(dict.fromkeys(_stream_valid_kw[:3] + [_stream_keyword_ko]))[:4]

    gather_results = await _asyncio.gather(
        get_kakao_visibility(req.business_name, _stream_keyword_ko, req.region),
        check_website_seo(_biz_data.get("website_url", "")),
        _get_naver_vis(req.business_name, _stream_multi_kws, req.region or "", category_ko=_stream_keyword_ko),
        return_exceptions=True,
    )
    kakao_data, website_check, naver_visibility = gather_results

    if isinstance(kakao_data, Exception):
        _logger.warning(f"kakao_visibility failed (stream): {kakao_data}")
        kakao_data = None
    if isinstance(website_check, Exception):
        _logger.warning(f"website_checker failed (stream): {website_check}")
        website_check = None
    if isinstance(naver_visibility, Exception):
        _logger.warning(f"naver_visibility failed (stream): {naver_visibility}")
        naver_visibility = {}

    # naver_data: naver_visibility API 결과(is_smart_place, blog_mentions) + AI 브리핑 스캔 결과 병합
    # 캡챠 차단 시 mentioned/in_briefing을 False로 덮어쓰면 실제 미노출로 오집계됨 — captcha_detected 시 제거
    naver_scanner_result = results.get("naver") or {}
    if naver_scanner_result.get("captcha_detected"):
        _logger.warning("naver_scanner: captcha detected — skipping mentioned/in_briefing override to prevent false-negative")
        naver_scanner_result = {k: v for k, v in naver_scanner_result.items() if k not in ("mentioned", "in_briefing", "rank")}
    naver_data = {**(naver_visibility if isinstance(naver_visibility, dict) else {}), **naver_scanner_result}

    # 카카오·웹사이트 결과를 scan_results에 병합해 채널 점수 계산
    combined_results = {
        **results,
        "kakao": kakao_data or {},
        "website_check": website_check or {},
    }
    # 블로그 분석 covered 키워드를 biz에 병합해 score_engine cold start 개선
    _blog_json_calc = (biz or {}).get("blog_analysis_json") or {}
    _blog_covered_calc = (_blog_json_calc.get("keyword_coverage") or {}).get("present") or []
    if isinstance(_blog_covered_calc, list) and _blog_covered_calc:
        biz = {**(biz or {}), "blog_covered_keywords": " ".join(_blog_covered_calc)}
    _blog_kw_cov = float((biz or {}).get("blog_keyword_coverage") or 0)
    _stream_kw_rate = _blog_kw_cov / 100 if _blog_kw_cov >= 10 else None
    score = calculate_score(combined_results, biz or {}, naver_data=naver_data, keyword_coverage_rate=_stream_kw_rate)

    # 쿼리 생성: 선택 키워드가 있으면 우선 반영 (_stream_multi_kws[0] = 선택 or 등록 첫번째)
    # _stream_keyword_ko: 선택 키워드가 있으면 해당 값으로 이미 교체됨
    if _stream_multi_kws:
        query = f"{req.region} {_stream_multi_kws[0]} 추천" if req.region else f"{_stream_multi_kws[0]} 추천"
    else:
        query = f"{req.region} {_stream_keyword_ko} 추천" if req.region else f"{_stream_keyword_ko} 추천"

    # 이전 score_history로 weekly_change 계산
    prev_history = (
        await execute(
            supabase.table("score_history")
            .select("total_score")
            .eq("business_id", business_id)
            .order("score_date", desc=True)
            .limit(1)
        )
    ).data
    weekly_change = round(
        score["total_score"] - prev_history[0]["total_score"], 2
    ) if prev_history else 0.0

    # 경쟁사 목록만 조회 (스캔은 백그라운드에서 수행)
    competitors = (
        await execute(
            supabase.table("competitors")
            .select("id, name")
            .eq("business_id", business_id)
            .eq("is_active", True)
        )
    ).data or []

    # ── scan_results DB INSERT (빠른 경로 핵심 — competitor_scores/smart_place는 None으로 먼저 저장) ──
    # top_missing_keywords 계산 — stream scan 경로 (taxonomy 기반)
    _stream_top_missing: list[str] = []
    try:
        _stream_biz_kw_raw = list((biz or {}).get("keywords") or [])

        # taxonomy 기반 분석: 등록 키워드는 covered로 처리되므로 missing에 포함되지 않음
        if True:
            from services.keyword_taxonomy import (
                analyze_keyword_coverage as _akc_stream,
                get_missing_keywords_for_query as _gmkq,
                _infer_taxonomy_key as _itk,
            )
            from services.keyword_resolver import get_user_keyword_prefs as _gkp_stream
            _stream_biz_kw_list = list(_stream_biz_kw_raw)
            if _selected_kw and _selected_kw not in _stream_biz_kw_list:
                _stream_biz_kw_list = [_selected_kw] + _stream_biz_kw_list
            _stream_biz_kw_text = " ".join(_stream_biz_kw_list)
            _stream_review_text = (biz or {}).get("review_sample", "") or ""
            if not _stream_review_text:
                _naver_res_s = results.get("naver") or {}
                _stream_review_text = " ".join(str(b.get("title", "")) for b in (_naver_res_s.get("top_blogs") or []))
            # 블로그 분석 covered 키워드 추가 (blog_analysis_json.keyword_coverage.present)
            _blog_json_s = (biz or {}).get("blog_analysis_json") or {}
            _blog_covered_s = (_blog_json_s.get("keyword_coverage") or {}).get("present") or []
            _blog_covered_text_s = " ".join(_blog_covered_s) if isinstance(_blog_covered_s, list) else ""
            _intro_draft_s = ((biz or {}).get("naver_intro_draft") or "").strip()
            _stream_combined_text = " ".join(filter(None, [_selected_kw, _stream_biz_kw_text, _stream_review_text, _intro_draft_s, _blog_covered_text_s]))
            # 사용자 맞춤 키워드 prefs 반영 (DB 컬럼 없으면 graceful)
            _stream_excluded_kw: list[str] = []
            _stream_custom_kw: list[str] = list(_stream_biz_kw_list)
            try:
                _p = await _gkp_stream(business_id, supabase)
                _stream_excluded_kw = _p.get("excluded") or []
                for ck in (_p.get("custom") or []):
                    if ck and ck not in _stream_custom_kw:
                        _stream_custom_kw.append(ck)
            except Exception as _e:
                _logger.warning(f"stream keyword_prefs lookup failed: {_e}")
            _stream_kw_analysis = _akc_stream(
                (biz or {}).get("category", req.category),
                [_stream_combined_text] if _stream_combined_text else [],
                business_keywords=_stream_custom_kw,
                excluded_keywords=_stream_excluded_kw or None,
            )
            if _selected_kw:
                _tx_key = _itk((biz or {}).get("category", req.category), _stream_biz_kw_list)
                _stream_top_missing = _gmkq(
                    _selected_kw, _tx_key,
                    _stream_kw_analysis.get("covered", []), max_count=5,
                )
            else:
                _stream_missing_all = _stream_kw_analysis.get("missing", [])
                # 서브카테고리 메타 빌드 (weight 순 이미 정렬돼 있음 — analyze_keyword_coverage가 보장)
                try:
                    from services.keyword_taxonomy import KEYWORD_TAXONOMY as _STREAM_TAX, normalize_category as _stream_norm_cat
                    _stream_industry = _STREAM_TAX.get(
                        _stream_norm_cat((biz or {}).get("category", req.category)), {}
                    )
                    _stream_kw_meta_s: dict[str, str] = {}
                    for _sn_s, _sd_s in (_stream_industry or {}).items():
                        for _k_s in _sd_s.get("keywords", []):
                            if _k_s not in _stream_kw_meta_s:
                                _stream_kw_meta_s[_k_s] = _sn_s
                except Exception as _e:
                    _logger.warning("[stream scan] keyword_taxonomy load failed (keyword_gap_score→0): %s", _e)
                    _stream_industry = {}
                    _stream_kw_meta_s = {}
                # round-robin: 서브카테고리에서 1개씩 순환 — 블록 편향 방지 (dict 삽입 순서 = weight 순)
                if _stream_missing_all:
                    _s_by_sub: dict[str, list[str]] = {}
                    for _kw_s in _stream_missing_all:
                        _s_by_sub.setdefault(_stream_kw_meta_s.get(_kw_s, "_etc"), []).append(_kw_s)
                    _s_div: list[str] = []
                    _s_max = max(len(v) for v in _s_by_sub.values())
                    for _r in range(_s_max):
                        for _sub_s, _lst in _s_by_sub.items():
                            if _r < len(_lst):
                                _s_div.append(_lst[_r])
                        if len(_s_div) >= 8:
                            break
                    _stream_missing_all = _s_div
                # 서브카테고리별 최대 2개 제한 (round-robin 이후 안전망)
                _stream_subcat_count: dict[str, int] = {}
                _stream_capped: list[str] = []
                for _kw_s in _stream_missing_all:
                    _sub_s = _stream_kw_meta_s.get(_kw_s, "_etc")
                    if _sub_s == "_etc" or _stream_subcat_count.get(_sub_s, 0) < 2:
                        _stream_capped.append(_kw_s)
                        if _sub_s != "_etc":
                            _stream_subcat_count[_sub_s] = _stream_subcat_count.get(_sub_s, 0) + 1
                    if len(_stream_capped) >= 8:
                        break
                _stream_top_missing = _stream_capped
    except Exception as e:
        _logger.warning(f"keyword_taxonomy failed (stream): {e}")

    # 이전 스캔의 smart_place_completeness_result를 초기값으로 사용
    # → 재스캔 직후 백그라운드 잡 완료 전 null 상태 방지. 백그라운드 잡이 덮어씀.
    _prev_sp_result = None
    _prev_photo_cats = None
    try:
        _prev_sp_row = (await execute(
            supabase.table("scan_results")
            .select("smart_place_completeness_result, photo_categories")
            .eq("business_id", business_id)
            .not_.is_("smart_place_completeness_result", "null")
            .order("scanned_at", desc=True)
            .limit(1)
            .maybe_single()
        )).data
        if _prev_sp_row:
            _prev_sp_result = _prev_sp_row.get("smart_place_completeness_result")
            _prev_photo_cats = _prev_sp_row.get("photo_categories")
    except Exception as _sp_prev_err:
        _logger.debug(f"prev sp_result lookup failed: {_sp_prev_err}")

    inserted = (await execute(supabase.table("scan_results").insert({
        "business_id": business_id,
        "query_used": query,
        "gemini_result":     results.get("gemini"),
        "chatgpt_result":    results.get("chatgpt"),
        "naver_result":      results.get("naver"),
        "google_result":     results.get("google"),
        "kakao_result":      kakao_data or None,
        "website_check_result": website_check or None,
        "exposure_freq": (results.get("gemini") or {}).get("exposure_freq", 0),
        "total_score": score["total_score"],
        "score_breakdown": score["breakdown"],
        "naver_channel_score": score.get("naver_channel_score"),
        "global_channel_score": score.get("global_channel_score"),
        "unified_score": score.get("unified_score"),
        "track1_score": score.get("track1_score"),
        "track2_score": score.get("track2_score"),
        "naver_weight": score.get("naver_weight"),
        "global_weight": score.get("global_weight"),
        "keyword_coverage": score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100,
        "competitor_scores": None,              # 백그라운드 enrich에서 UPDATE
        "smart_place_completeness_result": _prev_sp_result,  # 이전 스캔 폴백, 백그라운드 잡에서 갱신
        "growth_stage": score.get("growth_stage"),
        "growth_stage_label": score.get("growth_stage_label"),
        "is_keyword_estimated": score.get("is_keyword_estimated"),
        "top_missing_keywords": _stream_top_missing or [],
        "photo_categories": _prev_photo_cats,  # 이전 스캔 폴백, 백그라운드 잡에서 갱신
        "blog_post_count": int(_blog_json_calc.get("post_count") or 0) or None,
        "blog_ai_readiness": float(_blog_json_calc.get("ai_readiness_score") or 0) or None,
        "blog_keyword_coverage": _blog_kw_cov or None,
        "blog_platform": _blog_json_calc.get("platform") or None,
        "blog_top_recommendation": (_blog_json_calc.get("top_recommendation") or "")[:500] or None,
    }))).data

    new_scan_id = inserted[0]["id"] if (inserted and inserted[0]) else None
    _cache.delete(f"sentiment:{business_id}")

    # ── v3.1 Shadow 점수 계산 + scan_results v31 컬럼 업데이트 ─────────────
    if new_scan_id:
        try:
            from services.score_engine import calc_shadow_v3_1 as _calc_shadow_v31
            _shadow = _calc_shadow_v31(
                scan_result=results,
                biz=biz or {},
                naver_data=naver_data or {},
                keyword_coverage_rate=_stream_kw_rate,
            )
            await execute(
                supabase.table("scan_results").update({
                    "track1_score_v31": _shadow["track1_score_v31"],
                    "unified_score_v31": _shadow["unified_score_v31"],
                    "user_group_v31": _shadow["user_group_v31"],
                }).eq("id", new_scan_id)
            )
        except Exception as _sh_err:
            _logger.warning(
                f"[scan] v3.1 shadow 저장 실패 biz={business_id}: {_sh_err}"
            )
    # ─────────────────────────────────────────────────────────────────────────

    # ai_citations 저장 (언급 여부 관계없이 모든 플랫폼 저장)
    if new_scan_id:
        # INACTIVE 업종은 naver 인용 저장 안 함 — GET 필터와 이중 방어
        from services.score_engine import get_briefing_eligibility as _get_elig
        _biz_category = (biz or {}).get("category") or "other"
        _biz_franchise = bool((biz or {}).get("is_franchise"))
        _biz_eligibility = _get_elig(_biz_category, _biz_franchise)

        citation_rows = []
        for key, label in _PLATFORM_LABELS.items():
            r = results.get(key) or {}
            if not r:
                continue
            # INACTIVE 업종: naver 인용 DB 저장 생략 (잘못된 데이터 누적 방지)
            if key == "naver" and _biz_eligibility == "inactive":
                continue
            # Naver: keyword_results가 있으면 키워드별 개별 저장 (in_briefing 여부 모두)
            if key == "naver" and r.get("keyword_results"):
                for kw_r in r["keyword_results"]:
                    citation_rows.append({
                        "scan_id": new_scan_id,
                        "business_id": business_id,
                        "platform": "naver",
                        "query": kw_r.get("_query_used") or query,
                        "mentioned": bool(kw_r.get("in_briefing")),
                        "excerpt": (kw_r.get("excerpt") or "").strip()[:500],
                        "sentiment": "neutral",
                        "mention_type": "information",
                    })
            elif "mentioned" in r or "exposure_freq" in r:
                # sample_n 결과(exposure_freq) + 단일 호출(mentioned) 모두 호환
                _mentioned = bool(r.get("mentioned")) or (r.get("exposure_freq", 0) > 0)
                _excerpt_src = r.get("excerpt") or r.get("content")
                if not _excerpt_src and r.get("citations"):
                    _excerpt_src = r["citations"][0] if r["citations"] else ""
                _exc_text = (_excerpt_src or "").strip()[:500]
                citation_rows.append({
                    "scan_id": new_scan_id,
                    "business_id": business_id,
                    "platform": key,
                    "query": query,
                    "mentioned": _mentioned,
                    "excerpt": _exc_text,
                    "sentiment": r.get("sentiment") or "neutral",
                    "mention_type": r.get("mention_type") or "information",
                })
        if citation_rows:
            try:
                await execute(supabase.table("ai_citations").insert(citation_rows))
            except Exception as e:
                _logger.warning(f"ai_citations insert failed (biz={business_id}): {e}")

    # keyword_diversity 업데이트 (keywords 중 AI 결과에서 언급된 비율)
    try:
        keywords = (biz or {}).get("keywords") or []
        if keywords:
            all_text = " ".join(
                str((results.get(p) or {}).get("excerpt") or "") +
                str((results.get(p) or {}).get("content") or "")
                for p in _PLATFORM_LABELS
            ).lower()
            matched = sum(1 for kw in keywords if kw.lower() in all_text)
            diversity = round(matched / len(keywords), 2)
            await execute(supabase.table("businesses").update({"keyword_diversity": diversity}).eq("id", business_id))
    except Exception as e:
        _logger.warning(f"keyword_diversity update failed (biz={business_id}): {e}")

    # keyword_coverage → businesses.keyword_diversity 반영 (score_engine calc_review_quality에서 실제 활용)
    try:
        keyword_coverage = score.get("breakdown", {}).get("keyword_gap_score", 0.0)
        if keyword_coverage and keyword_coverage > 0:
            kd_value = round(min(1.0, keyword_coverage / 100), 4)
            await execute(
                supabase.table("businesses").update(
                    {"keyword_diversity": kd_value}
                ).eq("id", business_id)
            )
    except Exception as e:
        _logger.warning(f"keyword_diversity (coverage) update failed (biz={business_id}): {e}")

    # kakao_score 자동 저장 (카카오 가시성 결과에서 계산)
    if kakao_data and isinstance(kakao_data, dict):
        try:
            _ks = 0
            if kakao_data.get("mentioned"):
                _ks += 25
            if kakao_data.get("has_hours"):
                _ks += 15
            if kakao_data.get("has_phone"):
                _ks += 15
            if kakao_data.get("has_photos"):
                _ks += 20
            if _ks > 0:
                await execute(
                    supabase.table("businesses").update({"kakao_score": min(100, _ks)}).eq("id", business_id)
                )
        except Exception as e:
            _logger.warning(f"kakao_score update failed (biz={business_id}): {e}")

    # score_history upsert
    # [2026-05-01] score_breakdown JSONB 추가 — score-attribution 정밀도 강화용.
    # ALTER 미실행 시 graceful fallback: 컬럼 미존재 오류 감지 후 score_breakdown 제외 재시도.
    _sh_payload = {
        "business_id": business_id,
        "score_date": str(_date.today()),
        "total_score": score["total_score"],
        "exposure_freq": (results.get("gemini") or {}).get("exposure_freq", 0),
        "sample_size": (results.get("gemini") or {}).get("sample_size") or 50,
        "rank_in_category": 0,
        "total_in_category": 0,
        "weekly_change": weekly_change,
        "naver_channel_score": score.get("naver_channel_score"),
        "global_channel_score": score.get("global_channel_score"),
        "unified_score": score.get("unified_score"),
        "track1_score": score.get("track1_score"),
        "track2_score": score.get("track2_score"),
        "score_breakdown": score.get("breakdown"),
    }
    try:
        await execute(
            supabase.table("score_history").upsert(_sh_payload, on_conflict="business_id,score_date")
        )
    except Exception as e:
        if "score_breakdown" in str(e) or "sample_size" in str(e):
            _logger.warning(f"score_history 신규 컬럼 미존재 — fallback 저장 (biz={business_id}): {e}")
            _sh_payload.pop("score_breakdown", None)
            _sh_payload.pop("sample_size", None)
            try:
                await execute(
                    supabase.table("score_history").upsert(_sh_payload, on_conflict="business_id,score_date")
                )
            except Exception as e2:
                _logger.warning(f"score_history upsert fallback failed (biz={business_id}): {e2}")
        else:
            _logger.warning(f"score_history upsert failed (biz={business_id}): {e}")

    # 블로그 언급 수 → businesses.blog_mention_count 저장 (스트림 스캔 경로)
    try:
        _blog_mentions_stream = int((naver_data or {}).get("blog_mentions") or 0)
        if _blog_mentions_stream > 0:
            await execute(
                supabase.table("businesses").update({
                    "blog_mention_count": _blog_mentions_stream,
                }).eq("id", business_id)
            )
            _logger.info(f"blog_mention_count updated (stream) [{business_id}]: {_blog_mentions_stream}")
    except Exception as e:
        _logger.warning(f"blog_mention_count update failed (stream biz={business_id}): {e}")

    # review_snapshots 저장 (리뷰 시계열)
    review_count_snap = (biz or {}).get("review_count")
    avg_rating_snap   = (biz or {}).get("avg_rating")
    if review_count_snap is not None:
        try:
            await execute(supabase.table("review_snapshots").insert({
                "business_id": business_id,
                "review_count": review_count_snap,
                "avg_rating": avg_rating_snap,
            }))
        except Exception as e:
            _logger.warning(f"review_snapshots insert failed (stream biz={business_id}): {e}")

    # rank_in_category 계산 (score_history upsert 후) — 카테고리 내 전 사업장 최신 점수 기준
    try:
        if biz:
            rank_in_category, total_in_category = await _calc_rank_in_category(
                supabase, biz.get("category", ""), business_id, score["total_score"],
            )
            await execute(
                supabase.table("score_history").update({
                    "rank_in_category": rank_in_category,
                    "total_in_category": total_in_category,
                }).eq("business_id", business_id).eq("score_date", str(_date.today()))
            )
    except Exception as e:
        _logger.warning(f"rank_in_category update failed (stream biz={business_id}): {e}")

    # 스캔 완료 즉시 카카오톡 알림 (kakao_scan_notify 설정 ON + 전화번호 있는 경우만)
    try:
        biz_user_id = (biz or {}).get("user_id")
        if biz_user_id:
            profile = (
                await execute(
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("user_id", biz_user_id)
                    .maybe_single()
                )
            ).data
            phone = (profile or {}).get("phone")
            notify_on = (profile or {}).get("kakao_scan_notify", False)
            if phone and notify_on:
                mention_platforms = [
                    ("Gemini", (results.get("gemini") or {}).get("mentioned", False)),
                    ("ChatGPT", (results.get("chatgpt") or {}).get("mentioned", False)),
                    ("네이버 AI", (results.get("naver") or {}).get("mentioned", False)),
                    ("Claude", (results.get("claude") or {}).get("mentioned", False)),
                ]
                top_platform = next((n for n, m in mention_platforms if m), "없음")
                top_improvement = "개선 가이드 생성을 통해 AI 노출을 높이세요"

                from services.kakao_notify import KakaoNotifier
                notifier = KakaoNotifier()
                import asyncio as _aio
                _aio.create_task(notifier.send_scan_complete(
                    phone=phone,
                    biz_name=(biz or {}).get("name", ""),
                    score=score["total_score"],
                    grade=score["grade"],
                    weekly_change=weekly_change,
                    top_platform=top_platform,
                    top_improvement=top_improvement,
                ))
    except Exception as e:
        _logger.warning(f"kakao scan_complete notify failed (biz={business_id}): {e}")

    # ── 느린 백그라운드 enrich (fire-and-forget) ────────────────────────────
    if new_scan_id:
        _asyncio.ensure_future(_enrich_scan_background(
            scan_id=new_scan_id,
            business_id=business_id,
            biz=biz,
            query=query,
            naver_place_url=naver_place_url,
            req=req,
            score=score,
            results=results,
            competitors=competitors,
            weekly_change=weekly_change,
            selected_keyword=_selected_kw,
        ))


async def _enrich_scan_background(
    scan_id: str,
    business_id: str,
    biz: dict,
    query: str,
    naver_place_url: str,
    req: ScanRequest,
    score: dict,
    results: dict,
    competitors: list,
    weekly_change: float,
    selected_keyword: str = "",
):
    """느린 백그라운드 enrich — smart_place Playwright + competitor Gemini + query_exposure
    scan_results / scan_analytics 테이블을 UPDATE (빠른 경로 INSERT 완료 후 실행)
    """
    import asyncio as _asyncio
    from services.ai_scanner.gemini_scanner import GeminiScanner

    _selected_kw = (selected_keyword or "").strip()
    supabase = get_client()

    # ── 1. smart_place Playwright 체크 ────────────────────────────────────────
    smart_place_check = None
    if naver_place_url:
        try:
            from services.naver_place_stats import check_smart_place_completeness
            smart_place_check = await check_smart_place_completeness(naver_place_url)
        except Exception as e:
            _logger.warning(f"smart_place_completeness failed (bg biz={business_id}): {e}")

    if smart_place_check and not smart_place_check.get("error"):
        try:
            _sp_update_payload: dict = {"smart_place_completeness_result": smart_place_check}
            _pc = smart_place_check.get("photo_categories")
            if _pc is not None:
                _sp_update_payload["photo_categories"] = _pc
            await execute(
                supabase.table("scan_results").update(_sp_update_payload).eq("id", scan_id)
            )
        except Exception as e:
            _logger.warning(f"smart_place UPDATE failed (bg scan_id={scan_id}): {e}")
        try:
            from datetime import datetime, timezone as _tz
            _bg_biz_update: dict = {
                "smart_place_auto_checked_at": datetime.now(_tz.utc).isoformat(),
            }
            if smart_place_check.get("recent_post_measured"):
                _bg_biz_update["has_recent_post"] = smart_place_check["has_recent_post"]
            if smart_place_check.get("intro_measured"):
                _bg_biz_update["has_intro"] = smart_place_check["has_intro"]
            await execute(
                supabase.table("businesses").update(_bg_biz_update).eq("id", business_id)
            )
        except Exception as e:
            _logger.warning(f"smart_place_auto_checked_at update failed (bg): {e}")

    # ── 1.5 네이버 플레이스 통계 동기화 (review_count/avg_rating 자동 갱신) ─────
    naver_place_id_bg = (biz or {}).get("naver_place_id", "") or ""
    # naver_place_id 없으면 naver_place_url에서 숫자 ID 추출 시도
    if not naver_place_id_bg:
        import re as _re_bg
        _place_url_bg = (biz or {}).get("naver_place_url", "") or ""
        _m_bg = _re_bg.search(r"place/(\d+)", _place_url_bg)
        if _m_bg:
            naver_place_id_bg = _m_bg.group(1)
    if naver_place_id_bg:
        try:
            from services.naver_place_stats import sync_naver_place_stats as _sync_bg
            await _sync_bg(business_id, naver_place_id_bg)
        except Exception as e:
            _logger.warning(f"sync_naver_place_stats failed (bg biz={business_id}): {e}")

    # ── 1.6 블로그 언급 수 → businesses.blog_mention_count 저장 ────────────
    # 경쟁사와 동일한 측정 방식(업체명+지역 단독 쿼리)으로 정규화해 저장
    # → _advantage_lists 비교 시 측정 기준 일치 보장
    try:
        from services.competitor_place_crawler import fetch_competitor_blog_mentions as _fetch_blog_norm
        _biz_name_bg = (biz or {}).get("name", "")
        _biz_region_bg = (biz or {}).get("region", "")
        _blog_normalized_bg = 0
        if _biz_name_bg:
            _blog_normalized_bg = await _fetch_blog_norm(_biz_name_bg, _biz_region_bg)
        # fallback: naver_visibility multi-query 결과 사용
        if not _blog_normalized_bg:
            _naver_res_bg = results.get("naver") or {}
            _blog_normalized_bg = int(_naver_res_bg.get("blog_mentions") or 0)
        if _blog_normalized_bg > 0:
            await execute(
                supabase.table("businesses").update({
                    "blog_mention_count": _blog_normalized_bg,
                }).eq("id", business_id)
            )
            _logger.info(f"blog_mention_count updated (normalized) [{business_id}]: {_blog_normalized_bg}")
    except Exception as e:
        _logger.warning(f"blog_mention_count update failed (bg biz={business_id}): {e}")

    # ── 2. competitor Gemini 스캔 ──────────────────────────────────────────────
    competitor_scores: dict = {}
    if competitors:
        try:
            gemini = GeminiScanner()
            comp_results = await _asyncio.gather(
                *[gemini.single_check_with_competitors(query, c["name"]) for c in competitors],
                return_exceptions=True,
            )
            for comp, result in zip(competitors, comp_results):
                if isinstance(result, Exception):
                    _logger.warning(f"competitor scan failed for {comp['name']}: {result}")
                    continue
                mentioned = bool(result.get("mentioned") or result.get("exposure_freq", 0) > 0)
                excerpt = result.get("excerpt") or ""
                exposure_freq = result.get("exposure_freq", 0) or 0
                # 결정적 점수: AI 노출 빈도 + 언급 여부 + 발췌문 상세도
                if mentioned:
                    excerpt_len = len(excerpt) if excerpt else 0
                    freq_bonus = min(20, exposure_freq * 2)  # 노출 빈도 보너스 (최대 20)
                    if excerpt_len > 100:
                        base_score = round(min(80, 55 + freq_bonus), 1)  # 구체적 언급
                    else:
                        base_score = round(min(65, 40 + freq_bonus), 1)  # 단순 언급
                else:
                    base_score = 15.0  # 미언급 고정
                breakdown = {
                    "keyword_gap_score": round(base_score * 1.05, 1),
                    "review_quality": round(base_score * 0.9, 1),
                    "smart_place_completeness": round(base_score, 1),
                    "naver_exposure_confirmed": round(base_score * 1.1 if mentioned else 5.0, 1),
                    "multi_ai_exposure": round(base_score * 0.8, 1),
                    "schema_seo": round(base_score * 0.85, 1),
                    "online_mentions_t2": round(base_score * 0.75, 1),
                    "google_presence": round(base_score * 0.7, 1),
                }
                competitor_scores[comp["id"]] = {
                    "name": comp["name"],
                    "mentioned": mentioned,
                    "score": base_score,
                    "excerpt": excerpt,
                    "breakdown": breakdown,
                }
        except Exception as e:
            _logger.warning(f"competitor_scores scan failed (bg biz={business_id}): {e}")

    if competitor_scores:
        try:
            await execute(
                supabase.table("scan_results").update({
                    "competitor_scores": competitor_scores,
                }).eq("id", scan_id)
            )
        except Exception as e:
            _logger.warning(f"competitor_scores UPDATE failed (bg scan_id={scan_id}): {e}")

        # competitor_snapshots INSERT (익명화)
        if biz:
            comp_rows = []
            for comp_id, comp_data in competitor_scores.items():
                comp_rows.append({
                    "category": (biz or {}).get("category", req.category),
                    "region": (biz or {}).get("region", req.region),
                    "mentioned": bool(comp_data.get("mentioned")),
                    "score": int(comp_data["score"]) if comp_data.get("score") is not None else None,
                    "review_count": None,
                    "avg_rating": None,
                })
            if comp_rows:
                try:
                    await execute(supabase.table("competitor_snapshots").insert(comp_rows))
                except Exception as e:
                    _logger.warning(f"competitor_snapshots insert failed (bg biz={business_id}): {e}")

    # ── 2.5 AI 검색 화면 스크린샷 캡처 (백그라운드) ────────────────────────────
    try:
        from services.ai_search_screenshot import capture_ai_search_results as _capture_ai_ss
        _biz_name_ss = (biz or {}).get("name", req.business_name)
        _biz_cat_ss = (biz or {}).get("category", req.category) or ""
        _biz_reg_ss = (biz or {}).get("region", req.region) or ""
        _biz_kws_ss = (biz or {}).get("keywords") or []
        if _biz_name_ss and _biz_reg_ss:
            ai_screenshots = await _capture_ai_ss(
                business_name=_biz_name_ss,
                category=_biz_cat_ss,
                region=_biz_reg_ss,
                biz_id=business_id,
                keywords=_biz_kws_ss or None,
                selected_keyword=_selected_kw or None,
            )
            # Gemini + ChatGPT 듀얼 측정 결과 주입 (스캔 완료 결과 재사용, 추가 API 호출 없음)
            _gemini_r  = results.get("gemini")  or {}
            _chatgpt_r = results.get("chatgpt") or {}
            _g_ok = isinstance(_gemini_r,  dict) and not _gemini_r.get("error")
            _c_ok = isinstance(_chatgpt_r, dict) and not _chatgpt_r.get("error")
            if _g_ok or _c_ok:
                _g_freq   = int(_gemini_r.get("exposure_freq")  or 0) if _g_ok else 0
                _c_freq   = int(_chatgpt_r.get("exposure_freq") or 0) if _c_ok else 0
                _g_sample = int(_gemini_r.get("sample_size")    or 50) if _g_ok else 0
                _c_sample = int(_chatgpt_r.get("sample_size")   or 50) if _c_ok else 0
                # chatgpt(1회) 항목은 제거하고 50회 샘플 합산 결과로 교체
                ai_screenshots = [s for s in ai_screenshots if s.get("platform") != "chatgpt"]
                ai_screenshots.append({
                    "platform": "gemini",
                    "query": query,
                    "is_mentioned": bool(
                        (_gemini_r.get("mentioned") if _g_ok else False)
                        or (_chatgpt_r.get("mentioned") if _c_ok else False)
                    ),
                    "exposure_freq": _g_freq + _c_freq,
                    "sample_size":   _g_sample + _c_sample,
                    "url": None,
                    "captured_at": datetime.today().date().isoformat(),
                    "label": "Gemini·ChatGPT 듀얼" if (_g_ok and _c_ok) else ("Gemini AI" if _g_ok else "ChatGPT"),
                })
            if ai_screenshots:
                await execute(
                    supabase.table("scan_results").update({
                        "ai_search_screenshots": ai_screenshots,
                    }).eq("id", scan_id)
                )
    except Exception as e:
        _logger.warning(f"ai_search_screenshots failed (bg biz={business_id}): {e}")

    # ── 3. query_exposure Gemini 3회 추가 호출 ────────────────────────────────
    query_exposure = {
        "recommend": bool((results.get("gemini") or {}).get("mentioned")),
    }
    try:
        from services.ai_scanner.gemini_scanner import GeminiScanner as _GeminiQD
        gemini_qd = _GeminiQD()
        biz_name_qd = (biz or {}).get("name", req.business_name)
        keyword_ko_qd = _CATEGORY_KO.get((biz or {}).get("category", req.category), req.category)
        qd_results = await _asyncio.gather(
            gemini_qd.single_check(f"{keyword_ko_qd} 예약", biz_name_qd),
            gemini_qd.single_check(f"근처 {keyword_ko_qd}", biz_name_qd),
            gemini_qd.single_check(f"{keyword_ko_qd} 맛집", biz_name_qd),
            return_exceptions=True,
        )
        query_exposure["reservation"] = bool(not isinstance(qd_results[0], Exception) and (qd_results[0] or {}).get("mentioned"))
        query_exposure["nearby"]      = bool(not isinstance(qd_results[1], Exception) and (qd_results[1] or {}).get("mentioned"))
        query_exposure["best"]        = bool(not isinstance(qd_results[2], Exception) and (qd_results[2] or {}).get("mentioned"))
    except Exception as e:
        _logger.warning(f"query_exposure scan failed (bg biz={business_id}): {e}")

    # ── 4. scan_analytics INSERT (익명화 통계) ────────────────────────────────
    comp_list = list(competitor_scores.values()) if competitor_scores else []
    comp_mentioned = [c for c in comp_list if c.get("mentioned")]
    comp_avg = round(sum(c.get("score", 0) for c in comp_list) / len(comp_list), 2) if comp_list else None
    comp_gap = round(score.get("unified_score", 0) - comp_avg, 2) if comp_avg is not None else None
    try:
        platform_mentioned = {
            label: bool((results.get(key) or {}).get("mentioned"))
            for key, label in _PLATFORM_LABELS.items()
        }
        review_count_snap = (biz or {}).get("review_count")
        avg_rating_snap   = (biz or {}).get("avg_rating")
        await execute(supabase.table("scan_analytics").insert({
            "scan_type": "full",
            "category": (biz or {}).get("category", req.category),
            "region": (biz or {}).get("region", req.region),
            "track1_score": score.get("track1_score"),
            "track2_score": score.get("track2_score"),
            "unified_score": score.get("unified_score"),
            "naver_weight": score.get("naver_weight"),
            "global_weight": score.get("global_weight"),
            "growth_stage": score.get("growth_stage"),
            "top_missing_keywords": score.get("top_missing_keywords") or [],
            "keyword_coverage": score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100,
            "platform_mentioned": platform_mentioned,
            "smart_place_score": score.get("breakdown", {}).get("smart_place_completeness"),
            "competitor_count": len(comp_list),
            "competitor_mentioned_count": len(comp_mentioned),
            "competitor_avg_score": comp_avg,
            "my_vs_competitor_gap": comp_gap,
            "query_exposure": query_exposure,
            "review_count": review_count_snap,
            "avg_rating": avg_rating_snap,
        }))
    except Exception as e:
        _logger.warning(f"scan_analytics insert failed (bg full biz={business_id}): {e}")


async def _run_quick_scan(scan_id: str, req: ScanRequest):
    """백그라운드 quick scan 실행 — Gemini(10회) + 네이버
    수동 스캔 전 플랜 공통 경로 (biz 포함), 자동 스캔은 _run_full_scan 사용
    비용: ~3원/회
    """
    import asyncio as _asyncio
    from datetime import date as _date

    try:
        scanner = MultiAIScanner(mode="full")

        supabase = get_client()
        biz = (await execute(
            supabase.table("businesses")
            .select("id, name, category, region, business_type, website_url, naver_place_url, keywords, review_count, avg_rating, keyword_diversity")
            .eq("id", req.business_id)
            .single()
        )).data

        # 쿼리 생성: DB 등록 키워드 우선, 없으면 카테고리 한글명 (실제 고객 검색 패턴)
        _quick_biz_keywords = (biz or {}).get("keywords") or req.keywords or []
        _quick_valid_kw = [k.strip() for k in _quick_biz_keywords if k.strip() and len(k.strip()) >= 2]
        _quick_keyword_ko = _CATEGORY_KO.get((biz or {}).get("category", req.category), req.category)
        _quick_region = (biz or {}).get("region") or req.region or ""
        if _quick_valid_kw:
            query = f"{_quick_region} {_quick_valid_kw[0]} 추천" if _quick_region else f"{_quick_valid_kw[0]} 추천"
        else:
            query = f"{_quick_region} {_quick_keyword_ko} 추천" if _quick_region else f"{_quick_keyword_ko} 추천"

        # naver_prescan 당일 결과 조회 (GitHub Actions 야간 스캔 재사용 → 프록시 소진 방지)
        _prescan_naver_q: dict = {}
        try:
            _ps_q = supabase.table("naver_prescan").select("naver_result").eq(
                "business_id", req.business_id
            ).eq("scan_date", str(_date.today())).execute()
            if _ps_q and _ps_q.data:
                _prescan_naver_q = _ps_q.data[0].get("naver_result") or {}
                if _prescan_naver_q:
                    _logger.debug("[scan/quick] naver prescan 재사용 biz=%s", req.business_id)
        except Exception as _pe_q:
            _logger.debug("[scan/quick] naver_prescan 조회 실패 (무시): %s", _pe_q)

        result = await scanner.scan_quick(query, req.business_name)

        # prescan 결과가 있으면 덮어쓰기
        if _prescan_naver_q:
            result["naver"] = _prescan_naver_q

        # 카카오·웹사이트 결과 없이 점수 계산 (quick scan은 2개 AI만)
        from services.naver_visibility import get_naver_visibility_multi as _naver_multi_q
        try:
            _quick_multi_kws = list(dict.fromkeys(_quick_valid_kw[:3] + [_quick_keyword_ko]))[:4]
            naver_data = await _naver_multi_q(req.business_name, _quick_multi_kws, _quick_region or req.region or "", category_ko=_quick_keyword_ko)
        except Exception as e:
            _logger.warning(f"naver_visibility failed (quick): {e}")
            naver_data = {}

        combined_result = {**result}
        score = calculate_score(combined_result, biz or {}, naver_data=naver_data or {})

        prev_history = (
            await execute(
                supabase.table("score_history")
                .select("total_score")
                .eq("business_id", req.business_id)
                .order("score_date", desc=True)
                .limit(1)
            )
        ).data
        weekly_change = round(
            score["total_score"] - prev_history[0]["total_score"], 2
        ) if prev_history else 0.0

        await execute(
            supabase.table("scan_results").insert({
                "id": scan_id,
                "business_id": req.business_id,
                "query_used": query,
                "gemini_result": result.get("gemini"),
                "chatgpt_result": result.get("chatgpt"),
                "naver_result": result.get("naver"),
                "exposure_freq": (result.get("gemini") or {}).get("exposure_freq", 0),
                "total_score": score["total_score"],
                "score_breakdown": score["breakdown"],
                "naver_channel_score": score.get("naver_channel_score"),
                "global_channel_score": score.get("global_channel_score"),
                "unified_score": score.get("unified_score"),
                "track1_score": score.get("track1_score"),
                "track2_score": score.get("track2_score"),
                "keyword_coverage": score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100,
            })
        )

        # score_history upsert (score_breakdown 포함, 미존재 시 graceful fallback)
        _sh_payload_full = {
            "business_id": req.business_id,
            "score_date": str(_date.today()),
            "total_score": score["total_score"],
            "exposure_freq": (result.get("gemini") or {}).get("exposure_freq", 0),
            "sample_size": (result.get("gemini") or {}).get("sample_size") or 50,
            "rank_in_category": 0,
            "total_in_category": 0,
            "weekly_change": weekly_change,
            "naver_channel_score": score.get("naver_channel_score"),
            "global_channel_score": score.get("global_channel_score"),
            "unified_score": score.get("unified_score"),
            "track1_score": score.get("track1_score"),
            "track2_score": score.get("track2_score"),
            "score_breakdown": score.get("breakdown"),
        }
        try:
            await execute(
                supabase.table("score_history").upsert(_sh_payload_full, on_conflict="business_id,score_date")
            )
        except Exception as _sh_err:
            if "score_breakdown" in str(_sh_err) or "sample_size" in str(_sh_err):
                _logger.warning(f"score_history 신규 컬럼 미존재 — fallback 저장 (quick): {_sh_err}")
                _sh_payload_full.pop("score_breakdown", None)
                _sh_payload_full.pop("sample_size", None)
                try:
                    await execute(
                        supabase.table("score_history").upsert(_sh_payload_full, on_conflict="business_id,score_date")
                    )
                except Exception as _sh_err2:
                    _logger.warning(f"score_history full-scan fallback failed: {_sh_err2}")
            else:
                _logger.warning(f"score_history full-scan upsert failed (biz={req.business_id}): {_sh_err}")

        _cache.delete(f"sentiment:{req.business_id}")

    except Exception as e:
        _logger.error(f"Quick scan failed (biz={req.business_id}): {e}")


async def _auto_generate_guide(business_id: str, scan_id: str) -> None:
    """풀스캔 완료 후 가이드 자동 생성 백그라운드 태스크.

    - 오늘 날짜에 이미 가이드가 생성된 경우 스킵 (중복 방지)
    - 실패해도 예외를 전파하지 않음 (메인 스캔 결과에 영향 없음)
    """
    try:
        from datetime import date
        from models.schemas import GuideRequest
        from routers.guide import _generate_and_save

        supabase = get_client()

        # 오늘 이미 가이드가 생성됐으면 스킵
        today_start = date.today().isoformat() + "T00:00:00"
        existing = await execute(
            supabase.table("guides")
            .select("id", count="exact")
            .eq("business_id", business_id)
            .gte("generated_at", today_start)
        )
        if existing.count and existing.count > 0:
            _logger.info(f"Auto guide skipped (already generated today): biz={business_id}")
            return

        guide_req = GuideRequest(business_id=business_id, scan_id=scan_id)
        await _generate_and_save(guide_req)
        _logger.info(f"Auto guide generated: scan_id={scan_id}")
    except Exception as e:
        _logger.warning(f"Auto guide generation failed (biz={business_id}, scan={scan_id}): {e}")


async def _run_full_scan(scan_id: str, req: ScanRequest):
    """백그라운드 전체 스캔 실행"""
    import asyncio as _asyncio
    from datetime import date as _date
    from services.ai_scanner.gemini_scanner import GeminiScanner
    from services.kakao_visibility import get_kakao_visibility
    from services.website_checker import check_website_seo

    try:
        scanner = MultiAIScanner(mode="full")

        supabase = get_client()
        biz = (await execute(supabase.table("businesses").select("id, name, category, region, business_type, website_url, naver_place_url, keywords, naver_place_id, google_place_id, kakao_place_id, review_count, avg_rating, keyword_diversity, receipt_review_count, has_faq, has_recent_post, has_intro, review_sample, blog_keyword_coverage, blog_analysis_json, blog_latest_post_date, blog_analyzed_at").eq("id", req.business_id).single())).data

        # AI 스캔 + 카카오 가시성 + 웹사이트 SEO + 스마트플레이스 병렬 실행
        keyword_ko = _CATEGORY_KO.get((biz or {}).get("category", req.category), req.category)

        # 쿼리 생성: 짧은 변형 + 긴 자연어 질의(롱테일 2.5배 대응) 단일 소스
        _full_biz_keywords = (biz or {}).get("keywords") or req.keywords or []
        _full_valid_kw = [k.strip() for k in _full_biz_keywords if k.strip() and len(k.strip()) >= 2]
        _full_region = (biz or {}).get("region") or req.region or ""
        _primary_kw = _full_valid_kw[0] if _full_valid_kw else keyword_ko
        _scan_queries = _build_ai_scan_queries(_full_region, _primary_kw)
        query = _scan_queries[0]  # Playwright·네이버 단일 쿼리용 (짧은 쿼리 유지)
        naver_place_url = (biz or {}).get("naver_place_url", "") or ""
        naver_place_id_biz = (biz or {}).get("naver_place_id", "") or ""
        if not naver_place_url and naver_place_id_biz:
            naver_place_url = f"https://map.naver.com/p/entry/place/{naver_place_id_biz}"
        from services.naver_place_stats import check_smart_place_completeness, sync_naver_place_stats as _sync_place_stats
        from services.naver_visibility import get_naver_visibility_multi as _naver_multi_f
        _full_multi_kws = list(dict.fromkeys(_full_valid_kw[:3] + [keyword_ko]))[:4]

        # naver_prescan 당일 결과 조회 (GitHub Actions 야간 스캔 재사용 → 프록시 소진 방지)
        _prescan_naver_f: dict = {}
        try:
            _ps_f = supabase.table("naver_prescan").select("naver_result").eq(
                "business_id", req.business_id
            ).eq("scan_date", str(_date.today())).execute()
            if _ps_f and _ps_f.data:
                _prescan_naver_f = _ps_f.data[0].get("naver_result") or {}
                if _prescan_naver_f:
                    _logger.debug("[scan/full] naver prescan 재사용 biz=%s", req.business_id)
        except Exception as _pe_f:
            _logger.debug("[scan/full] naver_prescan 조회 실패 (무시): %s", _pe_f)

        result, kakao_data, website_check, smart_place_check, naver_visibility_full, place_stats_fresh = await _asyncio.gather(
            scanner.scan_all(_scan_queries, req.business_name),
            get_kakao_visibility(req.business_name, keyword_ko, req.region),
            check_website_seo((biz or {}).get("website_url", "")),
            check_smart_place_completeness(naver_place_url) if naver_place_url else _asyncio.sleep(0),
            _naver_multi_f(req.business_name, _full_multi_kws, (biz or {}).get("region") or req.region or "", category_ko=keyword_ko),
            _sync_place_stats(req.business_id, naver_place_id_biz) if naver_place_id_biz else _asyncio.sleep(0),
            return_exceptions=True,
        )
        if isinstance(result, Exception):
            raise result
        # prescan 결과가 있으면 scan_all의 naver 결과 덮어쓰기
        if _prescan_naver_f:
            result["naver"] = _prescan_naver_f
        if isinstance(kakao_data, Exception):
            _logger.warning(f"kakao_visibility failed (full): {kakao_data}")
            kakao_data = None
        if isinstance(website_check, Exception):
            _logger.warning(f"website_checker failed (full): {website_check}")
            website_check = None
        if isinstance(smart_place_check, Exception):
            _logger.warning(f"smart_place_completeness failed (full): {smart_place_check}")
            smart_place_check = None
        elif not naver_place_url:
            smart_place_check = None
        if isinstance(naver_visibility_full, Exception):
            _logger.warning(f"naver_visibility failed (full): {naver_visibility_full}")
            naver_visibility_full = {}
        # 최신 리뷰 수·평점으로 biz 딕셔너리 갱신 (점수 계산에 즉시 반영)
        if isinstance(place_stats_fresh, dict) and not place_stats_fresh.get("error"):
            if place_stats_fresh.get("review_count") is not None:
                biz = {**(biz or {}), "review_count": place_stats_fresh["review_count"]}
            if place_stats_fresh.get("avg_rating"):
                biz = {**biz, "avg_rating": place_stats_fresh["avg_rating"]}
        # SmartPlace 체크 결과를 biz에 즉시 반영 — DB 업데이트(하단) 전에 점수 계산이 먼저 실행되므로
        # has_recent_post/has_intro를 여기서 병합해야 스캔 시점 실측값이 점수에 반영된다
        if isinstance(smart_place_check, dict) and not smart_place_check.get("error"):
            if "has_recent_post" in smart_place_check:
                biz = {**(biz or {}), "has_recent_post": smart_place_check["has_recent_post"]}
            if "has_intro" in smart_place_check:
                biz = {**biz, "has_intro": smart_place_check["has_intro"]}

        # AI탭 스캔 (P2 — NAVER_AI_TAB_ENABLED=true 시 실행, 별도 세마포어 _AI_TAB_SEMAPHORE)
        from services.ai_scanner import naver_ai_tab_scanner as _naver_ai_tab
        _ai_tab_visible: "bool | None" = None
        _ai_tab_excerpt: "str | None" = None
        if await _naver_ai_tab._get_ai_tab_enabled():
            try:
                _ai_tab_res = await _naver_ai_tab.scan_batch(_scan_queries[:2], req.business_name)
                if _ai_tab_res:
                    # tab_available=True(AI탭 섹션 DOM 존재) 인 경우만 visible로 인정
                    # body fallback(tab_available=False)만으로 mentioned=True 시 거짓 양성 방지
                    _ai_tab_visible = any(
                        bool((r or {}).get("mentioned")) and bool((r or {}).get("tab_available"))
                        for r in _ai_tab_res.values()
                    )
                    _ai_tab_excerpt = next(
                        ((r or {}).get("excerpt") for r in _ai_tab_res.values()
                         if (r or {}).get("excerpt") and (r or {}).get("tab_available")),
                        None,
                    )
            except Exception as _e_tab:
                _logger.warning(f"naver_ai_tab scan_batch failed (full biz={req.business_id}): {_e_tab}")

        # naver_data: naver_visibility_multi 결과 + AI 브리핑 스캔 결과 병합
        naver_scanner_result_full = result.get("naver") or {}
        naver_data_full = {**(naver_visibility_full if isinstance(naver_visibility_full, dict) else {}), **naver_scanner_result_full}

        # 카카오·웹사이트 결과를 병합해 채널 점수 계산
        combined_result = {**result, "kakao": kakao_data or {}, "website_check": website_check or {}}
        # 블로그 covered 키워드를 biz에 병합해 score_engine cold start 개선
        _blog_json_full = (biz or {}).get("blog_analysis_json") or {}
        _blog_covered_full = (_blog_json_full.get("keyword_coverage") or {}).get("present") or []
        if isinstance(_blog_covered_full, list) and _blog_covered_full:
            biz = {**(biz or {}), "blog_covered_keywords": " ".join(_blog_covered_full)}
        _blog_kw_cov_full = float((biz or {}).get("blog_keyword_coverage") or 0)
        _full_kw_rate = _blog_kw_cov_full / 100 if _blog_kw_cov_full >= 10 else None
        score = calculate_score(combined_result, biz or {}, naver_data=naver_data_full, keyword_coverage_rate=_full_kw_rate)

        # weekly_change 계산 (이전 score_history 기준)
        prev_history = (
            await execute(
                supabase.table("score_history")
                .select("total_score")
                .eq("business_id", req.business_id)
                .order("score_date", desc=True)
                .limit(1)
            )
        ).data
        weekly_change = round(
            score["total_score"] - prev_history[0]["total_score"], 2
        ) if prev_history else 0.0

        # 경쟁사 단일 스캔으로 competitor_scores 계산
        competitors = (
            await execute(
                supabase.table("competitors")
                .select("id, name")
                .eq("business_id", req.business_id)
                .eq("is_active", True)
            )
        ).data or []
        competitor_scores: dict = {}
        if competitors:
            try:
                gemini = GeminiScanner()
                comp_results = await _asyncio.gather(
                    *[gemini.single_check_with_competitors(query, c["name"]) for c in competitors],
                    return_exceptions=True,
                )
                for comp, r in zip(competitors, comp_results):
                    if isinstance(r, Exception):
                        _logger.warning(f"competitor scan failed for {comp['name']}: {r}")
                        continue
                    mentioned = bool(r.get("mentioned") or r.get("exposure_freq", 0) > 0)
                    excerpt = r.get("excerpt") or ""
                    base_score = 55.0 if mentioned else 15.0
                    breakdown = {
                        "keyword_gap_score": round(base_score * 1.05, 1),
                        "review_quality": round(base_score * 0.9, 1),
                        "smart_place_completeness": round(base_score, 1),
                        "naver_exposure_confirmed": round(base_score * 1.1 if mentioned else 5.0, 1),
                        "multi_ai_exposure": round(base_score * 0.8, 1),
                        "schema_seo": round(base_score * 0.85, 1),
                        "online_mentions_t2": round(base_score * 0.75, 1),
                        "google_presence": round(base_score * 0.7, 1),
                    }
                    competitor_scores[comp["id"]] = {
                        "name": comp["name"],
                        "mentioned": mentioned,
                        "score": base_score,
                        "excerpt": excerpt,
                        "breakdown": breakdown,
                    }
            except Exception as e:
                _logger.warning(f"competitor_scores scan failed (full biz={req.business_id}): {e}")

        # 경쟁사별 AI 노출 현황을 competitor_snapshots에 저장 (익명화)
        if competitor_scores and biz:
            comp_rows = []
            for comp_id, comp_data in competitor_scores.items():
                comp_rows.append({
                    "category": (biz or {}).get("category", req.category),
                    "region": (biz or {}).get("region", req.region),
                    "mentioned": bool(comp_data.get("mentioned")),
                    "score": int(comp_data["score"]) if comp_data.get("score") is not None else None,
                    "review_count": None,   # 경쟁사 리뷰는 현재 Gemini 단일체크로 미수집 → None
                    "avg_rating": None,
                })
            if comp_rows:
                try:
                    await execute(supabase.table("competitor_snapshots").insert(comp_rows))
                except Exception as e:
                    _logger.warning(f"competitor_snapshots insert failed (full biz={req.business_id}): {e}")

        # 경쟁사 통계 계산 (scan_analytics용)
        comp_list_full = list(competitor_scores.values()) if competitor_scores else []
        comp_mentioned_full = [c for c in comp_list_full if c.get("mentioned")]
        comp_avg_full = round(sum(c.get("score", 0) for c in comp_list_full) / len(comp_list_full), 2) if comp_list_full else None
        comp_gap_full = round(score.get("unified_score", 0) - comp_avg_full, 2) if comp_avg_full is not None else None

        # 쿼리 다양화: 3가지 추가 의도 쿼리 노출 확인 (단일 체크, 비용 최소)
        query_exposure_full = {
            "recommend": bool((result.get("gemini") or {}).get("mentioned")),  # 기존 결과 재활용
        }
        try:
            gemini_qd_full = GeminiScanner()
            biz_name_qd_full = (biz or {}).get("name", req.business_name)
            keyword_ko_qd_full = _CATEGORY_KO.get(req.category, req.category)
            qd_results_full = await _asyncio.gather(
                gemini_qd_full.single_check(f"{keyword_ko_qd_full} 예약", biz_name_qd_full),
                gemini_qd_full.single_check(f"근처 {keyword_ko_qd_full}", biz_name_qd_full),
                gemini_qd_full.single_check(f"{keyword_ko_qd_full} 맛집", biz_name_qd_full),
                return_exceptions=True,
            )
            query_exposure_full["reservation"] = bool(not isinstance(qd_results_full[0], Exception) and (qd_results_full[0] or {}).get("mentioned"))
            query_exposure_full["nearby"]      = bool(not isinstance(qd_results_full[1], Exception) and (qd_results_full[1] or {}).get("mentioned"))
            query_exposure_full["best"]        = bool(not isinstance(qd_results_full[2], Exception) and (qd_results_full[2] or {}).get("mentioned"))
        except Exception as e:
            _logger.warning(f"query_exposure scan failed (full biz={req.business_id}): {e}")

        # 리뷰 스냅샷 변수
        review_count_snap_full = (biz or {}).get("review_count")
        avg_rating_snap_full   = (biz or {}).get("avg_rating")

        # top_missing_keywords 계산 (keyword_taxonomy)
        _full_top_missing: list[str] = []
        try:
            from services.keyword_taxonomy import analyze_keyword_coverage as _akc_full
            from services.keyword_resolver import get_user_keyword_prefs as _gkp_full
            # 등록 키워드 포함: 스마트플레이스에 등록된 키워드는 "있는 것"으로 처리
            _full_biz_kw_list = (biz or {}).get("keywords") or []
            if not isinstance(_full_biz_kw_list, list):
                _full_biz_kw_list = []
            _full_biz_kw_text = " ".join(_full_biz_kw_list)
            _full_review_text = (biz or {}).get("review_sample", "") or ""
            if not _full_review_text:
                _naver_res = result.get("naver") or {}
                _full_review_text = " ".join(str(b.get("title", "")) for b in (_naver_res.get("top_blogs") or []))
            # blog_analysis_json.keyword_coverage.present — 블로그에 실제로 존재하는 키워드는 "있는 것"으로 처리
            _blog_kw_json = (biz or {}).get("blog_analysis_json") or {}
            _blog_covered_kws = ((_blog_kw_json.get("keyword_coverage") or {}).get("present") or [])
            _full_blog_kw_text = " ".join(_blog_covered_kws) if isinstance(_blog_covered_kws, list) else ""
            _full_intro_draft = ((biz or {}).get("naver_intro_draft") or "").strip()
            # 등록 키워드 앞에 추가 (우선순위 높음)
            _full_combined_text = " ".join(filter(None, [_full_biz_kw_text, _full_review_text, _full_intro_draft, _full_blog_kw_text]))
            # 사용자 맞춤 키워드 prefs 반영
            _full_excluded_kw: list[str] = []
            _full_custom_kw: list[str] = list(_full_biz_kw_list)
            try:
                _pf = await _gkp_full(req.business_id, supabase)
                _full_excluded_kw = _pf.get("excluded") or []
                for ck in (_pf.get("custom") or []):
                    if ck and ck not in _full_custom_kw:
                        _full_custom_kw.append(ck)
            except Exception as _e:
                _logger.warning(f"full keyword_prefs lookup failed: {_e}")
            _full_kw_analysis = _akc_full(
                req.category,
                [_full_combined_text] if _full_combined_text else [],
                business_keywords=_full_custom_kw,
                excluded_keywords=_full_excluded_kw or None,
            )
            _full_missing_all = _full_kw_analysis.get("missing", [])
            # 서브카테고리 메타 빌드 (weight 순 이미 정렬돼 있음 — analyze_keyword_coverage가 보장)
            try:
                from services.keyword_taxonomy import KEYWORD_TAXONOMY as _FULL_TAX, normalize_category as _full_norm_cat
                _full_industry = _FULL_TAX.get(
                    _full_norm_cat(req.category),
                    {}
                )
                _full_kw_meta: dict[str, str] = {}
                for _sn, _sd in (_full_industry or {}).items():
                    for _k in _sd.get("keywords", []):
                        if _k not in _full_kw_meta:
                            _full_kw_meta[_k] = _sn
            except Exception as _e:
                _logger.warning("[full scan] keyword_taxonomy load failed (keyword_gap_score→0): %s", _e)
                _full_industry = {}
                _full_kw_meta = {}
            # round-robin: 서브카테고리에서 1개씩 순환 — 블록 편향 방지 (dict 삽입 순서 = weight 순)
            if _full_missing_all:
                _f_by_sub: dict[str, list[str]] = {}
                for _kw in _full_missing_all:
                    _f_by_sub.setdefault(_full_kw_meta.get(_kw, "_etc"), []).append(_kw)
                _f_div: list[str] = []
                _f_max = max(len(v) for v in _f_by_sub.values())
                for _r in range(_f_max):
                    for _sub, _lst in _f_by_sub.items():
                        if _r < len(_lst):
                            _f_div.append(_lst[_r])
                    if len(_f_div) >= 8:
                        break
                _full_missing_all = _f_div
            # 서브카테고리별 최대 2개 제한 (round-robin 이후 안전망)
            _full_subcat_count: dict[str, int] = {}
            _full_capped: list[str] = []
            for _kw in _full_missing_all:
                _sub = _full_kw_meta.get(_kw, "_etc")
                if _sub == "_etc" or _full_subcat_count.get(_sub, 0) < 2:
                    _full_capped.append(_kw)
                    if _sub != "_etc":
                        _full_subcat_count[_sub] = _full_subcat_count.get(_sub, 0) + 1
                if len(_full_capped) >= 8:
                    break
            _full_top_missing = _full_capped
        except Exception as e:
            _logger.warning(f"keyword_taxonomy failed (full): {e}")

        # naver_result에 AI탭 측정 결과 주입 — briefing_engine.simulate_ai_tab_answer()가
        # naver_result["in_ai_tab"] 키로 measured/estimated 배지를 판정하므로 필수
        _naver_result_full = {**(result.get("naver") or {})}
        if _ai_tab_visible is not None:
            _naver_result_full["in_ai_tab"] = _ai_tab_visible
        # P3 멀티채널 결과 — NAVER_MULTICH_ENABLED=true 시 naver_result에 포함 (DB 컬럼 추가 없음)
        if result.get("naver_cafe"):
            _naver_result_full["cafe_result"] = result["naver_cafe"]
        if result.get("naver_jisik"):
            _naver_result_full["jisik_result"] = result["naver_jisik"]

        await execute(
            supabase.table("scan_results").insert(
                {
                    "id": scan_id,
                    "business_id": req.business_id,
                    "query_used": query,
                    "gemini_result": result.get("gemini"),
                    "chatgpt_result": result.get("chatgpt"),
                    "naver_result": _naver_result_full,
                    "google_result": result.get("google"),
                    "kakao_result": kakao_data or None,
                    "website_check_result": website_check or None,
                    "exposure_freq": result.get("gemini", {}).get("exposure_freq", 0),
                    "total_score": score["total_score"],
                    "score_breakdown": score["breakdown"],
                    "naver_channel_score": score.get("naver_channel_score"),
                    "global_channel_score": score.get("global_channel_score"),
                    "unified_score": score.get("unified_score"),
                    "track1_score": score.get("track1_score"),
                    "track2_score": score.get("track2_score"),
                    "naver_weight": score.get("naver_weight"),
                    "global_weight": score.get("global_weight"),
                    "growth_stage": score.get("growth_stage"),
                    "growth_stage_label": score.get("growth_stage_label"),
                    "is_keyword_estimated": score.get("is_keyword_estimated", False),
                    "top_missing_keywords": _full_top_missing or [],
                    "keyword_coverage": score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100,
                    "competitor_scores": competitor_scores or None,
                    "smart_place_completeness_result": smart_place_check or None,
                    "photo_categories": (smart_place_check.get("photo_categories") if isinstance(smart_place_check, dict) else None) or None,
                    "blog_post_count": int(_blog_json_full.get("post_count") or 0) or None,
                    "blog_ai_readiness": float(_blog_json_full.get("ai_readiness_score") or 0) or None,
                    "blog_keyword_coverage": _blog_kw_cov_full or None,
                    "blog_platform": _blog_json_full.get("platform") or None,
                    "blog_top_recommendation": (_blog_json_full.get("top_recommendation") or "")[:500] or None,
                    "naver_ai_tab_visible": _ai_tab_visible,
                    "naver_ai_tab_excerpt": _ai_tab_excerpt or None,
                    "naver_reservation_linked": (smart_place_check.get("has_reservation") if isinstance(smart_place_check, dict) else None),
                }
            )
        )
        _cache.delete(f"sentiment:{req.business_id}")

        # smart_place 자동 분석 결과 DB 업데이트 (스마트플레이스 URL 있는 경우)
        if naver_place_url and smart_place_check and not smart_place_check.get("error"):
            try:
                from datetime import datetime, timezone as _tz
                sp_update: dict = {
                    "smart_place_auto_checked_at": datetime.now(_tz.utc).isoformat(),
                }
                # has_faq / has_recent_post / has_intro 동기화
                if "has_faq" in smart_place_check:
                    sp_update["has_faq"] = smart_place_check["has_faq"]
                if smart_place_check.get("recent_post_measured"):
                    sp_update["has_recent_post"] = smart_place_check["has_recent_post"]
                if smart_place_check.get("intro_measured"):
                    sp_update["has_intro"] = smart_place_check["has_intro"]
                # sp_completeness_json 전체 저장 (가이드 프롬프트에서 활용)
                try:
                    sp_update["sp_completeness_json"] = smart_place_check
                except Exception as e:
                    _logger.warning("sp_update sp_completeness_json 직렬화 실패: %s", e)
                await execute(
                    supabase.table("businesses").update(sp_update).eq("id", req.business_id)
                )
            except Exception as e:
                _logger.warning(f"smart_place update failed: {e}")

        # ai_citations 저장 (언급 여부 관계없이 모든 플랫폼 저장)
        citation_rows = []
        for key, label in _PLATFORM_LABELS.items():
            r = result.get(key) or {}
            if not r:
                continue
            # Naver: keyword_results가 있으면 키워드별 개별 저장 (in_briefing 여부 모두)
            if key == "naver" and r.get("keyword_results"):
                for kw_r in r["keyword_results"]:
                    citation_rows.append({
                        "scan_id": scan_id,
                        "business_id": req.business_id,
                        "platform": "naver",
                        "query": kw_r.get("_query_used") or query,
                        "mentioned": bool(kw_r.get("in_briefing")),
                        "excerpt": (kw_r.get("excerpt") or "").strip()[:500],
                        "sentiment": "neutral",
                        "mention_type": "information",
                    })
            elif "mentioned" in r or "exposure_freq" in r:
                # sample_n 결과(exposure_freq) + 단일 호출(mentioned) 모두 호환
                _mentioned = bool(r.get("mentioned")) or (r.get("exposure_freq", 0) > 0)
                _excerpt_src = r.get("excerpt") or r.get("content")
                if not _excerpt_src and r.get("citations"):
                    _excerpt_src = r["citations"][0] if r["citations"] else ""
                _exc_text = (_excerpt_src or "").strip()[:500]
                citation_rows.append({
                    "scan_id": scan_id,
                    "business_id": req.business_id,
                    "platform": key,
                    "query": query,
                    "mentioned": _mentioned,
                    "excerpt": _exc_text,
                    "sentiment": r.get("sentiment") or "neutral",
                    "mention_type": r.get("mention_type") or "information",
                })
        if citation_rows:
            try:
                await execute(supabase.table("ai_citations").insert(citation_rows))
            except Exception as e:
                _logger.warning(f"ai_citations insert failed (biz={req.business_id}): {e}")

        # keyword_diversity 업데이트
        try:
            keywords = (biz or {}).get("keywords") or []
            if keywords:
                all_text = " ".join(
                    str((result.get(p) or {}).get("excerpt") or "") +
                    str((result.get(p) or {}).get("content") or "")
                    for p in _PLATFORM_LABELS
                ).lower()
                matched = sum(1 for kw in keywords if kw.lower() in all_text)
                diversity = round(matched / len(keywords), 2)
                await execute(supabase.table("businesses").update({"keyword_diversity": diversity}).eq("id", req.business_id))
        except Exception as e:
            _logger.warning(f"keyword_diversity update failed (biz={req.business_id}): {e}")

        # scan_analytics 저장 (익명화 통계)
        try:
            platform_mentioned_full = {
                label: bool((result.get(key) or {}).get("mentioned"))
                for key, label in _PLATFORM_LABELS.items()
            }
            await execute(supabase.table("scan_analytics").insert({
                "scan_type": "full",
                "category": (biz or {}).get("category", req.category),
                "region": (biz or {}).get("region", req.region),
                "track1_score": score.get("track1_score"),
                "track2_score": score.get("track2_score"),
                "unified_score": score.get("unified_score"),
                "naver_weight": score.get("naver_weight"),
                "global_weight": score.get("global_weight"),
                "growth_stage": score.get("growth_stage"),
                "top_missing_keywords": score.get("top_missing_keywords") or [],
                "keyword_coverage": score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100,
                "platform_mentioned": platform_mentioned_full,
                "smart_place_score": score.get("breakdown", {}).get("smart_place_completeness"),
                "competitor_count": len(comp_list_full),
                "competitor_mentioned_count": len(comp_mentioned_full),
                "competitor_avg_score": comp_avg_full,
                "my_vs_competitor_gap": comp_gap_full,
                "query_exposure": query_exposure_full,
                "review_count": review_count_snap_full,
                "avg_rating": avg_rating_snap_full,
            }))
        except Exception as e:
            _logger.warning(f"scan_analytics insert failed (full biz={req.business_id}): {e}")

        # review_snapshots 저장 (리뷰 시계열)
        if review_count_snap_full is not None:
            try:
                await execute(supabase.table("review_snapshots").insert({
                    "business_id": req.business_id,
                    "review_count": review_count_snap_full,
                    "avg_rating": avg_rating_snap_full,
                }))
            except Exception as e:
                _logger.warning(f"review_snapshots insert failed (full biz={req.business_id}): {e}")

        # score_history 저장 (30일 추세용)
        try:
            await execute(
                supabase.table("score_history").upsert({
                    "business_id": req.business_id,
                    "score_date": str(_date.today()),
                    "total_score": score["total_score"],
                    "exposure_freq": result.get("gemini", {}).get("exposure_freq", 0),
                    "sample_size": result.get("gemini", {}).get("sample_size") or 50,
                    "rank_in_category": 0,
                    "total_in_category": 0,
                    "weekly_change": weekly_change,
                    "naver_channel_score": score.get("naver_channel_score"),
                    "global_channel_score": score.get("global_channel_score"),
                }, on_conflict="business_id,score_date")
            )

            # rank_in_category 계산 — 카테고리 내 전 사업장 최신 점수 기준
            if biz:
                rank_in_category, total_in_category = await _calc_rank_in_category(
                    supabase, biz.get("category", ""), req.business_id, score["total_score"],
                )
                await execute(
                    supabase.table("score_history").update({
                        "rank_in_category": rank_in_category,
                        "total_in_category": total_in_category,
                    }).eq("business_id", req.business_id).eq("score_date", str(_date.today()))
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"score_history save failed: {e}")

        # 풀스캔 완료 후 가이드 자동 생성 (백그라운드, 메인 스캔 흐름에 영향 없음)
        import asyncio as _asyncio_guide
        _asyncio_guide.create_task(_auto_generate_guide(req.business_id, scan_id))

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Full scan failed: {e}")


# ── v3.6 — Trial Conversion Funnel (2026-04-24) ──────────────────────────
# /api/scan/trial-claim : 비로그인 trial 사용자가 결과 페이지에서 이메일 입력 →
#                         Supabase Auth 매직 링크 발송 + claimed_at 기록
# /api/scan/trial-attach: 가입 완료된 사용자가 자기 trial_id를 본인 계정에 흡수

# IP 기반 분당 3회 제한 (이메일 폭격 방지)
_TRIAL_CLAIM_LIMIT_PER_MIN = 3
_TRIAL_CLAIM_WINDOW_SEC    = 60


def _check_trial_claim_rate_limit(ip: str) -> None:
    """IP당 분당 3회 trial-claim 제한"""
    key = f"trial_claim_ip:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _TRIAL_CLAIM_LIMIT_PER_MIN:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "CLAIM_RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요 (분당 3회 제한).",
                "retry_after": _TRIAL_CLAIM_WINDOW_SEC,
            },
        )
    if count == 0:
        _cache.set(key, 1, _TRIAL_CLAIM_WINDOW_SEC)
    else:
        _cache.set(key, count + 1, _TRIAL_CLAIM_WINDOW_SEC)


@router.post("/trial-claim")
async def trial_claim(req: TrialClaimRequest, request: Request):
    """무료 체험 결과 보관 + 매직 링크 발송 (비로그인 깔때기 진입점).

    Flow:
      1. trial_id 조회 (없으면 404)
      2. 이미 claimed_at 있으면 200 + "이미 처리됨"
      3. services.trial_conversion.claim_trial(...) 호출
      4. trial_scans.claimed_at = now(), claim_email = email 저장
      5. 응답 {"ok": True, "message": "메일을 확인해주세요"}
    """
    if not _is_admin_request(request):
        ip = _get_client_ip(request)
        _check_trial_claim_rate_limit(ip)

    from services.trial_conversion import claim_trial

    supabase = get_client()
    res = await execute(
        supabase.table("trial_scans")
        .select("id, claimed_at, claim_email")
        .eq("id", req.trial_id)
        .maybe_single()
    )
    if not (res and res.data):
        raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다")

    if res.data.get("claimed_at"):
        # resend=true 파라미터가 있으면 재발송 허용 (메일이 안 와요 → 재발송 버튼)
        if not getattr(req, "resend", False):
            return {
                "ok": True,
                "already_claimed": True,
                "message": "이미 처리된 진단 결과입니다. 이전에 보내드린 메일을 확인해 주세요.",
            }
        # 재발송: claimed_at을 초기화하여 claim_trial이 다시 실행되도록 허용
        supabase2 = get_client()
        await execute(
            supabase2.table("trial_scans")
            .update({"claimed_at": None})
            .eq("id", req.trial_id)
        )

    try:
        await claim_trial(
            trial_id=req.trial_id,
            email=req.email,
            phone=req.phone,
            opt_in=req.marketing_opt_in,
        )
    except ValueError as ve:
        if str(ve) == "trial_not_found":
            raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다")
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        if str(re) == "email_send_failed":
            raise HTTPException(
                status_code=503,
                detail="이메일 발송에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            )
        _logger.error(f"trial_claim RuntimeError: {re}")
        raise HTTPException(status_code=500, detail="처리 중 오류가 발생했습니다.")
    except Exception as e:
        _logger.error(f"trial_claim failed: {e}")
        raise HTTPException(status_code=500, detail="메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.")

    return {"ok": True, "message": "메일을 확인해주세요"}


@router.post("/trial-attach")
async def trial_attach(req: TrialAttachRequest, user=Depends(get_current_user)):
    """가입 후 자기 trial_id를 본인 계정에 흡수 (콜백 처리용).

    이미 다른 사용자에게 attached된 경우 409.
    멱등 — 본인 소유 재호출 시 200 with already_owned=True.
    """
    from services.trial_conversion import attach_trial_to_user

    user_id = user["id"]
    try:
        outcome = await attach_trial_to_user(req.trial_id, user_id)
    except ValueError as ve:
        msg = str(ve)
        if msg == "not_found":
            raise HTTPException(status_code=404, detail="진단 결과를 찾을 수 없습니다")
        if msg == "conflict":
            raise HTTPException(
                status_code=409,
                detail="이미 다른 계정에 등록된 진단 결과입니다",
            )
        raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        _logger.error(f"trial_attach failed: {e}")
        raise HTTPException(status_code=500, detail="처리 중 오류가 발생했습니다")

    return {
        "ok": True,
        "trial_id": req.trial_id,
        "already_owned": outcome == "already_owned",
    }


# ════════════════════════════════════════════════════════════════
# 키워드 순위 측정 (Phase A-2 / service_unification_v1.0.md §4.1)
# ════════════════════════════════════════════════════════════════

class KeywordRankScanRequest(BaseModel):
    biz_id: str
    # 미지정 시 businesses.keywords 사용. 지정 시 그 키워드만 측정.
    keywords: Optional[list[str]] = None


@router.post("/keyword-rank")
async def keyword_rank_scan(
    req: KeywordRankScanRequest,
    user=Depends(get_current_user),
):
    """사장님이 등록한 키워드 3~10개의 네이버 PC/모바일/플레이스 순위 측정.

    절차:
      1. 권한 검증 (사업장 소유자)
      2. naver_keyword_rank.measure_keywords() 호출 (Playwright)
      3. 가장 최근 scan_results 행에 keyword_ranks 업데이트
         (scan_results 없으면 새 행 생성 — 키워드 측정만)
      4. score_history에 keyword_rank_avg 기록 (시계열)

    응답:
      {ok, keyword_ranks, scan_id, measured_at, errors}

    실패 시: keyword_ranks={}, errors=[...]. 가짜 수치 금지.
    """
    supabase = get_client()
    biz_res = await execute(
        supabase.table("businesses")
            .select("id, user_id, name, naver_place_id, keywords, region")
            .eq("id", req.biz_id)
            .single()
    )
    if not (biz_res and biz_res.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    biz = biz_res.data
    if biz.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    keywords = req.keywords or biz.get("keywords") or []
    keywords = [k.strip() for k in keywords if isinstance(k, str) and k.strip()]
    keywords = list(dict.fromkeys(keywords))  # 중복 제거 (입력 순서 보존)
    if not keywords:
        raise HTTPException(status_code=400, detail="측정할 키워드가 없습니다 (사업장에 키워드 3개 이상 등록 필요)")

    # 측정 (Playwright + Semaphore + 환경변수 동시성 제어)
    from services.naver_keyword_rank import measure_keywords as _measure
    rank_result = await _measure(
        keywords=keywords[:10],  # 안전 한도 10개
        biz_name=biz.get("name") or "",
        place_id=biz.get("naver_place_id"),
        region=biz.get("region") or "",
    )

    # 시계열 평균 순위 계산 (점수 미노출 = 99로 간주)
    rank_values = []
    for kw in keywords[:10]:
        data = rank_result.get(kw) if isinstance(rank_result.get(kw), dict) else None
        if not data:
            continue
        ranks = [data.get("pc_rank"), data.get("mobile_rank"), data.get("place_rank")]
        ranks = [r for r in ranks if isinstance(r, (int, float)) and r > 0]
        rank_values.append(min(ranks) if ranks else 99.0)
    avg_rank = round(sum(rank_values) / len(rank_values), 2) if rank_values else None

    # 가장 최근 scan_results에 업데이트 (없으면 새 행)
    latest = await execute(
        supabase.table("scan_results")
            .select("id, scanned_at")
            .eq("business_id", req.biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
    )
    scan_id: str | None = None
    if latest and latest.data:
        scan_id = latest.data[0]["id"]
        try:
            await execute(
                supabase.table("scan_results").update({
                    "keyword_ranks": rank_result,
                }).eq("id", scan_id)
            )
        except Exception as e:
            _logger.warning(f"keyword_rank scan_results update 실패 [biz={req.biz_id}]: {e}")
    else:
        # scan_results 행이 없으면 신규 생성 (키워드 측정만)
        try:
            ins = await execute(
                supabase.table("scan_results").insert({
                    "business_id": req.biz_id,
                    "query_used": "keyword_rank_only",
                    "keyword_ranks": rank_result,
                }).select("id")
            )
            if ins and ins.data:
                scan_id = ins.data[0]["id"]
        except Exception as e:
            _logger.warning(f"keyword_rank scan_results insert 실패 [biz={req.biz_id}]: {e}")

    # score_history에 시계열 기록 (graceful — 컬럼 미존재 시 무시)
    if avg_rank is not None:
        try:
            await execute(
                supabase.table("score_history").insert({
                    "business_id": req.biz_id,
                    "context": "keyword_rank",
                    "keyword_rank_avg": avg_rank,
                })
            )
        except Exception as e:
            _logger.warning(f"keyword_rank score_history insert 실패 [biz={req.biz_id}]: {e}")

    ctx = rank_result.get("_context", {}) if isinstance(rank_result, dict) else {}
    return {
        "ok": True,
        "scan_id": scan_id,
        "keyword_ranks": {k: v for k, v in rank_result.items() if not k.startswith("_")},
        "avg_rank": avg_rank,
        "measured_at": ctx.get("scanned_at"),
        "errors": ctx.get("errors", []),
        "fallback": ctx.get("error") is not None,
    }

