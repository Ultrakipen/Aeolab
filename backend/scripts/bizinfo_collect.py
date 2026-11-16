"""
기업마당 지원사업·행사 스냅샷 수집 스크립트 (서버 cron 하루 1회, 방문자 요청과 무관)

사용법 (서버 backend/ 에서):
  PYTHONPATH=. ../venv/bin/python scripts/bizinfo_collect.py --status
  PYTHONPATH=. ../venv/bin/python scripts/bizinfo_collect.py --dry-run
  PYTHONPATH=. ../venv/bin/python scripts/bizinfo_collect.py

동작
- 기업마당 공개 API 2곳(지원사업 공고·행사)을 각각 1번 호출(searchCnt=0=전체)해 /api/bizinfo 가 읽는 스냅샷을 만든다.
- 지원사업 호출이 실패하거나 받은 건수가 너무 적으면 기존 스냅샷을 덮어쓰지 않는다(0건처럼 보이는 화면을 만들지 않음).
  행사 호출만 실패하면 지원사업만 갱신하고 기존 행사 목록을 유지한다.
- 인증키는 .env 의 BIZINFO_API_KEY(지원사업)·BIZINFO_EVENT_API_KEY(행사). 로그·오류에 키를 남기지 않는다.
- 종료 코드: 0 성공 / 2 지원사업 호출 실패 / 3 받은 건수가 비정상적으로 적음(--force 로 무시)
"""
import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.bizinfo import (  # noqa: E402
    EVENT_API_URL,
    SUPPORT_API_URL,
    build_snapshot,
    load_snapshot,
    save_snapshot,
    snapshot_path,
)

MIN_SUPPORT_ROWS = 50  # 2026-11-16 실측 1,330건 — 이보다 적으면 응답 이상으로 본다
SHRINK_LIMIT = 0.5  # 기존 소상공인 관련 건수의 절반 아래로 줄면 이상으로 본다


class FetchError(Exception):
    pass


def _redact(text: str, key: str) -> str:
    return text.replace(key, "***") if key else text


async def fetch_rows(url: str, key: str, timeout_s: int = 90) -> list[dict]:
    """기업마당 JSON 응답의 jsonArray 를 돌려준다. 형식이 다르거나 비어 있으면 FetchError(키는 메시지에서 가린다)."""
    import aiohttp

    params = {"crtfcKey": key, "dataType": "json", "searchCnt": "0"}
    try:
        timeout = aiohttp.ClientTimeout(total=timeout_s)
        async with aiohttp.ClientSession(timeout=timeout, headers={"User-Agent": "Mozilla/5.0"}) as s:
            async with s.get(url, params=params) as r:
                body = await r.read()
                if r.status != 200:
                    raise FetchError(f"HTTP {r.status}")
    except FetchError:
        raise
    except Exception as e:  # 네트워크 오류 — 예외 문자열에 URL(키 포함)이 들어갈 수 있어 가린다
        raise FetchError(_redact(f"{type(e).__name__}: {e}", key)) from None
    try:
        data = json.loads(body.decode("utf-8"))
    except ValueError:
        raise FetchError("JSON 이 아닌 응답(인증키 오류 등)") from None
    rows = data.get("jsonArray") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        raise FetchError("응답에 jsonArray 가 없음")
    return [r for r in rows if isinstance(r, dict)]


async def main() -> int:
    # .env 는 실행할 때만 읽는다(import 만으로 환경변수가 바뀌면 시험이 서로 오염된다)
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    ap = argparse.ArgumentParser()
    ap.add_argument("--status", action="store_true", help="현재 스냅샷 현황만 출력(호출 없음)")
    ap.add_argument("--dry-run", action="store_true", help="호출·변환까지 하고 저장은 하지 않음")
    ap.add_argument("--force", action="store_true", help="건수 이상 점검을 무시하고 저장")
    args = ap.parse_args()

    old = load_snapshot()
    if args.status:
        if not old:
            print(f"스냅샷 없음 ({snapshot_path()})")
        else:
            print(
                f"생성 {old.get('generated_at')} | 지원사업 {len(old['support']['items'])}건(원본 {old['support']['source_total']}건) | "
                f"행사 {len((old.get('events') or {}).get('items', []))}건"
            )
        return 0

    sup_key = os.getenv("BIZINFO_API_KEY", "").strip()
    ev_key = os.getenv("BIZINFO_EVENT_API_KEY", "").strip()
    if not sup_key:
        print("BIZINFO_API_KEY 가 설정되어 있지 않습니다.")
        return 2

    try:
        support_raw = await fetch_rows(SUPPORT_API_URL, sup_key)
    except FetchError as e:
        print(f"지원사업 호출 실패(기존 스냅샷 유지): {e}")
        return 2

    events_raw: list[dict] | None = None
    if ev_key:
        try:
            events_raw = await fetch_rows(EVENT_API_URL, ev_key)
        except FetchError as e:
            print(f"행사 호출 실패(기존 행사 목록 유지): {e}")

    now = datetime.now(timezone.utc)
    snap = build_snapshot(support_raw, events_raw or [], now)
    if events_raw is None and old and old.get("events"):
        snap["events"] = old["events"]

    n_new = len(snap["support"]["items"])
    n_old = len(old["support"]["items"]) if old else 0
    print(
        f"받은 지원사업 {len(support_raw)}건 → 소상공인 관련 {n_new}건 | "
        f"행사 {len(snap['events']['items'])}건 (이전 소상공인 관련 {n_old}건)"
    )
    if not args.force:
        if len(support_raw) < MIN_SUPPORT_ROWS:
            print(f"받은 건수가 {MIN_SUPPORT_ROWS}건 미만이라 저장하지 않습니다(응답 이상 가능). 확인 후 --force.")
            return 3
        if n_old and n_new < n_old * SHRINK_LIMIT:
            print(f"소상공인 관련 건수가 이전({n_old})의 절반 아래({n_new})라 저장하지 않습니다. 확인 후 --force.")
            return 3
    if args.dry_run:
        print("드라이런 — 저장하지 않음")
        return 0
    save_snapshot(snap)
    print(f"저장 완료: {snapshot_path()}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
