"""네이버 접속 용량 대비 활성 사업장 수 (2026-10-29).

한도는 `scripts/naver_load_model.py`(코드 기준 모델, 실측 아님)에서 일일 상한 600 기준 월요일이 먼저 닿는 규모(약 50곳)다.
결제는 막지 않고 운영자에게 알리기만 한다(사용자 결정). 실측 데이터가 쌓이면 NAVER_CAPACITY_BUSINESSES로 보정한다.
"""
from __future__ import annotations

import os

DEFAULT_CAPACITY_BUSINESSES = 50
# 단계: (비율, 이름) — 높은 단계부터 판정
LEVELS = ((1.0, "100%"), (0.9, "90%"), (0.7, "70%"))


# 단계별 대응표 — 활성 사업장 수가 늘 때 무엇을 어떤 순서로 하는지 (docs/naver_capacity_300_playbook_2026_10_29.md).
# 효과 수치는 코드 기준 모델(scripts/naver_load_model.py --levers 300)이며 실측이 아니다.
# decide=True는 공개 약속·기능 범위·법적 민감 항목이라 **사용자 결정 없이 실행하지 않는다**(CLAUDE.md 지침 8번).
PLAYBOOK = (
    {"from_pct": 70, "step": "AI탭 질의 수를 4→2로 낮춘다 (서버 .env NAVER_AI_TAB_MAX_QUERIES=2 후 백엔드 재시작)",
     "effect": "100곳 기준 정기 잡 하루 최대 705→613 (몫 420 대비 168%→146%)", "decide": False},
    # 스캔 슬롯 분산(NAVER_SCAN_SLOT_SPREAD)은 2026-10-29 사용자 결정으로 켰다 — 요일 문구 정리 후, 대응표에서 제외.
    {"from_pct": 90, "step": "일일 사용량·캐시 적중률·수동 스캔 빈도를 /admin/naver-access에서 읽어 모델 가정(키워드 4개·경쟁사 3곳·수동 스캔 0.2회/일·경쟁사 겹침)을 실측으로 교체한다",
     "effect": "한도 수치 자체를 보정 (이후 단계의 필요 시점이 바뀐다)", "decide": False},
    {"from_pct": 100, "step": "신규 가입을 대기자 명단으로 전환할지 결정한다 (결제는 자동으로 막지 않는다)",
     "effect": "더 이상 부하가 늘지 않음", "decide": True},
    {"from_pct": 200, "step": "100곳 이상으로 가려면 아래를 사용자가 결정한다 — 레버는 코드에 준비돼 있고 서버 .env에서 켠다(후 백엔드 재시작): 순위 모바일만 NAVER_RANK_MOBILE_ONLY=true(PC 순위 미측정, 점수 항목 영향), AI탭 끔 NAVER_AI_TAB_ENABLED=false(기능 축소), 경쟁사 갱신 4주 COMPETITOR_REFRESH_WEEKS=4(공개 문구 '2주마다' 4곳도 함께 수정 — demo/page.tsx·PlanGate.tsx·onboarding/page.tsx·CompetitorsClient.tsx). 플랜별 키워드·경쟁사 한도 축소는 환경변수 레버가 없다 — PLAN_LIMITS·plans.ts·요금제·설정 비교표·약관을 함께 바꿔야 한다",
     "effect": "300곳 기준 정기 잡 몫 대비 229%→96% (python scripts/naver_load_model.py --levers 300)", "decide": True},
    {"from_pct": 90, "step": "사전 스캔(GitHub 야간 워크플로)이 모든 사업장을 90분 안에 끝내는지 확인한다 — 워크플로 주석 기준 60곳에 약 60분이라 사업장이 늘면 나눠 실행해야 한다. 접속 경로가 GitHub IP라는 점은 법적 검토 대상이다",
     "effect": "300곳 기준 378%→318% (야간·수동 스캔이 서버의 브리핑 접속을 생략, 워크플로가 감당할 때만)", "decide": False},
    {"from_pct": 200, "step": "경쟁사 겹침 캐시의 효과를 실측한다 (플레이스 ID 공유 캐시는 구현돼 있으나 겹침 비율은 미측정)",
     "effect": "300곳 기준 318%→289% (30% 가정)", "decide": False},
    {"from_pct": 200, "step": "접속 경로 분산(서버·프록시 추가)은 변호사 자문 후 사용자가 결정한다",
     "effect": "IP당 한도가 기준이면 대략 서버 수만큼 (네이버 기준 미확인)", "decide": True},
)


def next_steps(used_pct: float) -> list[dict]:
    """현재 사용률에서 지금 착수해야 하는 조치(해당 단계 이하 전부)."""
    return [s for s in PLAYBOOK if used_pct >= s["from_pct"]]


def capacity_limit() -> int:
    try:
        v = int(os.getenv("NAVER_CAPACITY_BUSINESSES", str(DEFAULT_CAPACITY_BUSINESSES)))
        return v if v > 0 else DEFAULT_CAPACITY_BUSINESSES
    except ValueError:
        return DEFAULT_CAPACITY_BUSINESSES


def capacity_level(count: int, limit: int) -> str | None:
    """count가 한도의 몇 % 단계에 닿았는지. 70% 미만이면 None."""
    if limit <= 0:
        return None
    for ratio, name in LEVELS:
        if count >= limit * ratio:
            return name
    return None


async def active_business_count(supabase=None) -> int:
    """활성 구독자가 소유한 활성 사업장 수(네이버 접속 대상 규모)."""
    from db.supabase_client import get_client, execute
    supabase = supabase or get_client()
    subs = await execute(supabase.table("subscriptions").select("user_id").eq("status", "active"))
    user_ids = list({s["user_id"] for s in ((subs.data if subs else None) or []) if s.get("user_id")})
    if not user_ids:
        return 0
    biz = await execute(
        supabase.table("businesses").select("id").eq("is_active", True).in_("user_id", user_ids)
    )
    return len((biz.data if biz else None) or [])


async def capacity_snapshot(supabase=None) -> dict:
    limit = capacity_limit()
    count = await active_business_count(supabase)
    return {
        "active_businesses": count,
        "limit": limit,
        "used_pct": round(count / limit * 100, 1),
        "level": capacity_level(count, limit),
        "next_steps": next_steps(count / limit * 100),
        "basis": "코드 기준 모델(실측 아님) — scripts/naver_load_model.py, NAVER_CAPACITY_BUSINESSES로 보정",
    }
