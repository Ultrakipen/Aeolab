"""AI 스캐너 공통 유틸리티 — UA 풀, stealth, 프록시 로테이션"""
import asyncio
import contextvars
import functools
import json
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
    # 2026-08-29 추가: 프록시 인증이 거부되면 Chromium이 위 net::ERR_* 코드 대신
    # page.goto 자체를 조용히 매달아 "Page.goto: Timeout"으로만 표면화되는 사례를
    # 실측 확인(naver_place_stats.py — 08-22부터 회로차단 없이 매일 조용히 실패 중이었음).
    # 셀렉터 대기 등 다른 사후 타임아웃과 구분하기 위해 "Page.goto: Timeout"으로 한정
    # (post-navigation 타임아웃까지 넓히면 프록시와 무관한 실패까지 오탐할 수 있음).
    "Page.goto: Timeout",
    # 2026-10-25 추가: Webshare 프록시가 407(계정 목록에 없는 프록시)을 돌려주면 Chromium이
    # net::ERR_HTTP_RESPONSE_CODE_FAILURE로 표면화 — 위 시그니처에 없어 8일 넘게 회로차단 없이 실패했음.
    # 네이버 자체 4xx/5xx도 같은 문구라 연속 2회면 프록시를 30분 우회(직접 연결)하는 보수적 동작.
    "ERR_HTTP_RESPONSE_CODE_FAILURE",
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
# (참고: 위 66~90건은 "6명 기준"이라 했으나 이후 테스트 데이터 기반 추정치로 정정됨 — 실제 런칭 트래픽 아님)
# 2026-10-27: 단위를 "함수 호출 1번"에서 "페이지 로드 수"로 바꿨다. 플레이스 탭 점검은 한 번 호출이 페이지를 2~5개
# 여는데 1건으로만 세어 실제 트래픽을 과소 집계했다(check_naver_playwright_quota의 cost). 같은 여유를 유지하려고 기본값을
# 250→600으로 올림 — 실측 근거가 없는 제안값이므로 운영 사용량(naver_quota_daily_summary)을 보고 조정할 것.
_NAVER_PLAYWRIGHT_DAILY_CAP = int(os.getenv("NAVER_PLAYWRIGHT_DAILY_CAP", "600"))
_naver_pw_quota_date: str = ""
_naver_pw_quota_count: int = 0
_naver_pw_quota_alert_sent_date: str = ""
# 사용량 가시화(2026-10-26): 출처별 일일 사용 건수 + 상한 70%·90% 사전 경고(하루 각 1회).
# 프로세스 메모리라 재시작하면 그날 누적이 0부터 다시 시작한다(배포 직후 과소 집계 가능).
_naver_pw_quota_by_source: dict = {}
_naver_pw_quota_warn_sent: set = set()
_QUOTA_WARN_PERCENTS = (70, 90)

# ── 배치/사용자 요청 예약 용량 + 재시작 방지 영속화 (2026-10-27, 설계 문서 naver_request_load_spreading §3 D·E) ──
# 정기 잡(배치)이 하루 상한을 다 써 버리면 사용자가 직접 누른 스캔이 막힌다. 배치는 상한의 일정 비율까지만 쓰고
# 나머지는 사용자 요청 몫으로 남긴다. 비율 0.7은 근거 없는 제안값(NAVER_BATCH_CAP_RATIO로 조정).
_NAVER_BATCH_RATIO = max(0.1, min(1.0, float(os.getenv("NAVER_BATCH_CAP_RATIO", "0.7"))))
_naver_batch_var: "contextvars.ContextVar[bool]" = contextvars.ContextVar("naver_batch", default=False)
_naver_pw_quota_batch_count: int = 0
_naver_pw_batch_deny_logged_date: str = ""


def naver_batch_job(fn):
    """정기 잡(배치) 데코레이터 — 이 잡 안에서 일어나는 네이버 접속은 상한의 배치 비율까지만 쓴다.

    contextvar라 잡이 만드는 하위 태스크(asyncio.gather 등)에도 전파되고, 잡이 끝나면 원복된다.
    """
    @functools.wraps(fn)
    async def _wrapper(*args, **kwargs):
        token = _naver_batch_var.set(True)
        try:
            return await fn(*args, **kwargs)
        finally:
            _naver_batch_var.reset(token)
    return _wrapper


def is_naver_batch() -> bool:
    return _naver_batch_var.get()


def _quota_state_path() -> str:
    default = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".naver_quota_state.json")
    return os.getenv("NAVER_QUOTA_STATE_FILE", default)


def _quota_history_path() -> str:
    return _quota_state_path().replace(".json", "_history.jsonl")


def _save_quota_state() -> None:
    """카운터를 파일에 저장 — 프로세스 메모리 값이라 배포·재시작 때마다 그날 누적이 0부터 다시 시작해
    과소 집계되던 문제(설계 문서 §6 한계)를 없앤다. 저장 실패가 접속을 막지 않는다."""
    try:
        tmp = _quota_state_path() + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({
                "date": _naver_pw_quota_date, "count": _naver_pw_quota_count,
                "batch_count": _naver_pw_quota_batch_count, "by_source": _naver_pw_quota_by_source,
            }, f)
        os.replace(tmp, _quota_state_path())
    except Exception as e:
        _logger.warning("[naver_quota] 상태 파일 저장 실패(메모리 값은 유지): %s", e)


def _load_quota_state() -> None:
    """오늘 날짜의 저장된 카운터가 있으면 복원한다(다른 날짜면 무시)."""
    global _naver_pw_quota_date, _naver_pw_quota_count, _naver_pw_quota_batch_count
    from datetime import date as _date
    try:
        with open(_quota_state_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("date") == _date.today().isoformat():
            _naver_pw_quota_date = data["date"]
            _naver_pw_quota_count = int(data.get("count", 0))
            _naver_pw_quota_batch_count = int(data.get("batch_count", 0))
            _naver_pw_quota_by_source.clear()
            _naver_pw_quota_by_source.update({k: int(v) for k, v in (data.get("by_source") or {}).items()})
    except FileNotFoundError:
        pass
    except Exception as e:
        _logger.warning("[naver_quota] 상태 파일 읽기 실패(무시, 0부터 시작): %s", e)


def _append_quota_history(day: str, count: int, batch_count: int, by_source: dict) -> None:
    """하루가 끝날 때 그날 사용량을 한 줄(JSON)로 남긴다 — 구독자 데이터가 쌓이기 전 부하 모델을 실측으로 보정하는 근거."""
    if not day or count <= 0:
        return
    try:
        with open(_quota_history_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps({"date": day, "used": count, "batch_used": batch_count,
                                "by_source": by_source}, ensure_ascii=False) + "\n")
    except Exception as e:
        _logger.warning("[naver_quota] 일별 이력 기록 실패(무시): %s", e)


def check_naver_playwright_quota(source: str = "", cost: int = 1) -> bool:
    """오늘 네이버 Playwright 요청 상한 여유가 있으면 카운트 증가 후 True, 초과하면 False.

    cost: 이 호출이 여는 페이지 수(기본 1). 여러 탭을 여는 플레이스 점검은 실제 페이지 수만큼 센다.
          cost=1이면 기존 동작과 같다(카운트가 상한 이상이면 거부).
    호출자는 False를 받으면 해당 요청을 건너뛰어야 한다(스캔 스킵 — 예외 아님).
    날짜가 바뀌면(자정, 서버 로컬 타임존 기준) 자동 리셋.
    """
    global _naver_pw_quota_date, _naver_pw_quota_count, _naver_pw_quota_alert_sent_date
    global _naver_pw_quota_batch_count, _naver_pw_batch_deny_logged_date
    from datetime import date as _date
    today = _date.today().isoformat()
    if _naver_pw_quota_date != today:
        _append_quota_history(_naver_pw_quota_date, _naver_pw_quota_count, _naver_pw_quota_batch_count,
                              dict(_naver_pw_quota_by_source))
        _naver_pw_quota_date = today
        _naver_pw_quota_count = 0
        _naver_pw_quota_batch_count = 0
        _naver_pw_quota_by_source.clear()
        _naver_pw_quota_warn_sent.clear()
    cost = max(1, int(cost))
    # 플레이스 접속은 naver_access_guard.reserve_place_pages가 직접 기록한다. 그 밖의 네이버 접속(브리핑·AI탭·순위 등)은
    # 속도 제한 없이 기록만 해 같은 IP의 총 요청량이 플레이스 접속 허용량에서 차감되게 한다. (아래 상한 판정과 별개)
    _gate_src = (source or "")
    _is_place_src = _gate_src.startswith(("naver_place_stats.", "smart_place_auto_check.", "competitor_place_crawler."))
    # 배치(정기 잡)는 상한의 일부까지만 — 나머지는 사용자가 직접 누른 스캔 몫으로 남긴다
    if _naver_batch_var.get() and _naver_pw_quota_batch_count + cost > int(_NAVER_PLAYWRIGHT_DAILY_CAP * _NAVER_BATCH_RATIO):
        if _naver_pw_batch_deny_logged_date != today:
            _naver_pw_batch_deny_logged_date = today
            _logger.warning(
                "[naver_quota] 배치 상한(%d건=상한의 %d%%) 도달 — 정기 잡의 이후 요청은 오늘 건너뜀, 사용자 요청 몫은 남겨 둠 (source=%s)",
                int(_NAVER_PLAYWRIGHT_DAILY_CAP * _NAVER_BATCH_RATIO), int(_NAVER_BATCH_RATIO * 100), source,
            )
        return False
    if _naver_pw_quota_count + cost > _NAVER_PLAYWRIGHT_DAILY_CAP:
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

            _alert_coro = _alert()
            try:
                asyncio.create_task(_alert_coro)
            except RuntimeError:
                _alert_coro.close()  # 실행되지 않은 코루틴 경고 방지
                # 이벤트 루프 밖(동기 호출)에서는 알림만 건너뛴다 — 상한 판단 자체는 예외 없이 False 반환
                _logger.warning("[naver_quota] 이벤트 루프 없음 — 상한 도달 알림 메일 생략")
        return False
    _naver_pw_quota_count += cost
    if _naver_batch_var.get():
        _naver_pw_quota_batch_count += cost
    _src = source or "unknown"
    _naver_pw_quota_by_source[_src] = _naver_pw_quota_by_source.get(_src, 0) + cost
    _save_quota_state()
    _warn_quota_usage(today, _naver_pw_quota_count, _src)
    if not _is_place_src:
        try:
            from services.naver_access_guard import record_external
            record_external(cost)
        except Exception as _e:   # 기록 실패가 스캔을 막으면 안 된다
            _logger.warning("[naver_quota] 속도 기록 실패(무시): %s", _e)
    return True


def naver_playwright_quota_snapshot() -> dict:
    """오늘 네이버 Playwright 사용량 스냅샷 — 날짜·사용·상한·출처별(많은 순). 카운트는 증가시키지 않는다."""
    from datetime import date as _date
    if _naver_pw_quota_date != _date.today().isoformat():
        return {"date": _date.today().isoformat(), "used": 0, "cap": _NAVER_PLAYWRIGHT_DAILY_CAP, "by_source": {}}
    return {
        "date": _naver_pw_quota_date,
        "used": _naver_pw_quota_count,
        "cap": _NAVER_PLAYWRIGHT_DAILY_CAP,
        "batch_used": _naver_pw_quota_batch_count,
        "batch_cap": int(_NAVER_PLAYWRIGHT_DAILY_CAP * _NAVER_BATCH_RATIO),
        "by_source": dict(sorted(_naver_pw_quota_by_source.items(), key=lambda kv: -kv[1])),
    }


def naver_quota_history(limit: int = 30) -> list:
    """최근 일별 사용량 이력(오래된 순) — 부하 모델을 실측으로 보정하는 근거. 파일이 없으면 빈 목록."""
    rows: list = []
    try:
        with open(_quota_history_path(), "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        rows.append(json.loads(line))
                    except ValueError:
                        continue
    except FileNotFoundError:
        return []
    except Exception as e:
        _logger.warning("[naver_quota] 이력 읽기 실패: %s", e)
        return []
    return rows[-max(1, int(limit)):]


_load_quota_state()  # 모듈 로드 시 오늘 날짜의 저장된 카운터 복원(재시작해도 이어서 센다)


def _warn_quota_usage(today: str, count: int, source: str) -> None:
    """상한의 70%·90% 도달 시 하루 1회씩 경고 로그 + 운영자 알림(100% 알림은 별도로 기존 경로가 처리).

    동기 함수에서 호출되므로 이벤트 루프가 없으면 알림은 건너뛰고 로그만 남긴다.
    알림 실패가 스캔을 막지 않도록 모든 예외를 삼킨다.
    """
    cap = _NAVER_PLAYWRIGHT_DAILY_CAP
    if cap <= 0:
        return
    for pct in _QUOTA_WARN_PERCENTS:
        key = (today, pct)
        if count < cap * pct / 100 or key in _naver_pw_quota_warn_sent:
            continue
        _naver_pw_quota_warn_sent.add(key)
        top = sorted(_naver_pw_quota_by_source.items(), key=lambda kv: -kv[1])[:5]
        detail = ", ".join(f"{k}={v}" for k, v in top)
        _logger.warning("[naver_quota] 일일 상한의 %d%% 도달 (%d/%d) 출처 상위: %s", pct, count, cap, detail)
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            continue

        async def _send(_pct=pct, _count=count, _detail=detail):
            try:
                from services.email_sender import send_operator_alert
                await send_operator_alert(
                    f"네이버 Playwright 일일 상한 {_pct}% 도달",
                    f"오늘 네이버 자동화 요청이 {_count}/{cap}건({_pct}% 이상)입니다. 출처 상위: {_detail}. "
                    "상한(100%)에 도달하면 이후 요청은 오늘 건너뜁니다. 구독자 증가가 원인이면 "
                    "docs/naver_request_load_spreading_design_v1.0.md의 요일 분산 구현을 검토하세요. "
                    "(프로세스 시작 이후 누적이라 배포 직후엔 실제보다 적게 보일 수 있습니다.)",
                )
            except Exception as _e:
                _logger.warning("[naver_quota] 사전 경고 알림 발송 실패: %s", _e)

        loop.create_task(_send())


def naver_playwright_quota_usage() -> tuple[int, int]:
    """(오늘 사용 건수, 일일 상한). 카운트는 증가시키지 않는다 — 선택적 재확인 여부 판단·점검용."""
    from datetime import date as _date
    used = _naver_pw_quota_count if _naver_pw_quota_date == _date.today().isoformat() else 0
    return used, _NAVER_PLAYWRIGHT_DAILY_CAP


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


# ── 프록시 사용 범위·사용 기록 (2026-10-28) ──────────────────────────────────
# 프록시를 사면 NAVER_PROXY_LIST 하나로 11개 호출 지점이 전부 프록시를 타므로, 처음부터 전체에 켜지 않고
# 접속 구분별로 좁혀 켜고(되돌리기는 환경변수 한 줄) 실제로 어느 경로가 프록시를 탔는지 기록해 둔다.
#  - "place": 플레이스 페이지(가게 점검·통계·경쟁사 크롤·가게 상세 확인) — 10-27 차단이 난 쪽
#  - "search": 검색 화면(AI 브리핑·AI탭·가게 카드 검색·월간 모니터)
# NAVER_PROXY_SCOPE="place" / "search" / "place,search" / "all". 미설정·빈 값이면 "place,search"(기존 동작과 같음).
# 알 수 없는 값만 있으면(오타) 어느 쪽에도 쓰지 않는다 — 오타로 의도치 않게 전체에 켜지는 것을 막는 안전 쪽 선택.
# 키워드 순위 측정(naver_keyword_rank)은 프록시 인자 자체가 없어 항상 서버 IP로 직접 나간다(이 범위 설정과 무관).
_PROXY_SCOPES = ("place", "search")
_proxy_usage: dict = {}   # 접속 구분 -> {"proxy": n, "direct": n, "reasons": {사유: n}} — 프로세스 시작 이후, 재시작하면 0


def proxy_scope() -> set:
    raw = os.getenv("NAVER_PROXY_SCOPE", "").strip().lower()
    if not raw:
        return set(_PROXY_SCOPES)
    toks = {t.strip() for t in raw.split(",") if t.strip()}
    if "all" in toks:
        return set(_PROXY_SCOPES)
    valid = {t for t in toks if t in _PROXY_SCOPES}
    if not valid:
        _logger.warning("[proxy] NAVER_PROXY_SCOPE=%r 에 유효한 값이 없어 프록시를 어디에도 쓰지 않습니다(유효: place, search, all)", raw)
    return valid


def _note_proxy_usage(scope: str, used: bool, reason: str = "") -> None:
    u = _proxy_usage.setdefault(scope or "unclassified", {"proxy": 0, "direct": 0, "reasons": {}})
    if used:
        u["proxy"] += 1
    else:
        u["direct"] += 1
        u["reasons"][reason] = u["reasons"].get(reason, 0) + 1


def proxy_usage_snapshot() -> dict:
    """관리자 조회용 — 프록시 설정 여부·범위·회로 상태·접속 구분별 사용 횟수. 주소·계정·비밀번호는 포함하지 않는다."""
    import time as _time
    pool = _load_proxy_pool()
    return {
        "configured": bool(pool),
        "pool_size": len(pool),
        "scope": sorted(proxy_scope()),
        "circuit_open": bool(_proxy_circuit_open_until and _time.time() < _proxy_circuit_open_until),
        "counted_since_restart": True,
        "usage": {k: {"proxy": v["proxy"], "direct": v["direct"], "reasons": dict(v["reasons"])} for k, v in _proxy_usage.items()},
    }


def get_proxy_config(scope: str = "") -> Optional[dict]:
    """프록시 풀에서 배치 로테이션으로 선택. NAVER_PROXY_LIST 미설정 시 None (직접 연결).

    scope: 호출하는 접속 구분("place"/"search"). NAVER_PROXY_SCOPE 밖이면 None(직접 연결)이며 로테이션 카운터도
    소비하지 않는다. scope="" 는 구분 없는 옛 호출 — 범위 설정과 무관하게 허용(하위 호환).

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
            _note_proxy_usage(scope, False, "circuit_open")
            return None
        _logger.info("[proxy] 회로차단 쿨다운 종료 — 프록시 재사용 재개")
        _proxy_circuit_open_until = 0.0
        _proxy_circuit_fail_count = 0
    pool = _load_proxy_pool()
    if not pool:
        _note_proxy_usage(scope, False, "no_pool")
        return None
    if scope and scope not in proxy_scope():
        _note_proxy_usage(scope, False, "out_of_scope")
        return None
    proxy = pool[_proxy_index % len(pool)]
    _proxy_call_count += 1
    if _proxy_call_count >= _PROXY_ROTATION_BATCH:
        _proxy_call_count = 0
        _proxy_index += 1
    _note_proxy_usage(scope, True)
    return proxy
