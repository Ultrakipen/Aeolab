"""변화 방향 임계값(3점·10점) 재보정 점검 — 읽기 전용 (2026-11-02).

`stage_names.HEADLINE_BIG_DELTA`(10)·`HEADLINE_BAND_MIN_DELTA`(3)는 개발자 계정 9곳·344건으로 정한 제안값이다. 그 데이터에는 시스템 사건(채점 방식 변경·모델 교체·측정 장애)이 섞여 있어
지금 맞추면 그 사건들에 맞추게 된다. 이 도구는 **재보정 조건이 갖춰졌는지** 확인하고, 갖춰졌다면 사건 구간을 뺀 같은 가게의 변동폭 분포로 임계값 후보를 보여 준다.

재보정 조건(제안): ① 개발자 계정이 아닌 사업장 20곳 이상 ② 사건 구간을 뺀 '안정 구간'의 7일 간격 쌍 200개 이상.
개발자 계정 = ① 계정 생성일이 DEV_ACCOUNT_CUTOFF(2026-11-03, 소프트 런치 시작 전) 이전인 모든 계정(사용자 확인 2026-11-02: 그때까지의 계정은 전부 개발자 계정) ② `ADMIN_USER_IDS` ③ 환경변수 `RECALIBRATION_EXCLUDE_USER_IDS`(쉼표).
이전에는 ②만 봐서 개발자 계정인 사업장 6곳을 "개발자 계정이 아닌 곳"으로 세는 오판이 있었다(서버 첫 실행에서 발견).
사건 구간(기본값, 새 사건이 생기면 아래 상수에 추가): 순위 측정 장애기 2026-09-02~10-26, 채점·모델 변경일 2026-10-29(블로그 보정)·2026-11-01(ChatGPT 모델 교체)은 앞뒤 2일 제외.
DB에는 쓰지 않는다. 사용(서버): cd /var/www/aeolab/backend && PYTHONPATH=. /var/www/aeolab/venv/bin/python scripts/change_noise_report.py
"""
import os
import statistics
import sys
from collections import defaultdict
from datetime import date, timedelta

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

INCIDENT_RANGES = [("2026-09-02", "2026-10-26")]          # 순위 측정 장애기(RANK_MEASUREMENT_TRUSTED_FROM 이전)
METHOD_CHANGE_DATES = ["2026-10-29", "2026-11-01"]       # 채점·모델이 바뀐 날 — 앞뒤 MARGIN_DAYS 제외
MARGIN_DAYS = 2
MIN_NON_DEV_BUSINESSES = 20
MIN_STABLE_PAIRS = 200
DEV_ACCOUNT_CUTOFF = "2026-11-03"                          # 이 날짜 이전에 만들어진 계정은 모두 개발자 계정(소프트 런치 전, 사용자 확인 2026-11-02)


def is_developer_account(user_id, created_at, dev_ids) -> bool:
    """개발자 계정인가 — 생성일이 컷오프 이전이거나 명시된 id. 생성일을 모르면(조회 실패) 개발자로 본다(실제 고객 수를 부풀리지 않는 쪽)."""
    if str(user_id) in dev_ids:
        return True
    if not created_at:
        return True
    return str(created_at)[:10] < DEV_ACCOUNT_CUTOFF


def _d(s) -> date:
    return date.fromisoformat(str(s)[:10])


def is_excluded(day: date) -> bool:
    """장애기이거나 채점·모델 변경일의 앞뒤 구간이면 True."""
    for lo, hi in INCIDENT_RANGES:
        if _d(lo) <= day <= _d(hi):
            return True
    return any(abs((day - _d(c)).days) <= MARGIN_DAYS for c in METHOD_CHANGE_DATES)


def lag_deltas(by_day: dict, lag_days: int, stable_only: bool) -> list[float]:
    """같은 사업장의 날짜별 점수에서 lag_days 간격 쌍의 |변화|. stable_only면 양 끝 날짜가 모두 사건 구간 밖인 쌍만."""
    out = []
    for day_s, v in by_day.items():
        day = _d(day_s)
        prev_s = (day - timedelta(days=lag_days)).isoformat()
        if prev_s not in by_day:
            continue
        if stable_only and (is_excluded(day) or is_excluded(_d(prev_s))):
            continue
        out.append(abs(v - by_day[prev_s]))
    return out


def percentile(values: list[float], p: float) -> float:
    s = sorted(values)
    if not s:
        return float("nan")
    return s[min(len(s) - 1, int(len(s) * p))]


def summarize(values: list[float]) -> dict:
    n = len(values)
    if n == 0:
        return {"n": 0}
    return {
        "n": n, "median": round(statistics.median(values), 1), "p80": round(percentile(values, 0.8), 1), "p90": round(percentile(values, 0.9), 1),
        "ge2": round(sum(1 for x in values if x >= 2) / n * 100), "ge3": round(sum(1 for x in values if x >= 3) / n * 100),
        "ge5": round(sum(1 for x in values if x >= 5) / n * 100), "ge10": round(sum(1 for x in values if x >= 10) / n * 100),
    }


def recalibration_status(non_dev_businesses: int, stable_pairs: int) -> tuple[bool, list[str]]:
    """(조건 충족 여부, 미충족 사유 목록)."""
    why = []
    if non_dev_businesses < MIN_NON_DEV_BUSINESSES:
        why.append(f"개발자 계정이 아닌 사업장 {non_dev_businesses}곳 < {MIN_NON_DEV_BUSINESSES}곳")
    if stable_pairs < MIN_STABLE_PAIRS:
        why.append(f"안정 구간의 7일 간격 쌍 {stable_pairs}개 < {MIN_STABLE_PAIRS}개")
    return (not why, why)


def _load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(os.path.join(_BACKEND, ".env"))
    except ImportError:
        pass


def main() -> int:
    from db.supabase_client import get_client
    from services.score_engine import naver_result_unmeasured

    sb = get_client()
    rows, start = [], 0
    while True:  # 1,000행 상한 페이징
        page = sb.table("scan_results").select("business_id,scanned_at,unified_score,naver_result").order("scanned_at").range(start, start + 999).execute().data or []
        rows += page
        if len(page) < 1000:
            break
        start += 1000
    by_biz: dict = defaultdict(dict)
    for r in rows:
        if r.get("unified_score") is None or naver_result_unmeasured(r.get("naver_result")):
            continue  # 네이버 측정이 빠진 날은 척도가 달라 비교에서 뺀다
        by_biz[r["business_id"]][str(r["scanned_at"])[:10]] = r["unified_score"]

    owners = {b["id"]: b["user_id"] for b in (sb.table("businesses").select("id,user_id").execute().data or [])}
    dev_ids = {u.strip() for u in (os.getenv("ADMIN_USER_IDS", "") + "," + os.getenv("RECALIBRATION_EXCLUDE_USER_IDS", "")).split(",") if u.strip()}
    created = {}
    for uid in {owners.get(b) for b in by_biz if owners.get(b)}:
        try:
            created[uid] = str(getattr(sb.auth.admin.get_user_by_id(uid).user, "created_at", "") or "")
        except Exception as e:  # 한 명 조회 실패가 전체를 막지 않게 — 개발자로 취급(is_developer_account)
            print(f"  ! 계정 생성일 조회 실패 user={str(uid)[:8]}: {type(e).__name__}")
    non_dev = {b for b in by_biz if not is_developer_account(owners.get(b), created.get(owners.get(b)), dev_ids)}

    print(f"측정 정상 스캔 사업장 {len(by_biz)}곳 · 그중 개발자 계정이 아닌 곳 {len(non_dev)}곳")
    for label, lag, stable in (("전체 기간 · 하루 간격", 1, False), ("안정 구간 · 하루 간격", 1, True), ("전체 기간 · 7일 간격", 7, False), ("안정 구간 · 7일 간격", 7, True)):
        vals = [x for biz in by_biz.values() for x in lag_deltas(biz, lag, stable)]
        s = summarize(vals)
        print(f"{label.ljust(16)}", "표본 없음" if s["n"] == 0 else f"쌍 {s['n']} | 중앙 {s['median']} | 80분위 {s['p80']} | 90분위 {s['p90']} | ≥2점 {s['ge2']}% ≥3점 {s['ge3']}% ≥5점 {s['ge5']}% ≥10점 {s['ge10']}%")
    stable7 = [x for biz in by_biz.values() for x in lag_deltas(biz, 7, True)]
    stable7_non_dev = [x for b in non_dev for x in lag_deltas(by_biz[b], 7, True)]
    ready, why = recalibration_status(len(non_dev), len(stable7_non_dev))
    print("---")
    print("재보정 조건:", "충족" if ready else "미충족 — " + " / ".join(why))
    if ready:
        print(f"임계값 후보(개발자 계정이 아닌 사업장의 안정 구간 7일 간격 |변화| 90분위): {round(percentile(stable7_non_dev, 0.9), 1)}점 — 현재 10점·3점과 비교해 `stage_names.HEADLINE_*`·`lib/changeDirection.ts`를 함께 고친다(시험이 일치를 강제).")
    else:
        print(f"참고(전체 사업장 안정 구간 7일 90분위): {round(percentile(stable7, 0.9), 1) if stable7 else '표본 없음'}점 — 개발자 계정 포함이라 보정에 쓰지 않는다.")
    return 0


if __name__ == "__main__":
    _load_env()
    sys.exit(main())
