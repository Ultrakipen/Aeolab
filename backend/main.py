from dotenv import load_dotenv
load_dotenv()  # backend/.env 파일 자동 로드 (uvicorn 시작 시점에 os.environ 등록)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from routers import scan, report, guide, schema_gen, webhook, admin, business, competitor, settings, startup, teams, api_keys as api_keys_router
from routers import actions as actions_router
from routers import notices as notices_router, faq as faq_router, inquiry as inquiry_router
from routers import business_search as business_search_router
from routers import kakao as kakao_router
from routers import blog as blog_router
from routers import public_index as public_index_router
from routers import assistant as assistant_router
from routers import keywords as keywords_router
from routers import share as share_router
from routers import public_briefing as public_briefing_router
from routers import delivery as delivery_router
from routers import tools as tools_router
from routers import support as support_router
from scheduler.jobs import start_scheduler
from utils.logger import setup_logging
import os
import logging

setup_logging()

# ── 필수 환경변수 시작 시점 검증 (DB 연결에 필요한 항목만) ──────────────────────
_REQUIRED_ENVS = [
    "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
]
_missing = [k for k in _REQUIRED_ENVS if not os.getenv(k)]
if _missing:
    raise RuntimeError(f"필수 환경변수 미설정: {', '.join(_missing)}")

# AI·결제 키 미설정 시 경고만 출력 (기능 호출 시 개별 오류 처리)
_OPTIONAL_ENVS = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "TOSS_SECRET_KEY"]
_missing_optional = [k for k in _OPTIONAL_ENVS if not os.getenv(k)]
if _missing_optional:
    import warnings
    warnings.warn(f"선택 환경변수 미설정 (해당 기능 비활성): {', '.join(_missing_optional)}")

_logger = logging.getLogger("aeolab")

app = FastAPI(
    title="AEOlab API",
    version="3.0.0",
    description="AI Engine Optimization Lab - Backend API",
    # 운영 환경에서 Swagger UI 비활성화 (보안)
    docs_url="/docs" if os.getenv("APP_ENV", "development") != "production" else None,
    redoc_url=None,
)

# GZip 압축 (1KB 이상 응답 자동 압축 — JSON 응답 크기 60~80% 감소)
app.add_middleware(GZipMiddleware, minimum_size=1000)

_extra_origins = [o.strip() for o in os.getenv("CORS_EXTRA_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://aeolab.co.kr",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        *_extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-User-Id", "X-Requested-With"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """XSS·클릭재킹·MIME 스니핑 방지 보안 헤더 추가"""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://supabase.co https://*.supabase.co"
        )
        # SSE 스트림 응답에는 Cache-Control 덮어쓰지 않음
        if "text/event-stream" not in response.headers.get("content-type", ""):
            response.headers.setdefault("Cache-Control", "no-store")
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.include_router(scan.router,       prefix="/api/scan",    tags=["scan"])
app.include_router(report.router,     prefix="/api/report",  tags=["report"])
app.include_router(guide.router,      prefix="/api/guide",   tags=["guide"])
app.include_router(schema_gen.router, prefix="/api/schema",  tags=["schema"])
app.include_router(webhook.router,    prefix="/api/webhook", tags=["webhook"])
app.include_router(admin.router,      prefix="/admin",       tags=["admin"])
# business_search_router를 business.router보다 먼저 등록 — /search 경로가 /{id} 경로와 충돌하지 않도록
app.include_router(business_search_router.router, prefix="/api/businesses", tags=["business-search"])
# keywords_router도 business.router보다 먼저 — /{biz_id}/keywords 경로 충돌 방지
app.include_router(keywords_router.router, prefix="/api/businesses", tags=["keywords"])
app.include_router(business.router,   prefix="/api/businesses", tags=["business"])
app.include_router(competitor.router, prefix="/api/competitors", tags=["competitor"])
app.include_router(settings.router,       prefix="/api/settings",    tags=["settings"])
app.include_router(startup.router,        prefix="/api/startup",     tags=["startup"])
app.include_router(teams.router,          prefix="/api/teams",        tags=["teams"])
app.include_router(api_keys_router.router, prefix="/api/v1/keys",    tags=["public-api"])
app.include_router(notices_router.router, prefix="/api/notices", tags=["notices"])
app.include_router(faq_router.router,     prefix="/api/faq",     tags=["faq"])
app.include_router(inquiry_router.router, prefix="/api/inquiry", tags=["inquiry"])
app.include_router(kakao_router.router,   prefix="/api/kakao",   tags=["kakao"])
app.include_router(blog_router.router,    prefix="/api/blog",    tags=["blog"])
app.include_router(public_index_router.router, prefix="/api/public/index", tags=["public-index"])
app.include_router(actions_router.router,      prefix="/api/actions",     tags=["actions"])
app.include_router(assistant_router.router,    prefix="/api/assistant",   tags=["assistant"])
app.include_router(share_router.router,        prefix="/api/share",       tags=["share"])
app.include_router(public_briefing_router.router, prefix="/api/public",   tags=["public"])
app.include_router(delivery_router.router,        prefix="/api/delivery",  tags=["delivery"])
app.include_router(delivery_router.admin_router,  prefix="/admin/delivery", tags=["admin-delivery"])
app.include_router(tools_router.router,           prefix="/api/tools",     tags=["tools"])
app.include_router(support_router.router,         prefix="/api/support",   tags=["support"])
app.include_router(support_router.admin_router,   prefix="/admin/support", tags=["admin-support"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Starlette ServerErrorMiddleware가 CORS를 우회하는 문제를 방지하기 위해
    모든 미처리 예외를 여기서 잡아 JSON 응답으로 변환합니다.
    운영 환경에서는 내부 오류 메시지를 클라이언트에 노출하지 않습니다."""
    _logger.error(f"Unhandled exception: {type(exc).__name__}: {exc}", exc_info=exc)
    # 운영 환경: 내부 오류 상세 숨김 (정보 노출 방지)
    is_prod = os.getenv("APP_ENV", "development") == "production"
    message = "서버 내부 오류가 발생했습니다" if is_prod else str(exc)
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "SERVER_ERROR", "message": message}},
    )


@app.on_event("startup")
async def startup():
    start_scheduler()


@app.get("/health")
async def health():
    """Nginx, PM2, 외부 모니터링이 주기적으로 호출 (UptimeRobot 5분 간격)"""
    checks: dict = {}

    # DB 연결 확인
    try:
        from db.supabase_client import get_client
        supabase = get_client()
        supabase.table("businesses").select("id").limit(1).execute()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"

    # 메모리 확인
    try:
        import psutil
        mem = psutil.virtual_memory()
        checks["memory_used_pct"] = round(mem.percent, 1)
    except ImportError:
        checks["memory_used_pct"] = None

    checks["status"] = (
        "ok"
        if all(v == "ok" for k, v in checks.items() if k not in ("memory_used_pct", "status"))
        else "degraded"
    )
    return checks
