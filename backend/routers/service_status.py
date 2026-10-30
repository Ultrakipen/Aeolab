"""서비스 상태 — 사용자 화면의 '네이버 확인 지연' 안내용 (2026-10-29). 인증 불필요, 접속을 일으키지 않는 읽기 전용."""
from fastapi import APIRouter, Depends, Response

from middleware.plan_gate import get_current_user as _current_user

router = APIRouter()


@router.get("/naver")
async def naver_status(response: Response):
    """네이버 확인이 지연되는지, 언제 재개될 것으로 보이는지. 내부 한도·횟수·차단 단계는 포함하지 않는다."""
    from services.naver_status import user_status
    response.headers["Cache-Control"] = "public, max-age=30"
    try:
        return user_status()
    except Exception:
        # 상태를 읽지 못해도 화면을 막지 않는다 — '정상'으로 보이게 하는 것이 아니라 안내를 생략한다
        return {"state": "ok", "reason": None, "resume_in_sec": None, "eta_label": None, "message": "", "detail": ""}


@router.get("/capacity")
async def capacity_status(response: Response):
    """신규 구독을 받는 중인가(결제 전 화면 안내용). 인증 불필요, 내부 한도·사업장 수는 내보내지 않는다. 확인 실패 시 받는 중으로 본다."""
    from services.capacity_gate import accepting_new_subscribers, WAITLIST_MESSAGE
    response.headers["Cache-Control"] = "public, max-age=30"
    try:
        accepting = await accepting_new_subscribers()
    except Exception:
        accepting = True
    return {"accepting": accepting, "message": "" if accepting else WAITLIST_MESSAGE}


@router.get("/capacity/me")
async def capacity_status_me(user: dict = Depends(_current_user)):
    """로그인 사용자 기준으로 지금 신규 구독이 막혀 있는지(기존 구독자는 막히지 않는다). 결제 시작 **전**에 화면이 확인한다."""
    from services.capacity_gate import new_subscriber_blocked
    blocked = await new_subscriber_blocked(user["id"])
    return {"blocked": bool(blocked), "message": (blocked or {}).get("message", "")}


@router.post("/capacity/waitlist")
async def join_capacity_waitlist(user: dict = Depends(_current_user)):
    """신규 구독 대기자 명단 등록 — 로그인한 사용자의 이메일로 등록한다(이미 있으면 그대로)."""
    from db.supabase_client import get_client, execute
    email = (user.get("email") or "").strip().lower()
    if not email:
        return {"ok": False, "reason": "no_email"}
    await execute(
        get_client().table("waitlist").upsert(
            {"email": email, "business_name": "(신규 구독 대기)", "category": "capacity_waitlist"}
        )
    )
    return {"ok": True}
