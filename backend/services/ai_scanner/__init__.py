"""AI 스캐너 공통 유틸리티 — UA 풀, stealth, 프록시 로테이션"""
import asyncio
import logging
import os
import random
from typing import Optional

_logger = logging.getLogger("aeolab")

# ── User-Agent 풀 (Chrome 129~136, Windows/Mac/Android/iOS, 2025~2026) ───────
# 단일 고정 UA는 봇 시그니처. 매 요청마다 랜덤 선택으로 패턴 희석.
_UA_POOL = [
    # Windows Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    # macOS Chrome
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    # Android Chrome (모바일 비중 희석)
    "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 13; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36",
    # iOS Safari
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
]


def get_random_ua() -> str:
    """매 호출마다 UA 풀에서 랜덤 선택."""
    return random.choice(_UA_POOL)


# ── playwright-stealth 래퍼 ───────────────────────────────────────────────────
# playwright-stealth: navigator.webdriver, chrome.runtime, plugins 등 봇 지문 숨김
# pip install playwright-stealth==1.0.6
# 미설치 시 no-op 경고 후 계속 실행 (optional dependency)
async def apply_stealth(page) -> None:
    """Playwright page에 stealth 패치 적용. 미설치 시 경고만 출력."""
    try:
        from playwright_stealth import stealth_async
        await stealth_async(page)
    except ImportError:
        _logger.warning("[stealth] playwright-stealth 미설치 — pip install playwright-stealth==1.0.6")


# ── 리소스 차단 (대역폭 절감) ─────────────────────────────────────────────────
# AI 브리핑/AI탭 파싱은 DOM 텍스트만 필요 — 이미지·미디어·폰트·광고/로깅 스크립트는 낭비.
# 2026-07-02 프록시 대역폭 소진 사고 후 실측(콜드 요청 1회, 네이버 검색결과 페이지):
#   script 11.74MB(핵심 렌더링 fender.js 4MB 포함 — 차단 불가) > stylesheet 2.21MB
#   > document 1.17MB, image/font/media 0MB(이미 차단됨)
# 광고·로깅 스크립트(도메인/경로로 식별 가능한 것)만 추가 차단 — 약 3.3MB/페이지 절감.
# 핵심 렌더링 스크립트(fender 등)는 AI브리핑 DOM을 실제로 그리므로 차단 금지.
_BLOCKED_URL_SUBSTRINGS = (
    "ad-creative.pstatic.net",
    "gfp-display-sdk",
    "meerkat/logger",
    "log-invoker/scroll",
    "log-invoker/click",
    "ntm.pstatic.net",
)


async def block_heavy_resources(route) -> None:
    """image/media/font 및 광고·로깅 스크립트를 차단해 프록시 대역폭 사용량을 줄인다."""
    req = route.request
    if req.resource_type in ("image", "media", "font"):
        await route.abort()
        return
    if any(s in req.url for s in _BLOCKED_URL_SUBSTRINGS):
        await route.abort()
        return
    await route.continue_()


def attach_bandwidth_counter(ctx) -> list:
    """context에 응답 바이트 합산 리스너를 붙인다. 반환값[0]이 누적 바이트(가변 리스트로 클로저 우회)."""
    total = [0]

    async def _count(resp):
        try:
            total[0] += len(await resp.body())
        except Exception:
            pass

    ctx.on("response", lambda r: asyncio.create_task(_count(r)))
    return total


# ── 프록시 로테이션 ────────────────────────────────────────────────────────────
# 환경변수 NAVER_PROXY_LIST 형식 (쉼표로 여러 프록시 구분):
#
#   HTTP 프록시 (인증 있음):  host:port:user:pass
#   HTTP 프록시 (인증 없음):  host:port
#   SOCKS5 프록시 (인증 있음): socks5:host:port:user:pass
#   SOCKS5 프록시 (인증 없음): socks5:host:port
#
# SOCKS5는 HTTPS 사이트 크롤링에 더 안정적 (HTTP CONNECT 터널링 불필요).
# ERR_TUNNEL_CONNECTION_FAILED 발생 시 SOCKS5 프록시로 교체 권장.
#
# 설정 방법:
#   NAVER_PROXY_LIST=socks5:p.example.io:1080:user:pass,socks5:q.example.io:1080:user:pass
#   pm2 restart aeolab-backend --update-env
_proxy_pool: list[dict] = []
_proxy_pool_loaded = False
_proxy_index: int = 0  # 라운드로빈 인덱스 — 균등 소진

# ── 프록시 회로차단기 (2026-08-03 신설) ──────────────────────────────────────
# 2026-08-03 발견: DataImpulse 프록시 계정 트래픽 소진(HTTP 407 TRAFFIC_EXHAUSTED)이
# Chromium에서 ERR_PROXY_AUTH_UNSUPPORTED로 나타나 naver_scanner·naver_ai_tab 등
# 네이버 Playwright 스캔 전체가 2026-08-01부터 100% 실패 중이었음(코드 버그 아닌 외부
# 계정/잔액 문제). 연속 실패 감지 시 일정 시간 프록시를 비활성화(직접 연결로 폴백)해
# 이런 외부 장애가 전체 기능을 100% 마비시키지 않도록 함.
_proxy_circuit_fail_count = 0
_proxy_circuit_open_until: float = 0.0  # epoch seconds, 0 = 회로 닫힘(정상)
_PROXY_CIRCUIT_FAIL_THRESHOLD = 2
_PROXY_CIRCUIT_COOLDOWN_SEC = 1800  # 30분
_PROXY_ERROR_SIGNATURES = (
    "PROXY_AUTH_UNSUPPORTED",
    "PROXY_CONNECTION_FAILED",
    "TUNNEL_CONNECTION_FAILED",
    "PROXY_AUTH_REQUESTED",
    "SOCKS_CONNECTION_FAILED",
)


def note_proxy_result(error: Optional[BaseException] = None) -> None:
    """프록시 경유 Playwright 호출 성공/실패 보고 — 연속 인증/연결 실패 시 회로차단.

    error=None(성공)이면 실패 카운터 리셋. 프록시와 무관한 오류(사이트 자체 타임아웃 등)는
    시그니처에 없으면 카운트하지 않음. 가장 빈번히 호출되는 naver_scanner 경로 한 곳만
    보고해도, get_proxy_config()가 전역 상태를 참조하므로 다른 모든 호출자가 즉시 폴백 혜택을 받음.
    """
    global _proxy_circuit_fail_count, _proxy_circuit_open_until
    if error is None:
        _proxy_circuit_fail_count = 0
        return
    msg = str(error)
    if not any(sig in msg for sig in _PROXY_ERROR_SIGNATURES):
        return
    _proxy_circuit_fail_count += 1
    if _proxy_circuit_fail_count >= _PROXY_CIRCUIT_FAIL_THRESHOLD and not _proxy_circuit_open_until:
        import time as _time
        _proxy_circuit_open_until = _time.time() + _PROXY_CIRCUIT_COOLDOWN_SEC
        _logger.error(
            "[proxy] 연속 %d회 프록시 인증/연결 실패 — %d분간 직접연결로 폴백. "
            "NAVER_PROXY_LIST 계정 잔액/설정 확인 필요(DataImpulse 등 잔액 소진 가능성)",
            _proxy_circuit_fail_count, _PROXY_CIRCUIT_COOLDOWN_SEC // 60,
        )


def _load_proxy_pool() -> list[dict]:
    global _proxy_pool, _proxy_pool_loaded
    if _proxy_pool_loaded:
        return _proxy_pool
    raw = os.getenv("NAVER_PROXY_LIST", "").strip()
    if not raw:
        _proxy_pool_loaded = True
        return []
    proxies = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        # SOCKS5 형식: socks5:host:port 또는 socks5:host:port:user:pass
        if entry.startswith("socks5:"):
            parts = entry[len("socks5:"):].split(":")
            if len(parts) == 4:
                host, port, username, password = parts
                proxies.append({
                    "server": f"socks5://{host}:{port}",
                    "username": username,
                    "password": password,
                })
            elif len(parts) == 2:
                host, port = parts
                proxies.append({"server": f"socks5://{host}:{port}"})
            else:
                _logger.warning("[proxy] SOCKS5 형식 오류 — socks5:host:port[:user:pass] 필요: %r", entry)
        # HTTP 형식: host:port 또는 host:port:user:pass
        else:
            parts = entry.split(":")
            if len(parts) == 4:
                host, port, username, password = parts
                proxies.append({
                    "server": f"http://{host}:{port}",
                    "username": username,
                    "password": password,
                })
            elif len(parts) == 2:
                host, port = parts
                proxies.append({"server": f"http://{host}:{port}"})
            else:
                _logger.warning("[proxy] 형식 오류 — host:port[:user:pass] 또는 socks5:host:port[:user:pass] 필요: %r", entry)
    _proxy_pool = proxies
    _proxy_pool_loaded = True
    if proxies:
        _logger.info("[proxy] 프록시 풀 로드 완료 — %d개 (socks5: %d개, http: %d개)",
                     len(proxies),
                     sum(1 for p in proxies if p["server"].startswith("socks5")),
                     sum(1 for p in proxies if p["server"].startswith("http")))
    return proxies


def get_naver_cookies() -> list[dict]:
    """환경변수에서 네이버 로그인 쿠키를 읽어 Playwright cookie 형식으로 반환.

    설정 방법 (backend/.env):
        NAVER_COOKIE_NID_AUT=<값>
        NAVER_COOKIE_NID_SES=<값>        ← 로그인 세션 (30일 만료)
        NAVER_COOKIE_NID_JKL=<값>        (선택)
    추출: Chrome → F12 → Application → Cookies → .naver.com
    """
    cookies = []
    for name, env_key in [
        ("NID_AUT", "NAVER_COOKIE_NID_AUT"),
        ("NID_SES", "NAVER_COOKIE_NID_SES"),
        ("NID_JKL", "NAVER_COOKIE_NID_JKL"),
    ]:
        val = os.getenv(env_key, "").strip()
        if val:
            cookies.append({
                "name": name,
                "value": val,
                "domain": ".naver.com",
                "path": "/",
                "httpOnly": True,
                "secure": True,
            })
    if cookies:
        _logger.info(f"[naver] 쿠키 {len(cookies)}개 로드 ({[c['name'] for c in cookies]})")
    else:
        _logger.debug("[naver] 쿠키 없음 (NAVER_COOKIE_* 미설정)")
    return cookies


_chrome_ua_cache: str = ""


def build_chrome_ua() -> str:
    """설치된 google-chrome-stable 버전을 읽어 올바른 UA 반환 (프로세스 수명 동안 캐시).

    HeadlessChrome 문자열을 Chrome으로 교체 — 봇 감지 방지.
    """
    global _chrome_ua_cache
    if _chrome_ua_cache:
        return _chrome_ua_cache
    import subprocess
    try:
        result = subprocess.run(
            ["google-chrome-stable", "--version"],
            capture_output=True, text=True, timeout=5,
        )
        version_str = result.stdout.strip().split()[-1]
        major = version_str.split(".")[0]
        _chrome_ua_cache = (
            f"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            f"(KHTML, like Gecko) Chrome/{major}.0.0.0 Safari/537.36"
        )
        _logger.info(f"[naver] Chrome UA 감지: {_chrome_ua_cache}")
    except Exception as e:
        _logger.warning(f"[naver] Chrome 버전 감지 실패, fallback UA 사용: {e}")
        _chrome_ua_cache = (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
        )
    return _chrome_ua_cache


def get_proxy_config() -> Optional[dict]:
    """프록시 풀에서 라운드로빈 선택. NAVER_PROXY_LIST 미설정 시 None (직접 연결).

    random.choice → 라운드로빈: 10개 IP를 균등하게 소진해 특정 IP 집중 방지.
    asyncio 단일 스레드 환경이므로 전역 카운터 증분은 안전.
    회로차단기 열림(연속 인증/연결 실패) 중에는 None 반환 — 직접 연결로 폴백.
    """
    global _proxy_index, _proxy_circuit_open_until, _proxy_circuit_fail_count
    if _proxy_circuit_open_until:
        import time as _time
        if _time.time() < _proxy_circuit_open_until:
            return None
        _logger.info("[proxy] 회로차단 쿨다운 종료 — 프록시 재사용 재개")
        _proxy_circuit_open_until = 0.0
        _proxy_circuit_fail_count = 0
    pool = _load_proxy_pool()
    if not pool:
        return None
    proxy = pool[_proxy_index % len(pool)]
    _proxy_index += 1
    return proxy
