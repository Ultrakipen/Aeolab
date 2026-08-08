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
_proxy_call_count: int = 0  # 현재 IP로 처리한 호출 수 — 배치 로테이션용

# 2026-08-08 로테이션 강도 축소 (법적리스크 완화 Phase1,
# naver_scraping_legal_risk_resolution_plan_v1.0.md §3) — 부산지법 2017노4344가
# "캡차우회+다수IP 로테이션 프로그램" 조합을 문제 삼은 판례라, 매 호출마다 IP를
# 바꾸는 대신 N회 호출마다 교체해 "다수 IP를 빠르게 순환"하는 패턴 자체를 완화한다.
_PROXY_ROTATION_BATCH = max(1, int(os.getenv("NAVER_PROXY_ROTATION_BATCH", "5")))

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


# ── 네이버 Playwright 요청 전역 일일 상한선 (2026-08-08, 장기운영 안전망) ──────
# 구독자가 늘어도 네이버 쪽에서 보는 하루 총 자동화 트래픽은 완만하게만 늘도록 상한을
# 둔다 — "구독자 증가=리스크 비례 증가" 구조를 깨는 게 목적
# (naver_scraping_legal_risk_resolution_plan_v1.0.md §7). 초과분은 그 사이클만 건너뛰고
# (실패 아님, "오늘 상한 도달"로 로깅) 자정 지나면 자동 리셋.
# 기본값 250: 2026-08-08 기준 실측 추정 하루 요청량(~66~90건)의 약 3배 여유 —
# BEP(20명) 근처까지는 상한에 걸리지 않고, 그 이상 성장 시 상한이 실제로 작동해
# 트래픽을 완만하게 유지한다. 구독자 증가에 맞춰 NAVER_PLAYWRIGHT_DAILY_CAP로 조정 가능.
_NAVER_PLAYWRIGHT_DAILY_CAP = int(os.getenv("NAVER_PLAYWRIGHT_DAILY_CAP", "250"))
_naver_pw_quota_date: str = ""
_naver_pw_quota_count: int = 0
_naver_pw_quota_alert_sent_date: str = ""


def check_naver_playwright_quota(source: str = "") -> bool:
    """오늘 네이버 Playwright 요청 상한 여유가 있으면 카운트 증가 후 True, 초과하면 False.

    호출자는 False를 받으면 해당 요청을 건너뛰어야 한다(스캔 스킵 — 예외 아님).
    날짜가 바뀌면(자정, 서버 로컬 타임존 기준) 자동 리셋.
    """
    global _naver_pw_quota_date, _naver_pw_quota_count, _naver_pw_quota_alert_sent_date
    from datetime import date as _date
    today = _date.today().isoformat()
    if _naver_pw_quota_date != today:
        _naver_pw_quota_date = today
        _naver_pw_quota_count = 0
    if _naver_pw_quota_count >= _NAVER_PLAYWRIGHT_DAILY_CAP:
        if _naver_pw_quota_alert_sent_date != today:
            _naver_pw_quota_alert_sent_date = today
            _logger.error(
                "[naver_quota] 일일 상한(%d건) 도달 — 이후 요청은 오늘 스킵됨 (source=%s)",
                _NAVER_PLAYWRIGHT_DAILY_CAP, source,
            )

            async def _alert():
                try:
                    from services.email_sender import send_operator_alert
                    await send_operator_alert(
                        "네이버 Playwright 일일 상한 도달",
                        f"오늘 네이버 자동화 요청이 상한({_NAVER_PLAYWRIGHT_DAILY_CAP}건)에 "
                        f"도달해 이후 요청은 스킵됩니다(source={source}). 구독자 증가로 트래픽이 "
                        "늘었다면 NAVER_PLAYWRIGHT_DAILY_CAP 상향을 검토하세요.",
                    )
                except Exception as _e:
                    _logger.warning("[naver_quota] 알림 발송 실패: %s", _e)

            asyncio.create_task(_alert())
        return False
    _naver_pw_quota_count += 1
    return True


# ── 네이버 로그인쿠키 인증 실패 감지 (2026-08-08, 장기운영 안전망) ────────────
# naver_scanner.py(AI브리핑)·naver_ai_tab_scanner.py(AI탭)가 같은 로그인쿠키를
# 공유하므로 실패도 여기서 합산 카운트한다. check_naver_cookie_health_job(주1회)이
# 있지만 그 사이 최대 7일 공백이 생길 수 있어, 실제 스캔 실패가 연속되면 다음
# 주간 점검을 기다리지 않고 즉시 운영자에게 알린다(기능 변경 없음, 알림만 추가).
_naver_auth_fail_count: int = 0
_naver_auth_alert_sent = False
_NAVER_AUTH_FAIL_ALERT_THRESHOLD = 3

# ── 백업 네이버 계정 자동 전환 (2026-08-08, 장기운영 안전망) ──────────────────
# 기본 계정이 연속 실패하면 미리 준비해둔 백업 계정(*_BACKUP 쿠키)으로 전환한다.
# 이건 "아이디/비번 자동 로그인"이 아니라 "미리 확보해둔 또 다른 세션 쿠키로
# 교체"일 뿐이라 §2-1에서 정리한 "세션 재사용" 성격을 그대로 유지 — 자동
# 재로그인(jobs.py NAVER_AUTO_RELOGIN_ENABLED)과는 법적 성격이 다르다.
# 백업 미설정 시 전환 안 하고 기존 동작 그대로(기능 변화 없음).
# 원복은 자동으로 하지 않음(플래핑 방지) — 기본 계정 정상화 확인 후
# reset_naver_cookie_source() 호출 또는 pm2 restart(인메모리 플래그라 재시작 시 초기화).
_use_backup_naver_cookies: bool = False


def switch_to_backup_naver_cookies() -> bool:
    """백업 계정으로 전환 시도. NAVER_COOKIE_NID_AUT_BACKUP 미설정 시 False(전환 안 함)."""
    global _use_backup_naver_cookies
    if _use_backup_naver_cookies:
        return True
    if not os.getenv("NAVER_COOKIE_NID_AUT_BACKUP", "").strip():
        return False
    _use_backup_naver_cookies = True
    _logger.error(
        "[naver_auth] 백업 네이버 계정으로 자동 전환됨 — 기본 계정 정상화 후 "
        "reset_naver_cookie_source() 호출 또는 backend 재시작 필요"
    )
    return True


def reset_naver_cookie_source() -> None:
    """기본 계정으로 수동 원복 (기본 계정 쿠키 정상화 확인 후 호출)."""
    global _use_backup_naver_cookies
    _use_backup_naver_cookies = False
    _logger.info("[naver_auth] 기본 네이버 계정으로 원복")


def note_naver_auth_result(ok: bool, source: str = "") -> None:
    """네이버 로그인쿠키 인증 성공/실패 보고. 연속 실패가 임계치 도달 시 백업 전환 시도 + 1회만 운영자 알림.

    성공 시 카운터·알림 발송 플래그 리셋 — 다음 장애 발생 시 다시 알림 가능.
    (백업 사용 여부 플래그는 성공해도 리셋하지 않음 — 플래핑 방지, §위 주석 참조)
    """
    global _naver_auth_fail_count, _naver_auth_alert_sent
    if ok:
        _naver_auth_fail_count = 0
        _naver_auth_alert_sent = False
        return
    _naver_auth_fail_count += 1
    if _naver_auth_fail_count >= _NAVER_AUTH_FAIL_ALERT_THRESHOLD and not _naver_auth_alert_sent:
        _naver_auth_alert_sent = True
        switched = switch_to_backup_naver_cookies()
        _logger.error(
            "[naver_auth] 연속 %d회 로그인쿠키 인증 실패(%s) — 백업전환=%s — 운영자 알림 발송",
            _naver_auth_fail_count, source, switched,
        )

        async def _alert():
            try:
                from services.email_sender import send_operator_alert
                backup_note = (
                    "백업 계정으로 자동 전환했습니다 — 스캔은 계속되나 기본 계정 정상화가 필요합니다."
                    if switched else
                    "백업 계정이 설정돼 있지 않아 전환하지 못했습니다 — 스캔이 계속 실패합니다."
                )
                await send_operator_alert(
                    "네이버 로그인쿠키 인증 연속 실패",
                    f"{source} 스캔에서 연속 {_naver_auth_fail_count}회 로그인 리다이렉트/CAPTCHA를 "
                    f"감지했습니다.\n쿠키 만료(정상 주기 내) 또는 계정 정지 가능성이 있습니다.\n{backup_note}\n"
                    "Chrome → naver.com 로그인 → F12 → Application → Cookies에서 NID_AUT/NID_SES "
                    "확인 후 .env 교체가 필요할 수 있습니다.",
                )
            except Exception as _e:
                _logger.warning("[naver_auth] 운영자 알림 발송 실패: %s", _e)

        asyncio.create_task(_alert())


def get_naver_cookies() -> list[dict]:
    """환경변수에서 네이버 로그인 쿠키를 읽어 Playwright cookie 형식으로 반환.

    설정 방법 (backend/.env):
        NAVER_COOKIE_NID_AUT=<값>
        NAVER_COOKIE_NID_SES=<값>        ← 로그인 세션 (30일 만료)
        NAVER_COOKIE_NID_JKL=<값>        (선택)
        NAVER_COOKIE_NID_AUT_BACKUP=<값>  (선택, 백업 계정 — switch_to_backup_naver_cookies 참조)
        NAVER_COOKIE_NID_SES_BACKUP=<값>  (선택)
    추출: Chrome → F12 → Application → Cookies → .naver.com

    2026-08-08: _use_backup_naver_cookies가 True면 *_BACKUP 값을 우선 사용하고,
    개별 키에 백업값이 없으면 기본값으로 폴백한다.
    """
    cookies = []
    for name, env_key in [
        ("NID_AUT", "NAVER_COOKIE_NID_AUT"),
        ("NID_SES", "NAVER_COOKIE_NID_SES"),
        ("NID_JKL", "NAVER_COOKIE_NID_JKL"),
    ]:
        val = ""
        if _use_backup_naver_cookies:
            val = os.getenv(f"{env_key}_BACKUP", "").strip()
        if not val:
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
        _logger.info(
            f"[naver] 쿠키 {len(cookies)}개 로드 ({[c['name'] for c in cookies]}, "
            f"소스={'백업' if _use_backup_naver_cookies else '기본'})"
        )
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
    """프록시 풀에서 배치 로테이션으로 선택. NAVER_PROXY_LIST 미설정 시 None (직접 연결).

    같은 IP로 NAVER_PROXY_ROTATION_BATCH(기본 5)회 호출을 처리한 뒤 다음 IP로 교체 —
    풀 전체는 여전히 균등 소진하되(장기 대역폭 분산 목적 유지), 매 호출 단위로 IP를
    바꾸던 이전 방식보다 로테이션 빈도를 낮춰 "다수 IP 빠른 순환" 패턴을 완화한다
    (2026-08-08, naver_scraping_legal_risk_resolution_plan_v1.0.md §3).
    asyncio 단일 스레드 환경이므로 전역 카운터 증분은 안전.
    회로차단기 열림(연속 인증/연결 실패) 중에는 None 반환 — 직접 연결로 폴백.
    """
    global _proxy_index, _proxy_call_count, _proxy_circuit_open_until, _proxy_circuit_fail_count
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
    _proxy_call_count += 1
    if _proxy_call_count >= _PROXY_ROTATION_BATCH:
        _proxy_call_count = 0
        _proxy_index += 1
    return proxy
