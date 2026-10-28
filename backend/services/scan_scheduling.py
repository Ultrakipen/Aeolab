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

COMPETITOR_PAGE_COST = 10    # competitor_place_crawler.fetch_competitor_place_data 의 cost 와 같아야 한다


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
                       pace_days: float = 6.0) -> list[str]:
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
      6일로 나누면 한 주 안에 한 바퀴를 돌면서 하루 부하가 고르다. 예산이 더 작으면 예산이 우선한다.
    """
    if budget_pages <= 0:
        return []
    total_pages = sum(max(1, int(it["pages"])) for it in items)
    # pacing 한도는 "부드러운" 한도 — 한도에 닿을 때까지 담되 마지막 한 곳은 넘을 수 있다. 엄격하게 자르면 한도가 한 곳
    # 크기의 1.x배일 때 한 곳씩만 들어가 주간 처리 능력이 대상보다 작아진다(8곳+사업장 변경 시 간격 13일 — 시뮬레이션으로 확인).
    pace_cap = max(1, int(-(-total_pages // pace_days))) if (pace_days and pace_days > 0 and total_pages) else None
    due = [it for it in items if it["last"] is None or (now - it["last"]).total_seconds() >= min_age_sec]
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


# ── 별점 낮은 리뷰 잡: 오래된 순서 회전 (2026-10-28) ─────────────────────────────────
# 이 잡(6시간마다, 사업장당 플레이스 2페이지)은 사업장을 항상 같은 순서로 돌았다. 배치 몫·일일 상한으로 중간에 막히면 앞 사업장만
# 매번 확인되고 뒤 사업장은 영영 확인되지 않는다(시뮬레이션: 사업장 50곳 이상이면 15곳에서 멈춤). 마지막으로 **확인에 성공한** 시각을
# 파일에 두고 오래된(또는 한 번도 안 한) 사업장부터 돈다 — 막히면 그 자리에서 멈추고, 다음 실행은 못 한 사업장부터 이어 간다.
import json
import tempfile


def low_rating_state_path() -> str:
    default = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".naver_low_rating_state.json")
    return os.getenv("NAVER_LOW_RATING_STATE_FILE", default)


LOW_RATING_SEEN_MAX = 100   # 사업장당 기억하는 "이미 본 낮은 별점 리뷰" 수 — 화면에 보이는 리뷰보다 충분히 크다


def load_low_rating_state() -> dict:
    """{"last": {사업장 id: 마지막 확인 성공 epoch 초}, "seen": {사업장 id: [이미 본 낮은 별점 review_id…]}}.
    파일이 없거나 깨졌으면 빈 상태(전부 '한 번도 안 한' 것 — 첫 확인은 알림 없이 기준선만 기록한다)."""
    empty: dict = {"last": {}, "seen": {}}
    try:
        with open(low_rating_state_path(), "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            return empty
        last_raw = raw["last"] if isinstance(raw.get("last"), dict) else {k: v for k, v in raw.items() if k != "seen"}
        seen_raw = raw["seen"] if isinstance(raw.get("seen"), dict) else {}
        return {
            "last": {str(k): float(v) for k, v in last_raw.items() if isinstance(v, (int, float))},
            "seen": {str(k): [str(x) for x in v] for k, v in seen_raw.items() if isinstance(v, list)},
        }
    except (OSError, ValueError, AttributeError):
        return empty


def save_low_rating_state(state: dict, keep_ids: Iterable[str]) -> None:
    """현재 대상 사업장만 남겨 저장(삭제·비활성 사업장 정리). 원자적 교체 — 저장 실패는 다음 실행이 같은 순서로 다시 도는 것뿐이라 삼킨다."""
    keep = {str(i) for i in keep_ids}
    data = {
        "last": {k: v for k, v in state.get("last", {}).items() if k in keep},
        "seen": {k: v[-LOW_RATING_SEEN_MAX:] for k, v in state.get("seen", {}).items() if k in keep},
    }
    path = low_rating_state_path()
    try:
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path) or ".", prefix=".lowrating_", suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp, path)
    except OSError:
        pass


def order_stalest_first(ids: list[str], last: dict[str, float], today: date) -> list[str]:
    """한 번도 확인 못 한 사업장이 맨 앞, 그다음 마지막 확인이 오래된 순. 같은 값이면 날짜 시드 해시로 결정적 순서."""
    return sorted(
        (str(i) for i in ids),
        key=lambda i: (i in last, last.get(i, 0.0), hashlib.md5(f"{today.isoformat()}:{i}".encode("utf-8")).hexdigest()),
    )


def cache_still_valid(last: Optional[datetime], now: datetime, ttl_sec: float, margin_sec: float = 6 * 3600) -> bool:
    """경쟁사 크롤 캐시가 아직 유효해 enrich 가 네이버 접속 없이 끝낼 수 있는가.
    관측이 없거나 TTL 직전이면 False — enrich 가 캐시 만료로 새 크롤을 시작하지 않게 건너뛴다(다음 sync 가 처리)."""
    return last is not None and (now - last).total_seconds() < ttl_sec - margin_sec


def build_stale_items(rows: list[dict], now: datetime) -> list[dict]:
    """competitors 행들(business_id, naver_place_last_synced_at)을 사업장 단위 select_stale_first 입력으로 묶는다.
    한 곳이라도 관측이 없으면 그 사업장은 last=None(가장 우선), 아니면 가장 오래된 관측 시각. pages 는 경쟁사 수 × 크롤 비용(캐시 적중 시 실제는 더 적다)."""
    groups: dict[str, dict] = {}
    for r in rows:
        biz = str(r["business_id"])
        g = groups.setdefault(biz, {"id": biz, "last": now, "pages": 0, "unobserved": False})
        g["pages"] += COMPETITOR_PAGE_COST
        ts = parse_ts(r.get("naver_place_last_synced_at"))
        if ts is None:
            g["unobserved"] = True
        elif ts < g["last"]:
            g["last"] = ts
    return [{"id": g["id"], "last": None if g["unobserved"] else g["last"], "pages": g["pages"]} for g in groups.values()]
