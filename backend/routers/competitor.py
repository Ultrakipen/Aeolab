import asyncio
import logging
import os
import re
import urllib.parse
import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from models.schemas import CompetitorCreate
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user, PLAN_LIMITS

router = APIRouter()
_logger = logging.getLogger(__name__)

_KAKAO_LOCAL_URL  = "https://dapi.kakao.com/v2/local/search/keyword.json"
_NAVER_LOCAL_URL  = "https://openapi.naver.com/v1/search/local.json"
_GOOGLE_PLACE_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"


def _strip_tags(text: str) -> str:
    """HTML 태그 제거 (<b>, </b> 등)"""
    return re.sub(r"<[^>]+>", "", text or "")


# 주요 도시 중심 좌표 (Google Places location bias용)
# Google Places types → 한국어 업종 매핑 (일반 타입 제외)
_GOOGLE_TYPE_KO: dict[str, str] = {
    "restaurant": "음식점", "food": "음식점", "meal_takeaway": "테이크아웃",
    "meal_delivery": "배달음식", "cafe": "카페", "bakery": "베이커리",
    "bar": "주점", "night_club": "나이트클럽",
    "beauty_salon": "미용실", "hair_care": "헤어샵", "spa": "스파·마사지",
    "hospital": "병원", "doctor": "의원·클리닉", "dentist": "치과",
    "pharmacy": "약국", "veterinary_care": "동물병원",
    "gym": "헬스장·피트니스", "lodging": "숙박",
    "store": "소매점", "shopping_mall": "쇼핑몰", "supermarket": "마트",
    "convenience_store": "편의점", "clothing_store": "의류",
    "shoe_store": "신발", "book_store": "서점", "electronics_store": "전자제품",
    "pet_store": "반려동물", "florist": "꽃집",
    "school": "학교·학원", "university": "대학",
    "laundry": "세탁소", "car_wash": "세차장", "car_repair": "자동차정비",
    "gas_station": "주유소",
}
# 표시에서 제외할 일반·무의미 타입
_GOOGLE_TYPE_SKIP: set[str] = {
    "establishment", "point_of_interest", "premise", "subpremise",
    "street_address", "route", "locality", "political",
    "administrative_area_level_1", "administrative_area_level_2",
    "administrative_area_level_3", "country", "colloquial_area",
    "geocode", "health",
}


def _google_types_to_category(types: list[str]) -> str:
    """Google Places types 리스트를 한국어 업종 문자열로 변환."""
    # 한국어 매핑이 있는 타입 우선
    for t in types:
        if t in _GOOGLE_TYPE_KO:
            return _GOOGLE_TYPE_KO[t]
    # 매핑 없지만 일반 타입도 아닌 것: 첫 번째 영문 타입 반환
    for t in types:
        if t not in _GOOGLE_TYPE_SKIP:
            return t.replace("_", " ")
    return ""


_REGION_COORD: dict[str, tuple[float, float]] = {
    "서울": (37.5665, 126.9780), "부산": (35.1796, 129.0756),
    "대구": (35.8714, 128.6014), "인천": (37.4563, 126.7052),
    "광주": (35.1595, 126.8526), "대전": (36.3504, 127.3845),
    "울산": (35.5384, 129.3114), "수원": (37.2636, 127.0286),
    "창원": (35.2280, 128.6811), "고양": (37.6584, 126.8320),
    "용인": (37.2411, 127.1776), "성남": (37.4200, 127.1270),
    "청주": (36.6424, 127.4890), "전주": (35.8242, 127.1480),
    "천안": (36.8151, 127.1139), "안산": (37.3219, 126.8309),
    "안양": (37.3943, 126.9568), "평택": (36.9921, 127.1128),
    "제주": (33.4890, 126.4983), "세종": (36.4800, 127.2890),
    "포항": (36.0190, 129.3435), "김해": (35.2342, 128.8811),
    "진주": (35.1799, 128.1076), "경주": (35.8562, 129.2247),
}


def _get_region_coord(region: str) -> tuple[float, float] | None:
    """지역명에서 중심 좌표 반환"""
    for city, coord in _REGION_COORD.items():
        if city in region:
            return coord
    return None


def _region_filter_key(region: str) -> str:
    """주소 필터링용 도시 키워드 추출.
    '창원시' → '창원', '경상남도 창원시' → '창원', '서울특별시' → '서울'
    """
    parts = region.split()
    # 1순위: 일반 시/군 (특별시·광역시 제외)
    for part in parts:
        if part.endswith(("시", "군")) and not part.endswith(("특별시", "광역시", "특별자치시")):
            key = part[:-1].strip()  # '시'/'군' 제거
            if key:
                return key
    # 2순위: 특별시·광역시
    for part in parts:
        if part.endswith(("특별시", "광역시", "특별자치시")):
            return part.replace("특별자치시", "").replace("특별시", "").replace("광역시", "").strip()
    # fallback: 첫 단어에서 행정구역 접미사 제거
    prefix = parts[0] if parts else ""
    return prefix.rstrip("시도군구특별광역자치").strip() or prefix


async def _search_kakao(query: str, region: str) -> list[dict]:
    """카카오 로컬 REST API 기반 지역 사업장 검색 (최대 3페이지 × 15개 = 45개).
    https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
    """
    rest_key = os.getenv("KAKAO_REST_API_KEY")
    if not rest_key:
        return []

    full_query = f"{region.split()[0]} {query}".strip() if region else query

    results: list[dict] = []
    try:
        async with aiohttp.ClientSession() as session:
            for page in range(1, 4):  # 최대 3페이지 (45개)
                async with session.get(
                    _KAKAO_LOCAL_URL,
                    params={"query": full_query, "size": 15, "page": page},
                    headers={"Authorization": f"KakaoAK {rest_key}"},
                    timeout=aiohttp.ClientTimeout(total=8),
                ) as res:
                    if res.status != 200:
                        break
                    data = await res.json()
                    documents = data.get("documents", [])
                    if not documents:
                        break
                    seen_names = {r["name"] for r in results}
                    region_prefix = region.split()[0] if region else ""
                    for doc in documents:
                        name = doc.get("place_name", "")
                        if name and name not in seen_names:
                            naver_search_query = f"{region_prefix} {name}".strip() if region_prefix else name
                            results.append({
                                "name": name,
                                "address": doc.get("road_address_name") or doc.get("address_name", ""),
                                "category": doc.get("category_name", ""),
                                "phone": doc.get("phone", ""),
                                "naver_url": "https://map.naver.com/v5/search/" + urllib.parse.quote(naver_search_query),
                                "kakao_url": doc.get("place_url", ""),
                                "kakao_place_id": doc.get("id", ""),
                                "lat": doc.get("y", ""),
                                "lng": doc.get("x", ""),
                                "source": "kakao",
                            })
                    # 마지막 페이지 여부 확인
                    meta = data.get("meta", {})
                    if meta.get("is_end", True):
                        break
    except Exception as e:
        _logger.warning(f"kakao search failed: {type(e).__name__}: {e}")

    return results


async def _search_google(query: str, region: str) -> list[dict]:
    """Google Places Text Search — 최대 2페이지 × 20개 = 40개"""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return []

    region_prefix = region.split()[0] if region else ""
    full_query = f"{region_prefix} {query}".strip() if region_prefix else query

    results: list[dict] = []
    next_page_token: str | None = None

    coord = _get_region_coord(region)

    try:
        async with aiohttp.ClientSession() as session:
            for _ in range(2):  # 최대 2페이지 (40개)
                params: dict = {
                    "query": full_query,
                    "language": "ko",
                    "region": "kr",
                    "key": api_key,
                }
                # 지역 좌표 있으면 20km 반경으로 bias (타 지역 결과 억제)
                if coord:
                    params["location"] = f"{coord[0]},{coord[1]}"
                    params["radius"] = "20000"
                if next_page_token:
                    params = {"pagetoken": next_page_token, "key": api_key}
                    await asyncio.sleep(2)  # 구글 pagetoken 딜레이 필수

                async with session.get(
                    _GOOGLE_PLACE_URL,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as res:
                    if res.status != 200:
                        break
                    data = await res.json()
                    if data.get("status") not in ("OK", "ZERO_RESULTS"):
                        break

                    seen_names = {r["name"] for r in results}
                    for place in data.get("results", []):
                        name = place.get("name", "")
                        if not name or name in seen_names:
                            continue
                        place_id = place.get("place_id", "")
                        loc = place.get("geometry", {}).get("location", {})
                        results.append({
                            "name": name,
                            "address": place.get("formatted_address", ""),
                            "category": _google_types_to_category(place.get("types", [])),
                            "phone": "",
                            "naver_url": "",
                            "kakao_url": "",
                            "google_url": f"https://maps.google.com/?q=place_id:{place_id}" if place_id else "",
                            "kakao_place_id": "",
                            "lat": str(loc.get("lat", "")),
                            "lng": str(loc.get("lng", "")),
                            "source": "google",
                        })

                    next_page_token = data.get("next_page_token")
                    if not next_page_token:
                        break
    except Exception as e:
        _logger.warning(f"google places search failed: {type(e).__name__}: {e}")

    return results


# 업종별 유사어 — 쿼리 키워드에서 확장 검색으로 네이버 결과 수 극대화
_NAVER_SYNONYMS: dict[str, list[str]] = {
    "카페":      ["카페", "커피전문점", "브런치", "베이커리카페"],
    "커피":      ["커피전문점", "카페", "브런치", "베이커리카페"],
    "식당":      ["식당", "맛집", "음식점", "레스토랑"],
    "음식점":    ["음식점", "식당", "맛집", "레스토랑"],
    "맛집":      ["맛집", "식당", "음식점", "레스토랑"],
    "미용실":    ["미용실", "헤어샵", "헤어살롱", "미용원"],
    "헤어샵":    ["헤어샵", "미용실", "헤어살롱"],
    "병원":      ["병원", "의원", "클리닉", "한의원"],
    "의원":      ["의원", "병원", "클리닉"],
    "치과":      ["치과", "치과의원", "치과병원"],
    "한의원":    ["한의원", "한방병원", "한의과"],
    "학원":      ["학원", "교습소", "교육원"],
    "헬스장":    ["헬스장", "피트니스", "헬스클럽"],
    "피트니스":  ["피트니스", "헬스장", "헬스클럽"],
    "약국":      ["약국", "드러그스토어"],
    "편의점":    ["편의점", "GS25", "CU"],
    "마트":      ["마트", "슈퍼", "슈퍼마켓"],
    "빵집":      ["빵집", "베이커리", "제과점"],
    "베이커리":  ["베이커리", "빵집", "제과점"],
    "고기집":    ["고기집", "삼겹살", "barbecue", "갈비"],
    "치킨":      ["치킨", "닭갈비", "닭볶음탕"],
    "분식":      ["분식", "떡볶이", "김밥천국"],
    "중국집":    ["중국집", "중식", "짜장면"],
    "일식":      ["일식", "초밥", "라멘", "돈까스"],
}


async def _naver_fetch_one(
    session: aiohttp.ClientSession,
    keyword: str,
    region_prefix: str,
    headers: dict,
) -> list[dict]:
    """단일 키워드로 네이버 지역 검색 (최대 5개)"""
    q = f"{region_prefix} {keyword}".strip() if region_prefix else keyword
    try:
        async with session.get(
            _NAVER_LOCAL_URL,
            params={"query": q, "display": 5, "start": 1, "sort": "comment"},
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=6),
        ) as res:
            if res.status != 200:
                return []
            data = await res.json()
            items = data.get("items", [])
            return [
                {
                    "name": _strip_tags(item.get("title", "")),
                    "address": item.get("roadAddress") or item.get("address", ""),
                    "category": item.get("category", ""),
                    "phone": item.get("telephone", ""),
                    # 지역명 + 상호명으로 검색 — 전국 동명 업체 혼선 방지
                    "naver_url": "https://map.naver.com/v5/search/" + urllib.parse.quote(
                        f"{region_prefix} {_strip_tags(item.get('title', ''))}".strip()
                    ),
                    "naver_place_id": (lambda link: (m.group(1) if (m := re.search(r"/place/(\d+)", link)) else ""))(item.get("link", "")),
                    "kakao_url": "",
                    "kakao_place_id": "",
                    # 네이버 mapx/mapy는 WGS84 × 1e7 형식 → 나누기로 실제 좌표 변환
                    "lat": str(int(item["mapy"]) / 1e7) if item.get("mapy") else "",
                    "lng": str(int(item["mapx"]) / 1e7) if item.get("mapx") else "",
                    "source": "naver",
                }
                for item in items
                if _strip_tags(item.get("title", ""))
            ]
    except (aiohttp.ClientError, asyncio.TimeoutError):
        return []


async def _search_naver(query: str, region: str) -> list[dict]:
    """네이버 지역 검색 — 유사어 병렬 검색으로 최대 20개 수집"""
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        return []

    region_prefix = region.split()[0] if region else ""
    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }

    # 유사어 목록 결정: 등록된 업종이면 확장, 아니면 원본 키워드만
    synonyms = _NAVER_SYNONYMS.get(query.strip(), [query.strip()])

    try:
        async with aiohttp.ClientSession() as session:
            batches = await asyncio.gather(
                *[_naver_fetch_one(session, kw, region_prefix, headers) for kw in synonyms],
                return_exceptions=True,
            )

        seen: set[str] = set()
        results: list[dict] = []
        for batch in batches:
            if isinstance(batch, list):
                for item in batch:
                    name = item["name"]
                    if name and name not in seen:
                        seen.add(name)
                        results.append(item)
            if len(results) >= 25:
                break
    except Exception:
        results = []

    return results


@router.get("/search")
async def search_local_businesses(query: str, region: str, user=Depends(get_current_user)):
    """카카오 + Google + 네이버 3개 API 병렬 통합 검색 — 중복 제거 후 반환"""
    kakao_res, google_res, naver_res = await asyncio.gather(
        _search_kakao(query, region),
        _search_google(query, region),
        _search_naver(query, region),
        return_exceptions=True,
    )

    # 예외 발생 시 빈 리스트로 처리
    kakao_list  = kakao_res  if isinstance(kakao_res,  list) else []
    google_list = google_res if isinstance(google_res, list) else []
    naver_list  = naver_res  if isinstance(naver_res,  list) else []

    # 지역 필터 키워드 (예: '창원시 의창구' → '창원')
    region_key = _region_filter_key(region)

    def _in_region(item: dict) -> bool:
        """주소에 지역 키워드가 포함된 경우만 통과"""
        if not region_key:
            return True
        addr = item.get("address", "")
        return region_key in addr

    # 카카오 우선 → Google → 네이버 순으로 합산, 지역 필터 후 중복 제거
    seen: set[str] = set()
    merged: list[dict] = []
    for item in [*kakao_list, *google_list, *naver_list]:
        name = item.get("name", "").strip()
        if name and name not in seen and _in_region(item):
            seen.add(name)
            merged.append(item)

    if not merged:
        raise HTTPException(status_code=503, detail="지역 검색 API 연결 오류. 잠시 후 다시 시도하세요.")

    return merged


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
        .in_("status", ["active", "grace_period"])
        .maybe_single()
    )
    plan = sub.data["plan"] if sub.data else "free"
    limits = {k: v["competitors"] for k, v in PLAN_LIMITS.items()}
    if (existing.count or 0) >= limits.get(plan, 0):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": f"{plan} 플랜 경쟁사 한도 초과", "upgrade_url": "/pricing"},
        )

    # 사업장 지역 조회 — 다른 지역 경쟁사 등록 시 경고 (차단 아님)
    biz_region_row = await execute(
        supabase.table("businesses")
        .select("region")
        .eq("id", req.business_id)
        .maybe_single()
    )
    region_warning: str | None = None
    if biz_region_row.data and req.address:
        biz_region = biz_region_row.data.get("region") or ""
        biz_region_prefix = biz_region[:2]  # 예: "서울", "부산"
        if biz_region_prefix and biz_region_prefix not in req.address:
            region_warning = (
                f"등록된 사업장({biz_region})과 다른 지역의 업체일 수 있습니다."
            )

    insert_data = {
        "business_id": req.business_id,
        "name": req.name,
        "address": req.address,
        "is_active": True,
    }
    if req.kakao_place_id:
        insert_data["kakao_place_id"] = req.kakao_place_id
    if req.naver_place_id:
        insert_data["naver_place_id"] = req.naver_place_id
    # 검색 결과에서 전달받은 좌표 저장 (있는 경우에만)
    if req.lat is not None:
        insert_data["lat"] = req.lat
    if req.lng is not None:
        insert_data["lng"] = req.lng

    result = await execute(supabase.table("competitors").insert(insert_data))
    row = result.data[0] if result.data else {}

    # naver_place_id가 있으면 백그라운드에서 플레이스 데이터 즉시 동기화
    if req.naver_place_id and row.get("id"):
        try:
            from services.competitor_place_crawler import sync_competitor_place
            asyncio.create_task(
                sync_competitor_place(row["id"], req.naver_place_id, supabase)
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                f"competitor place sync 백그라운드 실행 실패: {e}"
            )

    return {
        **row,
        "message": "경쟁사가 등록되었습니다.",
        "region_warning": region_warning,
    }


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
        .select(
            "id, name, address, is_active, created_at, "
            "kakao_place_id, naver_place_id, "
            "naver_review_count, naver_avg_rating, "
            "has_faq, has_recent_post, has_menu, "
            "naver_photo_count, naver_place_last_synced_at"
        )
        .eq("business_id", biz_id)
        .eq("is_active", True)
    )
    # 프론트엔드 Competitor 인터페이스(entities.ts)의 place_* 필드명으로 변환
    rows = []
    for r in (result.data or []):
        rows.append({
            **r,
            "place_review_count": r.get("naver_review_count"),
            "place_avg_rating": r.get("naver_avg_rating"),
            "place_has_faq": r.get("has_faq"),
            "place_has_recent_post": r.get("has_recent_post"),
            "place_has_menu": r.get("has_menu"),
            "place_photo_count": r.get("naver_photo_count"),
            "place_synced_at": r.get("naver_place_last_synced_at"),
        })
    return rows


@router.get("/{competitor_id}/detail")
async def get_competitor_detail(competitor_id: str, user=Depends(get_current_user)):
    """경쟁사 상세 정보 조회 — 블로그 언급 수, 웹사이트 SEO, 업종 키워드 분석 포함 (Basic+)"""
    supabase = get_client()

    # 플랜 게이트: basic 이상만 접근 가능
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    user_plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(user_plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "pro", "biz", "enterprise"], "upgrade_url": "/pricing"},
        )

    # 소유권 검증: competitor → business_id → user_id
    comp = await execute(
        supabase.table("competitors")
        .select(
            "id, name, address, is_active, created_at, "
            "kakao_place_id, naver_place_id, "
            "naver_review_count, naver_avg_rating, "
            "has_faq, has_recent_post, has_menu, "
            "naver_photo_count, naver_place_last_synced_at, "
            "blog_mention_count, website_url, "
            "website_seo_score, website_seo_result, detail_synced_at, "
            "business_id"
        )
        .eq("id", competitor_id)
        .maybe_single()
    )
    if not comp.data:
        raise HTTPException(status_code=404, detail="경쟁사를 찾을 수 없습니다")

    biz = await execute(
        supabase.table("businesses")
        .select("user_id, category, region")
        .eq("id", comp.data["business_id"])
        .maybe_single()
    )
    if not biz.data or biz.data["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    category = biz.data.get("category", "")

    # 업종 키워드 분석: scan_results.competitor_scores에서 해당 경쟁사 excerpt 추출
    comp_keywords: dict = {}
    try:
        scan_rows = (
            await execute(
                supabase.table("scan_results")
                .select("competitor_scores")
                .eq("business_id", comp.data["business_id"])
                .order("scanned_at", desc=True)
                .limit(3)
            )
        ).data or []

        comp_excerpts: list[str] = []
        comp_name = comp.data.get("name", "")
        for row in scan_rows:
            scores = row.get("competitor_scores") or {}
            # competitor_scores: {name: {score, excerpt, ...}}
            for name, score_data in scores.items():
                if isinstance(score_data, dict) and comp_name and comp_name in name:
                    excerpt = score_data.get("excerpt", "")
                    if excerpt:
                        comp_excerpts.append(excerpt)

        if category and comp_excerpts:
            from services.keyword_taxonomy import analyze_keyword_coverage
            comp_keywords = analyze_keyword_coverage(
                category=category,
                review_excerpts=comp_excerpts,
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            f"competitor detail keyword analysis failed [{competitor_id}]: {e}"
        )

    return {
        **comp.data,
        "comp_keywords": comp_keywords,
    }


@router.patch("/{competitor_id}")
async def update_competitor(competitor_id: str, payload: dict, user=Depends(get_current_user)):
    """경쟁사 정보 수정 — naver_place_id 등 업데이트 가능, 소유권 검증 필수"""
    supabase = get_client()

    # 소유권 검증: competitor → business_id → user_id
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

    # 허용 필드만 업데이트 (화이트리스트)
    allowed_fields = {"name", "address", "naver_place_id", "kakao_place_id"}
    update_data = {k: v for k, v in payload.items() if k in allowed_fields}
    if not update_data:
        raise HTTPException(status_code=400, detail="업데이트할 유효한 필드가 없습니다")

    await execute(
        supabase.table("competitors")
        .update(update_data)
        .eq("id", competitor_id)
    )
    # update 후 변경된 행 재조회
    result = await execute(
        supabase.table("competitors")
        .select("id, name, address, naver_place_id, kakao_place_id")
        .eq("id", competitor_id)
        .maybe_single()
    )

    # naver_place_id 변경 시 백그라운드 sync 자동 실행
    if "naver_place_id" in update_data and update_data.get("naver_place_id"):
        try:
            from services.competitor_place_crawler import sync_competitor_place as _sync_place
            asyncio.create_task(_sync_place(competitor_id, update_data["naver_place_id"], supabase))
            _logger.info(f"PATCH: naver_place_id 저장 후 sync 자동 트리거 [{competitor_id}]")
        except Exception as _e:
            _logger.warning(f"PATCH sync trigger failed [{competitor_id}]: {_e}")

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


@router.post("/{competitor_id}/sync-place")
async def sync_competitor_place_endpoint(competitor_id: str, user=Depends(get_current_user)):
    """경쟁사 네이버 플레이스 데이터 수동 동기화 트리거 — 소유권 검증 필수"""
    supabase = get_client()

    # 소유권 검증: competitor → business_id → user_id
    comp = await execute(
        supabase.table("competitors")
        .select("business_id, naver_place_id, name")
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

    naver_place_id = comp.data.get("naver_place_id")
    if not naver_place_id:
        raise HTTPException(
            status_code=400,
            detail="naver_place_id가 등록되지 않았습니다. 경쟁사 정보를 수정하여 네이버 플레이스 ID를 입력해 주세요.",
        )

    # 즉시 크롤링 실행 (비동기 백그라운드 태스크)
    from services.competitor_place_crawler import sync_competitor_place
    asyncio.create_task(sync_competitor_place(competitor_id, naver_place_id, supabase))

    return {
        "status": "sync_started",
        "competitor_id": competitor_id,
        "name": comp.data.get("name"),
        "naver_place_id": naver_place_id,
        "message": "네이버 플레이스 데이터 동기화가 시작되었습니다. 약 30초 후 반영됩니다.",
    }
