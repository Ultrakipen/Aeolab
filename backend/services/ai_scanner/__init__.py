"""AI 스캐너 공통 유틸리티 — UA 풀, stealth, 프록시 로테이션"""
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


def get_proxy_config() -> Optional[dict]:
    """프록시 풀에서 라운드로빈 선택. NAVER_PROXY_LIST 미설정 시 None (직접 연결).

    random.choice → 라운드로빈: 10개 IP를 균등하게 소진해 특정 IP 집중 방지.
    asyncio 단일 스레드 환경이므로 전역 카운터 증분은 안전.
    """
    global _proxy_index
    pool = _load_proxy_pool()
    if not pool:
        return None
    proxy = pool[_proxy_index % len(pool)]
    _proxy_index += 1
    return proxy
