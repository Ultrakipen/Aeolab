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
# 슬롯 분산 패턴은 가게 슬롯(0~6)에서 바로 만든다: Basic {s, s+3}(주 2회), Pro {s, s+2, s+4}(주 3회).
# 이전에는 슬롯%3으로 3가지 패턴만 써서 Basic이 월·목에 42%씩 몰리고 일요일은 0%, Pro가 수·금에 71%씩 몰렸다(2026-10-29 측정).
# 슬롯이 7일에 고르게 퍼지므로 이 방식은 하루 부하가 Basic 2/7·Pro 3/7로 정확히 균등하다.


def slot_spread_enabled() -> bool:
    return os.getenv("NAVER_SCAN_SLOT_SPREAD", "false").strip().lower() == "true"


def scan_slot(biz_id: str) -> int:
    """사업장 ID 기반 0~6 슬롯. 재시작·재배포에도 같고 새 가입자도 자동 배정된다(DB 변경 없음)."""
    return int(hashlib.md5(str(biz_id).encode("utf-8")).hexdigest()[:8], 16) % 7


def keyword_rank_day(biz_id: str) -> int:
    """Basic 플랜 주 1회 키워드 순위를 재는 요일(0=월~6=일). 가게마다 하루씩 나눠 월요일 쏠림을 푼다(2026-10-29).

    scan_slot(경쟁사 동기화·스캔 슬롯)과 같은 요일에 겹치지 않도록 소금값을 따로 둔다.
    """
    return int(hashlib.md5(f"{biz_id}:rank".encode("utf-8")).hexdigest()[:8], 16) % 7


def keyword_rank_days(plan: str, biz_id: str) -> set[int]:
    """키워드 순위를 재는 요일 집합(0=월~6=일). 가게당 주 횟수는 이전과 같다 — Basic 주 1회, 그 외 플랜 주 3회.

    주 3회는 월·수·금 일괄이 아니라 가게별 {d, d+2, d+4}(간격 2·2·3일)로 나눠 하루 부하가 전체의 3/7이 되게 한다.
    """
    d = keyword_rank_day(biz_id)
    if plan == "basic":
        return {d}
    return {d, (d + 2) % 7, (d + 4) % 7}


def place_stats_day(biz_id: str) -> int:
    """내 가게 플레이스 통계(리뷰 수·평점)를 갱신하는 요일(0=월~6=일). 순위·스캔 슬롯과 겹치지 않게 소금값을 따로 둔다."""
    return int(hashlib.md5(f"{biz_id}:stats".encode("utf-8")).hexdigest()[:8], 16) % 7


def scheduled_full_scan_days(plan: str, biz_id: str) -> set[int]:
    """슬롯 분산 시 이 사업장이 풀스캔하는 요일 집합. 주 N회 횟수는 플랜 약속과 같다."""
    slot = scan_slot(biz_id)
    if plan == "startup":
        return {slot}                                   # 주 1회
    if plan == "basic":
        return {slot, (slot + 3) % 7}                   # 주 2회 — 3·4일 간격
    if plan == "pro":
        return {slot, (slot + 2) % 7, (slot + 4) % 7}   # 주 3회 풀스캔(간격 2·2·3일), 나머지 날 경량
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


# ─────────────────────────────────────────────────────────────────────────────
# 경쟁사 크롤 "오래된 순서 + 하루 예산" 선택 (2026-10-28)
#
# 요일 슬롯 방식(`competitor_job_due`)의 한계 — 두 가지를 실측(시뮬레이션)·코드로 확인했다:
#  1) md5 % 7 해시 배정은 사업장이 적을 때 크게 치우친다. 사업장 20곳이면 최대일이 균등(3곳)보다 평균 5.3곳으로
#     용량의 약 44%를 잃고, 10~50곳 구간에서 27~38%를 잃는다(하필 일일 상한에 걸리는 구간).
#  2) 요일을 매일 다시 계산하는 균형 배정은 사업장이 추가·삭제되면 배정이 바뀌어 한 주를 건너뛸 수 있다.
# 그래서 요일 대신 "마지막 관측이 오래된 사업장부터, 하루 예산 안에서" 고른다:
#  - 건너뛸 수 없다: 예산에서 밀린 사업장은 다음 날 더 오래된 상태로 맨 앞에 선다(굶음 없음, 순서 회전도 불필요).
#  - 스스로 분산된다: 처음 며칠은 예산만큼만 처리하고 나머지는 다음 날로 넘어가 이후 요일이 자연히 엇갈린다.
#  - 사업장·경쟁사 수가 바뀌어도, 일일 상한이 줄어도 그대로 동작한다. 사용자에게 보이는 요일 약속이 없다.
# 기준 시각은 경쟁사 행의 naver_place_last_synced_at(다른 사업장 크롤을 재사용했어도 실제 관측 시각)이다.
# ─────────────────────────────────────────────────────────────────────────────
from datetime import datetime, timezone
from typing import Optional

COMPETITOR_PAGE_COST = 6     # competitor_place_crawler.fetch_competitor_place_data 의 cost 와 같아야 한다
# 경쟁사 플레이스 정보 갱신 주기 — 2주(2026-10-28 사용자 결정, 공개 문구도 "2주마다"). 캐시 TTL(13.5일)과 pacing(13일)을 함께 둔다:
# TTL이 14일이면 14일째 아침에 아슬아슬하게 못 들어와 하루씩 밀린다. 기본값 변경 시 crawler의 기본 TTL·테스트도 같이 바꿀 것.
# 갱신 주기는 COMPETITOR_REFRESH_WEEKS(2·3·4주, 기본 2)가 단일 출처다. 용량이 모자랄 때 쓰는 절감 레버(기본 꺼짐=2주):
# 바꾸면 공개 문구("경쟁사 정보를 2주마다")도 같은 주기로 고쳐야 한다 — demo/page.tsx·PlanGate.tsx·onboarding/page.tsx·CompetitorsClient.tsx.
_ALLOWED_REFRESH_WEEKS = (2, 3, 4)


def competitor_refresh_weeks() -> int:
    """환경변수 COMPETITOR_REFRESH_WEEKS(2·3·4). 비었거나 허용값이 아니면 2주(현재 약속)."""
    try:
        w = int(os.getenv("COMPETITOR_REFRESH_WEEKS", "2").strip())
    except ValueError:
        return 2
    return w if w in _ALLOWED_REFRESH_WEEKS else 2


def refresh_params(weeks: int) -> tuple:
    """(캐시 TTL 초, pacing 일수). N주 주기 = N*7일에서 TTL은 0.5일, pacing은 1일 모자라게 둔다(N*7일째 아침에
    아슬아슬하게 못 들어와 하루씩 밀리는 것을 막는다)."""
    return ((weeks * 7 - 0.5) * 86400, float(weeks * 7 - 1))


COMPETITOR_REFRESH_TTL_SEC, COMPETITOR_PACE_DAYS = refresh_params(competitor_refresh_weeks())   # 기본 2주 = 13.5일 / 13일


def competitor_stale_first_enabled() -> bool:
    """기본 꺼짐 — 켜면 competitor_place_sync_job·enrich_competitor_details_job 이 요일 대신 오래된 순서로 고른다.
    NAVER_SCAN_SLOT_SPREAD 와 별개다(요일 문구와 무관해서 약관·요금제 점검이 필요 없다)."""
    return os.getenv("NAVER_COMPETITOR_STALE_FIRST", "false").strip().lower() == "true"


def competitor_daily_budget_ratio() -> float:
    """정기 잡 일일 상한 중 경쟁사 크롤이 쓸 비율 — 나머지는 스캔·순위·통계 몫. 근거 없는 제안값."""
    try:
        return max(0.1, min(1.0, float(os.getenv("NAVER_COMPETITOR_DAILY_RATIO", "0.6"))))
    except ValueError:
        return 0.6


def parse_ts(v) -> Optional[datetime]:
    """ISO 문자열/datetime → 시간대 있는 UTC datetime. 비었거나 해석 불가면 None(관측 없음으로 취급)."""
    if v is None or v == "":
        return None
    try:
        dt = v if isinstance(v, datetime) else datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def select_stale_first(items: list[dict], now: datetime, min_age_sec: float, budget_pages: int, today: date,
                       pace_days: float = COMPETITOR_PACE_DAYS) -> list[str]:
    """오늘 크롤할 사업장 id 목록(오래된 순서).

    items: [{"id": str, "last": datetime|None, "pages": int}] — last 는 그 사업장 경쟁사 중 **가장 오래된** 관측 시각
    (한 곳이라도 관측이 없으면 None), pages 는 크롤 예상 페이지 수.
    - min_age_sec 이상 지난(또는 관측 없는) 사업장만 대상. 캐시 TTL과 같게 두면 캐시에 막혀 헛도는 선택이 없다.
    - 가장 오래된 순서(관측 없음이 맨 앞). 같은 시각이면 날짜 시드 해시로 결정적 순서.
    - 예산을 넘기 직전까지만. 맨 앞(가장 오래된) 사업장은 예산보다 커도 반드시 포함 — 큰 사업장이 영영 안 밀리게.
      예산 안에 못 드는 사업장을 건너뛰고 뒤의 작은 사업장을 먼저 처리하지 않는다(굶음 방지, 엄격한 오래된 순서).
    - budget_pages <= 0 이면 아무것도 고르지 않는다(상한을 이미 썼다).
    - pace_days: 하루 처리량을 "전체 사업장 페이지 합 ÷ pace_days"로도 제한한다. 이 제한이 없으면 예산이 주간 평균보다 클 때
      대상이 된 날 예산을 전부 쓰고 나머지 날은 쉬는 식으로 3일에 몰린다(시뮬레이션으로 확인: 일별 240·240·120·0·0·0…).
      13일(COMPETITOR_PACE_DAYS, 갱신 주기 2주)로 나누면 2주 안에 한 바퀴를 돌면서 하루 부하가 고르다. 예산이 더 작으면 예산이 우선한다.
      (위 시뮬레이션 수치는 주기 1주·pace 6일 때의 값이다. 2주 주기의 값은 tests/test_competitor_stale_first.py가 확인한다.)
    """
    if budget_pages <= 0:
        return []
    # pacing 기준은 "캐시 할인 전" 전체 작업량 — 지금 캐시가 유효한 경쟁사를 0으로 세면 한도가 같이 줄어 처리량이 오히려 막힌다
    total_pages = sum(max(1, int(it.get("pages_full", it["pages"]))) for it in items)
    # pacing 한도는 "부드러운" 한도 — 한도에 닿을 때까지 담되 마지막 한 곳은 넘을 수 있다. 엄격하게 자르면 한도가 한 곳
    # 크기의 1.x배일 때 한 곳씩만 들어가 주간 처리 능력이 대상보다 작아진다(8곳+사업장 변경 시 간격 13일 — 시뮬레이션으로 확인).
    pace_cap = max(1, int(-(-total_pages // pace_days))) if (pace_days and pace_days > 0 and total_pages) else None
    due = [it for it in items if it["last"] is None or (now - it["last"]).total_seconds() >= min_age_sec]
    # 평활화(pace)는 하루 부하를 고르게 하는 장치일 뿐이다. 이미 기한(min_age_sec)을 하루 넘겨 밀린 사업장이 있으면 풀고
    # 예산(budget_pages)만 지킨다 — 신규 사업장(관측 없음)이 맨 앞에서 하루 처리량을 먼저 써 기존 사업장이 3~5일 더 기다리는
    # 것을 막는다(20곳 + 신규 5곳 시뮬레이션: 최대 간격 17일 → 15일, 정상 상태는 변화 없음. 2026-10-29).
    if pace_cap is not None and any(
        it["last"] is not None and (now - it["last"]).total_seconds() >= min_age_sec + 86400 for it in due
    ):
        pace_cap = None
    due.sort(key=lambda it: (it["last"] is not None, it["last"] or now,
                             hashlib.md5(f"{today.isoformat()}:{it['id']}".encode("utf-8")).hexdigest()))
    out: list[str] = []
    used = 0
    for it in due:
        pages = max(1, int(it["pages"]))
        if out and (used + pages > budget_pages or (pace_cap is not None and used >= pace_cap)):
            break
        out.append(str(it["id"]))
        used += pages
    return out


# ── 네이버 측정 실패 후 1회 재시도 (2026-10-29) ─────────────────────────────────────────────
# 정기 스캔에서 네이버 측정이 실패(차단·캡차·일일 상한·접속 실패)하면 그 항목은 "확인 전"으로 남고, 스캔하지 않는 날이
# 많은 플랜(Basic 주 2회·창업패키지 주 1회)은 다음 정기 스캔까지 며칠을 기다린다. 스캔하지 않는 날이어도 **직전 스캔의
# 네이버 측정이 실패했다면 하루 뒤 한 번만** 기존 스캔 경로로 다시 측정한다(새 측정 코드를 만들지 않는다 — 점수·기록·알림이
# 정기 스캔과 똑같이 만들어진다). 네이버 접속은 기존 가드(쿨다운·속도·일일 상한·배치 몫)를 그대로 거친다.
NAVER_RETRY_MAX_AGE_SEC = 36 * 3600     # 직전 스캔이 이보다 오래됐으면 재시도하지 않는다(다음 정기 스캔이 가깝거나 이미 지남)
NAVER_RETRY_MAX_CONSECUTIVE_FAILS = 1   # 연속 실패가 이보다 많으면(재시도도 실패) 더 두드리지 않고 정기 일정을 기다린다


def naver_scan_failed(naver_result) -> bool:
    """저장된 naver_result가 '측정 자체에 실패한' 결과인가 — 캡차·오류·일일 상한 건너뜀. 값이 아예 없으면 False
    (순위 전용 행처럼 naver_result가 원래 비는 행을 실패로 오인하지 않는다)."""
    if not isinstance(naver_result, dict):
        return False
    return bool(naver_result.get("captcha_detected")) or bool(naver_result.get("error")) or naver_result.get("quota_skipped") is True


def naver_retry_due(recent_scans: list, now: datetime, today: date, access_blocked: bool) -> bool:
    """오늘이 스캔하지 않는 날이어도 이 사업장을 한 번 다시 스캔해야 하는가.

    recent_scans: 최신순 [{"scanned_at": ISO, "naver_result": dict|None}, ...].
    - 지금 네이버 접속이 막혀 있으면(쿨다운 중) 재시도해도 같은 결과라 AI 호출 비용만 쓰므로 하지 않는다.
    - 가장 최근 스캔의 네이버 측정이 실패했고, 그 스캔이 오늘이 아니며 36시간 이내일 때만.
    - 최근 스캔이 연속으로 실패한 횟수가 NAVER_RETRY_MAX_CONSECUTIVE_FAILS를 넘으면(= 재시도도 실패) 하지 않는다.
    """
    if access_blocked or not recent_scans:
        return False
    latest = recent_scans[0]
    if not naver_scan_failed(latest.get("naver_result")):
        return False
    ts = parse_ts(latest.get("scanned_at"))
    if ts is None or ts.date() >= today or (now - ts).total_seconds() > NAVER_RETRY_MAX_AGE_SEC:
        return False
    fails = 0
    for r in recent_scans:
        if naver_scan_failed(r.get("naver_result")):
            fails += 1
        else:
            break
    return fails <= NAVER_RETRY_MAX_CONSECUTIVE_FAILS


def cache_still_valid(last: Optional[datetime], now: datetime, ttl_sec: float, margin_sec: float = 6 * 3600) -> bool:
    """경쟁사 크롤 캐시가 아직 유효해 enrich 가 네이버 접속 없이 끝낼 수 있는가.
    관측이 없거나 TTL 직전이면 False — enrich 가 캐시 만료로 새 크롤을 시작하지 않게 건너뛴다(다음 sync 가 처리)."""
    return last is not None and (now - last).total_seconds() < ttl_sec - margin_sec


def build_stale_items(rows: list[dict], now: datetime, cached_ids: Optional[set] = None) -> list[dict]:
    """competitors 행들(business_id, naver_place_last_synced_at)을 사업장 단위 select_stale_first 입력으로 묶는다.
    한 곳이라도 관측이 없으면 그 사업장은 last=None(가장 우선), 아니면 가장 오래된 관측 시각. pages 는 경쟁사 수 × 크롤 비용.
    cached_ids: 지금 캐시가 유효해 네이버 접속 없이 끝날 플레이스 ID(다른 사업장이 최근 크롤한 같은 경쟁사). 그 행은 0페이지로 센다 —
    안 그러면 겹치는 경쟁사가 많을수록 예산을 실제보다 크게 잡아 하루 처리 사업장이 줄고 간격이 늘어난다. 없으면(None) 전부 비용으로 센다."""
    groups: dict[str, dict] = {}
    for r in rows:
        biz = str(r["business_id"])
        g = groups.setdefault(biz, {"id": biz, "last": now, "pages": 0, "pages_full": 0, "unobserved": False})
        g["pages_full"] += COMPETITOR_PAGE_COST
        if not (cached_ids and r.get("naver_place_id") is not None and str(r["naver_place_id"]) in cached_ids):
            g["pages"] += COMPETITOR_PAGE_COST
        ts = parse_ts(r.get("naver_place_last_synced_at"))
        if ts is None:
            g["unobserved"] = True
        elif ts < g["last"]:
            g["last"] = ts
    return [{"id": g["id"], "last": None if g["unobserved"] else g["last"], "pages": g["pages"], "pages_full": g["pages_full"]}
            for g in groups.values()]


def entitled_user_ids(sub_rows, admin_ids=()) -> set:
    """지금 유료 서비스를 받을 자격이 있는 사용자 id (2026-10-29).

    `middleware.plan_gate.get_user_plan`과 같은 기준이다: active·grace_period, 그리고 해지했어도 `end_at`이 아직
    지나지 않았다면 포함(해지해도 만료일까지 서비스 유지). 만료일이 지난 해지·그 밖의 상태·구독 없음은 free라 제외한다.
    네이버를 열어 보는 정기 잡이 이미 끝난 계정의 경쟁사까지 매일 크롤하던 낭비를 막는 데 쓴다 — 오늘(10-29) 경쟁사 크롤
    48페이지가 전부 만료된 해지 계정·관리자 계정의 것이었다.
    """
    from middleware.plan_gate import _end_at_in_future

    ids = {str(a) for a in (admin_ids or ()) if a}
    for row in sub_rows or []:
        uid, status = row.get("user_id"), row.get("status")
        if not uid:
            continue
        if status in ("active", "grace_period") or (status == "cancelled" and _end_at_in_future(row.get("end_at"))):
            ids.add(str(uid))
    return ids


def entitled_sub_rows(sub_rows) -> list:
    """`entitled_user_ids`와 같은 기준으로 구독 행만 남긴다(플랜 정보를 같이 쓰는 잡용).

    네이버·AI 스캔 비용이 드는 정기 잡(야간 스캔·순위·내 가게 통계)이 같은 정의를 쓰게 한다. 이전에는 잡마다
    active만 / active+grace_period로 달라서, 해지했어도 만료일까지 서비스를 유지한다는 안내(설정 화면)와 어긋났다.
    """
    keep = entitled_user_ids(sub_rows)
    return [r for r in (sub_rows or []) if r.get("user_id") in keep]
