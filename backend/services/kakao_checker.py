"""
카카오맵 비즈니스 완성도 체커
- 카카오 로컬 API(이미 승인)로 사업장 등록 여부 확인
- 사용자 직접 입력 체크리스트로 완성도 점수 산정
- API 심사 불필요 방식

담당: backend-dev 에이전트 | v3.2
"""
import asyncio
import logging
import os

import aiohttp

_logger = logging.getLogger("aeolab")

# ─────────────────────────────────────────────────────────────────────────────
# 체크리스트 항목 정의
# key        : 내부 식별자
# label      : 사용자 표시 문구
# weight     : 완성도 점수 반영 가중치 (합계 100)
# auto       : True → 카카오 API 자동 확인 / False → 사용자 직접 입력
# tip        : 미충족 시 개선 조언
# ─────────────────────────────────────────────────────────────────────────────
KAKAO_CHECKLIST: list[dict] = [
    {
        "key": "is_registered",
        "label": "카카오맵 등록",
        "weight": 25,
        "auto": True,
        "tip": "카카오 내 사업장 등록(https://biz.kakao.com)에서 사업장을 등록하세요. 카카오맵·카카오내비 노출의 전제 조건입니다.",
    },
    {
        "key": "has_hours",
        "label": "영업시간 입력",
        "weight": 15,
        "auto": False,
        "tip": "카카오 내 사업장 관리 → 기본 정보에서 영업시간을 입력하세요. 영업시간이 없으면 '정보 없음'으로 표시되어 방문 의향이 낮아집니다.",
    },
    {
        "key": "has_phone",
        "label": "전화번호 등록",
        "weight": 15,
        "auto": False,
        "tip": "카카오 내 사업장에서 대표 전화번호를 등록하세요. 전화연결 버튼은 즉시 방문 고객 전환율을 높입니다.",
    },
    {
        "key": "has_photos",
        "label": "사진 3장 이상 등록",
        "weight": 20,
        "auto": False,
        "tip": "카카오 내 사업장 → 사진 관리에서 대표 사진 3장 이상을 등록하세요. 사진 있는 사업장의 클릭률은 평균 2.3배 높습니다.",
    },
    {
        "key": "has_kakao_channel",
        "label": "카카오톡 채널 연결",
        "weight": 15,
        "auto": False,
        "tip": "카카오톡 채널(https://business.kakao.com/dashboard/chplus)를 개설하고 내 사업장과 연결하세요. 고객 문의 창구로 활용할 수 있습니다.",
    },
    {
        "key": "has_menu_info",
        "label": "메뉴/서비스 정보 등록",
        "weight": 10,
        "auto": False,
        "tip": "카카오 내 사업장 → 메뉴/서비스 탭에 대표 메뉴나 서비스를 3개 이상 등록하세요. AI 검색 노출 시 카드 형태로 표시됩니다.",
    },
]

# 카카오 로컬 API 엔드포인트
_KAKAO_LOCAL_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


async def check_kakao_registration(business_name: str, region: str) -> bool:
    """등록 여부 bool (확인하지 못한 경우도 False). 저장·점수에 쓰지 말 것 — `check_kakao_registration_or_none`을 쓴다.

    2026-11-01: API 키 없음·HTTP 오류·타임아웃을 '미등록(False)'과 구분하지 못해, 카카오 API가 한 번 실패하면 등록된 가게가
    businesses.kakao_registered=False로 덮어써졌다(지침 9: 측정 못 한 것은 0이 아니라 '확인 전'). 호환용 래퍼로만 남긴다.
    """
    return bool(await check_kakao_registration_or_none(business_name, region))


async def check_kakao_registration_or_none(business_name: str, region: str) -> "bool | None":
    """
    카카오 로컬 API로 사업장 등록 여부 확인.

    검색어: "{region 앞 2글자} {business_name}" → 결과에 business_name 포함 시 True.
    **확인하지 못한 경우(API 키 없음·HTTP 오류·타임아웃·예외)는 None** — '미등록(False)'이 아니다. 호출자는 None이면 저장된 값을 바꾸지 않는다.

    Args:
        business_name: 사업장 이름
        region: 지역명 (예: "서울 강남구")

    Returns:
        True(검색 결과에 있음) / False(확인했고 결과에 없음) / None(확인 못 함)
    """
    rest_key = os.getenv("KAKAO_REST_API_KEY")
    if not rest_key:
        _logger.warning("KAKAO_REST_API_KEY 미설정 — 등록 여부 확인 못 함(None)")
        return None

    region_prefix = region.split()[0] if region else ""
    full_query = f"{region_prefix} {business_name}".strip()

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _KAKAO_LOCAL_URL,
                params={"query": full_query, "size": 10},
                headers={"Authorization": f"KakaoAK {rest_key}"},
                timeout=aiohttp.ClientTimeout(total=5),
            ) as res:
                if res.status != 200:
                    _logger.warning(f"카카오 로컬 API 오류: status={res.status} — 확인 못 함(None)")
                    return None
                data = await res.json()

        documents = data.get("documents", [])
        name_lower = business_name.strip().lower()
        for doc in documents:
            place_name = doc.get("place_name", "").strip().lower()
            if name_lower in place_name or place_name in name_lower:
                return True
        return False

    except asyncio.TimeoutError:
        _logger.warning(f"카카오 로컬 API 타임아웃 (5s) — business_name={business_name} — 확인 못 함(None)")
        return None
    except Exception as e:
        _logger.warning(f"카카오 로컬 API 호출 실패: {e} — 확인 못 함(None)")
        return None


def calculate_kakao_score(checklist: dict) -> dict:
    """
    체크리스트 결과로 카카오맵 완성도 점수 계산.

    Args:
        checklist: 항목별 True/False dict
            예) {"is_registered": True, "has_hours": False, "has_photos": True, ...}

    Returns:
        {
          "score": int (0~100),
          "checklist_result": [
            {"key": ..., "label": ..., "weight": ..., "checked": bool, "tip": str | None}
          ],
          "tips": [str]  # 미충족 항목 중 가중치 높은 순으로 개선 조언 최대 3개
        }
    """
    total_score = 0
    checklist_result = []
    missed_items: list[dict] = []

    for item in KAKAO_CHECKLIST:
        key = item["key"]
        checked = bool(checklist.get(key, False))
        if checked:
            total_score += item["weight"]
        else:
            missed_items.append(item)

        checklist_result.append({
            "key":     key,
            "label":   item["label"],
            "weight":  item["weight"],
            "auto":    item["auto"],
            "checked": checked,
            "tip":     None if checked else item["tip"],
        })

    # 가중치 높은 순으로 개선 조언 최대 3개
    missed_sorted = sorted(missed_items, key=lambda x: x["weight"], reverse=True)
    tips = [m["tip"] for m in missed_sorted[:3]]

    return {
        "score":            total_score,
        "checklist_result": checklist_result,
        "tips":             tips,
    }


async def build_kakao_checklist_with_auto(
    business_name: str,
    region: str,
    user_checklist: dict,
    fallback_registered: "bool | None" = None,
) -> dict:
    """
    자동 항목(is_registered)을 API로 확인하고, 사용자 체크리스트와 합쳐 점수를 반환.

    Args:
        business_name: 사업장 이름
        region: 지역명
        user_checklist: 사용자가 입력한 체크리스트 (auto=False 항목)
        fallback_registered: API로 확인하지 못했을 때 점수 계산에 쓸 직전 저장값(없으면 False로 계산하되 저장은 하지 않는다)

    Returns:
        calculate_kakao_score() 반환 구조 + "is_registered_auto": True/False(확인함) 또는 None(확인 못 함 — 저장하지 말 것)
    """
    checked = await check_kakao_registration_or_none(business_name, region)
    is_registered = checked if checked is not None else bool(fallback_registered)

    merged = {**user_checklist, "is_registered": is_registered}
    result = calculate_kakao_score(merged)
    result["is_registered_auto"] = checked   # None이면 호출자가 kakao_registered를 덮어쓰지 않는다
    return result
