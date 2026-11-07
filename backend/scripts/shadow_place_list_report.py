"""플레이스 목록 섀도 필드(place_list_*) 표본 리포트 — 읽기 전용 (2026-11-07).

서버 backend/ 에서:  /var/www/aeolab/venv/bin/python scripts/shadow_place_list_report.py [--since 2026-11-07T12:45:00+00:00]
(서버 venv는 backend/ 안이 아니라 /var/www/aeolab/venv 다 — 11-07 첫 실행에서 backend/venv 경로로 실패한 적 있음.)
(.env는 스크립트가 직접 읽는다 — source 금지.) DB 쓰기·네이버 접속 없음.

기존 `mentioned`(브리핑 또는 페이지 전체 텍스트 일치)와 구조 기반 `place_list_rank`를 비교해, 점수 반영(단계 4) 전에 필요한 표본을 센다:
  text_only      mentioned=True, in_briefing=False, place_list_rank=None → 블로그 글 속 이름 등 텍스트 폴백만으로 True (과대 가능)
  old_missed     mentioned=False, place_list_rank 있음                   → 기존 판정이 목록 안 가게를 놓침 (과소 가능)
  both           mentioned=True, place_list_rank 있음
  unreadable     place_list_found False/None                              → 목록을 못 읽음(측정 불가와 같다 — '목록 밖'이 아니다)
측정 불가(error·captcha·quota_skipped) 행은 비교에서 제외한다. 섀도 필드가 없는 행(코드 반영 이전)도 제외하고 개수만 센다.
"""
from __future__ import annotations

import argparse
import json
import os
from collections import Counter

DEFAULT_SINCE = "2026-11-07T12:45:00+00:00"   # 섀도 필드 서버 반영(약 12:48 UTC) 직후


def classify(nr: dict) -> str:
    """naver_result 한 건을 분류한다. 반환: skip_unmeasured | no_shadow | unreadable | old_missed | both | text_only | in_list_only | absent_both"""
    if not isinstance(nr, dict) or not nr:
        return "no_shadow"
    if nr.get("captcha_detected") or nr.get("error") or nr.get("quota_skipped") is True:
        return "skip_unmeasured"
    if "place_list_found" not in nr:
        return "no_shadow"
    if nr.get("place_list_found") is not True:
        return "unreadable"
    prank = nr.get("place_list_rank")
    mentioned = bool(nr.get("mentioned"))
    in_brief = bool(nr.get("in_briefing"))
    if prank is not None:
        return "both" if mentioned else "old_missed"
    if mentioned and not in_brief:
        return "text_only"
    if in_brief:
        return "in_list_only"        # 브리핑에는 있으나 플레이스 목록에는 없음(정상 가능)
    return "absent_both"


def summarize(rows: list[dict]) -> dict:
    c = Counter(classify(r.get("naver_result") or {}) for r in rows)
    comparable = sum(v for k, v in c.items() if k in ("both", "old_missed", "text_only", "in_list_only", "absent_both"))
    return {"rows": len(rows), "counts": dict(c), "comparable_rows": comparable}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default=DEFAULT_SINCE)
    ap.add_argument("--limit", type=int, default=500)
    args = ap.parse_args()

    from dotenv import dotenv_values
    from supabase import create_client
    here = os.path.dirname(os.path.abspath(__file__))
    env = dotenv_values(os.path.join(here, "..", ".env"))
    sb = create_client(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])
    rows = (
        sb.table("scan_results")
        .select("id,business_id,scanned_at,naver_result")
        .gte("scanned_at", args.since)
        .order("scanned_at", desc=True)
        .limit(args.limit)
        .execute()
        .data
        or []
    )
    rep = summarize(rows)
    detail = []
    for r in rows:
        nr = r.get("naver_result") or {}
        k = classify(nr)
        if k in ("old_missed", "text_only", "both", "unreadable"):
            detail.append({
                "at": (r["scanned_at"] or "")[:19], "biz": (r["business_id"] or "")[:8], "class": k,
                "mentioned": nr.get("mentioned"), "in_briefing": nr.get("in_briefing"),
                "place_list_found": nr.get("place_list_found"), "place_list_rank": nr.get("place_list_rank"),
                "n_names": len(nr.get("place_list_names") or []),
            })
    # 사업장명·이웃 가게 이름은 ASCII 이스케이프로만 출력(콘솔 인코딩 깨짐 방지) — 이름이 필요하면 DB에서 직접 확인
    print(json.dumps({"since": args.since, **rep, "detail": detail[:30]}, ensure_ascii=True))


if __name__ == "__main__":
    main()
