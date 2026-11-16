"""
backend/services/area_data.py

/area(우리 동네 상권) 공개 페이지의 고정 목록 — 지역(시군구)·업종·범위 라벨.

원칙
- 방문자 요청 경로에서는 외부 API를 부르지 않는다. 이 목록은 "무엇을 수집·표시할지"만 정한다.
- 지역은 소상공인시장진흥공단 상가(상권)정보 API가 주는 공식 시군구 목록(area_regions.json, 2026-11-15 수집)이다.
  손으로 적지 않는다 — 2026년 개편(전남광주통합특별시·인천 검단구·대구 군위군 등)이 이미 반영돼 있다.
  개편 뒤 목록을 바꿀 때는 같은 API로 다시 받아 JSON을 교체한다.
- 업종은 두 데이터(상가정보 업소 수·인허가 폐업률)가 모두 있고 정의가 크게 어긋나지 않는 것만 연다.
  반려동물(상가정보 G22001='애완동물·용품 소매업' vs 인허가=동물병원)·마사지·피트니스는 정의가 달라 제외했다
  (상권업종 코드 이름은 2026-11-15 실호출로 확인).
"""
from __future__ import annotations

import json
from pathlib import Path

_REGIONS_FILE = Path(__file__).resolve().parent / "area_regions.json"


def _load_regions() -> dict[str, dict]:
    doc = json.loads(_REGIONS_FILE.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    for r in doc["regions"]:
        sido, sido_official, name = r["sido"], r["sido_official"], r["name"]
        # 세종은 시도와 시군구 이름이 같다 → 중복 표기를 피한다
        if name == sido_official:
            slug, label, query = sido, sido, sido_official
            sigungu = sido
        else:
            slug = f"{sido}-{name.replace(' ', '-')}"
            label = f"{sido} {name}"
            # 조회에는 공식 전체 이름을 쓴다(약칭 변환에 의존하지 않음) — 인허가는 지번주소 부분일치,
            # 상가정보는 카카오 주소검색으로 좌표 변환
            query = f"{sido_official} {name}"
            sigungu = name
        if slug in out:
            raise ValueError(f"중복 지역 슬러그: {slug}")
        out[slug] = {
            "slug": slug,
            "label": label,
            "sido": sido,
            "sigungu": sigungu,
            "query": query,
            "code": r.get("code"),
        }
    return out


REGIONS: dict[str, dict] = _load_regions()

# 1차로 여는 업종 → 화면 이름
CATEGORIES: dict[str, str] = {
    "restaurant": "음식점",
    "cafe": "카페",
    "bakery": "제과점·베이커리",
    "bar": "주점",
    "accommodation": "숙박",
    "beauty": "미용실",
    "nail": "네일",
    "skincare": "피부관리",
    "pharmacy": "약국",
    "optics": "안경점",
    "billiards": "당구장",
}

# 업소 수(상가정보)의 실제 집계 범위 — 상권업종 코드의 공식 이름(2026-11-15 실호출 확인)
SBIZ_SCOPE_LABEL: dict[str, str] = {
    "restaurant": "음식(한식·중식·일식·서양식·동남아·기타 외국·구내식당/뷔페)",
    "cafe": "카페(비알코올 음료점)",
    "bakery": "빵·도넛",
    "bar": "주점",
    "accommodation": "숙박업 전체",
    "beauty": "미용실",
    "nail": "네일숍",
    "skincare": "피부 관리실",
    "pharmacy": "약국",
    "optics": "안경·정밀기기 소매",
    "billiards": "당구장",
}

# 폐업률 데이터의 실제 범위 — 인허가 데이터셋이 업종과 1:1이 아니라서 화면에 그대로 밝힌다.
CLOSURE_SCOPE_LABEL: dict[str, str] = {
    "restaurant": "일반음식점 전체",
    "cafe": "휴게음식점 전체(카페 외 포함)",
    "bakery": "휴게음식점 전체(제과점 외 포함)",
    "bar": "일반음식점 중 호프·주점",
    "accommodation": "숙박업 전체",
    "beauty": "미용업 전체(네일·피부 포함)",
    "nail": "미용업 전체(네일 외 포함)",
    "skincare": "미용업 전체(피부 외 포함)",
    "pharmacy": "약국",
    "optics": "안경업",
    "billiards": "당구장업",
}

# 같은 인허가 데이터셋을 쓰는 업종은 한 번만 조회해 재사용한다(호출 절약, 값은 동일해야 정상).
CLOSURE_REUSE_FROM: dict[str, str] = {
    "nail": "beauty",
    "skincare": "beauty",
    "bakery": "cafe",
}


def is_valid(region_slug: str, category: str) -> bool:
    return region_slug in REGIONS and category in CATEGORIES
