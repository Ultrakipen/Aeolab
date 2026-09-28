"""블로그 언급 수 검증 집계 — "가게 이름이 실제로 나온 글"만 센다 (2026-09-28).

배경 (실측):
- 네이버 블로그 검색 API의 `total`은 따옴표("...")를 무시하고 단어를 따로 매칭한다. 가게 이름이 "안민 중동"·
  "하라식당"처럼 흔한 단어로 이뤄지면 가게와 무관한 글(민원발급기·병원 목록 등)이 합산된다
  (안민 중동 total 2,336건 → 상위 100건 중 이름이 나온 글 1건, 하라식당 본점 37건 → 3건).
  2026-07-14에 "따옴표 exact match로 과대집계 수정"이라 적었으나 따옴표가 무시되므로 효과가 없었다.
- 같은 이름의 다른 지역 가게·같은 동네 이름(성산구 상남동 vs 마산합포구 상남동, 강남구 신사동 vs 은평구 신사동)의
  글이 섞인다. 흔한 이름("본가")은 이름이 나온 글 33건 중 6건이 다른 지역이었다.

방식:
1. `f"{지역} {이름}"`으로 sim 정렬 상위 100건을 받는다.
2. 제목+요약에 (지점 접미사를 뗀 이름 포함) 정규화한 가게 이름이 실제로 나온 글만 남긴다.
3. 그중 **지역이 확인되는 글**만 센다(아래 `region_ok`). 다른 지역 글은 `region_excluded`로 따로 집계.

한계 (화면에도 "하한값"으로 밝힐 것):
- 본문에만 이름이 나오는 글은 빠진다. 요약에 지역이 없는 글도 빠진다(시 단위 확인 기준 실측 손실 약 4%).
- 같은 지역 안의 동명 가게는 구분할 수 없다.
- 상위 100건까지만 본다 — 100건에 가까우면 `capped`(100건 이상일 수 있음).
"""
from __future__ import annotations

import logging
import re
from typing import Awaitable, Callable, Optional

_logger = logging.getLogger("aeolab")

# 특별시·광역시(+세종): 시 이름만으로는 지역이 좁혀지지 않는다(구 단위 확인 필요)
_METRO = {"서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종"}

# 구를 가진 일반 시 — 같은 시의 "다른 구" 글을 걸러내기 위한 구 이름 표지 (구 이름에서 '구' 제거)
# 통합시(창원)는 옛 시 이름(마산·진해)도 표지로 쓴다.
_CITY_GU: dict[str, dict[str, set[str]]] = {
    "창원": {"의창": {"의창"}, "성산": {"성산"}, "마산합포": {"합포", "마산합포", "마산"},
           "마산회원": {"회원", "마산회원", "마산"}, "진해": {"진해"}},
    "수원": {"장안": {"장안"}, "권선": {"권선"}, "팔달": {"팔달"}, "영통": {"영통"}},
    "성남": {"수정": {"수정"}, "중원": {"중원"}, "분당": {"분당"}},
    "용인": {"처인": {"처인"}, "기흥": {"기흥"}, "수지": {"수지"}},
    "고양": {"덕양": {"덕양"}, "일산동": {"일산"}, "일산서": {"일산"}},
    "안양": {"만안": {"만안"}, "동안": {"동안"}},
    "안산": {"상록": {"상록"}, "단원": {"단원"}},
    "청주": {"상당": {"상당"}, "서원": {"서원"}, "흥덕": {"흥덕"}, "청원": {"청원"}},
    "천안": {"동남": {"동남"}, "서북": {"서북"}},
    "전주": {"완산": {"완산"}, "덕진": {"덕진"}},
}

# 특별시·광역시의 구 이름(구 접미사 제외, 다른 구의 글을 식별하는 표지). 남·동·서·북·중처럼 일반 단어와 겹치는 이름은 뺐다.
_METRO_GU_NAMES = {
    "강남", "강동", "강북", "강서", "관악", "광진", "구로", "금천", "노원", "도봉", "동대문", "동작", "마포", "서대문",
    "서초", "성동", "성북", "송파", "양천", "영등포", "용산", "은평", "종로", "중랑",          # 서울
    "금정", "동래", "부산진", "사상", "사하", "수영", "연제", "영도", "해운대",                # 부산
    "달서", "달성", "수성",                                                                      # 대구
    "계양", "미추홀", "부평", "연수",                                                            # 인천
    "광산", "유성", "대덕", "북구",                                                              # 광주·대전
}

_SUFFIX_CITY = re.compile(r"(특별시|광역시|특별자치시|특별자치도|시|군|도)$")


def _norm(t: str) -> str:
    return re.sub(r"[\s\-_·.,()\[\]\"']+", "", t or "").lower()


def _strip_tags(t: str) -> str:
    return re.sub(r"<[^>]+>", "", t or "")


class RegionKey:
    """지역 문자열 → 판정용 표지. 예: '창원시 의창구', '서울 강남구 신사동', '경상남도 창원시 성산구 상남동', '김해시', '전국'."""

    __slots__ = ("city", "gu_key", "gu_tokens", "dong", "metro")

    def __init__(self, region: str):
        parts = [p for p in re.split(r"\s+", (region or "").strip()) if p]
        self.city = ""
        self.gu_key = ""
        self.gu_tokens: set[str] = set()
        self.dong = ""
        for p in parts:
            if p in ("전국", "전체", "온라인"):
                continue
            if re.search(r"(도|특별자치도)$", p) and len(p) >= 3 and not p.endswith(("시", "군")) and p not in _METRO:
                continue  # 경상남도·제주특별자치도 등 광역 단위는 표지로 쓰지 않음(너무 넓음)
            base = _SUFFIX_CITY.sub("", p).strip()
            if p.endswith("구") and len(p) >= 2:
                self.gu_key = p[:-1]
            elif p.endswith(("동", "읍", "면")) and len(p) >= 2:
                self.dong = p[:-1] if p.endswith("동") else p
            elif (p.endswith(("시", "군")) or base in _METRO) and base and not self.city:
                self.city = base
            elif base and not self.city and not self.gu_key:
                self.city = base  # "서울"·"창원" 처럼 접미사 없이 쓴 경우
        self.metro = self.city in _METRO
        if self.gu_key:
            # 창원 마산합포구 → {"합포","마산합포","마산"} 처럼 옛 지명 표지를 함께 쓴다
            table = _CITY_GU.get(self.city, {})
            self.gu_tokens = set(table.get(self.gu_key, set())) | {self.gu_key}

    @property
    def empty(self) -> bool:
        return not (self.city or self.gu_key or self.dong)


def region_ok(text_norm: str, key: RegionKey) -> bool:
    """정규화된 글(제목+요약)이 이 지역의 글로 확인되는지.

    - 지역 정보가 없으면(전국·빈 값) 제한하지 않는다.
    - 특별시·광역시: 내 구 이름이 있어야 한다. 구 이름 없이 동 이름만 쓴 글은 시 이름이 있고 **다른 구 표지가
      없을 때만** 인정(같은 시 안에 구가 많고 동 이름이 겹침). 구·동 정보가 없으면 시 이름.
    - 일반 시: 시 이름이 있어야 한다. 같은 시의 **다른 구** 표지만 있고 내 구 표지가 없으면 제외
      (창원 성산구 상남동 vs 마산합포구 상남동).
    """
    if key.empty:
        return True
    has_city = bool(key.city) and key.city in text_norm
    has_gu = any(g in text_norm for g in key.gu_tokens) if key.gu_tokens else False
    has_dong = bool(key.dong) and key.dong in text_norm
    if key.metro:
        if key.gu_tokens:
            if has_gu:
                return True
            # 구 이름 없이 "서울 신사동"처럼 동 이름만 쓴 글: 다른 구 표지가 없고 시 이름이 있을 때만 인정
            # (같은 동 이름이 여러 구에 있다 — 강남구 신사동 vs 은평구 신사동)
            others = _METRO_GU_NAMES - key.gu_tokens
            return has_dong and has_city and not any(o in text_norm for o in others)
        if key.dong:
            return has_dong and has_city
        return has_city
    if key.city and not has_city:
        # 시 이름이 없어도 내 구/동 표지가 있으면 통과시키지 않는다 — 다른 시의 같은 구·동 이름일 수 있음
        return False
    if key.gu_key:
        table = _CITY_GU.get(key.city)
        if table and not has_gu:
            others: set[str] = set()
            for k, toks in table.items():
                if k != key.gu_key:
                    others |= toks
            others -= key.gu_tokens
            if any(o in text_norm for o in others):
                return False
    return True


def name_variants(name: str) -> set[str]:
    """이름 + 지점 접미사('본점'·'OO점') 뗀 이름. 길이 2 미만은 제외."""
    name = (name or "").strip()
    core = re.sub(r"\s*(본점|직영점|[가-힣0-9]{1,6}점)$", "", name).strip()
    return {v for v in (_norm(name), _norm(core)) if len(v) >= 2}


def verify_items(items: list[dict], name: str, region: str, must_contain: Optional[list[str]] = None) -> dict:
    """블로그 검색 결과 items(title·description)에서 이름이 실제 나온 + 지역이 확인된 글 수를 센다.

    must_contain: 추가로 요약·제목에 있어야 하는 단어들(키워드별 비교용, 하나라도 포함되면 통과).
    """
    variants = name_variants(name)
    key = RegionKey(region)
    name_hits = confirmed = 0
    kws = [_norm(k) for k in (must_contain or []) if _norm(k)]
    for it in items or []:
        txt = _norm(_strip_tags(it.get("title", "")) + _strip_tags(it.get("description", "")))
        if not variants or not any(v in txt for v in variants):
            continue
        name_hits += 1
        if not region_ok(txt, key):
            continue
        if kws and not any(k in txt for k in kws):
            continue
        confirmed += 1
    return {
        "count": confirmed,
        "name_hits": name_hits,
        "region_excluded": name_hits - confirmed if not kws else None,
        "sampled": len(items or []),
    }


async def fetch_verified_blog(
    name: str,
    region: str,
    get: Callable[[str, dict], Awaitable[dict]],
    must_contain: Optional[list[str]] = None,
) -> Optional[dict]:
    """상위 100건을 받아 `verify_items`로 센다. 조회 실패는 None(0으로 오판 금지).

    반환: count·name_hits·region_excluded·sampled·api_total·capped·(위 verify_items 필드)
    """
    name = (name or "").strip()
    if not name or not name_variants(name):
        return None
    key = RegionKey(region)
    prefix_parts = [p for p in (key.city, key.gu_key and f"{key.gu_key}구", key.dong and f"{key.dong}동") if p]
    q = f"{' '.join(prefix_parts)} {name}".strip()
    d = await get("blog", {"query": q, "display": 100, "sort": "sim"})
    if not isinstance(d, dict) or d.get("total") is None:
        return None
    items = d.get("items") or []
    res = verify_items(items, name, region, must_contain)
    res["api_total"] = int(d.get("total") or 0)
    # 상위 100건이 거의 다 확인된 글이면 실제로는 100건 이상일 수 있다
    res["capped"] = bool(len(items) >= 100 and res["count"] >= 90)
    return res
