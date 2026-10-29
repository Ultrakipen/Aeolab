"""서비스 상태 — 사용자 화면의 '네이버 확인 지연' 안내용 (2026-10-29). 인증 불필요, 접속을 일으키지 않는 읽기 전용."""
from fastapi import APIRouter, Response

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
