"""
backend/services/bizinfo.py

기업마당(bizinfo.go.kr, 중소벤처기업부) 공개 API의 지원사업 공고·행사 정보를 /support-programs 공개 페이지용 스냅샷으로 만든다.

- 방문자 요청은 스냅샷 파일(`backend/data/bizinfo/support.json`)만 읽는다(외부 API·Supabase 호출 없음).
  파일은 `scripts/bizinfo_collect.py`가 하루 한 번(호출 2회) 채운다. 인증키는 서버 `.env`의 `BIZINFO_API_KEY`·`BIZINFO_EVENT_API_KEY`.
- 원문 전체를 복사하지 않는다 — 제목·기관·기간·지원대상(원문 필드 그대로)과 짧은 발췌만 저장하고 항상 기업마당 원문 링크를 붙인다.
- 링크는 응답의 URL 필드를 믿지 않고 공고 ID로 다시 만든다(첨부 링크에는 만료되는 다운로드 토큰이 붙어 저장하지 않는다).
- 지원대상(trgetNm)은 기업마당이 붙인 분류 그대로 보여 준다. "받을 수 있다/없다" 같은 자격 판단은 하지 않는다.
"""
from __future__ import annotations

import html
import json
import logging
import os
import re
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

_logger = logging.getLogger("aeolab.bizinfo")

SUPPORT_API_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"
EVENT_API_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoEventApi.do"
BASE = "https://www.bizinfo.go.kr"

REGION_TAGS = (
    "서울", "부산", "대구", "인천", "전남광주", "광주", "대전", "울산", "세종",
    "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
)

_SUPPORT_ID = re.compile(r"^PBLN_\d{6,}$")
_EVENT_ID = re.compile(r"^EVEN_\d{6,}$")
_RANGE = re.compile(r"^\s*(\d{4})-?(\d{2})-?(\d{2})\s*~\s*(\d{4})-?(\d{2})-?(\d{2})\s*$")

_DEFAULT_DIR = Path(__file__).resolve().parent.parent / "data" / "bizinfo"
_mem: dict[str, tuple[float, dict]] = {}

KST = timezone(timedelta(hours=9))


def snapshot_path() -> Path:
    return Path(os.getenv("BIZINFO_SNAPSHOT_DIR") or _DEFAULT_DIR) / "support.json"


def today_kst(now: Optional[datetime] = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(KST).date()


def strip_html(raw: Any, limit: int = 160) -> str:
    """HTML 태그를 지우고 공백을 정리해 limit 자 안으로 자른다(잘리면 …)."""
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", " ", str(raw))
    text = html.unescape(text).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "…"


def parse_range(text: Any) -> Optional[tuple[str, str]]:
    """'2026-11-09 ~ 2026-11-23' 또는 '20261109 ~ 20261123' → ('2026-11-09', '2026-11-23'). 날짜 범위가 아니면 None."""
    m = _RANGE.match(str(text or ""))
    if not m:
        return None
    y1, m1, d1, y2, m2, d2 = (int(x) for x in m.groups())
    try:
        a, b = date(y1, m1, d1), date(y2, m2, d2)
    except ValueError:
        return None
    return a.isoformat(), b.isoformat()


def _split_tags(raw: Any) -> list[str]:
    return [t.strip() for t in str(raw or "").split(",") if t.strip()]


def _iso_day(v: Any) -> str:
    """'2026-11-16 13:15:03' 또는 '20261116' → '2026-11-16'. 형식이 다르면 빈 문자열."""
    s = str(v or "").strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s) or re.match(r"^(\d{4})(\d{2})(\d{2})", s)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""


def normalize_support(it: dict) -> Optional[dict]:
    """지원사업 1건 → 저장용 dict. 소상공인과 무관하면 None. ID 형식이 이상하면 None."""
    pid = str(it.get("pblancId") or "").strip()
    title = str(it.get("pblancNm") or "").strip()
    if not _SUPPORT_ID.match(pid) or not title:
        return None
    target = str(it.get("trgetNm") or "").strip()
    tags = _split_tags(it.get("hashtags"))
    summary_full = strip_html(it.get("bsnsSumryCn"), limit=4000)
    sbiz_target = target == "소상공인"
    if not (sbiz_target or "소상공인" in title or "소상공인" in tags or "소상공인" in summary_full):
        return None
    period_raw = str(it.get("reqstBeginEndDe") or "").strip()
    rng = parse_range(period_raw)
    return {
        "id": pid,
        "title": title,
        "url": f"{BASE}/sii/siia/selectSIIA200Detail.do?pblancId={pid}",
        "agency": str(it.get("jrsdInsttNm") or "").strip(),
        "exec_agency": str(it.get("excInsttNm") or "").strip(),
        "field": str(it.get("pldirSportRealmLclasCodeNm") or "").strip(),
        "sub_field": str(it.get("pldirSportRealmMlsfcCodeNm") or "").strip(),
        "target": target,
        "sbiz_target": sbiz_target,
        "regions": [t for t in tags if t in REGION_TAGS],
        "period_raw": period_raw,
        "start": rng[0] if rng else None,
        "end": rng[1] if rng else None,
        "summary": strip_html(it.get("bsnsSumryCn"), limit=150),
        "contact": strip_html(it.get("refrncNm"), limit=80),
        "created": _iso_day(it.get("creatPnttm")),
        "updated": _iso_day(it.get("updtPnttm")),
    }


def normalize_event(it: dict, today: date) -> Optional[dict]:
    """행사 1건 → 저장용 dict. 이미 끝났으면 None. ID 형식이 이상하면 None."""
    eid = str(it.get("eventInfoId") or "").strip()
    title = str(it.get("nttNm") or "").strip()
    if not _EVENT_ID.match(eid) or not title:
        return None
    period_raw = str(it.get("eventBeginEndDe") or "").strip()
    rng = parse_range(period_raw)
    if rng and rng[1] < today.isoformat():
        return None  # 끝난 행사
    rel = str(it.get("bizinfoUrl") or "").strip()
    url = f"{BASE}{rel}" if rel.startswith("/web/") else f"{BASE}/web/lay1/bbs/S1T122C127/AX/210/view.do?eventInfoId={eid}"
    origin = str(it.get("orginlUrlAdres") or "").strip()
    if not re.match(r"^https?://", origin):
        origin = ""
    tags = _split_tags(it.get("hashtags"))
    summary_full = strip_html(it.get("nttCn"), limit=4000)
    return {
        "id": eid,
        "title": title,
        "url": url,
        "origin_url": origin,
        "area": str(it.get("areaNm") or "").strip(),
        "type": str(it.get("eventInfoTyNm") or "").strip(),
        "field": str(it.get("pldirSportRealmLclasCodeNm") or "").strip(),
        "org": str(it.get("originEngnNm") or "").strip(),
        "period_raw": period_raw,
        "start": rng[0] if rng else None,
        "end": rng[1] if rng else None,
        "summary": strip_html(it.get("nttCn"), limit=140),
        "sbiz_mention": "소상공인" in title or "소상공인" in tags or "소상공인" in summary_full,
        "registered": _iso_day(it.get("registDe")),
    }


def build_snapshot(support_raw: list[dict], events_raw: list[dict], now: Optional[datetime] = None) -> dict:
    now = now or datetime.now(timezone.utc)
    today = today_kst(now)
    support = [n for n in (normalize_support(i) for i in support_raw) if n]
    events = [n for n in (normalize_event(i, today) for i in events_raw) if n]
    return {
        "generated_at": now.astimezone(timezone.utc).isoformat(timespec="seconds"),
        "support": {"source_total": len(support_raw), "items": support},
        "events": {"source_total": len(events_raw), "items": events},
    }


# ── 스냅샷 파일 입출력 ─────────────────────────────────────────────────────────

def load_snapshot() -> Optional[dict]:
    p = snapshot_path()
    try:
        mtime = p.stat().st_mtime
    except OSError:
        return None
    hit = _mem.get("support")
    if hit and hit[0] == mtime:
        return hit[1]
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        _logger.warning("bizinfo_snapshot_read_fail: %s", e)
        return None
    if not isinstance(data, dict) or "support" not in data:
        return None
    _mem["support"] = (mtime, data)
    return data


def save_snapshot(data: dict) -> None:
    p = snapshot_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(p.parent), prefix=".support_", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, p)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    _mem.pop("support", None)


def public_view() -> dict:
    """공개 응답 — 스냅샷이 없으면 available=False(0건처럼 보이지 않게)."""
    snap = load_snapshot()
    if not snap:
        return {"available": False}
    return {
        "available": True,
        "generated_at": snap.get("generated_at"),
        "support": snap["support"],
        "events": snap.get("events") or {"source_total": 0, "items": []},
    }
