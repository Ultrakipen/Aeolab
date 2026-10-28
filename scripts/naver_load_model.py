"""네이버 접속 부하 용량 모델 (2026-10-27) — 사업장 수가 늘 때 요일별 하루 페이지 로드와 상한 대비를 계산한다.

사용: python scripts/naver_load_model.py [--cap 600] [--batch-ratio 0.7] [--keywords 4] [--competitors 3]

**실측이 아니라 코드 기준 모델이다.** 구독자가 0명이라 실제 트래픽 데이터가 없다. 각 상수에 출처(코드에서 확인) 또는
"가정"을 표시했고, 운영이 시작되면 `.naver_quota_state_history.jsonl`(일별 출처별 실측)로 보정해야 한다.
관리자 API `GET /admin/naver-access`의 history가 같은 데이터를 보여 준다.
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from services.scan_scheduling import decide_scan_mode, scan_slot  # noqa: E402

# ── 단위: 페이지 로드 수 (check_naver_playwright_quota의 cost와 같은 단위) ───────────────────
BRIEF_PER_SCAN = 2        # 가정: scan_all/scan_basic이 네이버 브리핑 check_mention을 1회 호출하나 내부 변형 수는 미확인
AI_TAB_PER_FULL = 4       # 코드: multi_scanner.scan_all이 질의 최대 4개로 AI탭 스캔(NAVER_AI_TAB_ENABLED=true일 때)
LIGHT_SCAN_NAVER = 1      # 코드: scan_basic은 브리핑 1회
RANK_PER_KEYWORD = 2      # 코드: naver_keyword_rank PC + 모바일(place_rank는 공식 API라 제외)
PLACE_STATS_COST = 2      # 코드: fetch_stats cost=2 (주 1회 월요일 02:00 직전 잡, jobs.py)
COMPETITOR_CRAWL_COST = 10  # 코드: _run_place_crawl goto 최대 12회, 정상 8~10 → cost=10
COMPETITOR_JOBS_PER_WEEK = 2  # 코드: competitor_place_sync_job(화) + enrich_competitor_details_job(목)
LOW_RATING_COST = 2         # 코드: check_low_rating_reviews_for cost=2 (가게 페이지 + 리뷰 탭)
LOW_RATING_WEEKDAYS = (0, 3)  # 코드: jobs.py low_rating_check cron day_of_week="mon,thu" hour=10 (2026-10-28 6시간마다→주 2회로 변경; 이전 모델은 하루 4회=8페이지/일)
LOW_RATING_PHONE_SHARE = 1.0  # 가정(보수적): 전화번호를 등록한 사용자 비율 — 실측 현재 활성 구독 사업장 3곳 중 1~2곳
USER_SCAN_PLACE_CHECK = 4   # 코드: 사용자 직접 풀스캔의 점검 cost(사진 탭 끄면 4)
USER_SCANS_PER_BIZ_PER_DAY = 0.2   # 가정: 사업장당 하루 평균 사용자 수동 스캔 횟수 (실제 데이터 없음)


def mix_population(n: int) -> list[tuple[str, str]]:
    """설계 문서 §2 가정: basic 70% / startup 10% / pro 15% / biz 5%. 결정적 ID."""
    plans = (["basic"] * 14 + ["startup"] * 2 + ["pro"] * 3 + ["biz"] * 1)   # 20곳 단위 비율
    out = []
    for i in range(n):
        out.append((str(uuid.UUID(int=(i + 1) * 104729)), plans[i % len(plans)]))
    return out


def daily_loads(n: int, *, spread: bool, keywords: int, competitors: int, dedupe: float, prescan_reuse: bool,
                comp_cache: bool = False, comp_spread: bool = False, comps: dict | None = None) -> list[dict]:
    """요일(월~일)별 {batch, user, total} 페이지 로드. 배치=정기 잡, 사용자=수동 스캔."""
    pop = mix_population(n)
    days = []
    for wd in range(7):
        batch = 0.0
        for biz_id, plan in pop:
            mode = decide_scan_mode(plan, wd, biz_id, spread)
            naver_brief = 0 if prescan_reuse else BRIEF_PER_SCAN
            scan_cost = 0.0
            if mode == "full":
                scan_cost = naver_brief + AI_TAB_PER_FULL
            elif mode == "basic":
                scan_cost = 0 if prescan_reuse else LIGHT_SCAN_NAVER
            batch += scan_cost
            if comps is not None:
                comps["스캔(브리핑·AI탭)"] = comps.get("스캔(브리핑·AI탭)", 0) + scan_cost
            # 순위 잡: basic 월 1회(04:00), 그 외 플랜 매일(04:30) — jobs.py:215-222
            rank_cost = (RANK_PER_KEYWORD * keywords if wd == 0 else 0) if plan == "basic" else RANK_PER_KEYWORD * keywords
            batch += rank_cost
            if comps is not None:
                comps["키워드 순위(PC·모바일)"] = comps.get("키워드 순위(PC·모바일)", 0) + rank_cost
            # 별점 낮은 리뷰 감지: 월·목 10시, 사업장당 플레이스 2페이지(전화번호 등록 사업장만)
            low = LOW_RATING_COST * LOW_RATING_PHONE_SHARE if wd in LOW_RATING_WEEKDAYS else 0
            batch += low
            if comps is not None:
                comps["별점 낮은 리뷰 감지"] = comps.get("별점 낮은 리뷰 감지", 0) + low
            # 장소 통계: 월요일 주 1회
            if wd == 0:
                batch += PLACE_STATS_COST
                if comps is not None:
                    comps["내 가게 통계"] = comps.get("내 가게 통계", 0) + PLACE_STATS_COST
            # 경쟁사 크롤: 화·목, 고유 장소 비율(1-dedupe)만 실제 접속
            # 화(sync_all) + 목(enrich: 모든 경쟁사 재크롤). 72h 캐시가 있으면 목요일은 네이버 요청 없이 재사용
            # comp_spread: 사업장 슬롯 요일에 크롤(보강은 슬롯+2일 — 72h 캐시 안), 아니면 전 사업장이 화요일에 몰림
            sync_day = scan_slot(biz_id) if comp_spread else 1
            enrich_day = (sync_day + 2) % 7 if comp_spread else 3
            if wd == sync_day or (wd == enrich_day and not comp_cache):
                c = competitors * COMPETITOR_CRAWL_COST * (1 - dedupe)
                batch += c
                if comps is not None:
                    comps["경쟁사 크롤"] = comps.get("경쟁사 크롤", 0) + c
        user = n * USER_SCANS_PER_BIZ_PER_DAY * (naver_brief + AI_TAB_PER_FULL + USER_SCAN_PLACE_CHECK + PLACE_STATS_COST)
        days.append({"batch": batch, "user": user, "total": batch + user})
    return days


def first_n_over(limit: float, key: str, **kw) -> int | None:
    for n in (5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500, 1000):
        if max(d[key] for d in daily_loads(n, **kw)) > limit:
            return n
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cap", type=int, default=600)
    ap.add_argument("--batch-ratio", type=float, default=0.7)
    # 기본 4 — 2026-10-28 실측: 활성 사업장 6곳의 키워드 수 2·3·3·4·5·6(평균 3.8), 04:30 순위 잡이 4곳에서 16개를 측정(기존 가정 3)
    ap.add_argument("--keywords", type=int, default=4)
    ap.add_argument("--competitors", type=int, default=3)
    a = ap.parse_args()
    batch_cap = int(a.cap * a.batch_ratio)

    scenarios = {
        "현재(고정 요일, 중복 접속, 캐시 없음)": dict(spread=False, dedupe=0.0, prescan_reuse=False),
        "슬롯 분산": dict(spread=True, dedupe=0.0, prescan_reuse=False),
        "슬롯 분산 + 사전스캔 재사용": dict(spread=True, dedupe=0.0, prescan_reuse=True),
        "슬롯+사전스캔+경쟁사 72h 캐시": dict(spread=True, dedupe=0.0, prescan_reuse=True, comp_cache=True),
        "위 + 경쟁사 요일 분산": dict(spread=True, dedupe=0.0, prescan_reuse=True, comp_cache=True, comp_spread=True),
        "위 + 경쟁사 30% 중복 제거": dict(spread=True, dedupe=0.3, prescan_reuse=True, comp_cache=True, comp_spread=True),
    }
    print(f"가정: 키워드 {a.keywords}개, 사업장당 경쟁사 {a.competitors}곳, 상한 {a.cap} / 배치 몫 {batch_cap} (모두 코드 기준 모델, 실측 아님)")
    print(f"사용자 수동 스캔: 사업장당 하루 {USER_SCANS_PER_BIZ_PER_DAY}회 가정(근거 없음)\n")
    print(f"{'사업장 수':>8} | " + " | ".join(f"{k[:16]:<16}" for k in scenarios))
    for n in (10, 20, 50, 100, 300):
        cells = []
        for k, kw in scenarios.items():
            d = daily_loads(n, keywords=a.keywords, competitors=a.competitors, **kw)
            cells.append(f"배치{max(x['batch'] for x in d):>5.0f}/전체{max(x['total'] for x in d):>5.0f}")
        print(f"{n:>8} | " + " | ".join(f"{c:<16}" for c in cells))
    print()
    print("주간 합계 구성요소(사업장 20곳, 슬롯+사전스캔+캐시 시나리오):")
    _c: dict = {}
    daily_loads(20, keywords=a.keywords, competitors=a.competitors, spread=True, dedupe=0.0, prescan_reuse=True,
                comp_cache=True, comps=_c)
    _tot = sum(_c.values()) or 1
    for _k, _v in sorted(_c.items(), key=lambda kv: -kv[1]):
        print(f"  {_k}: {_v:.0f}건/주 ({_v / _tot * 100:.0f}%)")
    print("\n상한 초과 최초 사업장 수 (요일 최대 기준):")
    for k, kw in scenarios.items():
        nb = first_n_over(batch_cap, "batch", keywords=a.keywords, competitors=a.competitors, **kw)
        nt = first_n_over(a.cap, "total", keywords=a.keywords, competitors=a.competitors, **kw)
        print(f"  {k}: 배치 몫({batch_cap}) {nb or '>1000'}곳 / 전체({a.cap}) {nt or '>1000'}곳")


if __name__ == "__main__":
    main()
