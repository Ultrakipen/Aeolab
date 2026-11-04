"""무료 체험의 '측정 가능률' 점검 — 읽기 전용 (2026-11-04).

체험 화면이 소개글·소식·리뷰·네이버 순위를 실제로 읽는지를 최근 기록으로 센다. 이 비율이 보이지 않아서
place ID 복구가 거의 항상 실패하는 구조 결함(45일 33건 중 ID 확보 1건, 소개글·소식 읽기 0건, 내 가게를 5곳 안에서 찾은 건 0건)이 방치됐다.
화면은 이 항목들이 측정되는 것처럼 짜여 있으면 안 되므로, 주 1회 이 스크립트로 비율을 확인한다.

사용 (서버 backend 폴더에서, .env는 스크립트가 직접 읽는다 — source 금지):
    /var/www/aeolab/venv/bin/python scripts/trial_measurement_health.py [일수=45]

개인정보(가게 이름·이메일·IP 해시)는 출력하지 않는다. DB는 select만 한다.
주의: 개발·운영 테스트가 섞인 기록이라 비율을 실제 사장님의 행동으로 일반화하지 않는다(접속 IP 수를 함께 출력한다).
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone


def _pct(a: int, b: int) -> str:
    return "n/a" if b <= 0 else f"{a}/{b} ({100.0 * a / b:.0f}%)"


def summarize(rows: list[dict]) -> dict:
    """trial_scans 행 목록 → 측정 가능률 요약(순수 함수 — 테스트 대상)."""
    n = len(rows)
    ips = {r.get("ip_hash") for r in rows if r.get("ip_hash")}

    place_data = place_id = url_only = 0
    sp_ok = sp_err = sp_none = intro_read = post_read = 0
    naver_rows = rank_found = review_sort_found = 0
    ai_known = ai_true = 0

    for r in rows:
        pdata = r.get("place_data")
        if isinstance(pdata, dict) and pdata:
            place_data += 1
            if str(pdata.get("naver_place_id") or "").strip():
                place_id += 1
            elif str(pdata.get("naver_place_url") or "").strip():
                url_only += 1

        sp = r.get("smart_place_check")
        if not sp:
            sp_none += 1
        elif isinstance(sp, dict) and sp.get("error"):
            sp_err += 1
        else:
            sp_ok += 1
            if isinstance(sp, dict):
                # 차단으로 못 읽은 값(*_measured=false)은 읽은 것으로 세지 않는다
                if sp.get("intro_measured") is not False and sp.get("has_intro") is not None:
                    intro_read += 1
                if sp.get("recent_post_measured") is not False and sp.get("has_recent_post") is not None:
                    post_read += 1

        if r.get("naver_competitors"):
            naver_rows += 1
            if r.get("naver_rank") not in (None, 0):
                rank_found += 1
        nv = r.get("naver_result")
        if isinstance(nv, dict) and nv.get("review_sort_rank"):
            review_sort_found += 1

        if r.get("ai_mentioned") is not None:
            ai_known += 1
            if r.get("ai_mentioned"):
                ai_true += 1

    return {
        "rows": n,
        "distinct_ips": len(ips),
        "place_data": place_data,
        "place_id": place_id,
        "place_url_only": url_only,
        "smart_place_ok": sp_ok,
        "smart_place_error": sp_err,
        "smart_place_none": sp_none,
        "intro_read": intro_read,
        "post_read": post_read,
        "naver_rows": naver_rows,
        "rank_found": rank_found,
        "review_sort_found": review_sort_found,
        "ai_known": ai_known,
        "ai_mentioned": ai_true,
    }


def verdicts(s: dict, min_rows: int = 20) -> list[str]:
    """요약 → 사람이 읽는 경고. 표본이 min_rows 미만이면 판단하지 않는다."""
    if s["rows"] < min_rows:
        return [f"표본 {s['rows']}건 < {min_rows}건 — 비율로 판단하지 않는다"]
    out: list[str] = []
    if s["smart_place_ok"] > 0 and s["intro_read"] == 0:
        out.append("점검은 돌았지만 소개글을 읽은 건이 0 — 화면 구조 변경·차단 의심")
    if s["smart_place_ok"] * 5 < s["rows"]:
        out.append("소개글·소식·리뷰 점검 성공이 전체의 20% 미만 — 화면이 이 항목을 측정하는 것처럼 보이면 안 된다")
    if s["place_id"] * 5 < s["place_data"]:
        out.append("place ID 확보가 place_data의 20% 미만 — ID 복구 경로(지역검색 API는 ID를 주지 않음) 점검")
    if s["naver_rows"] and s["rank_found"] * 10 < s["naver_rows"]:
        out.append("내 가게를 지역검색 상위 5곳에서 찾은 비율이 10% 미만 — 순위로 결론을 내지 않는다(공식 API 5곳 한도)")
    return out or ["이상 없음"]


def _fetch(days: int) -> list[dict]:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
    from db.supabase_client import get_client

    sb = get_client()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cols = "id,scanned_at,naver_rank,naver_competitors,naver_result,ai_mentioned,place_data,smart_place_check,ip_hash"
    rows: list[dict] = []
    start = 0
    while True:  # Supabase 서버 1,000행 상한 — 500행씩 페이징
        res = (
            sb.table("trial_scans").select(cols).gte("scanned_at", since)
            .order("scanned_at", desc=True).range(start, start + 499).execute()
        )
        data = res.data if (res and res.data) else []
        rows.extend(data)
        if len(data) < 500:
            break
        start += 500
    return rows


def main() -> None:
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 45
    s = summarize(_fetch(days))
    print(f"체험 측정 가능률 — 최근 {days}일 {s['rows']}건 (접속 IP {s['distinct_ips']}곳, 테스트 섞임 주의)")
    print(f"- place ID 확보: {_pct(s['place_id'], s['place_data'])}  (URL만 있고 ID 없음 {s['place_url_only']}건)")
    print(f"- 스마트플레이스 점검: 성공 {s['smart_place_ok']} · 오류 {s['smart_place_error']} · 없음 {s['smart_place_none']}")
    print(f"- 소개글 읽음 {_pct(s['intro_read'], s['rows'])} · 소식 읽음 {_pct(s['post_read'], s['rows'])}")
    print(f"- 지역검색 상위 5곳에서 내 가게 발견: {_pct(s['rank_found'], s['naver_rows'])}")
    print(f"- 후기 많은 순 순위 발견: {_pct(s['review_sort_found'], s['rows'])}")
    print(f"- ChatGPT 노출 확인: {_pct(s['ai_mentioned'], s['ai_known'])}")
    for v in verdicts(s):
        print("판단:", v)


if __name__ == "__main__":
    main()
