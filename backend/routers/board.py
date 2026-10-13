"""공개 문의 게시판 (비로그인 작성 가능, 제목 공개·본문 비밀번호 보호).

설계: docs/public_board_v1.0.md
- 목록은 제목·유형·상태·마스킹 작성자·날짜만 노출. 본문·이메일·답변은 비밀번호로만 열람.
- 비밀번호는 hashlib.scrypt(솔트 포함) 해시로만 저장 — 평문 저장 금지.
- 글별 연속 실패 5회 → 15분 잠금 + IP별 열람 시도 제한(무차별 대입 방어).
- RLS는 정책 없이 활성화(서비스 롤 전용) — anon 키 직접 조회 차단 (trial_scans 유출 사고 재발 방지).
"""
import asyncio
import hashlib
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from db.supabase_client import get_client, execute
from utils import cache as _cache
from utils.admin_auth import verify_admin

router = APIRouter()
admin_router = APIRouter()  # main.py에서 /admin/board 로 마운트 (관리자 감사 로그 대상 경로)
_logger = logging.getLogger("aeolab.board")

CATEGORIES = {"general", "suggest", "partner", "biz", "other"}
TITLE_MAX, CONTENT_MAX, NAME_MAX, EMAIL_MAX = 60, 3000, 20, 100
PW_MIN, PW_MAX = 6, 40
MAX_FAILS = 5
LOCK_MINUTES = 15
LIST_COLUMNS = "id, category, title, title_private, is_notice, status, author_name, created_at"

# 제목은 공개이므로 연락처·URL이 들어가면 거부 (스팸·개인정보 노출 방지)
_PHONE_RE = re.compile(r"(\d{2,4})[\s\-.)]*\d{3,4}[\s\-.]*\d{4}")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_URL_RE = re.compile(r"(https?://|www\.|\.com\b|\.co\.kr\b|\.kr\b|\.net\b|t\.me/|open\.kakao)", re.I)


# ── 유틸 ────────────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return f"{salt.hex()}${dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split("$", 1)
        dk = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2 ** 14, r=8, p=1, dklen=32)
        return secrets.compare_digest(dk.hex(), dk_hex)
    except Exception as e:
        _logger.warning("[board] 비밀번호 검증 오류: %s", e)
        return False


def _mask_name(name: str) -> str:
    name = (name or "").strip()
    if len(name) <= 1:
        return "*"
    if len(name) == 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]


def _rate_limit(key: str, limit: int, window: int, message: str) -> None:
    count: int = _cache.get(key) or 0
    if count >= limit:
        raise HTTPException(status_code=429, detail={"code": "RATE_LIMIT", "message": message})
    _cache.set(key, count + 1, window)


def _public_item(row: dict) -> dict:
    private_title = bool(row.get("title_private"))
    return {
        "id": row["id"],
        "category": row.get("category"),
        "title": "비밀글입니다." if private_title and not row.get("is_notice") else row.get("title"),
        "title_private": private_title,
        "is_notice": bool(row.get("is_notice")),
        "status": row.get("status"),
        "author_name": "운영자" if row.get("is_notice") else _mask_name(row.get("author_name") or ""),
        "created_at": row.get("created_at"),
    }


def _validate_title(title: str) -> None:
    if _PHONE_RE.search(title) or _EMAIL_RE.search(title) or _URL_RE.search(title):
        raise HTTPException(
            status_code=422,
            detail="제목은 목록에 공개됩니다. 전화번호·이메일·웹주소는 제목에 쓰지 말고 본문에 적어 주세요.",
        )


async def _get_post(post_id: int) -> dict:
    res = await execute(
        get_client().table("public_posts").select(
            "id, category, title, content, title_private, is_notice, status, author_name, pw_hash, "
            "answer, answered_at, fail_count, locked_until, created_at"
        ).eq("id", post_id).eq("is_hidden", False).limit(1)
    )
    if not (res and res.data):
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    return res.data[0]


async def _check_password(post: dict, password: str, ip: str) -> None:
    """비밀번호 검증 + 잠금/실패 카운트 처리. 실패 시 HTTPException."""
    _rate_limit(f"board_open:{ip}", 30, 600, "시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.")
    locked_until = post.get("locked_until")
    if locked_until:
        try:
            until = datetime.fromisoformat(str(locked_until).replace("Z", "+00:00"))
            if until > datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=429,
                    detail={"code": "POST_LOCKED", "message": f"비밀번호를 여러 번 틀려 {LOCK_MINUTES}분간 열람이 제한됩니다."},
                )
        except ValueError:
            pass
    stored = post.get("pw_hash") or ""
    ok = await asyncio.to_thread(_verify_password, password, stored) if stored else False
    supabase = get_client()
    if ok:
        if post.get("fail_count"):
            await execute(supabase.table("public_posts").update({"fail_count": 0, "locked_until": None}).eq("id", post["id"]))
        return
    fails = int(post.get("fail_count") or 0) + 1
    update: dict = {"fail_count": fails}
    if fails >= MAX_FAILS:
        update = {"fail_count": 0, "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)).isoformat()}
    await execute(supabase.table("public_posts").update(update).eq("id", post["id"]))
    raise HTTPException(status_code=403, detail={"code": "WRONG_PASSWORD", "message": "비밀번호가 맞지 않습니다."})


def _send_mail(to: list[str], subject: str, html: str) -> None:
    resend_key = os.getenv("RESEND_API_KEY", "")
    from_email = os.getenv("FROM_EMAIL", "noreply@aeolab.co.kr")
    if not resend_key or not to:
        return
    try:
        import resend as _resend
        _resend.api_key = resend_key
        _resend.Emails.send({"from": f"AEOlab <{from_email}>", "to": to, "subject": subject, "html": html})
    except Exception as e:
        _logger.warning("[board] 메일 발송 실패 (무시): %s", e)


async def _notify_admin(post_id, category: str) -> None:
    admins = [e.strip() for e in os.getenv("ADMIN_EMAILS", "contact@aeolab.co.kr").split(",") if e.strip()]
    await asyncio.to_thread(
        _send_mail, admins, f"[AEOlab] 게시판 새 글 #{post_id} ({category})",
        f"<p>공개 게시판에 새 글이 등록되었습니다. (#{post_id}, 유형: {category})</p>"
        "<p><a href='https://aeolab.co.kr/admin/board'>관리자 페이지에서 확인</a></p>",
    )


async def _notify_author(email: str, post_id) -> None:
    await asyncio.to_thread(
        _send_mail, [email], "[AEOlab] 문의하신 글에 답변이 등록되었습니다",
        "<p>문의하신 글에 답변이 등록되었습니다.</p>"
        f"<p>아래 주소에서 글 작성 시 정한 비밀번호를 입력하면 확인할 수 있습니다.</p>"
        f"<p><a href='https://aeolab.co.kr/board/{post_id}'>https://aeolab.co.kr/board/{post_id}</a></p>"
        "<p>본 메일은 발신 전용입니다.</p>",
    )


# ── 모델 ────────────────────────────────────────────────────────────────────

class PostCreate(BaseModel):
    category: str = "general"
    author_name: str
    password: str
    email: Optional[str] = None
    title: str
    content: str
    title_private: bool = False
    consent: bool = False
    website: Optional[str] = None  # 허니팟 — 사람은 비워 둔다


class PasswordBody(BaseModel):
    password: str


class PostEdit(BaseModel):
    password: str
    title: str
    content: str
    title_private: bool = False


class AdminUpdate(BaseModel):
    answer: Optional[str] = None
    is_hidden: Optional[bool] = None
    is_notice: Optional[bool] = None


class NoticeCreate(BaseModel):
    title: str
    content: str
    category: str = "general"


# ── 관리자 (/admin/board/*) ────────────────────────────────────────────────

@admin_router.get("/list", summary="전체 글 목록 (관리자)")
async def admin_list(
    status: str = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    _: None = Depends(verify_admin),
):
    q = get_client().table("public_posts").select(
        "id, category, title, title_private, content, author_name, email, status, answer, answered_at, "
        "is_notice, is_hidden, created_at", count="exact",
    )
    if status in ("pending", "answered"):
        q = q.eq("status", status)
    off = (page - 1) * limit
    res = await execute(q.order("created_at", desc=True).range(off, off + limit - 1))
    return {"items": res.data or [], "total": res.count or 0, "page": page}


@admin_router.post("/notice", summary="공지 등록 (관리자)", status_code=201)
async def admin_create_notice(body: NoticeCreate, _: None = Depends(verify_admin)):
    title, content = body.title.strip(), body.content.strip()
    if not title or not content:
        raise HTTPException(status_code=422, detail="제목과 내용을 입력해 주세요.")
    cat = body.category if body.category in CATEGORIES else "general"
    res = await execute(get_client().table("public_posts").insert({
        "category": cat, "title": title[:TITLE_MAX * 2], "content": content[:CONTENT_MAX],
        "author_name": "운영자", "pw_hash": None, "is_notice": True, "status": "answered",
    }))
    return {"id": res.data[0]["id"] if res and res.data else None}


@admin_router.patch("/{post_id}", summary="답변·숨김·공지 고정 (관리자)")
async def admin_update(post_id: int, body: AdminUpdate, _: None = Depends(verify_admin)):
    supabase = get_client()
    chk = await execute(supabase.table("public_posts").select("id, email, is_notice").eq("id", post_id).limit(1))
    if not (chk and chk.data):
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    row = chk.data[0]
    update: dict = {}
    answered = False
    if body.answer is not None:
        ans = body.answer.strip()
        if not ans:
            raise HTTPException(status_code=422, detail="답변 내용을 입력해 주세요.")
        update.update({"answer": ans[:CONTENT_MAX], "status": "answered",
                       "answered_at": datetime.now(timezone.utc).isoformat()})
        answered = True
    if body.is_hidden is not None:
        update["is_hidden"] = body.is_hidden
    if body.is_notice is not None:
        update["is_notice"] = body.is_notice
    if not update:
        raise HTTPException(status_code=422, detail="변경할 내용이 없습니다.")
    await execute(supabase.table("public_posts").update(update).eq("id", post_id))
    if answered and row.get("email"):
        asyncio.create_task(_notify_author(row["email"], post_id))
    return {"id": post_id, "ok": True}


@admin_router.delete("/{post_id}", summary="글 삭제 (관리자)")
async def admin_delete(post_id: int, _: None = Depends(verify_admin)):
    await execute(get_client().table("public_posts").delete().eq("id", post_id))
    return {"id": post_id, "ok": True}


# ── 공개 ────────────────────────────────────────────────────────────────────

@router.get("", summary="게시글 목록 (공개 — 제목만)")
async def list_posts(page: int = Query(1, ge=1, le=500), limit: int = Query(15, ge=1, le=30)):
    off = (page - 1) * limit
    supabase = get_client()
    notices = []
    if page == 1:
        nres = await execute(
            supabase.table("public_posts").select(LIST_COLUMNS)
            .eq("is_hidden", False).eq("is_notice", True).order("created_at", desc=True).limit(5)
        )
        notices = [_public_item(r) for r in (nres.data or [])]
    res = await execute(
        supabase.table("public_posts").select(LIST_COLUMNS, count="exact")
        .eq("is_hidden", False).eq("is_notice", False)
        .order("created_at", desc=True).range(off, off + limit - 1)
    )
    return {"notices": notices, "items": [_public_item(r) for r in (res.data or [])],
            "total": res.count or 0, "page": page, "limit": limit}


@router.post("", summary="글 작성 (비로그인 가능)", status_code=201)
async def create_post(body: PostCreate, request: Request):
    if body.website:  # 허니팟에 값이 있으면 봇 — 성공한 것처럼 응답해 재시도 방지
        return {"id": 0, "message": "등록되었습니다."}
    ip = _client_ip(request)
    _rate_limit(f"board_new_h:{ip}", 5, 3600, "잠시 후 다시 시도해 주세요. (시간당 5건 제한)")
    _rate_limit(f"board_new_d:{ip}", 15, 86400, "오늘 작성 가능한 글 수를 초과했습니다.")

    name, title, content = body.author_name.strip(), body.title.strip(), body.content.strip()
    email = (body.email or "").strip()
    if not body.consent:
        raise HTTPException(status_code=422, detail="개인정보 수집·이용에 동의해 주세요.")
    if not name or len(name) > NAME_MAX:
        raise HTTPException(status_code=422, detail=f"이름을 {NAME_MAX}자 이내로 입력해 주세요.")
    if not title or len(title) > TITLE_MAX:
        raise HTTPException(status_code=422, detail=f"제목을 {TITLE_MAX}자 이내로 입력해 주세요.")
    if not content or len(content) > CONTENT_MAX:
        raise HTTPException(status_code=422, detail=f"내용을 {CONTENT_MAX}자 이내로 입력해 주세요.")
    if not (PW_MIN <= len(body.password) <= PW_MAX):
        raise HTTPException(status_code=422, detail=f"비밀번호는 {PW_MIN}자 이상 {PW_MAX}자 이하로 정해 주세요.")
    if email and (len(email) > EMAIL_MAX or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)):
        raise HTTPException(status_code=422, detail="이메일 형식이 올바르지 않습니다.")
    _validate_title(title)
    category = body.category if body.category in CATEGORIES else "general"

    pw_hash = await asyncio.to_thread(_hash_password, body.password)
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]
    try:
        res = await execute(get_client().table("public_posts").insert({
            "category": category, "title": title, "content": content, "author_name": name,
            "email": email or None, "pw_hash": pw_hash, "title_private": body.title_private,
            "status": "pending", "ip_hash": ip_hash,
        }))
    except Exception as e:
        _logger.warning("[board] 작성 실패: %s", e)
        raise HTTPException(status_code=500, detail="등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    post_id = res.data[0]["id"] if res and res.data else None
    asyncio.create_task(_notify_admin(post_id, category))
    return {"id": post_id, "message": "등록되었습니다."}


@router.get("/{post_id}", summary="글 정보 (본문 제외 — 공지는 본문 포함)")
async def get_post_meta(post_id: int):
    post = await _get_post(post_id)
    item = _public_item(post)
    if post.get("is_notice"):
        item["content"] = post.get("content")
    return item


@router.post("/{post_id}/open", summary="비밀번호로 본문·답변 열람")
async def open_post(post_id: int, body: PasswordBody, request: Request):
    post = await _get_post(post_id)
    if post.get("is_notice"):
        return {**_public_item(post), "content": post.get("content"), "answer": None}
    await _check_password(post, body.password, _client_ip(request))
    return {
        **_public_item(post),
        "title": post.get("title"),  # 본인 인증 후에는 비밀글 제목도 표시
        "content": post.get("content"),
        "answer": post.get("answer"),
        "answered_at": post.get("answered_at"),
        "can_edit": post.get("status") == "pending",
    }


@router.patch("/{post_id}", summary="글 수정 (답변 전, 비밀번호 필요)")
async def edit_post(post_id: int, body: PostEdit, request: Request):
    post = await _get_post(post_id)
    if post.get("is_notice"):
        raise HTTPException(status_code=403, detail="공지는 수정할 수 없습니다.")
    await _check_password(post, body.password, _client_ip(request))
    if post.get("status") != "pending":
        raise HTTPException(status_code=409, detail="답변이 등록된 글은 수정할 수 없습니다. 삭제 후 다시 작성해 주세요.")
    title, content = body.title.strip(), body.content.strip()
    if not title or len(title) > TITLE_MAX or not content or len(content) > CONTENT_MAX:
        raise HTTPException(status_code=422, detail="제목·내용 길이를 확인해 주세요.")
    _validate_title(title)
    await execute(get_client().table("public_posts").update({
        "title": title, "content": content, "title_private": body.title_private,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", post_id))
    return {"id": post_id, "ok": True}


@router.post("/{post_id}/delete", summary="글 삭제 (비밀번호 필요)")
async def delete_post(post_id: int, body: PasswordBody, request: Request):
    post = await _get_post(post_id)
    if post.get("is_notice"):
        raise HTTPException(status_code=403, detail="공지는 삭제할 수 없습니다.")
    await _check_password(post, body.password, _client_ip(request))
    await execute(get_client().table("public_posts").delete().eq("id", post_id))
    return {"id": post_id, "ok": True}
