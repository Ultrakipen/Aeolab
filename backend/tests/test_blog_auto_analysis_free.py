"""블로그 분석 자동 실행의 월 횟수 면제 (2026-11-07).

/blog-analysis는 열기만 해도 결과가 없거나 오래·구형식이면 분석을 자동 실행한다. 사용자가 누르지 않았는데 월 한도(Basic 3회)가 줄지 않도록
서버가 면제하되, auto는 클라이언트 값이라 월 상한을 서버가 다시 집계한다(상한 초과·집계 실패는 일반 분석으로 센다).
"""
import asyncio
import inspect

import pytest

from routers import blog


class _Chain:
    def __getattr__(self, _n):
        return lambda *a, **k: self


class _Sb:
    def table(self, _n):
        return _Chain()


class _Res:
    def __init__(self, count):
        self.count = count


def _free(monkeypatch, count=0, requested=True, boom=False, env=None):
    async def fake_execute(_q):
        if boom:
            raise RuntimeError("db down")
        return _Res(count)

    monkeypatch.setattr(blog, "execute", fake_execute)
    if env is None:
        monkeypatch.delenv("BLOG_AUTO_FREE_PER_MONTH", raising=False)
    else:
        monkeypatch.setenv("BLOG_AUTO_FREE_PER_MONTH", env)
    return asyncio.run(blog._auto_analysis_is_free("u1", _Sb(), requested))


def test_not_requested_is_never_free(monkeypatch):
    assert _free(monkeypatch, count=0, requested=False) is False


def test_requested_under_cap_is_free(monkeypatch):
    assert _free(monkeypatch, count=0) is True
    assert _free(monkeypatch, count=1) is True


def test_requested_at_or_over_cap_counts_as_normal(monkeypatch):
    assert _free(monkeypatch, count=2) is False
    assert _free(monkeypatch, count=9) is False


def test_count_failure_closes_toward_counting(monkeypatch):
    assert _free(monkeypatch, boom=True) is False


def test_cap_env_zero_disables_and_bad_value_falls_back_to_default(monkeypatch):
    assert _free(monkeypatch, count=0, env="0") is False
    assert _free(monkeypatch, count=1, env="abc") is True      # 기본 2회
    assert _free(monkeypatch, count=2, env="abc") is False


def test_request_model_defaults_auto_false():
    assert blog.BlogAnalyzeRequest(business_id="b", blog_url="https://x").auto is False


def test_free_auto_run_skips_monthly_limit_and_is_recorded_separately():
    src = inspect.getsource(blog._run_blog_analysis)
    assert "_auto_analysis_is_free(" in src
    assert "limit < 999 and not auto_free" in src                 # 월 한도 검사는 면제 때 건너뜀
    assert "_AUTO_FREE_TYPE if auto_free else \"blog_analysis\"" in src   # 월 사용량 집계에 들어가지 않는 별도 종류
    assert "monthly_used + 1" in src and "auto_free" in src.split("monthly_used + 1")[0].splitlines()[-1]
    # 24시간 쿨다운은 면제 대상이 아니다
    assert "블로그 분석은 24시간에 1회 가능합니다" in src
    assert src.index("_auto_analysis_is_free(") < src.index("블로그 분석은 24시간에 1회 가능합니다")


def test_monthly_counter_still_counts_only_normal_type():
    src = inspect.getsource(blog._get_monthly_blog_count)
    assert '"blog_analysis"' in src and "blog_analysis_auto" not in src
