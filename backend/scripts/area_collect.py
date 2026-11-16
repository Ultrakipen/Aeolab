"""
/area 스냅샷 수집 스크립트 (서버에서 수동·야간 실행, 방문자 요청과 무관)

사용법 (서버 backend/ 에서):
  PYTHONPATH=. venv/bin/python scripts/area_collect.py --dry-run
  PYTHONPATH=. venv/bin/python scripts/area_collect.py --max-regions 3
  PYTHONPATH=. venv/bin/python scripts/area_collect.py --only "서울-강남구" --force

동작
- 지역을 하나씩 순차로, 업종도 순차로 조회한다(동시 호출 없음 — sbiz '초당 제한' 실측 이력 때문).
- 이미 수집한 지역은 STALE_DAYS(25일) 안이면 건너뛴다(기준월이 월 단위라 한 달에 한 번이면 충분). --force로 무시.
- 한 번에 --max-regions개까지만(기본 5) — 일일 한도(data.go.kr 10,000회/일, 코드 주석 기준)를 며칠에 나눠 쓰기 위해.
- 새로 받은 값이 '실패(api_timeout 등)'이면 기존에 받아 둔 값을 덮어쓰지 않는다. 성공적으로 확인된 '데이터 없음'만 기록한다.
- 지역 이름을 카카오 주소검색으로 확인하지 못하면 그 지역은 건너뛰고 보고한다(스냅샷을 만들지 않음 → 화면은 '집계 전').
- 네이버(Playwright·검색)에는 접속하지 않는다. 외부 호출은 data.go.kr(상가정보·인허가)와 카카오 주소검색뿐.
"""
import argparse
import asyncio
import logging
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.area_data import CATEGORIES, CLOSURE_REUSE_FROM, REGIONS  # noqa: E402
from services.area_snapshot import load_region, save_region  # noqa: E402

_logger = logging.getLogger("area_collect")
STALE_DAYS = 25
SLEEP_BETWEEN_CALLS = 1.5  # 초
_TRANSIENT = {"api_timeout", "api_key_missing"}
# 일시 장애 재시도 간격(초). 11-16 서버 시험에서 같은 호출이 504·빈 응답으로 실패했다가 다시 하면 성공하는 것을 확인했다
# (인허가 일반음식점은 대도시에서 60초 시간 초과가 간헐적). 시도는 1 + len(간격)회.
CLOSURE_RETRY_SLEEPS = (30, 60)
SBIZ_RETRY_SLEEPS = (10, 30)
# 값이 빠진 업종이 있는 지역은 25일을 기다리지 않고 이 시간이 지나면 다음 실행에서 다시 시도한다
INCOMPLETE_RETRY_HOURS = 20


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _is_incomplete(snap: dict) -> bool:
    """수집에 성공한 적 없는 값(업소 수 또는 폐업률이 None)이 하나라도 있는지.
    확인된 '데이터 없음'(no_data)은 값이 dict 로 저장되므로 불완전이 아니다."""
    cats = snap.get("categories") or {}
    return any((cats.get(c) or {}).get("sbiz") is None or (cats.get(c) or {}).get("closure") is None for c in CATEGORIES)


def _is_fresh(snap: dict | None) -> bool:
    if not snap or not snap.get("categories"):
        return False
    try:
        ts = datetime.fromisoformat(snap.get("generated_at", ""))
    except ValueError:
        return False
    age = datetime.now(timezone.utc) - ts
    if age >= timedelta(days=STALE_DAYS):
        return False
    if _is_incomplete(snap) and age >= timedelta(hours=INCOMPLETE_RETRY_HOURS):
        return False  # 일부 값이 비어 있으면 다음 실행에서 채운다(25일 방치 방지)
    return True


async def _retry(call, failed, sleeps):
    """call()을 부르고 failed(결과)면 sleeps 간격으로 다시 부른다. 마지막 결과를 돌려준다."""
    result = await call()
    for delay in sleeps:
        if not failed(result):
            break
        print(f"    [재시도] {delay}초 뒤 다시 조회")
        await asyncio.sleep(delay)
        result = await call()
    return result


async def _collect_region(slug: str, query: str, old: dict | None) -> dict | None:
    from services.localdata_api import get_closure_rate
    from services.sbiz_api import _geocode_region, get_sbiz_market_count

    if await _geocode_region(query) is None:
        print(f"  [건너뜀] {slug}: 카카오 주소검색으로 확인되지 않는 지역 이름 — 목록 오기 가능")
        return None

    old_cats = (old or {}).get("categories") or {}
    cats: dict = {}
    closure_cache: dict[str, dict] = {}

    for cat in CATEGORIES:
        old_entry = old_cats.get(cat) or {}

        sbiz = await _retry(lambda: get_sbiz_market_count(cat, query), lambda r: r is None, SBIZ_RETRY_SLEEPS)
        await asyncio.sleep(SLEEP_BETWEEN_CALLS)
        if sbiz is None:
            sbiz_new = old_entry.get("sbiz")  # 실패 — 기존 값 유지(없으면 None)
        else:
            sbiz_new = {k: v for k, v in sbiz.items() if k != "samples"}  # 가게 이름은 저장하지 않음

        src = CLOSURE_REUSE_FROM.get(cat, cat)
        if src not in closure_cache:
            closure_cache[src] = await _retry(
                lambda: get_closure_rate(src, query),
                lambda r: (not r.get("available")) and r.get("reason") in _TRANSIENT,
                CLOSURE_RETRY_SLEEPS,
            )
            await asyncio.sleep(SLEEP_BETWEEN_CALLS)
        cl = closure_cache[src]
        if not cl.get("available") and cl.get("reason") in _TRANSIENT:
            closure_new = old_entry.get("closure")  # 일시 실패 — 기존 값 유지
        else:
            closure_new = cl

        cats[cat] = {"sbiz": sbiz_new, "closure": closure_new, "collected_at": _now()}
        print(
            f"  {slug}/{cat}: sbiz={'OK' if (sbiz_new and sbiz_new.get('available')) else '-'}"
            f" closure={'OK' if (closure_new and closure_new.get('available')) else (closure_new or {}).get('reason', '-')}"
        )

    return {"region": slug, "generated_at": _now(), "categories": cats}


def _has_value(entry: dict) -> bool:
    """업종 하나에 사용할 수 있는 값(업소 수 또는 폐업률)이 있는지"""
    sbiz, closure = entry.get("sbiz"), entry.get("closure")
    return bool((sbiz and sbiz.get("available")) or (closure and closure.get("available")))


async def run_batch(slugs, collect, save, max_fail_streak: int = 3) -> dict:
    """지역을 순서대로 수집해 저장한다.

    - collect 가 None 을 돌려주면(지역 이름을 카카오로 확인하지 못함) 건너뛴다 — 연속 실패로 세지 않는다.
    - 값이 하나도 없는 지역(API 키·한도·장애 의심)은 저장하지 않고, **연속 max_fail_streak곳이 그러면 중단**한다.
      전체 수집은 수 시간 걸리므로 한도 초과·키 오류가 났을 때 상대 API를 계속 두드리지 않기 위한 안전장치다.
    """
    done = skipped = unusable = streak = 0
    stopped = False
    for slug in slugs:
        print(f"[{slug}]")
        result = await collect(slug)
        if result is None:
            skipped += 1
            continue
        if not any(_has_value(c) for c in result["categories"].values()):
            unusable += 1
            streak += 1
            print(f"  [경고] {slug}: 사용할 수 있는 값이 하나도 없음 ({streak}/{max_fail_streak}) — 저장하지 않음")
            if streak >= max_fail_streak:
                print("  [중단] 연속으로 값이 없어 수집을 멈춥니다(API 키·일일 한도·장애를 확인하세요)")
                stopped = True
                break
            continue
        streak = 0
        save(slug, result)
        done += 1
    return {"done": done, "skipped": skipped, "unusable": unusable, "stopped": stopped}


async def main() -> int:
    # .env 는 실행할 때만 읽는다(import 만으로 환경변수가 바뀌면 시험이 다른 시험을 오염시킨다).
    # services.localdata_api 는 처음 import 될 때 키를 읽으므로, 그 import 가 일어나는 수집 시작 전에 로딩한다.
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    ap = argparse.ArgumentParser()
    ap.add_argument("--max-regions", type=int, default=5)
    ap.add_argument("--only", help="지역 슬러그 하나만 (예: 서울-강남구)")
    ap.add_argument("--force", action="store_true", help="최근 수집분도 다시")
    ap.add_argument("--dry-run", action="store_true", help="대상 지역만 보여주고 호출 안 함")
    ap.add_argument("--status", action="store_true", help="수집 현황만 출력(호출 없음)")
    args = ap.parse_args()

    if args.status:
        from services.area_snapshot import coverage

        cov = coverage()
        print(
            f"수집된 지역 {cov['regions_collected']}/{cov['regions_total']}, "
            f"가장 오래된 수집 {cov['oldest_generated_at']}"
        )
        return 0

    targets = [args.only] if args.only else list(REGIONS)
    unknown = [t for t in targets if t not in REGIONS]
    if unknown:
        print(f"알 수 없는 지역: {unknown}")
        return 2

    todo = []
    for slug in targets:
        snap = load_region(slug)
        if args.force or not _is_fresh(snap):
            todo.append(slug)
    todo = todo[: args.max_regions]
    print(f"대상 {len(todo)}개 / 전체 {len(targets)}개 (최근 {STALE_DAYS}일 이내 수집분은 제외)")
    if args.dry_run:
        for s in todo:
            print("  -", s)
        return 0

    t0 = time.time()

    async def _collect(slug: str):
        return await _collect_region(slug, REGIONS[slug]["query"], load_region(slug))

    summary = await run_batch(todo, _collect, save_region)
    print(
        f"완료 {summary['done']}개, 건너뜀 {summary['skipped']}개, 값 없음 {summary['unusable']}개, "
        f"{time.time() - t0:.0f}초" + (" — 연속 실패로 중단" if summary["stopped"] else "")
    )
    return 3 if summary["stopped"] else 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    sys.exit(asyncio.run(main()))
