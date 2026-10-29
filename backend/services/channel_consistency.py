"""채널 정보 일관성 점검 — 사장님이 입력한 정보 vs 카카오·네이버·구글 지도 (2026-10-30).

설계: docs/naver_independence_design_v2.0_final_2026_10_29.md §5-2

원칙
- LLM을 쓰지 않는다. 정규화한 값을 코드로 비교한다(환각 없음).
- 조회 실패·채널이 제공하지 않는 값은 "불일치"가 아니라 unknown(확인 못함)이다 (error ≠ false).
  예) 네이버 지역검색은 전화번호를 주지 않고, 구글에는 전화가 등록되지 않은 가게의 필드가 응답에서 빠진다.
- 네이버에는 공식 지역검색 API만 쓴다(Playwright 접속 없음 — 차단 대응 지침 8번).
- 구글 응답은 저장하지 않는다(Places 약관). 이 모듈은 DB를 건드리지 않고 결과를 호출자에게 돌려준다.
- 프랜차이즈 포함: 저장된 플레이스 ID가 있으면 그 지점을 쓰고, 없고 같은 구에 동일 브랜드가 여럿이면 ambiguous(지점 특정 불가).
"""
import asyncio
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import aiohttp

from services import google_places_client as places
from services.ai_scanner.chatgpt_scanner import names_match
from services.kakao_visibility import _district_token, _region_query_prefix, _search as _kakao_search
from services.local_search import search_naver

_logger = logging.getLogger("aeolab")

_KAKAO_TIMEOUT = aiohttp.ClientTimeout(total=6)

# ── 정규화 ──────────────────────────────────────────────────────────────────


def _s(v) -> str:
    return str(v).strip() if v is not None else ""


def norm_name(name) -> str:
    """chatgpt_scanner._norm_name / kakao_visibility._norm 과 같은 규칙 — 공백·기호 제거, 소문자"""
    return re.sub(r"[\s\-·.,()\[\]'\"“”‘’]+", "", _s(name)).lower()


def norm_phone(v) -> str:
    """숫자만 남기고 국가번호(+82)를 0으로 바꾼다. 자릿수가 8 미만이면 전화번호로 보지 않는다."""
    d = re.sub(r"\D", "", _s(v))
    if d.startswith("82") and len(d) >= 10:
        d = "0" + d[2:]
    return d if len(d) >= 8 else ""


_SOCIAL_HOSTS = (
    "instagram.com", "facebook.com", "naver.com", "band.us", "linktr.ee", "youtube.com",
    "tiktok.com", "kakao.com", "daangn.com", "tistory.com", "blogspot.com", "brunch.co.kr",
)
_KR_SECOND_LEVEL = {"co", "or", "go", "ne", "re", "pe", "ac"}


def canon_site(url) -> tuple[str, bool]:
    """(비교 키, SNS/블로그 여부). 일반 사이트는 등록 도메인, SNS·블로그는 호스트+첫 경로(계정)까지."""
    u = _s(url)
    if not u:
        return ("", False)
    if "://" not in u:
        u = "http://" + u
    try:
        p = urlparse(u)
    except ValueError:
        return ("", False)
    host = re.sub(r"^(www|m|mobile)\.", "", (p.hostname or "").lower())
    if not host or "." not in host:
        return ("", False)
    social = any(host == h or host.endswith("." + h) for h in _SOCIAL_HOSTS)
    if social:
        seg = [x for x in p.path.split("/") if x][:1]
        return (host + ("/" + seg[0].lower() if seg else ""), True)
    labels = host.split(".")
    if len(labels) >= 3 and labels[-1] == "kr" and labels[-2] in _KR_SECOND_LEVEL:
        return (".".join(labels[-3:]), False)
    return (".".join(labels[-2:]), False)


_SIDO = {
    "서울특별시": "서울", "서울시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
    "경기도": "경기", "강원특별자치도": "강원", "강원도": "강원", "충청북도": "충북", "충청남도": "충남",
    "전북특별자치도": "전북", "전라북도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남",
    "제주특별자치도": "제주",
}
_ROAD_RE = re.compile(r"([가-힣0-9]+(?:로|길)(?:\d+번?길)?)\s*(\d+(?:-\d+)?)")


def parse_address(addr) -> dict:
    """채널마다 다른 주소 표기를 (구·군, 도로명, 번호)로 줄인다.
    구글 "대한민국 서울특별시 성동구 아차산로9길 8" / 네이버 "서울특별시 성동구 아차산로9길 8 1, 2층" /
    카카오 "서울 성동구 아차산로9길 8" → 모두 ("성동구", "아차산로9길", "8")."""
    s = re.sub(r"\([^)]*\)", " ", _s(addr)).replace("대한민국", " ")
    for k, v in _SIDO.items():
        s = s.replace(k, v)
    s = re.sub(r"\s+", " ", s).strip()
    m = _ROAD_RE.search(s)
    return {
        "district": _district_token(s),
        "road": m.group(1) if m else "",
        "number": m.group(2) if m else "",
    }


# ── 항목별 판정 ───────────────────────────────────────────────────────────────


def _fv(status: str, expected, observed, note: str = "") -> dict:
    """status: match | mismatch | unknown"""
    return {"status": status, "expected": _s(expected) or None, "observed": _s(observed) or None, "note": note}


def compare_name(expected, observed) -> dict:
    if not _s(expected):
        return _fv("unknown", expected, observed, "입력한 가게 이름이 없어요")
    if not _s(observed):
        return _fv("unknown", expected, observed, "이 채널에서 이름을 확인하지 못했어요")
    a, b = norm_name(expected), norm_name(observed)
    if names_match(a, b) or names_match(b, a):
        return _fv("match", expected, observed)
    return _fv("mismatch", expected, observed, "표기가 달라요")


def compare_phone(expected, observed, channel_supports: bool = True) -> dict:
    if not channel_supports:
        return _fv("unknown", expected, None, "이 채널의 검색은 전화번호를 알려주지 않아요")
    e, o = norm_phone(expected), norm_phone(observed)
    if not e:
        return _fv("unknown", expected, observed, "입력한 전화번호가 없어요")
    if not o:
        return _fv("unknown", expected, observed, "이 채널에 전화번호가 등록돼 있지 않아요")
    return _fv("match" if e == o else "mismatch", expected, observed, "" if e == o else "전화번호가 달라요")


def compare_website(expected, observed) -> dict:
    ek, e_social = canon_site(expected)
    ok, o_social = canon_site(observed)
    if not ek:
        return _fv("unknown", expected, observed, "입력한 웹사이트가 없어요")
    if not ok:
        return _fv("unknown", expected, observed, "이 채널에 웹사이트가 등록돼 있지 않아요")
    if ek == ok:
        return _fv("match", expected, observed)
    if o_social and not e_social:
        return _fv("mismatch", expected, observed, "공식 사이트가 아니라 SNS·블로그 주소가 등록돼 있어요")
    return _fv("mismatch", expected, observed, "웹사이트 주소가 달라요")


def compare_address(expected, observed) -> dict:
    if not _s(expected):
        return _fv("unknown", expected, observed, "입력한 주소가 없어요")
    if not _s(observed):
        return _fv("unknown", expected, observed, "이 채널에서 주소를 확인하지 못했어요")
    a, b = parse_address(expected), parse_address(observed)
    if a["district"] and b["district"] and a["district"] != b["district"]:
        return _fv("mismatch", expected, observed, "지역(구·군)이 달라요")
    if a["road"] and b["road"]:
        if a["road"] == b["road"] and a["number"] == b["number"]:
            return _fv("match", expected, observed)
        return _fv("mismatch", expected, observed, "도로명 또는 번호가 달라요")
    return _fv("unknown", expected, observed, "주소 형식이 달라 비교하지 못했어요")


# ── 채널별 조회 ───────────────────────────────────────────────────────────────


def pick_candidates(target_name: str, district: str, items: list[dict]) -> list[dict]:
    """이름이 같은 가게(지점 표기만 다른 경우 포함)이면서 같은 구·군에 있는 것만."""
    t = norm_name(target_name)
    out = []
    for it in items or []:
        n = norm_name(it.get("name"))
        if not (names_match(t, n) or names_match(n, t)):
            continue
        if district and district not in _s(it.get("address")):
            continue
        out.append(it)
    return out


def select_match(target_name: str, district: str, items: list[dict], pid: str, id_key: str) -> tuple[str, dict | None]:
    """('found'|'not_found'|'ambiguous', item). 저장된 플레이스 ID가 있으면 그 지점을 우선한다."""
    if pid:
        for it in items or []:
            if _s(it.get(id_key)) == pid:
                return "found", it
    cands = pick_candidates(target_name, district, items)
    if not cands:
        return "not_found", None
    if len(cands) == 1:
        return "found", cands[0]
    return "ambiguous", None


def _channel_result(state: str, item: dict | None, expected: dict, supports_phone: bool, cands_for_display: list[dict] | None = None) -> dict:
    if state == "found" and item:
        return {
            "state": "found",
            "observed_name": item.get("name"),
            "fields": {
                "name": compare_name(expected["name"], item.get("name")),
                "address": compare_address(expected["address"], item.get("address")),
                "phone": compare_phone(expected["phone"], item.get("phone"), channel_supports=supports_phone),
            },
        }
    if state == "ambiguous":
        return {
            "state": "ambiguous",
            "note": "같은 이름의 가게가 여러 곳 보여 어느 지점인지 특정하지 못했어요",
            "candidates": [{"name": c.get("name"), "address": c.get("address")} for c in (cands_for_display or [])[:3]],
        }
    return {"state": "not_found"}


async def _check_kakao(biz: dict, expected: dict) -> dict:
    name = _s(biz.get("name"))
    if not name:
        return {"state": "error", "error": "no_name"}
    region = _s(biz.get("region"))
    query = f"{_region_query_prefix(region)} {name}".strip()
    async with aiohttp.ClientSession(timeout=_KAKAO_TIMEOUT) as session:
        docs = await _kakao_search(session, query, 5)
    if docs is None:  # 조회 자체 실패 — "등록 안 됨"으로 단정하지 않는다
        return {"state": "error", "error": "lookup_failed"}
    items = [
        {
            "id": d.get("id", ""),
            "name": d.get("place_name", ""),
            "address": d.get("road_address_name") or d.get("address_name", ""),
            "phone": d.get("phone", ""),
        }
        for d in docs
    ]
    district = _district_token(region) or _district_token(expected["address"])
    state, item = select_match(name, district, items, _s(biz.get("kakao_place_id")), "id")
    return _channel_result(state, item, expected, True, pick_candidates(name, district, items))


async def _check_naver(biz: dict, expected: dict) -> dict:
    name = _s(biz.get("name"))
    if not name:
        return {"state": "error", "error": "no_name"}
    region = _s(biz.get("region"))
    items = await search_naver(name, region)
    if not items:  # 빈 결과는 "없음"과 "조회 실패"를 구분할 수 없다(search_naver가 둘 다 [] 반환)
        return {"state": "not_found", "lookup_uncertain": True}
    district = _district_token(region) or _district_token(expected["address"])
    state, item = select_match(name, district, items, _s(biz.get("naver_place_id")), "naver_place_id")
    # 네이버 지역검색 API는 전화번호를 주지 않는다(2026-10-29 실측: 4개 질의 16건 전부 빈 값)
    return _channel_result(state, item, expected, False, pick_candidates(name, district, items))


async def _check_google(biz: dict, expected: dict) -> dict:
    pid = _s(biz.get("google_place_id"))
    if not pid:
        return {"state": "not_linked"}
    if not places.is_valid_place_id(pid):
        return {"state": "error", "error": "invalid_place_id"}
    try:
        d = await places.get_place_details(pid)
    except places.PlacesError as e:
        return {"state": "error", "error": e.code}
    return {
        "state": "found",
        "observed_name": d.get("name"),
        "business_status": d.get("status"),
        "rating": d.get("rating"),
        "rating_count": d.get("rating_count"),
        "fields": {
            "name": compare_name(expected["name"], d.get("name")),
            "address": compare_address(expected["address"], d.get("address")),
            "phone": compare_phone(expected["phone"], d.get("phone")),
            "website": compare_website(expected["website"], d.get("website")),
        },
        "attribution": "Google Maps",
    }


def summarize(channels: dict) -> dict:
    counts = {"match": 0, "mismatch": 0, "unknown": 0}
    for ch in channels.values():
        if isinstance(ch, dict) and ch.get("state") == "found":
            for fv in (ch.get("fields") or {}).values():
                counts[fv["status"]] += 1
    return counts


async def run_consistency_check(biz: dict) -> dict:
    """세 채널을 병렬로 조회해 항목별 일치 여부를 돌려준다. 한 채널의 오류가 다른 채널을 막지 않는다."""
    expected = {
        "name": _s(biz.get("name")),
        "address": _s(biz.get("address")),
        "phone": _s(biz.get("phone")),
        "website": _s(biz.get("website_url")),
    }
    keys = ("kakao", "naver", "google")
    results = await asyncio.gather(
        _check_kakao(biz, expected), _check_naver(biz, expected), _check_google(biz, expected),
        return_exceptions=True,
    )
    channels = {}
    for key, res in zip(keys, results):
        if isinstance(res, Exception):
            _logger.warning("[consistency] %s 조회 중 예외: %s", key, type(res).__name__)
            channels[key] = {"state": "error", "error": "internal"}
        else:
            channels[key] = res
    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "expected": expected,
        "channels": channels,
        "summary": summarize(channels),
    }
