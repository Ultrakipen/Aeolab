"""프록시 사용 범위(NAVER_PROXY_SCOPE)와 사용 기록 (2026-10-28).

배경: NAVER_PROXY_LIST 하나가 11개 호출 지점 전부에 적용돼, 프록시를 사면 한꺼번에 전체에 켜진다.
접속 구분(place/search)별로 좁혀 켜고, 어느 경로가 프록시를 탔는지 기록해 시험 결과가 직접 접속과 섞이지 않게 한다.
"""
import os
import re
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.ai_scanner as ai  # noqa: E402

_SECRET = "TOPSECRET-PW"
_POOL = [
    {"server": "http://gate-a.example:7000", "username": "user-a", "password": _SECRET},
    {"server": "http://gate-b.example:7000", "username": "user-b", "password": _SECRET},
]


@pytest.fixture(autouse=True)
def _proxy_state(monkeypatch):
    monkeypatch.setattr(ai, "_proxy_pool_loaded", True)
    monkeypatch.setattr(ai, "_proxy_pool", list(_POOL))
    monkeypatch.setattr(ai, "_proxy_index", 0)
    monkeypatch.setattr(ai, "_proxy_call_count", 0)
    monkeypatch.setattr(ai, "_proxy_circuit_open_until", 0.0)
    monkeypatch.setattr(ai, "_proxy_circuit_fail_count", 0)
    monkeypatch.setattr(ai, "_proxy_usage", {})
    monkeypatch.delenv("NAVER_PROXY_SCOPE", raising=False)


def test_default_scope_covers_place_and_search_like_before():
    assert ai.proxy_scope() == {"place", "search"}
    assert ai.get_proxy_config("place") is not None
    assert ai.get_proxy_config("search") is not None


def test_unclassified_legacy_call_is_always_allowed(monkeypatch):
    monkeypatch.setenv("NAVER_PROXY_SCOPE", "place")
    assert ai.get_proxy_config() is not None          # 구분 없는 옛 호출은 범위 설정과 무관


def test_scope_place_only_blocks_search(monkeypatch):
    monkeypatch.setenv("NAVER_PROXY_SCOPE", "place")
    assert ai.get_proxy_config("place") is not None
    assert ai.get_proxy_config("search") is None
    snap = ai.proxy_usage_snapshot()
    assert snap["usage"]["search"]["reasons"] == {"out_of_scope": 1}
    assert snap["usage"]["place"]["proxy"] == 1


def test_scope_search_only_blocks_place(monkeypatch):
    monkeypatch.setenv("NAVER_PROXY_SCOPE", "search")
    assert ai.get_proxy_config("place") is None
    assert ai.get_proxy_config("search") is not None


def test_scope_all_and_case_and_spaces(monkeypatch):
    monkeypatch.setenv("NAVER_PROXY_SCOPE", " ALL ")
    assert ai.proxy_scope() == {"place", "search"}
    monkeypatch.setenv("NAVER_PROXY_SCOPE", "Place , Search")
    assert ai.proxy_scope() == {"place", "search"}


def test_garbage_scope_uses_proxy_nowhere_not_everywhere(monkeypatch):
    # 오타로 의도치 않게 전체에 켜지면 안 된다 — 안전 쪽(직접 연결)으로 실패
    monkeypatch.setenv("NAVER_PROXY_SCOPE", "plce")
    assert ai.proxy_scope() == set()
    assert ai.get_proxy_config("place") is None
    assert ai.get_proxy_config("search") is None


def test_out_of_scope_calls_do_not_advance_rotation(monkeypatch):
    monkeypatch.setenv("NAVER_PROXY_SCOPE", "place")
    # 배치 크기만큼 호출하면 소비 시 로테이션이 정확히 1칸 움직인다(풀 2개라 짝수 칸이면 우연히 제자리로 돌아와 못 잡는다)
    for _ in range(ai._PROXY_ROTATION_BATCH):
        assert ai.get_proxy_config("search") is None     # 범위 밖 호출이 로테이션 카운터를 소비하면 안 된다
    assert ai.get_proxy_config("place") == _POOL[0]


def test_circuit_open_falls_back_to_direct_and_is_recorded(monkeypatch):
    import time
    monkeypatch.setattr(ai, "_proxy_circuit_open_until", time.time() + 600)
    assert ai.get_proxy_config("place") is None
    snap = ai.proxy_usage_snapshot()
    assert snap["circuit_open"] is True
    assert snap["usage"]["place"]["reasons"] == {"circuit_open": 1}


def test_no_pool_is_direct_and_recorded(monkeypatch):
    monkeypatch.setattr(ai, "_proxy_pool", [])
    assert ai.get_proxy_config("place") is None
    snap = ai.proxy_usage_snapshot()
    assert snap["configured"] is False and snap["pool_size"] == 0
    assert snap["usage"]["place"]["reasons"] == {"no_pool": 1}


def test_snapshot_never_exposes_addresses_or_credentials():
    ai.get_proxy_config("place")
    text = repr(ai.proxy_usage_snapshot())
    for secret in (_SECRET, "user-a", "gate-a.example", "gate-b.example", "7000"):
        assert secret not in text
    assert ai.proxy_usage_snapshot()["pool_size"] == 2


def test_usage_counts_per_scope():
    for _ in range(3):
        ai.get_proxy_config("place")
    ai.get_proxy_config("search")
    u = ai.proxy_usage_snapshot()["usage"]
    assert u["place"]["proxy"] == 3 and u["search"]["proxy"] == 1 and u["place"]["direct"] == 0


def test_every_call_site_passes_a_scope():
    """회귀 방지: 새 호출 지점이 접속 구분 없이(인자 없이) 프록시를 요청하면 범위 설정을 우회한다."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    bad = []
    pat = re.compile(r"(?<![\w.])(?:get_proxy_config|_get_proxy_config|_gpc\d?)\(\s*\)")
    for sub in ("services", "scheduler", "routers"):
        for dp, dirs, files in os.walk(os.path.join(root, sub)):
            # 배포 중 남은 임시·백업 폴더(예: services/ai_scanner_deploy_tmp — 추적되지 않고 임포트되지 않는 옛 복사본)는 제외
            dirs[:] = [d for d in dirs if not re.search(r"(_tmp|tmp_|\.bak|backup|__pycache__)", d, re.I)]
            for f in files:
                if not f.endswith(".py"):
                    continue
                path = os.path.join(dp, f)
                for n, line in enumerate(open(path, encoding="utf-8", errors="ignore"), 1):
                    code = line.split("#")[0]
                    if "def get_proxy_config" in code:
                        continue
                    if pat.search(code) and "get_proxy_config()가" not in line:
                        bad.append(f"{os.path.relpath(path, root)}:{n}")
    assert not bad, bad
