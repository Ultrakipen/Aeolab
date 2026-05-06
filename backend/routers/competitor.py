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

# 업종 코드 → 한국어 검색어 변환
# v3.5 화이트리스트 25개 코드가 반드시 포함되어야 suggestions 엔드포인트가 동작
_CATEGORY_KO: dict[str, str] = {
    # ── v3.5 화이트리스트 25개 (DB 실제 사용 코드) ──
    "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리", "bar": "술집",
    "beauty": "미용실", "nail": "네일샵", "medical": "병원", "pharmacy": "약국",
    "fitness": "헬스장", "yoga": "요가 필라테스", "pet": "반려동물",
    "education": "학원", "tutoring": "과외", "legal": "법률사무소",
    "realestate": "부동산", "interior": "인테리어", "auto": "자동차정비",
    "cleaning": "청소대행", "shopping": "쇼핑몰", "fashion": "의류",
    "photo": "사진·영상", "video": "영상제작", "design": "디자인",
    "accommodation": "숙박 펜션", "other": "",
}


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


async def _find_naver_place_id(name: str, address: str, region: str = "") -> str | None:
    """경쟁사 이름+주소로 네이버 로컬 검색 API를 호출해 place_id 자동 조회"""
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }
    region_prefix = region.split()[0] if region else (address.split()[0] if address else "")
    query = f"{region_prefix} {name}".strip()

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _NAVER_LOCAL_URL,
                params={"query": query, "display": 5},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as res:
                if res.status != 200:
                    return None
                data = await res.json()
                for item in data.get("items", []):
                    item_name = _strip_tags(item.get("title", ""))
                    link = item.get("link", "")
                    m = re.search(r"/place/(\d+)", link)
                    if m and name in item_name:
                        return m.group(1)
    except Exception as e:
        _logger.warning(f"_find_naver_place_id 실패: {name} — {e}")
    return None


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

    # 네이버 결과에서 name→naver_place_id 맵 생성 (카카오 결과 보강용)
    naver_id_map: dict[str, str] = {}
    for nitem in (naver_list if isinstance(naver_list, list) else []):
        nname = nitem.get("name", "").strip()
        nid = nitem.get("naver_place_id", "")
        if nname and nid:
            naver_id_map[nname] = nid

    # 카카오 우선 → Google → 네이버 순으로 합산, 지역 필터 후 중복 제거
    # 카카오/구글 결과에 naver_place_id 없으면 naver_id_map에서 보강
    seen: set[str] = set()
    merged: list[dict] = []
    for item in [*kakao_list, *google_list, *naver_list]:
        name = item.get("name", "").strip()
        if name and name not in seen and _in_region(item):
            seen.add(name)
            if not item.get("naver_place_id") and name in naver_id_map:
                item = {**item, "naver_place_id": naver_id_map[name]}
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
    # naver_place_id가 없으면 자동 조회 후 동기화 시도
    if row.get("id"):
        biz_region = biz_region_row.data.get("region", "") if biz_region_row.data else ""
        if req.naver_place_id:
            try:
                from services.competitor_place_crawler import sync_competitor_place
                asyncio.create_task(
                    sync_competitor_place(row["id"], req.naver_place_id, supabase)
                )
            except Exception as e:
                _logger.warning(f"competitor place sync 백그라운드 실행 실패: {e}")
        else:
            async def _auto_find_and_sync(comp_id: str, comp_name: str, comp_address: str, biz_region_str: str, sb):
                found_id = await _find_naver_place_id(comp_name, comp_address, biz_region_str)
                if found_id:
                    try:
                        await execute(sb.table("competitors").update({"naver_place_id": found_id}).eq("id", comp_id))
                        from services.competitor_place_crawler import sync_competitor_place
                        await sync_competitor_place(comp_id, found_id, sb)
                        _logger.info(f"[auto_find] naver_place_id 자동 설정 완료 — comp={comp_name}, place_id={found_id}")
                    except Exception as e:
                        _logger.warning(f"[auto_find] sync 실패 — comp={comp_name}: {e}")
                else:
                    _logger.info(f"[auto_find] naver_place_id 조회 실패 — comp={comp_name}")

            asyncio.create_task(_auto_find_and_sync(
                comp_id=row["id"],
                comp_name=req.name,
                comp_address=req.address or "",
                biz_region_str=biz_region,
                sb=supabase,
            ))

    # 경쟁사 등록 직후 Gemini 단일 스캔 백그라운드 실행
    # 여러 경쟁사를 연속 등록할 때 동시 DB 업데이트로 인한 race condition 방지:
    # 현재 등록된 경쟁사 수에 비례한 지연(5초 × index)을 두어 순차 처리되도록 함
    if row.get("id"):
        # 현재 등록된 경쟁사 수로 지연 계산 (이미 DB에 저장된 수 기준)
        try:
            comp_count_res = await execute(
                supabase.table("competitors")
                .select("id", count="exact")
                .eq("business_id", req.business_id)
                .eq("is_active", True)
            )
            # 방금 등록한 경쟁사 포함 개수 — 기존 개수 기반 지연 (최신 등록자일수록 더 늦게)
            existing_count = max(0, (comp_count_res.count or 1) - 1)
            delay_sec = existing_count * 5  # 기존 0개→0초, 1개→5초, 2개→10초
        except Exception:
            delay_sec = 0

        async def _delayed_scan(comp_id: str, comp_name: str, biz_id: str, sb, delay: float):
            if delay > 0:
                import asyncio as _aio
                await _aio.sleep(delay)
            await _scan_new_competitor(comp_id, comp_name, biz_id, sb)

        asyncio.create_task(_delayed_scan(
            comp_id=row["id"],
            comp_name=req.name,
            biz_id=req.business_id,
            sb=supabase,
            delay=float(delay_sec),
        ))

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


# 추천 경쟁사 캐시 {biz_id: (expires_ts, data)}
_suggestions_cache: dict[str, tuple[float, list]] = {}

# 광역 행정구역 접미사 — 지역 키 추출 시 제거
_REGION_SUFFIX = ("특별시", "광역시", "특별자치시", "특별자치도", "시", "군", "구", "도")


def _region_key(region: str) -> str:
    """지역 문자열에서 핵심 도시명을 추출한다.
    '경상남도 창원시 의창구' → '창원'
    '서울특별시 강남구'     → '강남'  (구 단위가 있으면 구 우선)
    """
    parts = region.split()
    # 구(區) 단위가 있으면 구 이름 우선 (강남구 → 강남)
    for part in reversed(parts):
        if part.endswith("구") and not part.endswith(("특별자치구",)):
            return part[:-1]
    # 시/군
    for part in parts:
        if part.endswith(("시", "군")) and not part.endswith(("특별시", "광역시", "특별자치시")):
            return part[:-1]
    # 특별시·광역시
    for part in parts:
        for suf in ("특별시", "광역시", "특별자치시"):
            if part.endswith(suf):
                return part[: -len(suf)]
    return parts[0].rstrip("".join(_REGION_SUFFIX)) if parts else ""


def _build_suggestion_query(name: str, category: str, region: str, keywords: list) -> str:
    """추천 검색어를 구성한다 — 구체적인 것부터 시도해 fallback.

    1순위: businesses.keywords 첫 번째 항목
    2순위: 가게 이름에서 지역명 제거 후 남은 키워드
    3순위: category 대분류 한국어 fallback
    """
    region_key = _region_key(region)
    cat_ko = _CATEGORY_KO.get(category, "")

    # 1순위: 사용자 정의 키워드
    if keywords:
        kw = (keywords[0] or "").strip()
        if kw:
            return f"{region_key} {kw}"

    # 2순위: 이름에서 지역명·업종 대분류어 제거 후 남은 단어
    cleaned = name
    for part in region.split():
        cleaned = cleaned.replace(part.rstrip("".join(_REGION_SUFFIX)), "")
    if cat_ko:
        cleaned = cleaned.replace(cat_ko, "")
    cleaned = re.sub(r"\s+", "", cleaned).strip()
    # 2글자 이상 남아있으면 유효한 세부 키워드
    if len(cleaned) >= 2:
        return f"{region_key} {cleaned}"

    # 3순위: 업종 대분류 fallback
    if cat_ko:
        return f"{region_key} {cat_ko}"
    return region_key


@router.get("/suggestions")
async def competitor_suggestions(
    biz_id: str,
    user: dict = Depends(get_current_user),
):
    """경쟁사 추천 — 같은 업종·지역에서 아직 등록되지 않은 업체 최대 5개 반환.

    - 쿼리: keywords → 이름 키워드 추출 → category 순 우선순위
    - 지역 필터: 카카오 결과의 주소가 사업장 지역과 일치하는 업체만 포함
    - AI 우선순위: scan_results에서 함께 언급된 업체를 상위 배치
    - 캐시: 30분 메모리 캐시
    """
    import time

    kakao_key = os.getenv("KAKAO_REST_API_KEY", "")
    if not kakao_key:
        return {"suggestions": []}

    now = time.time()
    cached = _suggestions_cache.get(biz_id)
    if cached and cached[0] > now:
        return {"suggestions": cached[1]}

    supabase = get_client()

    # 소유권 확인 + keywords 포함 조회
    biz_res = await execute(
        supabase.table("businesses")
        .select("id, name, category, region, user_id, keywords")
        .eq("id", biz_id)
        .eq("user_id", user["id"])
        .maybe_single()
    )
    if not (biz_res and biz_res.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    biz = biz_res.data

    category = biz.get("category", "")
    region = biz.get("region", "")
    biz_name = biz.get("name", "")
    keywords = biz.get("keywords") or []

    if not region:
        return {"suggestions": []}

    region_filter = _region_key(region)  # 주소 필터링 키워드 (예: "창원", "강남")
    query = _build_suggestion_query(biz_name, category, region, keywords)

    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as session:
            async with session.get(
                _KAKAO_LOCAL_URL,
                params={"query": query, "size": 15},
                headers={"Authorization": f"KakaoAK {kakao_key}"},
            ) as resp:
                if resp.status != 200:
                    return {"suggestions": []}
                data = await resp.json()
    except Exception as e:
        _logger.warning(f"[suggestions] 카카오 API 오류: {e}")
        return {"suggestions": []}

    # 기존 등록 경쟁사 이름 조회
    comp_res = await execute(
        supabase.table("competitors")
        .select("name")
        .eq("business_id", biz_id)
        .eq("is_active", True)
    )
    existing_names = {c["name"] for c in (comp_res.data or [])}
    existing_names.add(biz_name)

    # AI 스캔 이력에서 함께 언급된 업체명 조회 (우선순위 배치용)
    scan_res = await execute(
        supabase.table("scan_results")
        .select("competitor_scores")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(3)
    )
    ai_mentioned: set[str] = set()
    for row in (scan_res.data or []):
        for entry in (row.get("competitor_scores") or {}).values():
            if isinstance(entry, dict) and entry.get("name"):
                ai_mentioned.add(entry["name"])

    ai_first, normal = [], []
    for doc in data.get("documents", []):
        place_name = doc.get("place_name", "")
        if not place_name or place_name in existing_names:
            continue

        # 같은 지역 필터: 주소에 지역 키워드가 포함되어야 함
        address = doc.get("road_address_name") or doc.get("address_name", "")
        if region_filter and region_filter not in address:
            continue

        item = {
            "name": place_name,
            "address": address,
            "phone": doc.get("phone", ""),
            "category_name": doc.get("category_name", ""),
            "ai_competitor": place_name in ai_mentioned,
        }
        if place_name in ai_mentioned:
            ai_first.append(item)
        else:
            normal.append(item)

    suggestions = (ai_first + normal)[:5]
    _suggestions_cache[biz_id] = (now + 1800, suggestions)
    return {"suggestions": suggestions}


@router.get("/brand-check")
async def brand_check(
    name: str,
    region: str,
    category: str,
    user: dict = Depends(get_current_user),
):
    """지역 브랜드 중복 진단 — 네이버 지역 검색 API 기반.

    동일 지역·업종 내 유사 상호명 업체 수를 분석해 AI 혼동 위험도를 반환한다.
    인증 필요 (GET /api/competitors/brand-check?name=...&region=...&category=...)
    """
    naver_client_id = os.getenv("NAVER_CLIENT_ID", "")
    naver_client_secret = os.getenv("NAVER_CLIENT_SECRET", "")

    if not naver_client_id or not naver_client_secret:
        _logger.warning("[brand_check] NAVER_CLIENT_ID/SECRET 미설정")
        return {"risk_level": "unknown", "message": "네이버 API 키가 설정되지 않았습니다"}

    category_ko = _CATEGORY_KO.get(category, category)
    search_query = f"{region} {category_ko}".strip()

    try:
        headers = {
            "X-Naver-Client-Id": naver_client_id,
            "X-Naver-Client-Secret": naver_client_secret,
        }
        params = {"query": search_query, "display": 20, "start": 1, "sort": "random"}

        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(_NAVER_LOCAL_URL, headers=headers, params=params) as resp:
                if resp.status != 200:
                    _logger.warning(f"[brand_check] 네이버 API 오류 status={resp.status}")
                    return {"risk_level": "unknown", "message": "검색 결과를 가져오지 못했습니다"}
                data = await resp.json()

        items = data.get("items", [])
        total_in_region = data.get("total", 0)

        name_clean = re.sub(r"\s+", "", name).lower()
        similar_list: list[str] = []
        for item in items:
            title = re.sub(r"<[^>]+>", "", item.get("title", ""))
            title_clean = re.sub(r"\s+", "", title).lower()
            if name_clean in title_clean or title_clean in name_clean:
                similar_list.append(title)

        same_name_count = len(similar_list)

        if same_name_count == 0:
            risk_level = "low"
            msg = f"{region}에 같거나 비슷한 상호명의 업체가 없습니다. AI가 상호명만으로 내 가게를 특정할 수 있어 노출에 유리합니다."
        elif same_name_count <= 1:
            risk_level = "medium"
            msg = f"{region}에 상호명이 비슷한 업체가 {same_name_count}개 있습니다. 소개글이나 키워드에 지역명을 명확히 포함하면 AI 혼동을 줄일 수 있습니다."
        else:
            risk_level = "high"
            msg = f"{region}에 상호명이 비슷한 업체가 {same_name_count}개입니다. AI가 내 가게를 다른 업체로 혼동할 수 있습니다. 상호명에 지역명이나 특징어를 추가하는 것을 권장합니다."

        return {
            "total_in_region": total_in_region,
            "same_name_count": same_name_count,
            "risk_level": risk_level,
            "message": msg,
            "similar_businesses": similar_list[:10],
        }

    except Exception as e:
        _logger.warning(f"[brand_check] 분석 실패: {e}")
        return {"risk_level": "unknown", "message": "분석에 실패했습니다. 잠시 후 다시 시도해주세요."}


@router.get("/{biz_id}/changes")
async def get_competitor_changes(biz_id: str, user=Depends(get_current_user)):
    """최근 7일 이내 변화가 감지된 경쟁사 목록 반환."""
    supabase = get_client()
    # 소유권 검증
    biz = await execute(
        supabase.table("businesses")
        .select("id")
        .eq("id", biz_id)
        .eq("user_id", user["id"])
        .maybe_single()
    )
    if not biz.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    rows = (
        await execute(
            supabase.table("competitors")
            .select("id, name, change_summary, change_detected_at")
            .eq("business_id", biz_id)
            .eq("is_active", True)
            .gte("change_detected_at", cutoff)
            .order("change_detected_at", desc=True)
        )
    ).data or []

    return rows


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
            "naver_photo_count, naver_place_last_synced_at, "
            "has_intro, website_url"
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
            "place_has_intro": r.get("has_intro"),
            "website_url": r.get("website_url"),
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
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "pro", "biz"], "upgrade_url": "/pricing"},
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
    """경쟁사 네이버 플레이스 데이터 수동 동기화.
    naver_place_id가 없으면 이름+주소로 자동 조회 후 저장, 찾지 못하면 422 반환.
    """
    supabase = get_client()

    # 소유권 검증: competitor → business_id → user_id
    comp = await execute(
        supabase.table("competitors")
        .select("id, name, address, naver_place_id, business_id")
        .eq("id", competitor_id)
        .maybe_single()
    )
    if not comp.data:
        raise HTTPException(status_code=404, detail="경쟁사를 찾을 수 없습니다")

    biz = await execute(
        supabase.table("businesses")
        .select("user_id, region")
        .eq("id", comp.data["business_id"])
        .maybe_single()
    )
    if not biz.data or biz.data["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    naver_place_id = comp.data.get("naver_place_id") or ""

    # naver_place_id 없으면 자동 조회
    if not naver_place_id:
        naver_place_id = await _find_naver_place_id(
            comp.data.get("name", ""),
            comp.data.get("address", ""),
            biz.data.get("region", ""),
        ) or ""
        if naver_place_id:
            try:
                await execute(
                    supabase.table("competitors")
                    .update({"naver_place_id": naver_place_id})
                    .eq("id", competitor_id)
                )
                _logger.info(f"[sync-place] naver_place_id 자동 저장 — comp={comp.data.get('name')}, place_id={naver_place_id}")
            except Exception as e:
                _logger.warning(f"[sync-place] naver_place_id 저장 실패: {e}")

    if not naver_place_id:
        raise HTTPException(
            status_code=422,
            detail="네이버 플레이스에서 해당 업체를 찾을 수 없습니다. 직접 네이버 플레이스 ID를 입력해주세요.",
        )

    # 동기화 실행 (await로 직접 호출하여 결과 반환)
    from services.competitor_place_crawler import sync_competitor_place
    try:
        result = await sync_competitor_place(competitor_id, naver_place_id, supabase, biz.data.get("region", ""))
    except TypeError:
        # sync_competitor_place 시그니처가 region 파라미터 없는 구버전인 경우 fallback
        result = await sync_competitor_place(competitor_id, naver_place_id, supabase)

    if result and result.get("error"):
        raise HTTPException(status_code=500, detail=f"동기화 실패: {result['error']}")

    return {
        "message": "동기화 완료",
        "competitor_id": competitor_id,
        "name": comp.data.get("name"),
        "naver_place_id": naver_place_id,
        "review_count": result.get("review_count", 0) if result else 0,
        "avg_rating": result.get("avg_rating", 0.0) if result else 0.0,
    }


# ── 경쟁사 약점 분석 ─────────────────────────────────────────────────────────

_NEGATIVE_PATTERNS = [
    "불친절", "불편", "비쌈", "비싸", "대기", "웨이팅", "기다려", "오래 걸려",
    "줄 서", "주차", "좁아", "시끄러", "청결", "위생", "불결", "냄새",
    "별로", "실망", "기대 이하", "아쉬워", "아쉬운", "아쉽", "아쉬웠",
    "소음", "복잡", "혼잡", "불친절한", "느려", "느립니다", "차갑", "싸늘",
    "딱딱", "퉁명", "퉁명스러", "퉁명스럽",
    "맛없", "맛이 없", "맛은 별로", "양이 적", "적은 양", "양 대비",
    "가격 대비", "가성비 별로", "바가지", "과대광고", "광고랑 달라",
]

_NEGATIVE_TO_OPPORTUNITY: dict[str, str] = {
    "주차": "주차가 편리한 가게임을 강조하세요",
    "대기": "웨이팅 없이 바로 입장 가능함을 강조하세요",
    "웨이팅": "웨이팅 없이 바로 입장 가능함을 강조하세요",
    "불친절": "친절한 서비스를 전면에 내세우세요",
    "비쌈": "합리적인 가격을 강조하거나 가성비를 어필하세요",
    "비싸": "합리적인 가격을 강조하거나 가성비를 어필하세요",
    "청결": "청결하고 위생적인 환경을 사진으로 보여주세요",
    "위생": "위생 관리 인증이나 사진을 등록하세요",
    "시끄러": "조용하고 편안한 분위기를 강조하세요",
    "소음": "조용하고 편안한 분위기를 강조하세요",
    "좁아": "넓고 여유로운 공간임을 사진으로 어필하세요",
    "맛없": "시그니처 메뉴의 맛을 블로그 포스팅으로 적극 알리세요",
    "양이 적": "푸짐한 양이나 리필 서비스를 강조하세요",
    "느려": "빠른 서비스와 회전율을 어필하세요",
    "가성비 별로": "가성비 메뉴나 세트를 전면에 내세우세요",
}


async def _fetch_blog_snippets(name: str, region: str) -> tuple[list[str], list[dict]]:
    """경쟁사 이름으로 네이버 블로그 검색.

    Returns:
        (snippets, posts) 튜플.
        snippets: description 텍스트 리스트 (약점 분석용).
        posts: [{"title": str, "link": str, "pubDate": str}] 최대 5개 최신순.
    """
    client_id = os.getenv("NAVER_CLIENT_ID", "")
    client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return [], []

    region_prefix = region.split()[0] if region else ""
    query = f"{region_prefix} {name}".strip() if region_prefix else name

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://openapi.naver.com/v1/search/blog.json",
                params={"query": query, "display": 20, "sort": "date"},
                headers={
                    "X-Naver-Client-Id": client_id,
                    "X-Naver-Client-Secret": client_secret,
                },
                timeout=aiohttp.ClientTimeout(total=8),
            ) as res:
                if res.status != 200:
                    return [], []
                data = await res.json()
                snippets: list[str] = []
                posts: list[dict] = []
                for item in data.get("items", []):
                    text = re.sub(r"<[^>]+>", "", item.get("description", ""))
                    if text:
                        snippets.append(text)
                    if len(posts) < 5:
                        title = re.sub(r"<[^>]+>", "", item.get("title", ""))
                        link = item.get("link", "") or item.get("bloggerlink", "")
                        pub_date = item.get("postdate", "") or item.get("pubDate", "")
                        if title:
                            posts.append({"title": title, "link": link, "pubDate": pub_date})
                return snippets, posts
    except Exception as e:
        _logger.warning(f"[weakness] 블로그 검색 실패 — {name}: {e}")
        return [], []


def _analyze_weakness(snippets: list[str]) -> dict:
    """블로그 snippet에서 부정 키워드 빈도 분석"""
    keyword_counts: dict[str, int] = {}

    for snippet in snippets:
        for pattern in _NEGATIVE_PATTERNS:
            if pattern in snippet:
                # 대표 키워드로 정규화 (_NEGATIVE_TO_OPPORTUNITY 키 우선)
                key = pattern
                for norm_key in _NEGATIVE_TO_OPPORTUNITY:
                    if norm_key in pattern:
                        key = norm_key
                        break
                keyword_counts[key] = keyword_counts.get(key, 0) + 1

    # 빈도 1회 이상인 것만 반환, 빈도순 정렬, 최대 5개
    weaknesses = sorted(
        [
            {
                "keyword": k,
                "count": v,
                "opportunity": _NEGATIVE_TO_OPPORTUNITY.get(
                    k, f"'{k}' 문제를 해결하면 경쟁사 대비 우위를 점할 수 있습니다."
                ),
            }
            for k, v in keyword_counts.items()
            if v >= 1
        ],
        key=lambda x: x["count"],
        reverse=True,
    )[:5]

    return {
        "weaknesses": weaknesses,
        "total_posts_analyzed": len(snippets),
        "has_weakness": len(weaknesses) > 0,
    }


@router.get("/{competitor_id}/weakness")
async def get_competitor_weakness(competitor_id: str, user=Depends(get_current_user)):
    """경쟁사 블로그 포스팅에서 부정 키워드를 추출해 '경쟁사 약점 → 내 가게 공략 포인트'를 반환한다.

    - 플랜 게이트: basic 이상
    - 소유권 검증: competitor → business_id → user_id
    - 네이버 블로그 검색 API 기반, AI 호출 없음
    """
    supabase = get_client()

    # 플랜 게이트: basic 이상만 접근 가능
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    user_plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(user_plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "required_plans": ["basic", "pro", "biz"],
                "upgrade_url": "/pricing",
            },
        )

    # 소유권 검증: competitor → business_id → user_id
    comp = await execute(
        supabase.table("competitors")
        .select("id, name, business_id")
        .eq("id", competitor_id)
        .maybe_single()
    )
    if not comp.data:
        raise HTTPException(status_code=404, detail="경쟁사를 찾을 수 없습니다")

    biz = await execute(
        supabase.table("businesses")
        .select("user_id, region")
        .eq("id", comp.data["business_id"])
        .maybe_single()
    )
    if not biz.data or biz.data["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    comp_name: str = comp.data.get("name", "")
    region: str = biz.data.get("region", "")

    snippets, recent_posts = await _fetch_blog_snippets(comp_name, region)
    analysis = _analyze_weakness(snippets)

    return {
        "competitor_name": comp_name,
        **analysis,
        "recent_posts": recent_posts,
    }


async def _scan_new_competitor(comp_id: str, comp_name: str, business_id: str, supabase) -> None:
    """경쟁사 등록 직후 Gemini 단일 스캔 실행 → 최근 scan_results.competitor_scores에 병합.
    plan_gate 체크 없이 직접 실행 (사용자 스캔 한도 소비 없음).
    
    Race condition 방지: Gemini AI 스캔을 먼저 완료한 후 DB에서 최신 값을 다시 읽어
    다른 경쟁사 스캔 결과와 충돌 없이 병합한다.
    """
    import asyncio as _asyncio
    try:
        # 사업장 정보 조회 (쿼리 생성용)
        biz_row = await execute(
            supabase.table("businesses")
            .select("name, category, region")
            .eq("id", business_id)
            .maybe_single()
        )
        if not biz_row.data:
            _logger.warning(f"[competitor_scan] 사업장 조회 실패 — biz={business_id}")
            return

        biz = biz_row.data
        category = biz.get("category", "")
        region = biz.get("region", "")

        keyword_ko = _CATEGORY_KO.get(category, category)
        query = f"{region} {keyword_ko}".strip() if region else keyword_ko

        # Gemini 단일 스캔 (single_check_with_competitors 사용)
        from services.ai_scanner.gemini_scanner import GeminiScanner
        gemini = GeminiScanner()
        result = await gemini.single_check_with_competitors(query, comp_name)

        mentioned = bool(result.get("mentioned"))
        excerpt = result.get("excerpt", "")
        base_score = 60.0 if mentioned else 30.0
        breakdown = {
            "ai_visibility_t1": round(base_score * 0.9, 1),
            "review_quality_t1": round(base_score * 0.85, 1),
            "online_mentions_t2": round(base_score * 0.75, 1),
            "google_presence": round(base_score * 0.7, 1),
        }
        new_entry = {
            "name": comp_name,
            "mentioned": mentioned,
            "score": base_score,
            "excerpt": excerpt,
            "breakdown": breakdown,
        }

        # ── Race condition 방지: Gemini 스캔 완료 후 최신 DB 값 재조회 후 병합 ──
        # 여러 경쟁사가 동시에 등록될 경우 각 태스크가 순서대로 스캔을 완료하고
        # 그 시점의 최신 competitor_scores를 읽어 자신의 항목만 추가 → 덮어쓰기 없음
        scan_row = await execute(
            supabase.table("scan_results")
            .select("id, competitor_scores")
            .eq("business_id", business_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .maybe_single()
        )
        if not scan_row.data:
            _logger.info(f"[competitor_scan] 기존 스캔 없음 — comp={comp_name}, biz={business_id}")
            return

        scan_id = scan_row.data["id"]
        # 최신 competitor_scores를 다시 읽어 자신의 항목만 추가 (기존 항목 보존)
        existing_scores: dict = scan_row.data.get("competitor_scores") or {}
        existing_scores[comp_id] = new_entry

        await execute(
            supabase.table("scan_results")
            .update({"competitor_scores": existing_scores})
            .eq("id", scan_id)
        )
        _logger.info(
            f"[competitor_scan] 완료 — comp={comp_name}, mentioned={mentioned}, scan_id={scan_id}"
        )

    except Exception as e:
        _logger.warning(f"[competitor_scan] 실패 — comp={comp_name}, biz={business_id}: {e}")


@router.get("/{competitor_id}/faq-items")
async def get_competitor_faq_items(competitor_id: str, user=Depends(get_current_user)):
    """경쟁사 네이버 플레이스 FAQ 질문 목록 실시간 크롤링 (Basic+).

    ChatGPT로는 얻을 수 없는 데이터 — 경쟁사 사장님이 직접 등록한 FAQ 질문만 추출.
    답변 본문은 저작권 이슈로 수집하지 않음.
    Playwright Semaphore(2) 는 크롤러 내부에서 처리되므로 별도 제어 불필요.
    """
    supabase = get_client()

    # 플랜 게이트: basic 이상만 접근 가능
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    user_plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(user_plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "required_plans": ["basic", "pro", "biz"],
                "upgrade_url": "/pricing",
            },
        )

    # 소유권 검증: competitor → business_id → user_id
    comp = await execute(
        supabase.table("competitors")
        .select("id, name, naver_place_id, business_id")
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

    naver_place_id = comp.data.get("naver_place_id") or ""
    if not naver_place_id:
        raise HTTPException(
            status_code=422,
            detail="네이버 플레이스 ID가 설정되지 않았습니다",
        )

    from services.competitor_place_crawler import fetch_competitor_faq_items
    result = await fetch_competitor_faq_items(naver_place_id)

    if result.get("error") == "deprecated_qna_tab_removed":
        return {
            "naver_place_id": naver_place_id,
            "questions": [],
            "collected_at": result.get("collected_at"),
            "deprecated": True,
            "message": "네이버 스마트플레이스 Q&A 탭이 폐기(2026-05-01)되어 질문 수집이 불가합니다. 경쟁사 소개글의 Q&A 섹션은 '플레이스 현황' 카드에서 확인하세요.",
        }
    if result.get("error"):
        raise HTTPException(
            status_code=500,
            detail=f"FAQ 수집 실패: {result['error']}",
        )

    return result


