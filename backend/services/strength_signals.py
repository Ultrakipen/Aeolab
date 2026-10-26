"""강점 신호 — 측정으로 확인된 사실만 골라 보여주는 규칙 (단일 소스).

설계: docs/strength_signals_design_v1.0.md. 점수·성장 단계·알림과 연결하지 않는다(AI 호출 0, 조회 전용).

원칙
- 사실 + 측정 시점. 평가어("많다·우수") 금지.
- 값이 0·NULL·측정 오류면 쓰지 않는다. 측정 오류는 "미노출"이 아니라 '확인하지 못한 항목'으로만 알린다.
- 사용자가 편집할 수 있는 값(리뷰 수 등)은 플레이스 ID가 있어 자동 수집이 확인된 경우에만 쓴다.
- 임계값은 근거 약한 제안값이라 상수로 분리했다(실사용 반응을 보고 조정).
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

# ── 조정 가능한 제안값 ────────────────────────────────────────────────────────
MIN_CHATGPT_SAMPLE = 30        # 표본이 이보다 작으면(예: 5회 빠른 측정) 빈도가 흔들려 표시하지 않음
MAX_AGE_DAYS = 30              # 측정이 이보다 오래되면 표시하지 않음
MIN_COMPETITORS_FOR_COMPARE = 3  # 동기화된 활성 경쟁 가게가 이보다 적으면 비교하지 않음
MAX_ITEMS = 4                  # 한 번에 보여주는 최대 항목 수
MAX_KEYWORD_NAMES = 3

_PLACE_URL = "https://m.place.naver.com/place/{pid}"
_SEARCH_URL = "https://search.naver.com/search.naver?query={q}"


def _norm(s: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]", "", (s or "").lower())


def is_brand_keyword(keyword: str, business_name: Optional[str]) -> bool:
    """가게 이름(상호) 키워드 판별 — 프론트 `lib/keywordBrand.ts`와 같은 규칙(보수적: 오탐이 더 나쁨).

    키워드가 상호(또는 지점명을 뗀 상호)를 통째로 포함할 때만 True. 상호 핵심이 3자 미만이면 False.
    """
    k = _norm(keyword)
    full = _norm(business_name or "")
    if not k or not full:
        return False
    candidates = [full]
    tokens = (business_name or "").strip().split()
    if len(tokens) >= 2 and tokens[-1].endswith("점"):
        candidates.append(_norm("".join(tokens[:-1])))
    return any(len(c) >= 3 and c in k for c in candidates)


def _parse_ts(value: Any) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _fresh(ts: Optional[datetime], now: datetime) -> bool:
    return ts is not None and (now - ts) <= timedelta(days=MAX_AGE_DAYS)


def _pos_int(v: Any) -> Optional[int]:
    """양의 정수만 인정(bool·0·음수·문자열 제외). 0은 '없음'이 아니라 '미수집'일 수 있어 쓰지 않는다."""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)) and v > 0:
        return int(v)
    return None


def _reviews_item(biz: dict, competitors: list[dict]) -> Optional[dict]:
    pid = str(biz.get("naver_place_id") or "").strip()
    if not pid:
        return None  # 입력값일 수 있어 자동 수집 확인 전에는 쓰지 않는다
    n = _pos_int(biz.get("visitor_review_count"))
    if n is None:
        return None
    text = f"방문자 리뷰 {n:,}건"
    rating = biz.get("avg_rating")
    if isinstance(rating, (int, float)) and not isinstance(rating, bool) and rating > 0:
        r = f"{rating:.2f}".rstrip("0")
        text += f" (평점 {r + '0' if r.endswith('.') else r})"

    synced = [c for c in competitors if c.get("is_active", True) and _pos_int(c.get("naver_review_count"))]
    detail = None
    if len(synced) >= MIN_COMPETITORS_FOR_COMPARE:
        rank = 1 + sum(1 for c in synced if int(c["naver_review_count"]) > n)
        detail = f"내가 등록한 경쟁 가게 {len(synced)}곳과 비교하면 리뷰 수 {rank}번째입니다"
    return {
        "key": "reviews",
        "text": text,
        "detail": detail,
        "measured_at": None,
        "link": _PLACE_URL.format(pid=pid),
        "link_label": "네이버 플레이스에서 확인",
    }


def _chatgpt_item(scan: Optional[dict], now: datetime) -> tuple[Optional[dict], Optional[str]]:
    """(강점 항목, 확인하지 못한 항목 라벨)"""
    if not scan:
        return None, None
    r = scan.get("chatgpt_result") or {}
    if not isinstance(r, dict) or not r:
        return None, None
    ts = _parse_ts(scan.get("scanned_at"))
    if not _fresh(ts, now):
        return None, None  # 오래된 기록의 오류까지 '확인하지 못한 항목'으로 알리지 않는다
    if r.get("error"):
        return None, "ChatGPT 추천 측정"
    freq, size = r.get("exposure_freq"), r.get("sample_size")
    if not (isinstance(freq, (int, float)) and isinstance(size, (int, float))) or isinstance(freq, bool):
        return None, None
    if size < MIN_CHATGPT_SAMPLE or freq <= 0:
        return None, None
    return {
        "key": "chatgpt",
        "text": f"ChatGPT 추천 질문 {int(size)}회 중 {int(freq)}회 목록에 등장",
        "detail": "지역·업종 추천 질문을 가게 이름 없이 반복해 물은 결과입니다",
        "measured_at": scan.get("scanned_at"),
        "link": None,
        "link_label": None,
    }, None


def _briefing_item(scan: Optional[dict], now: datetime) -> tuple[Optional[dict], Optional[str]]:
    if not scan:
        return None, None
    r = scan.get("naver_result") or {}
    if not isinstance(r, dict) or not r:
        return None, None
    ts = _parse_ts(scan.get("scanned_at"))
    if not _fresh(ts, now):
        return None, None
    if r.get("error") or r.get("captcha_detected") or r.get("briefing_unrecognized"):
        return None, "네이버 AI 브리핑 측정"
    if r.get("in_briefing") is True:
        return {
            "key": "briefing",
            "text": "네이버 AI 브리핑에 노출 확인",
            "detail": None,
            "measured_at": scan.get("scanned_at"),
            "link": None,
            "link_label": None,
        }, None
    return None, None


def _keywords_item(biz: dict, rank_scan: Optional[dict], now: datetime) -> Optional[dict]:
    if not rank_scan:
        return None
    ranks = rank_scan.get("keyword_ranks")
    if not isinstance(ranks, dict):
        return None
    ctx = ranks.get("_context") if isinstance(ranks.get("_context"), dict) else {}
    ts = _parse_ts(ctx.get("scanned_at") or rank_scan.get("scanned_at"))
    if not _fresh(ts, now):
        return None
    name = biz.get("name") or ""
    hit: list[tuple[str, str]] = []  # (등록 키워드, 실제 검색어)
    for kw, d in ranks.items():
        if str(kw).startswith("_") or not isinstance(d, dict) or d.get("error"):
            continue
        if is_brand_keyword(kw, name):
            continue
        if any(_pos_int(d.get(c)) for c in ("pc_rank", "mobile_rank", "place_rank")):
            hit.append((kw, d.get("search_query") or kw))
    if not hit:
        return None
    names = ", ".join(f"'{k}'" for k, _ in hit[:MAX_KEYWORD_NAMES])
    more = f" 외 {len(hit) - MAX_KEYWORD_NAMES}개" if len(hit) > MAX_KEYWORD_NAMES else ""
    return {
        "key": "keywords",
        "text": f"네이버 검색 첫 화면(광고 제외)에 노출된 키워드 {len(hit)}개: {names}{more}",
        "detail": None,
        "measured_at": ctx.get("scanned_at") or rank_scan.get("scanned_at"),
        "link": _SEARCH_URL.format(q=_url_quote(hit[0][1])),
        "link_label": "네이버에서 직접 확인",
    }


def _url_quote(s: str) -> str:
    from urllib.parse import quote
    return quote(s, safe="")


def _kakao_item(scan: Optional[dict], now: datetime) -> Optional[dict]:
    if not scan:
        return None
    r = scan.get("kakao_result") or {}
    if not isinstance(r, dict) or r.get("error") or r.get("is_on_kakao") is not True:
        return None
    if not _fresh(_parse_ts(scan.get("scanned_at")), now):
        return None
    return {"key": "kakao", "text": "카카오맵 등록 확인", "detail": None,
            "measured_at": scan.get("scanned_at"), "link": None, "link_label": None}


def _google_item(scan: Optional[dict], now: datetime) -> Optional[dict]:
    if not scan:
        return None
    r = scan.get("google_result") or {}
    # `mentioned`는 AI 개요 노출과 뜻이 달라(검색 결과 등장 포함) 쓰지 않는다 — in_ai_overview만 사용
    if not isinstance(r, dict) or r.get("error") or r.get("in_ai_overview") is not True:
        return None
    if not _fresh(_parse_ts(scan.get("scanned_at")), now):
        return None
    return {"key": "google_ai", "text": "구글 AI 개요에 노출 확인", "detail": None,
            "measured_at": scan.get("scanned_at"), "link": None, "link_label": None}


def build_strengths(
    biz: dict,
    latest_scan: Optional[dict],
    rank_scan: Optional[dict],
    competitors: list[dict],
    now: Optional[datetime] = None,
) -> dict:
    """강점 신호 계산. 반환: {items, unmeasured, empty_reason, total_found}."""
    now = now or datetime.now(timezone.utc)
    items: list[dict] = []
    unmeasured: list[str] = []

    rv = _reviews_item(biz, competitors)
    if rv:
        items.append(rv)

    for fn in (_chatgpt_item, _briefing_item):
        it, miss = fn(latest_scan, now)
        if it:
            items.append(it)
        if miss:
            unmeasured.append(miss)

    for it in (_keywords_item(biz, rank_scan, now), _kakao_item(latest_scan, now), _google_item(latest_scan, now)):
        if it:
            items.append(it)

    total = len(items)
    shown = items[:MAX_ITEMS]

    empty_reason = None
    if not shown:
        empty_reason = "no_place_id" if not str(biz.get("naver_place_id") or "").strip() else "none"

    return {
        "items": shown,
        "unmeasured": unmeasured,
        "empty_reason": empty_reason,
        "total_found": total,
        # 플레이스 ID가 없으면 리뷰 수 등 자동 수집 항목을 쓸 수 없다 — 화면에서 연결을 안내
        "needs_place_id": not str(biz.get("naver_place_id") or "").strip(),
    }
