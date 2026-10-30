"""Playwright 슬롯 획득 — 사용자 요청은 대기 상한, 배치는 양보 — 테스트 (2026-10-30)."""
import asyncio
import inspect
import os
import pathlib
import time

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

import pytest  # noqa: E402

from services import playwright_slot as ps  # noqa: E402

_REAL_SLEEP = asyncio.sleep
ROOT = pathlib.Path(__file__).resolve().parents[1]


def _run(coro):
    # 변이로 대기 상한이 사라지면 영원히 멈추므로 시간 제한을 걸어 '멈춤'을 실패로 드러낸다
    return asyncio.run(asyncio.wait_for(coro, timeout=8))


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    ps._waiting_interactive = 0
    monkeypatch.setattr(ps, "_queue_timeout", lambda: 0.2)
    monkeypatch.setattr(ps, "BATCH_YIELD_MAX_SEC", 1.0)
    yield
    ps._waiting_interactive = 0


def test_interactive_gives_up_after_queue_timeout_with_timeouterror():
    async def go():
        sem = asyncio.Semaphore(1)
        await sem.acquire()                       # 정기 잡이 잡고 있는 상태
        ps.mark_interactive()
        t = time.monotonic()
        with pytest.raises(asyncio.TimeoutError):  # 호출 지점들이 "timeout 오류(측정 안 됨)"로 처리하는 바로 그 예외
            async with ps.playwright_slot(sem):
                pass
        assert time.monotonic() - t < 1.0
        assert ps.waiting_interactive() == 0       # 대기 표시가 남지 않는다
        assert sem._value == 0                     # 남의 슬롯을 풀지 않는다

    _run(go())


def test_interactive_gets_slot_when_free_and_releases_it():
    async def go():
        sem = asyncio.Semaphore(1)
        ps.mark_interactive()
        async with ps.playwright_slot(sem):
            assert sem._value == 0
        assert sem._value == 1

    _run(go())


def test_batch_waits_without_limit_like_before():
    async def go():
        sem = asyncio.Semaphore(1)
        await sem.acquire()
        done = []

        async def batch():                         # 표시 없음 = 배치
            async with ps.playwright_slot(sem):
                done.append(1)

        t = asyncio.create_task(batch())
        await _REAL_SLEEP(0.5)                     # 대기 상한(0.2초)을 넘겨도 포기하지 않는다
        assert not t.done()
        sem.release()
        await asyncio.wait_for(t, 1.0)
        assert done == [1]

    _run(go())


def test_batch_yields_while_an_interactive_request_is_waiting():
    async def go():
        sem = asyncio.Semaphore(1)
        ps._waiting_interactive = 1                # 사용자 요청이 줄을 서 있다
        order = []

        async def batch():
            async with ps.playwright_slot(sem):
                order.append("batch")

        t0 = time.monotonic()
        t = asyncio.create_task(batch())
        await _REAL_SLEEP(0.3)
        assert not order                           # 양보 중 — 아직 슬롯을 잡지 않았다
        ps._waiting_interactive = 0                # 사용자 요청이 끝났다
        await asyncio.wait_for(t, 2.0)
        assert order == ["batch"] and time.monotonic() - t0 < 1.5

    _run(go())


def test_batch_yield_is_bounded_so_it_never_starves():
    async def go():
        sem = asyncio.Semaphore(1)
        ps._waiting_interactive = 1                # 계속 대기 중이라도
        t = time.monotonic()
        async with ps.playwright_slot(sem):        # BATCH_YIELD_MAX_SEC(1초) 뒤에는 줄을 선다
            pass
        assert 0.8 < time.monotonic() - t < 2.0

    _run(go())


def test_interactive_flag_is_isolated_per_task():
    async def go():
        async def interactive():
            ps.mark_interactive()
            return ps.is_interactive()

        async def other():
            await _REAL_SLEEP(0.01)
            return ps.is_interactive()

        a, b = await asyncio.gather(asyncio.create_task(interactive()), asyncio.create_task(other()))
        assert a is True and b is False            # 한 요청의 표시가 다른 요청·배치로 새지 않는다

    _run(go())


# ── 연결 구조 ──
def test_all_unbounded_semaphore_sites_use_the_slot():
    for rel, n in (("services/naver_place_stats.py", 2), ("services/smart_place_auto_check.py", 1), ("services/competitor_place_crawler.py", 2)):
        src = (ROOT / rel).read_text(encoding="utf-8")
        assert src.count("async with playwright_slot(_get_playwright_sem()):") == n, rel
        assert "async with _get_playwright_sem():" not in src, rel     # 시간 제한 없는 직접 획득이 남아 있지 않다


def test_every_slot_site_handles_timeout_as_unmeasured_not_false():
    """대기 상한 초과(asyncio.TimeoutError)가 0점·미노출로 저장되지 않고 'timeout' 오류로 돌아간다."""
    for rel in ("services/naver_place_stats.py", "services/smart_place_auto_check.py", "services/competitor_place_crawler.py"):
        src = (ROOT / rel).read_text(encoding="utf-8")
        assert src.count('"timeout"') >= src.count("async with playwright_slot("), rel


def test_user_waiting_endpoints_are_marked_interactive():
    scan_src = (ROOT / "routers/scan.py").read_text(encoding="utf-8")
    comp_src = (ROOT / "routers/competitor.py").read_text(encoding="utf-8")
    assert "mark_interactive()" in scan_src[scan_src.index("async def run_basic_trial"):scan_src.index("async def run_basic_trial") + 1400]
    assert "mark_interactive()" in comp_src[comp_src.index("async def sync_competitor_place_endpoint"):comp_src.index("async def sync_competitor_place_endpoint") + 700]
