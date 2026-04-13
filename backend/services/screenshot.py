import asyncio
import uuid
import os
import re
from playwright.async_api import async_playwright


async def capture_ai_result(
    platform: str, query: str, biz_id: str, capture_type: str = "before"
) -> str:
    """AI 검색 결과 스크린샷 캡처 → Supabase Storage 업로드"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],  # 서버 환경 필수
        )
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="ko-KR",
            timezone_id="Asia/Seoul",
        )
        page = await ctx.new_page()

        try:
            if platform == "naver":
                await page.goto(
                    f"https://search.naver.com/search.naver?query={query}",
                    timeout=30000,
                )
                await page.wait_for_timeout(2000)  # AI 브리핑 로딩 대기
            elif platform == "perplexity":
                await page.goto("https://www.perplexity.ai", timeout=30000)
                await page.fill("textarea[placeholder]", query)
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(5000)  # 답변 생성 대기
            elif platform == "google":
                await page.goto(
                    f"https://www.google.com/search?q={query}",
                    timeout=30000,
                )
                await page.wait_for_timeout(2000)

            fname = f"{biz_id}_{platform}_{capture_type}_{uuid.uuid4().hex[:8]}.png"
            img_bytes = await page.screenshot(
                clip={"x": 0, "y": 0, "width": 1280, "height": 1200}
            )
        finally:
            await browser.close()

    # Supabase Storage 업로드
    from db.supabase_client import get_storage

    path = f"screenshots/{biz_id}/{fname}"
    storage = get_storage()
    storage.from_("before-after").upload(path, img_bytes)
    public_url = storage.from_("before-after").get_public_url(path)
    return public_url


# 영문 → 한글 키워드 변환 테이블 (사용자가 영문으로 입력한 경우 대응)
_EN_TO_KO: dict[str, str] = {
    "cafe": "카페",
    "coffee": "커피",
    "bakery": "베이커리",
    "beauty": "미용",
    "hair": "헤어",
    "nail": "네일",
    "fitness": "피트니스",
    "gym": "헬스",
    "yoga": "요가",
    "pilates": "필라테스",
    "dental": "치과",
    "clinic": "의원",
    "hospital": "병원",
    "pharmacy": "약국",
    "law": "법률",
    "lawyer": "변호사",
    "academy": "학원",
    "school": "학원",
    "restaurant": "음식점",
    "food": "음식",
    "chicken": "치킨",
    "pizza": "피자",
    "sushi": "초밥",
    "ramen": "라멘",
    "design": "디자인",
    "photo": "사진·영상",
    "video": "영상",
    "studio": "스튜디오",
    "wedding": "웨딩",
    "travel": "여행",
    "hotel": "호텔",
    "pet": "반려동물",
    "dog": "강아지",
    "cat": "고양이",
    "car": "자동차",
    "repair": "수리",
    "cleaning": "청소",
    "moving": "이사",
    "interior": "인테리어",
    "print": "인쇄",
    "printing": "인쇄",
    "shop": "가게",
    "store": "매장",
    "market": "마켓",
    "delivery": "배달",
    "kids": "어린이",
    "baby": "유아",
    "clothes": "의류",
    "fashion": "패션",
    "shoes": "신발",
    "jewelry": "주얼리",
    "massage": "마사지",
    "spa": "스파",
    "skincare": "피부관리",
    "it": "IT",
    "software": "소프트웨어",
    "web": "웹",
    "app": "앱",
    "game": "게임",
    "news": "뉴스",
    "broadcasting": "방송",
    "music": "음악",
    "art": "미술",
    "gallery": "갤러리",
    "book": "도서",
    "education": "교육",
    "consulting": "컨설팅",
    "marketing": "마케팅",
    "accounting": "회계",
    "tax": "세무",
    "real estate": "부동산",
    "realestate": "부동산",
    "insurance": "보험",
    "finance": "금융",
    "sports": "스포츠",
    "golf": "골프",
    "swimming": "수영",
    "taekwondo": "태권도",
    "boxing": "복싱",
}


def _normalize_keyword(kw: str) -> str | None:
    """영문 키워드를 한글로 변환. 번역 불가 영문은 None 반환(쿼리 제외)"""
    stripped = kw.strip()
    lower = stripped.lower()
    if lower in _EN_TO_KO:
        return _EN_TO_KO[lower]
    # 영문(ASCII 위주)이면서 번역 테이블에 없으면 제외
    if re.match(r"^[a-zA-Z0-9\s\-_]+$", stripped):
        return None
    return stripped


def _extract_city(region: str) -> str:
    """지역명에서 시(市) 단위만 추출
    예: "창원 성산구" → "창원", "서울특별시 강남구" → "서울"
    """
    if not region:
        return region
    first = region.strip().split()[0]
    cleaned = re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도)$", "", first)
    return cleaned if cleaned else first


def _extract_district(region: str) -> str:
    """지역명에서 구(區) 단위 추출
    예: "창원 성산구" → "성산구", "서울 강남구" → "강남구", "창원" → ""
    """
    if not region:
        return ""
    parts = region.strip().split()
    # 두 번째 토큰이 구/군/동으로 끝나면 반환
    if len(parts) >= 2:
        candidate = parts[1]
        if re.search(r"(구|군|동)$", candidate):
            return candidate
    # 첫 번째 토큰 자체가 구/군이면 반환 (구 단위로만 등록된 경우)
    if re.search(r"(구|군)$", parts[0]):
        return parts[0]
    return ""


def build_queries(biz: dict) -> list:
    """사업장 정보로 대표 검색 쿼리 생성
    우선순위: 등록 키워드 > 카테고리 한글명
    - 키워드 있으면: {지역} {키워드} 추천 (최대 2개) + 카테고리 fallback
    - 키워드 없으면: {지역} {카테고리} 추천 + 구 단위 쿼리 + 가게명 직접 검색
    - 영문 키워드는 자동으로 한글 변환
    """
    # 순환 import 방지: _CATEGORY_KO를 함수 내부에서 import
    try:
        from routers.scan import _CATEGORY_KO as _SCAN_CATEGORY_KO
    except Exception:
        _SCAN_CATEGORY_KO = {}

    region = biz.get("region", "")
    category = biz.get("category", "")
    keywords = biz.get("keywords") or []
    name = biz.get("name", "")
    city = _extract_city(region)          # "창원 성산구" → "창원"
    district = _extract_district(region)  # "창원 성산구" → "성산구"
    category_ko = _SCAN_CATEGORY_KO.get(category, category)

    # 유효한 키워드 필터링 (공백·영문만·1글자 이하 제외, 영문은 한글로 변환)
    valid_keywords = []
    for kw in keywords:
        normalized = _normalize_keyword(kw)
        if normalized and len(normalized) >= 2:
            valid_keywords.append(normalized)

    queries = []

    if valid_keywords:
        # 키워드 우선: 실제 고객 검색 패턴 반영 (최대 3개)
        for kw in valid_keywords[:3]:
            q = f"{city} {kw} 추천"
            if q not in queries:
                queries.append(q)
        # fallback: 카테고리 쿼리
        q_cat = f"{city} {category_ko} 추천"
        if q_cat not in queries:
            queries.append(q_cat)
    else:
        # 키워드 없으면 카테고리 기반
        queries.append(f"{city} {category_ko} 추천")
        if district:
            queries.append(f"{city} {district} {category_ko} 추천")
        # 가게 이름 직접 검색
        if name:
            queries.append(f"{name} {category_ko}")

    return queries[:4]  # 최대 4개


async def capture_batch(biz_id: str, queries: list) -> list:
    """가입 시점 Before 일괄 캡처 — 순차 실행 (RAM 4GB 서버 보호)
    RAM 원칙: Playwright 인스턴스 1개 ≈ 300~500MB → 동시 2개 이상 금지
    """
    results = []
    for q in queries[:3]:  # 대표 쿼리 3개만
        try:
            url = await capture_ai_result("naver", q, biz_id, "before")
            results.append(url)
        except Exception as e:
            results.append(None)
        await asyncio.sleep(3)  # 브라우저 메모리 해제 대기
    return results
