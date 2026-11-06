"""website_checker SSRF 방어 — 도메인 해석 결과·리다이렉트 단계 검사 (2026-11-06 점검).

기존 `_is_safe_url`은 IP 리터럴만 막아 (a) 내부 주소로 해석되는 도메인 (b) 공개 도메인이 내부 주소로 보내는 리다이렉트가
통과했다. 실제 네트워크는 쓰지 않고 가짜 리졸버·가짜 세션으로 검증한다.
"""
import asyncio

import pytest

from services import website_checker as wc


def _run(coro):
    return asyncio.run(coro)


class _FakeInner:
    def __init__(self, addrs):
        self._addrs = addrs

    async def resolve(self, host, port=0, family=0):
        return [{"hostname": host, "host": a, "port": port, "family": 2, "proto": 0, "flags": 0} for a in self._addrs]

    async def close(self):
        pass


def _resolver_with(addrs):
    r = wc._PublicOnlyResolver()
    r._inner = _FakeInner(addrs)
    return r


@pytest.mark.parametrize("addr", ["127.0.0.1", "10.0.0.5", "169.254.169.254", "192.168.1.1", "100.64.0.1", "::1"])
def test_resolver_rejects_domains_resolving_to_non_public(addr):
    with pytest.raises(OSError):
        _run(_resolver_with([addr]).resolve("evil.example"))


def test_resolver_rejects_when_any_address_is_private():
    with pytest.raises(OSError):
        _run(_resolver_with(["93.184.216.34", "10.0.0.1"]).resolve("mixed.example"))


def test_resolver_allows_public_address():
    out = _run(_resolver_with(["93.184.216.34"]).resolve("example.com"))
    assert out[0]["host"] == "93.184.216.34"


class _Resp:
    def __init__(self, status, location=None, url="https://public.example/"):
        self.status = status
        self.headers = {"Location": location} if location else {}
        self.url = url
        self.released = False

    def release(self):
        self.released = True


class _Session:
    def __init__(self, resps):
        self._resps = list(resps)
        self.requested = []

    async def get(self, url, **kw):
        assert kw.get("allow_redirects") is False   # 자동 리다이렉트는 검사를 건너뛴다
        self.requested.append(url)
        return self._resps.pop(0)


def test_redirect_to_loopback_literal_is_blocked():
    s = _Session([_Resp(302, "http://127.0.0.1:8000/admin")])
    with pytest.raises(wc._UnsafeUrl):
        _run(wc._get_following_safe(s, "https://public.example/"))
    assert s.requested == ["https://public.example/"]   # 내부 주소로는 요청하지 않았다


def test_relative_redirect_to_public_is_followed():
    s = _Session([_Resp(301, "/home"), _Resp(200)])
    resp = _run(wc._get_following_safe(s, "https://public.example/"))
    assert resp.status == 200
    assert s.requested == ["https://public.example/", "https://public.example/home"]


def test_redirect_loop_is_cut():
    s = _Session([_Resp(302, "https://public.example/a") for _ in range(10)])
    with pytest.raises(wc._UnsafeUrl):
        _run(wc._get_following_safe(s, "https://public.example/"))


def test_check_website_seo_reports_not_allowed_for_redirect_to_internal(monkeypatch):
    import contextlib

    class _Sess(_Session):
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(wc, "_new_session", lambda: _Sess([_Resp(302, "http://169.254.169.254/latest/meta-data")]))
    out = _run(wc.check_website_seo("https://public.example/"))
    assert out["error"] == "허용되지 않는 URL"
    assert out["has_json_ld"] is False


def test_literal_private_ip_still_rejected_up_front():
    out = _run(wc.check_website_seo("http://127.0.0.1:8000/"))
    assert out["error"] == "허용되지 않는 URL"


def test_blog_analyzer_external_fetch_blocks_redirect_to_internal(monkeypatch):
    """blog_analyzer 외부 블로그 수집도 같은 보호를 쓰며, 자체 검사(포트 80/443만)를 각 단계에 적용한다."""
    from services import blog_analyzer as ba

    class _Sess(_Session):
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    sess = _Sess([_Resp(302, "http://10.0.0.5/secret")])
    monkeypatch.setattr(wc, "_new_session", lambda *a, **k: sess)
    out = _run(ba._analyze_external_blog("https://public.example/", "restaurant", "창원"))
    assert "허용되지 않는 URL" in str(out)
    assert sess.requested == ["https://public.example/"]


def test_blog_analyzer_blocks_non_standard_port_on_redirect():
    s = _Session([_Resp(302, "https://public.example:8443/x")])
    from services import blog_analyzer as ba
    with pytest.raises(wc._UnsafeUrl):
        _run(wc._get_following_safe(s, "https://public.example/", is_blocked=ba._is_ssrf_blocked))
