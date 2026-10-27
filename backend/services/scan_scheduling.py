"""정기 스캔 분산 — 결정적 요일 슬롯·처리 순서 회전·예상 부하 계산 (2026-10-27).

docs/naver_request_load_spreading_design_v1.0.md §3 A·D 구현. 사용자 증가에 미리 대비하되,
**사용자에게 약속한 "주 N회"는 그대로 유지**하고 요일만 사업장 ID로 분산한다.

현재 구조의 문제(설계 문서 §1): 플랜별 요일이 고정(basic 월·목, startup 월, pro 월·수·금)이라 같은 플랜 전원이 같은 날
몰리고, 병목은 평균이 아니라 월요일 쏠림이다. 처리 순서도 DB 순서 고정이라 상한 도달 시 항상 뒤쪽 사업장이 굶는다.

요일 슬롯 분산은 `NAVER_SCAN_SLOT_SPREAD=true`일 때만 적용한다(기본 꺼짐). 이유: UI·약관·요금제 페이지에
"월·목" 같은 요일 고정 표기가 남아 있을 수 있어 문구 점검과 사용자 승인 후 켠다. 순서 회전은 사용자에게 보이지
않으므로 항상 적용한다.
"""
from __future__ import annotations

import hashlib
import os
from datetime import date
from typing import Callable, Iterable, TypeVar

T = TypeVar("T")

# 요일: 0=월 … 6=일 (date.weekday())
_BASIC_PAIRS = ({0, 3}, {1, 4}, {2, 5})          # 주 2회 — 이틀 간격 쌍
_PRO_TRIPLES = ({0, 2, 4}, {1, 3, 5}, {2, 4, 6})  # 주 3회 — 하루 걸러


def slot_spread_enabled() -> bool:
    return os.getenv("NAVER_SCAN_SLOT_SPREAD", "false").strip().lower() == "true"


def scan_slot(biz_id: str) -> int:
    """사업장 ID 기반 0~6 슬롯. 재시작·재배포에도 같고 새 가입자도 자동 배정된다(DB 변경 없음)."""
    return int(hashlib.md5(str(biz_id).encode("utf-8")).hexdigest()[:8], 16) % 7


def scheduled_full_scan_days(plan: str, biz_id: str) -> set[int]:
    """슬롯 분산 시 이 사업장이 풀스캔하는 요일 집합. 주 N회 횟수는 플랜 약속과 같다."""
    slot = scan_slot(biz_id)
    if plan == "startup":
        return {slot}                                   # 주 1회
    if plan == "basic":
        return set(_BASIC_PAIRS[slot % 3])              # 주 2회
    if plan == "pro":
        return set(_PRO_TRIPLES[slot % 3])              # 주 3회 풀스캔, 나머지 날 경량
    return set(range(7))                                # biz(매일)·그 외 — 분산 불가


def legacy_full_scan_days(plan: str) -> set[int]:
    """현재(고정 요일) 정책 — 분산 효과 비교·예상 부하 계산용."""
    if plan == "startup":
        return {0}
    if plan == "basic":
        return {0, 3}
    if plan == "pro":
        return {0, 2, 4}
    return set(range(7))


def rotate_for_fairness(items: Iterable[T], key: Callable[[T], str], today: date) -> list[T]:
    """처리 순서를 날짜 시드로 섞는다 — 상한에 도달해도 같은 사업장이 매일 뒤로 밀려 굶지 않게 한다.

    같은 날 안에서는 결정적(재시작해도 같은 순서), 날짜가 바뀌면 순서가 바뀐다.
    """
    seed = today.isoformat()
    return sorted(items, key=lambda it: hashlib.md5(f"{seed}:{key(it)}".encode("utf-8")).hexdigest())


def predict_weekday_load(businesses: Iterable[dict], spread: bool) -> list[int]:
    """요일(월~일)별 풀스캔 사업장 수. businesses: [{"id":..., "plan":...}]. DRY 점검·부하 모델용."""
    counts = [0] * 7
    for b in businesses:
        plan = b.get("plan") or "basic"
        days = scheduled_full_scan_days(plan, b["id"]) if spread else legacy_full_scan_days(plan)
        for d in days:
            counts[d] += 1
    return counts


def decide_scan_mode(plan: str, weekday: int, biz_id: str, spread: bool) -> str:
    """오늘 이 사업장을 어떻게 스캔할지 — "skip" | "basic"(경량) | "full".

    spread=False면 기존 daily_scan_all의 고정 요일 규칙과 **정확히 같다**(전수 비교 테스트로 고정):
      startup=월 / basic=월·목 / pro=월·수·금 풀스캔·나머지 날 경량 / biz 등=매일 풀스캔.
    spread=True면 같은 주 N회를 사업장 슬롯 요일로 분산한다.
    """
    if spread:
        full_today = weekday in scheduled_full_scan_days(plan, biz_id)
        startup_day = basic_day = pro_day = full_today
    else:
        startup_day, basic_day, pro_day = weekday == 0, weekday in (0, 3), weekday in (0, 2, 4)
    if plan == "startup" and not startup_day:
        return "skip"
    if plan == "basic" and not basic_day:
        return "skip"
    if plan == "pro" and not pro_day:
        return "basic"
    return "full"


def competitor_job_due(job: str, weekday: int, biz_id: str, spread: bool) -> bool:
    """경쟁사 플레이스 정기 잡이 오늘 이 사업장의 경쟁사를 처리할 차례인가.

    job: "sync"(competitor_place_sync_job, 현재 화요일 03:30) | "enrich"(enrich_competitor_details_job, 현재 목요일 03:00)
    spread=False면 기존과 같다(sync=화, enrich=목 — 전 사업장이 같은 날 몰림). 경쟁사 크롤이 주간 네이버 부하의 절반 이상이라
    (scripts/naver_load_model.py, 코드 기준 모델) 하루 최대치를 결정한다.
    spread=True면 사업장 슬롯 요일에 sync, 그 2일 뒤에 enrich — enrich는 72시간 재사용 캐시 안이라 네이버 요청 없이
    블로그 언급·웹사이트 SEO 보강만 한다.
    """
    if spread:
        sync_day = scan_slot(biz_id)
        return weekday == (sync_day if job == "sync" else (sync_day + 2) % 7)
    return weekday == (1 if job == "sync" else 3)
