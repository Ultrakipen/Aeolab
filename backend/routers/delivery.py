"""대행 의뢰 게시판 엔드포인트.

사용자 라우터:
  GET  /api/delivery/packages               — 패키지 3종 정보 (인증 불필요)
  POST /api/delivery/orders                 — 대행 의뢰 생성 (인증 필수)
  GET  /api/delivery/orders/me              — 내 의뢰 목록 (인증 필수)
  GET  /api/delivery/orders/{order_id}      — 의뢰 상세 (인증 필수, 본인 소유 검증)
  POST /api/delivery/orders/{order_id}/consent   — 동의 서명 (인증 필수)
  GET  /api/delivery/orders/{order_id}/messages  — 메시지 목록 (인증 필수)
  POST /api/delivery/orders/{order_id}/messages  — 메시지 작성 (인증 필수)
  GET  /api/delivery/orders/{order_id}/report    — 완료 보고서 (인증 필수)
  POST /api/delivery/orders/{order_id}/testimonial — 후기 작성 + 쿠폰 발급 (인증 필수)

관리자 라우터 (X-Admin-Key 헤더):
  GET  /admin/delivery/{order_id}           — 주문 상세 조회
  GET  /admin/delivery/{order_id}/messages  — 메시지 목록 조회
  POST /admin/delivery/{order_id}/status    — 상태 변경 + 카카오 알림톡
  POST /admin/delivery/{order_id}/messages  — 운영자 메시지
  POST /admin/delivery/{order_id}/complete  — 완료 보고서 등록
"""

import aiohttp
import base64
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, field_validator

from config.prices import DELIVERY_PRICES
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user

_logger = logging.getLogger("aeolab")

router = APIRouter()
admin_router = APIRouter()

# 토스 API 호출 timeout (무한 대기 방지)
_TOSS_TIMEOUT = aiohttp.ClientTimeout(total=30)

# ── 패키지 정의 (금액은 config/prices.py DELIVERY_PRICES 단일 소스) ──────────
PACKAGES: dict[str, dict] = {
    "smartplace_register": {
        "name": "01 스마트플레이스 등록 대행",
        "amount": DELIVERY_PRICES["smartplace_register"],
        "description": "스마트플레이스 신규 등록부터 기본정보, 메뉴, 키워드 최적화까지",
        "work_hours": "5.2h 작업",
        "features": [
            "스마트플레이스 신규 등록",
            "기본정보·메뉴·키워드 최적화",
            "대표 사진 구성 안내",
        ],
    },
    "ai_optimization": {
        "name": "02 AI 검색 최적화",
        "amount": DELIVERY_PRICES["ai_optimization"],
        "description": "AI 검색 최적화, 소개글·톡톡메뉴·후기답글·키워드 보강",
        "work_hours": "6.0h 작업",
        "features": [
            "소개글·톡톡채팅방 메뉴 최적화",
            "후기 답글 10건 작성",
            "핵심 키워드 보강",
        ],
    },
    "comprehensive": {
        "name": "03 종합 풀패키지",
        "amount": DELIVERY_PRICES["comprehensive"],
        "description": "등록+최적화+코칭+30일 재진단 — 개별 합산 158,000원 → 119,000원",
        "work_hours": "11.2h 작업",
        "features": [
            "01 등록 대행 전체 포함",
            "02 AI 최적화 전체 포함",
            "1:1 코칭 세션 + 30일 재진단",
        ],
    },
}

# 유효한 주문 상태 목록
VALID_STATUSES = {"received", "paid", "in_progress", "completed", "cancelled", "rework", "refunded"}


# ── 관리자 인증 ────────────────────────────────────────────────────────────────
def verify_admin(x_admin_key: str = Header(None)) -> None:
    secret = os.getenv("ADMIN_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="관리자 키가 설정되지 않았습니다")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, secret):
        raise HTTPException(status_code=403, detail="관리자 전용")


# ── Pydantic 모델 ──────────────────────────────────────────────────────────────
class DeliveryOrderCreate(BaseModel):
    package_type: str
    business_id: str
    request_title: str
    request_body: str
    consent_agreed: bool

    @field_validator("package_type")
    @classmethod
    def validate_package_type(cls, v: str) -> str:
        if v not in PACKAGES:
            raise ValueError(f"유효하지 않은 패키지 타입입니다. 허용값: {', '.join(PACKAGES.keys())}")
        return v

    @field_validator("request_title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("의뢰 제목을 입력해 주세요")
        if len(v) > 100:
            raise ValueError("의뢰 제목은 100자 이내로 입력해 주세요")
        return v

    @field_validator("request_body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("의뢰 내용을 입력해 주세요")
        if len(v) > 2000:
            raise ValueError("의뢰 내용은 2000자 이내로 입력해 주세요")
        return v


class DeliveryMessageCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("메시지 내용을 입력해 주세요")
        if len(v) > 1000:
            raise ValueError("메시지는 1000자 이내로 입력해 주세요")
        return v


class DeliveryPaymentConfirm(BaseModel):
    payment_key: str
    amount: int
    toss_order_id: str  # 토스 orderID (UUID)


class AdminStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"유효하지 않은 상태입니다. 허용값: {', '.join(VALID_STATUSES)}")
        return v


class AdminMessageCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("메시지 내용을 입력해 주세요")
        if len(v) > 2000:
            raise ValueError("메시지는 2000자 이내로 입력해 주세요")
        return v


class AdminCompleteReport(BaseModel):
    completion_report: dict


# ── 공통 유틸 ──────────────────────────────────────────────────────────────────
async def _get_order_or_404(order_id: str) -> dict:
    """delivery_orders 조회 — 없으면 404."""
    supabase = get_client()
    res = await execute(
        supabase.table("delivery_orders")
        .select("id, user_id, business_id, package_type, request_title, request_body, status, amount, consent_agreed, consent_signed_at, consent_ip, completion_report, created_at")
        .eq("id", order_id)
        .single()
    )
    if not (res and res.data):
        raise HTTPException(status_code=404, detail="의뢰를 찾을 수 없습니다")
    return res.data


async def _get_order_owned_or_403(order_id: str, user_id: str) -> dict:
    """delivery_orders 소유권 검증 — 타인 접근 시 403."""
    order = await _get_order_or_404(order_id)
    if order["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    return order


async def _send_status_kakao(order_id: str, new_status: str) -> None:
    """상태 변경 시 카카오 알림톡 발송 (환경변수 미설정 시 skip).

    kakao_notify.KakaoNotifier의 send_delivery_* 함수를 사용.
    received(paid 전환)은 confirm_delivery_payment()에서 직접 호출 — 여기서는 처리 안 함.
    """
    if new_status not in ("in_progress", "completed"):
        return
    try:
        from services.kakao_notify import KakaoNotifier

        # 주문 + 사용자 전화번호 조회
        supabase = get_client()
        order_res = await execute(
            supabase.table("delivery_orders")
            .select("user_id, package_type")
            .eq("id", order_id)
            .single()
        )
        if not (order_res and order_res.data):
            _logger.debug(f"[delivery] _send_status_kakao: 주문 없음 order_id={order_id}")
            return
        order = order_res.data

        profile_res = await execute(
            supabase.table("profiles")
            .select("phone")
            .eq("user_id", order["user_id"])
            .single()
        )
        if not (profile_res and profile_res.data):
            _logger.debug(f"[delivery] _send_status_kakao: 프로필 없음 user_id={order['user_id']}")
            return
        phone = (profile_res.data.get("phone") or "").strip()
        if not phone:
            _logger.debug(f"[delivery] 카카오 알림 skip — 전화번호 없음: user_id={order['user_id']}")
            return

        # 사업장명 조회 (없으면 패키지명으로 대체)
        biz_name = ""
        try:
            biz_res = await execute(
                supabase.table("delivery_orders")
                .select("businesses(name)")
                .eq("id", order_id)
                .single()
            )
            if biz_res and biz_res.data:
                biz_info = biz_res.data.get("businesses") or {}
                biz_name = biz_info.get("name") or ""
        except Exception as _e:
            _logger.debug(f"[delivery] 사업장명 조회 실패 (무시): {_e}")

        pkg_name = PACKAGES.get(order["package_type"], {}).get("name", order["package_type"])
        if not biz_name:
            biz_name = pkg_name

        notifier = KakaoNotifier()

        if new_status == "in_progress":
            await notifier.send_delivery_in_progress(
                order_id=order_id,
                user_phone=phone,
                package_name=pkg_name,
                business_name=biz_name,
                expected_days=3,
            )
        elif new_status == "completed":
            await notifier.send_delivery_completed(
                order_id=order_id,
                user_phone=phone,
                package_name=pkg_name,
                business_name=biz_name,
            )

    except Exception as e:
        _logger.warning(f"[delivery] 카카오 알림 발송 실패 (order_id={order_id}): {e}")


# ── 사용자 엔드포인트 ───────────────────────────────────────────────────────────

@router.get("/packages")
async def list_packages():
    """패키지 3종 정보 반환 (인증 불필요)."""
    return {
        "packages": [
            {
                "type": key,
                "name": pkg["name"],
                "amount": pkg["amount"],
                "description": pkg["description"],
                "work_hours": pkg.get("work_hours", ""),
                "features": pkg.get("features", []),
            }
            for key, pkg in PACKAGES.items()
        ]
    }


@router.post("/orders")
async def create_order(
    body: DeliveryOrderCreate,
    user: dict = Depends(get_current_user),
):
    """대행 의뢰 생성.

    - consent_agreed=False면 400
    - delivery_orders 테이블에 INSERT (status='received')
    - 생성된 order_id 반환
    """
    if not body.consent_agreed:
        raise HTTPException(status_code=400, detail="서비스 이용 동의가 필요합니다")

    user_id = user["id"]

    # 사업장 소유권 검증
    supabase = get_client()
    biz_res = await execute(
        supabase.table("businesses")
        .select("id, user_id")
        .eq("id", body.business_id)
        .single()
    )
    if not (biz_res and biz_res.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    if biz_res.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="해당 사업장에 대한 접근 권한이 없습니다")

    pkg = PACKAGES[body.package_type]
    now = datetime.now(timezone.utc).isoformat()

    payload = {
        "user_id": user_id,
        "business_id": body.business_id,
        "package_type": body.package_type,
        "request_title": body.request_title,
        "request_body": body.request_body,
        "status": "received",
        "amount": pkg["amount"],
        "consent_agreed": True,
        "consent_signed_at": now,
    }

    insert_res = await execute(
        supabase.table("delivery_orders").insert(payload).select("id")
    )
    if not (insert_res and insert_res.data):
        _logger.warning(f"[delivery] delivery_orders INSERT 실패: user_id={user_id}")
        raise HTTPException(status_code=500, detail="의뢰 생성에 실패했습니다")

    order_id = insert_res.data[0]["id"]
    _logger.info(f"[delivery] 의뢰 생성 완료: order_id={order_id}, user_id={user_id}, package={body.package_type}")
    return {"order_id": order_id, "status": "received", "amount": pkg["amount"]}


@router.get("/orders/me")
async def list_my_orders(user: dict = Depends(get_current_user)):
    """내 의뢰 목록 반환 (최신순 20건)."""
    supabase = get_client()
    res = await execute(
        supabase.table("delivery_orders")
        .select("id, package_type, request_title, status, amount, created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(20)
    )
    orders = res.data or []
    # 패키지 이름 enrichment
    for o in orders:
        pkg_type = o.get("package_type", "")
        o["package_name"] = PACKAGES.get(pkg_type, {}).get("name", pkg_type)
    return {"orders": orders}


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    """의뢰 상세 조회 (본인 소유 검증)."""
    order = await _get_order_owned_or_403(order_id, user["id"])
    pkg_type = order.get("package_type", "")
    order["package_name"] = PACKAGES.get(pkg_type, {}).get("name", pkg_type)

    # 사업장명 enrichment
    biz_id = order.get("business_id")
    if biz_id:
        try:
            supabase = get_client()
            biz_res = await execute(
                supabase.table("businesses").select("name").eq("id", biz_id).single()
            )
            if biz_res and biz_res.data:
                order["business_name"] = biz_res.data.get("name") or ""
        except Exception as _e:
            _logger.debug(f"[delivery/get_order] 사업장명 조회 실패 (무시): {_e}")

    return {"order": order}


@router.post("/orders/{order_id}/consent")
async def sign_consent(
    order_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """동의 서명 처리.

    - consent_agreed=True 설정
    - consent_signed_at=now(), consent_ip=클라이언트 IP
    """
    await _get_order_owned_or_403(order_id, user["id"])

    # 클라이언트 IP (Nginx X-Real-IP 우선)
    client_ip = (
        request.headers.get("X-Real-IP")
        or (request.client.host if request.client else "unknown")
    )
    now = datetime.now(timezone.utc).isoformat()

    supabase = get_client()
    await execute(
        supabase.table("delivery_orders")
        .update({
            "consent_agreed": True,
            "consent_signed_at": now,
            "consent_ip": client_ip,
        })
        .eq("id", order_id)
    )
    return {"order_id": order_id, "consent_agreed": True, "consent_signed_at": now}


@router.get("/orders/{order_id}/messages")
async def get_messages(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    """의뢰 메시지 목록 조회 (본인 소유 검증)."""
    await _get_order_owned_or_403(order_id, user["id"])

    supabase = get_client()
    res = await execute(
        supabase.table("delivery_messages")
        .select("id, sender_type, body, created_at")
        .eq("order_id", order_id)
        .order("created_at", desc=False)
    )
    return {"order_id": order_id, "messages": res.data or []}


@router.post("/orders/{order_id}/messages")
async def create_message(
    order_id: str,
    body: DeliveryMessageCreate,
    user: dict = Depends(get_current_user),
):
    """사용자 메시지 작성 (본인 소유 검증)."""
    order = await _get_order_owned_or_403(order_id, user["id"])

    # 취소·완료·환불 상태 의뢰는 메시지 작성 불가
    if order.get("status") in ("cancelled", "completed", "refunded"):
        raise HTTPException(status_code=400, detail="완료·취소·환불된 의뢰에는 메시지를 작성할 수 없습니다")

    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "order_id": order_id,
        "sender_type": "user",
        "sender_id": user["id"],
        "body": body.body,
        "created_at": now,
    }
    insert_res = await execute(
        supabase.table("delivery_messages").insert(payload).select("id, sender_type, body, created_at")
    )
    if not (insert_res and insert_res.data):
        _logger.warning(f"[delivery] 메시지 INSERT 실패: order_id={order_id}")
        raise HTTPException(status_code=500, detail="메시지 전송에 실패했습니다")

    return {"message": insert_res.data[0]}


@router.get("/orders/{order_id}/report")
async def get_completion_report(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    """완료 보고서 조회 (본인 소유 검증, 완료 상태만 반환)."""
    order = await _get_order_owned_or_403(order_id, user["id"])

    if order.get("status") != "completed":
        raise HTTPException(status_code=404, detail="아직 완료 보고서가 등록되지 않았습니다")

    return {
        "order_id": order_id,
        "completion_report": order.get("completion_report"),
    }


@router.post("/orders/{order_id}/confirm")
async def confirm_delivery_payment(
    order_id: str,
    body: DeliveryPaymentConfirm,
    user: dict = Depends(get_current_user),
):
    """대행 의뢰 결제 확인 — 토스페이먼츠 서버 재검증 후 상태 paid 전환.

    1. 의뢰 소유권 검증
    2. 이미 paid/in_progress/completed 이면 409 (중복 방지)
    3. PACKAGES 금액과 body.amount 비교 (클라이언트 조작 방어)
    4. 토스 서버 재검증
    5. status → paid, payment_key 저장
    6. 카카오 알림톡 접수 완료 발송
    """
    user_id = user["id"]
    order = await _get_order_owned_or_403(order_id, user_id)

    # 2. 중복 확인 방지
    if order["status"] in ("paid", "in_progress", "completed"):
        raise HTTPException(
            status_code=409,
            detail=f"이미 결제 처리된 의뢰입니다 (status={order['status']})",
        )

    # 3. 금액 서버 검증 (클라이언트 조작 방어)
    expected_amount = PACKAGES.get(order["package_type"], {}).get("amount")
    if expected_amount is None:
        _logger.warning(f"[delivery/confirm] 알 수 없는 패키지 타입: {order['package_type']}")
        raise HTTPException(status_code=400, detail="알 수 없는 패키지 타입입니다")
    if body.amount != expected_amount:
        _logger.warning(
            f"[delivery/confirm] 금액 불일치: order_id={order_id}, "
            f"expected={expected_amount}, received={body.amount}"
        )
        raise HTTPException(
            status_code=400,
            detail=f"결제 금액이 올바르지 않습니다 (expected={expected_amount})",
        )

    # 4. 토스 서버 재검증
    toss_secret = os.getenv("TOSS_SECRET_KEY", "")
    if toss_secret:
        encoded = base64.b64encode(f"{toss_secret}:".encode()).decode()
        try:
            async with aiohttp.ClientSession(timeout=_TOSS_TIMEOUT) as session:
                async with session.post(
                    "https://api.tosspayments.com/v1/payments/confirm",
                    headers={
                        "Authorization": f"Basic {encoded}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "paymentKey": body.payment_key,
                        "orderId": body.toss_order_id,
                        "amount": body.amount,
                    },
                ) as resp:
                    toss_data = await resp.json()
        except aiohttp.ClientError as e:
            _logger.warning(f"[delivery/confirm] 토스 API 연결 오류: {e}")
            raise HTTPException(status_code=502, detail="결제 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.")

        if toss_data.get("status") != "DONE":
            _logger.warning(
                f"[delivery/confirm] 토스 결제 확인 실패: order_id={order_id}, "
                f"toss_status={toss_data.get('status')}, message={toss_data.get('message')}"
            )
            raise HTTPException(
                status_code=400,
                detail=f"결제 확인 실패: {toss_data.get('message', '알 수 없는 오류')}",
            )
    else:
        # 테스트/개발 환경: TOSS_SECRET_KEY 미설정 시 검증 건너뜀
        _logger.warning(f"[delivery/confirm] TOSS_SECRET_KEY 미설정 — 토스 검증 건너뜀 (dev/test 전용)")

    # 5. 상태 업데이트
    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()
    await execute(
        supabase.table("delivery_orders")
        .update({
            "status": "paid",
            "payment_key": body.payment_key,
        })
        .eq("id", order_id)
    )

    _logger.info(f"[delivery/confirm] 결제 확인 완료: order_id={order_id}, user_id={user_id}")

    # 6. 카카오 알림톡 접수 완료 발송 (실패해도 응답에 영향 없음)
    try:
        from services.kakao_notify import KakaoNotifier
        profile_res = await execute(
            supabase.table("profiles")
            .select("phone")
            .eq("user_id", user_id)
            .single()
        )
        phone = ""
        if profile_res and profile_res.data:
            phone = (profile_res.data.get("phone") or "").strip()
        if phone:
            # 사업장명 조회 (실패 시 패키지명 fallback)
            biz_name = ""
            try:
                biz_res = await execute(
                    supabase.table("businesses")
                    .select("name")
                    .eq("id", order.get("business_id", ""))
                    .single()
                )
                if biz_res and biz_res.data:
                    biz_name = biz_res.data.get("name") or ""
            except Exception as _e:
                _logger.debug(f"[delivery/confirm] 사업장명 조회 실패 (무시): {_e}")
            pkg_name = PACKAGES.get(order["package_type"], {}).get("name", order["package_type"])
            if not biz_name:
                biz_name = pkg_name
            notifier = KakaoNotifier()
            await notifier.send_delivery_received(
                order_id=order_id,
                user_phone=phone,
                package_name=pkg_name,
                business_name=biz_name,
            )
        else:
            _logger.debug(f"[delivery/confirm] 접수 알림 skip — 전화번호 없음: user_id={user_id}")
    except Exception as e:
        _logger.warning(f"[delivery/confirm] 카카오 알림 발송 실패 (무시): {e}")

    # 7. 운영자 이메일 알림 (contact@aeolab.co.kr)
    try:
        from services.email_sender import send_operator_delivery_notification
        pkg_name = PACKAGES.get(order["package_type"], {}).get("name", order["package_type"])
        await send_operator_delivery_notification(
            order_id=order_id,
            package_name=pkg_name,
            amount=body.amount,
            user_id=user_id,
        )
    except Exception as _email_e:
        _logger.warning(f"[delivery/confirm] 운영자 이메일 발송 실패 (무시): {_email_e}")

    # 업데이트된 order 반환
    updated_order = {**order, "status": "paid", "payment_key": body.payment_key}
    return {"order": updated_order}


# ── 관리자 엔드포인트 ───────────────────────────────────────────────────────────

@admin_router.get("/{order_id}")
async def admin_get_order(
    order_id: str,
    _: None = Depends(verify_admin),
):
    """주문 상세 조회 (관리자)."""
    order = await _get_order_or_404(order_id)
    pkg_type = order.get("package_type", "")
    order["package_name"] = PACKAGES.get(pkg_type, {}).get("name", pkg_type)
    return {"order": order}


@admin_router.get("/{order_id}/messages")
async def admin_get_messages(
    order_id: str,
    _: None = Depends(verify_admin),
):
    """메시지 목록 조회 (관리자)."""
    await _get_order_or_404(order_id)
    supabase = get_client()
    res = await execute(
        supabase.table("delivery_messages")
        .select("id, sender_type, body, created_at")
        .eq("order_id", order_id)
        .order("created_at", desc=False)
    )
    return {"order_id": order_id, "messages": res.data or []}


@admin_router.post("/{order_id}/status")
async def admin_update_status(
    order_id: str,
    body: AdminStatusUpdate,
    _: None = Depends(verify_admin),
):
    """주문 상태 변경 + 카카오 알림톡 트리거."""
    # 주문 존재 확인
    await _get_order_or_404(order_id)

    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()
    await execute(
        supabase.table("delivery_orders")
        .update({"status": body.status})
        .eq("id", order_id)
    )

    _logger.info(f"[admin/delivery] 상태 변경: order_id={order_id}, status={body.status}")

    # 카카오 알림톡 비동기 발송 (실패해도 응답에 영향 없음)
    if body.status in ("in_progress", "completed"):
        try:
            await _send_status_kakao(order_id, body.status)
        except Exception as e:
            _logger.warning(f"[admin/delivery] 카카오 알림 발송 실패 (무시): {e}")

    return {"order_id": order_id, "status": body.status}


@admin_router.post("/{order_id}/messages")
async def admin_create_message(
    order_id: str,
    body: AdminMessageCreate,
    _: None = Depends(verify_admin),
):
    """운영자 메시지 작성."""
    await _get_order_or_404(order_id)

    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "order_id": order_id,
        "sender_type": "admin",
        "sender_id": "admin",
        "body": body.body,
        "created_at": now,
    }
    insert_res = await execute(
        supabase.table("delivery_messages").insert(payload).select("id, sender_type, body, created_at")
    )
    if not (insert_res and insert_res.data):
        _logger.warning(f"[admin/delivery] 운영자 메시지 INSERT 실패: order_id={order_id}")
        raise HTTPException(status_code=500, detail="메시지 전송에 실패했습니다")

    return {"message": insert_res.data[0]}


@router.post("/orders/{order_id}/testimonial")
async def submit_testimonial(
    order_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
):
    """완료 주문 후기 작성 + 무료 코칭 쿠폰 예약 발급.

    - 본인 소유 + completed 상태만 허용
    - 1건만 허용 (testimonial_submitted_at 체크)
    - success_stories INSERT (published_at NULL = 관리자 검토 대기)
    """
    supabase = get_client()
    res = await execute(
        supabase.table("delivery_orders")
        .select("id, user_id, business_id, package_type, status, testimonial_submitted_at, score_before, score_after")
        .eq("id", order_id)
        .single()
    )
    if not (res and res.data):
        raise HTTPException(status_code=404, detail="의뢰를 찾을 수 없습니다")
    order = res.data

    if order["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    if order.get("status") != "completed":
        raise HTTPException(status_code=400, detail="완료된 주문만 후기를 작성할 수 있습니다")

    if order.get("testimonial_submitted_at"):
        raise HTTPException(status_code=409, detail="이미 후기를 작성하셨습니다")

    testimonial_body = (body.get("body") or "").strip()
    if len(testimonial_body) < 10:
        raise HTTPException(status_code=422, detail="후기는 10자 이상 입력해주세요")

    # businesses에서 category/region 조회 (delivery_orders에 해당 컬럼 없음)
    biz_category = "other"
    biz_region = ""
    biz_id = order.get("business_id")
    if biz_id:
        try:
            biz_res = await execute(
                supabase.table("businesses").select("category, region").eq("id", biz_id).single()
            )
            if biz_res and biz_res.data:
                biz_category = biz_res.data.get("category") or "other"
                biz_region = biz_res.data.get("region") or ""
        except Exception as _be:
            _logger.debug(f"[delivery/testimonial] 사업장 정보 조회 실패 (무시): {_be}")

    # success_stories INSERT (published_at 없음 → 관리자 검토 대기)
    story_payload = {
        "delivery_order_id": order_id,
        "business_id": order.get("business_id"),
        "category": biz_category,
        "region": biz_region,
        "title": body.get("title") or "서비스 후기",
        "body": testimonial_body,
        "score_before": order.get("score_before"),
        "score_after": order.get("score_after"),
        "is_anonymous": bool(body.get("is_anonymous", True)),
        "display_name": body.get("display_name"),
        "published_at": None,
    }
    await execute(
        supabase.table("success_stories").insert(story_payload)
    )

    # 주문에 후기 제출 타임스탬프
    now = datetime.now(timezone.utc).isoformat()
    await execute(
        supabase.table("delivery_orders")
        .update({"testimonial_submitted_at": now})
        .eq("id", order_id)
    )

    _logger.info(f"[delivery/testimonial] 후기 작성 완료: order={order_id}")

    return {"ok": True, "coupon_message": "코칭 쿠폰은 카카오톡으로 보내드립니다"}


@admin_router.post("/{order_id}/complete")
async def admin_complete_order(
    order_id: str,
    body: AdminCompleteReport,
    _: None = Depends(verify_admin),
):
    """완료 보고서 등록 + 상태 completed 로 변경."""
    await _get_order_or_404(order_id)

    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()
    await execute(
        supabase.table("delivery_orders")
        .update({
            "completion_report": body.completion_report,
            "status": "completed",
        })
        .eq("id", order_id)
    )

    _logger.info(f"[admin/delivery] 완료 보고서 등록: order_id={order_id}")

    # 완료 카카오 알림
    try:
        await _send_status_kakao(order_id, "completed")
    except Exception as e:
        _logger.warning(f"[admin/delivery] 완료 카카오 알림 실패 (무시): {e}")

    return {"order_id": order_id, "status": "completed"}


# ── 납품 파일 관리 ───────────────────────────────────────────────────────────────

@admin_router.post("/{order_id}/materials")
async def admin_upload_material(
    order_id: str,
    body: dict,
    _: None = Depends(verify_admin),
):
    """납품 파일 URL 등록 (관리자).

    Supabase Storage에 업로드된 파일의 공개 URL 또는 서명 URL을 body.url로 전달.
    delivery_orders.materials_url JSONB 배열에 추가.
    body: { "url": "https://...", "filename": "소개글_초안.pdf" }
    """
    await _get_order_or_404(order_id)

    url = (body.get("url") or "").strip()
    filename = (body.get("filename") or "파일").strip()
    if not url:
        raise HTTPException(status_code=422, detail="url 필드가 필요합니다")

    supabase = get_client()
    # 기존 배열 조회
    res = await execute(
        supabase.table("delivery_orders")
        .select("materials_url")
        .eq("id", order_id)
        .single()
    )
    existing = (res.data or {}).get("materials_url") or []
    if not isinstance(existing, list):
        existing = []

    new_entry = {"url": url, "filename": filename, "added_at": datetime.now(timezone.utc).isoformat()}
    existing.append(new_entry)

    await execute(
        supabase.table("delivery_orders")
        .update({"materials_url": existing})
        .eq("id", order_id)
    )
    _logger.info(f"[admin/delivery] 납품 파일 등록: order_id={order_id}, filename={filename}")
    return {"ok": True, "materials_url": existing}


@router.get("/orders/{order_id}/materials")
async def get_materials(
    order_id: str,
    user: dict = Depends(get_current_user),
):
    """납품 파일 목록 조회 (사용자 — 본인 소유 검증)."""
    order = await _get_order_owned_or_403(order_id, user["id"])
    return {"order_id": order_id, "materials_url": order.get("materials_url") or []}
