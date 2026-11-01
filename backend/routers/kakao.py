"""
카카오맵 완성도 체크리스트 라우터
GET  /api/kakao/check/{biz_id}     — 카카오맵 등록 여부 자동 확인
POST /api/kakao/checklist/{biz_id} — 체크리스트 저장 + 점수 계산
GET  /api/kakao/score/{biz_id}     — 카카오 완성도 점수 조회

플랜 제한 없음 — 전 플랜 사용 가능
담당: backend-dev 에이전트 | v3.2
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.supabase_client import get_client
from middleware.plan_gate import get_current_user
from services.kakao_checker import (
    KAKAO_CHECKLIST,
    build_kakao_checklist_with_auto,
    calculate_kakao_score,
    check_kakao_registration_or_none,
)

router = APIRouter()
_logger = logging.getLogger("aeolab")


# ─────────────────────────────────────────────────────────────────────────────
# 헬퍼
# ─────────────────────────────────────────────────────────────────────────────

def _verify_biz_ownership(biz_id: str, user_id: str, supabase) -> dict:
    """사업장이 존재하고 현재 사용자 소유인지 검증. 아니면 403/404 raise."""
    try:
        res = (
            supabase.table("businesses")
            .select("id, name, region, user_id, kakao_checklist, kakao_score, kakao_registered")
            .eq("id", biz_id)
            .single()
            .execute()
        )
    except Exception as e:
        _logger.warning(f"businesses 조회 실패 biz_id={biz_id}: {e}")
        raise HTTPException(404, "사업장을 찾을 수 없습니다")

    if not res.data:
        raise HTTPException(404, "사업장을 찾을 수 없습니다")

    biz = res.data
    if biz["user_id"] != user_id:
        raise HTTPException(403, "접근 권한 없음")

    return biz


# ─────────────────────────────────────────────────────────────────────────────
# 요청 스키마
# ─────────────────────────────────────────────────────────────────────────────

class KakaoChecklistRequest(BaseModel):
    """사용자가 직접 입력하는 카카오맵 완성도 체크리스트 (auto=False 항목)"""
    has_hours:         bool = False
    has_phone:         bool = False
    has_photos:        bool = False
    has_kakao_channel: bool = False
    has_menu_info:     bool = False


# ─────────────────────────────────────────────────────────────────────────────
# 엔드포인트
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/check/{biz_id}", summary="카카오맵 등록 여부 자동 확인")
async def check_kakao_registration_endpoint(
    biz_id: str,
    user=Depends(get_current_user),
):
    """
    카카오 로컬 API로 해당 사업장의 카카오맵 등록 여부를 확인합니다.
    API 키 미설정 또는 오류 시 is_registered=False로 graceful fallback.
    """
    supabase = get_client()
    biz = _verify_biz_ownership(biz_id, user["id"], supabase)

    try:
        is_registered = await check_kakao_registration_or_none(biz["name"], biz.get("region", ""))
    except Exception as e:
        _logger.warning(f"check_kakao_registration 오류: {e}")
        is_registered = None

    # 확인하지 못했으면(키 없음·API 오류·타임아웃) 저장된 값을 바꾸지 않는다 — 실패를 '미등록'으로 덮어쓰지 않는다(지침 9).
    # 2026-11-01: 예전에는 실패도 False로 저장해, 카카오 API가 한 번 실패하면 등록된 가게가 미등록으로 바뀌었다.
    if is_registered is not None:
        try:
            supabase.table("businesses").update(
                {"kakao_registered": is_registered}
            ).eq("id", biz_id).execute()
        except Exception as e:
            _logger.warning(f"kakao_registered DB 업데이트 실패: {e}")

    if is_registered is None:
        return {
            "biz_id": biz_id,
            "business_name": biz["name"],
            "is_registered": None,
            "checked": False,
            "message": "지금은 카카오맵 등록 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요. 기존 저장값은 바뀌지 않았습니다.",
        }
    return {
        "biz_id": biz_id,
        "business_name": biz["name"],
        "is_registered": is_registered,
        "checked": True,
        "message": (
            "카카오맵에 등록된 사업장입니다." if is_registered
            else "카카오맵 미등록 또는 검색 불일치입니다. 카카오 내 사업장(biz.kakao.com)에서 등록을 확인하세요."
        ),
    }


@router.post("/checklist/{biz_id}", summary="체크리스트 저장 + 점수 계산")
async def save_kakao_checklist(
    biz_id: str,
    body: KakaoChecklistRequest,
    user=Depends(get_current_user),
):
    """
    사용자가 입력한 카카오맵 완성도 체크리스트를 저장하고
    카카오 로컬 API 자동 확인(is_registered)을 포함한 전체 점수를 계산합니다.

    - is_registered: 카카오 로컬 API 자동 확인
    - 나머지 항목: 사용자 직접 입력
    - 점수 결과는 businesses.kakao_score / kakao_checklist 컬럼에 저장
    """
    supabase = get_client()
    biz = _verify_biz_ownership(biz_id, user["id"], supabase)

    user_checklist = body.model_dump()

    try:
        result = await build_kakao_checklist_with_auto(
            business_name=biz["name"],
            region=biz.get("region", ""),
            user_checklist=user_checklist,
            fallback_registered=biz.get("kakao_registered"),   # 확인 못 하면 직전 저장값으로 점수를 계산한다
        )
    except Exception as e:
        _logger.warning(f"build_kakao_checklist_with_auto 오류: {e}")
        # fallback: API 실패 시 직전 저장값 + 사용자 입력으로 계산하고, 등록 여부는 저장하지 않는다(None)
        user_checklist_fb = {**user_checklist, "is_registered": bool(biz.get("kakao_registered"))}
        result = calculate_kakao_score(user_checklist_fb)
        result["is_registered_auto"] = None

    # DB 저장
    try:
        # checklist에서 auto 포함 전체 boolean 상태 저장
        checklist_to_store = {
            item["checked"]: item for item in result["checklist_result"]
        }
        # key → checked 매핑으로 단순화
        checklist_flat = {
            item["key"]: item["checked"]
            for item in result["checklist_result"]
        }
        update_row = {
            "kakao_checklist":  checklist_flat,
            "kakao_score":      result["score"],
        }
        # 등록 여부는 API로 확인한 경우(True/False)에만 저장한다 — None(확인 못 함)이면 저장된 값을 그대로 둔다(지침 9)
        if result.get("is_registered_auto") is not None:
            update_row["kakao_registered"] = bool(result["is_registered_auto"])
        supabase.table("businesses").update(update_row).eq("id", biz_id).execute()
    except Exception as e:
        _logger.warning(f"카카오 체크리스트 DB 저장 실패: {e}")
        # 저장 실패해도 계산 결과는 반환

    return {
        "biz_id":             biz_id,
        "business_name":      biz["name"],
        "score":              result["score"],
        "checklist_result":   result["checklist_result"],
        "tips":               result["tips"],
        "is_registered_auto": result.get("is_registered_auto"),   # True/False(확인함) 또는 None(확인 못 함) — 못 한 것을 False로 말하지 않는다
    }


@router.get("/score/{biz_id}", summary="카카오 완성도 점수 조회")
async def get_kakao_score(
    biz_id: str,
    user=Depends(get_current_user),
):
    """
    저장된 카카오맵 완성도 점수와 체크리스트를 조회합니다.
    체크리스트가 아직 입력되지 않았다면 score=0, empty 체크리스트를 반환합니다.
    """
    supabase = get_client()
    biz = _verify_biz_ownership(biz_id, user["id"], supabase)

    stored_checklist: dict = biz.get("kakao_checklist") or {}
    stored_score: int      = biz.get("kakao_score") or 0
    is_registered: bool    = bool(biz.get("kakao_registered", False))

    # 저장된 checklist로 점수 재계산 (tips 생성 포함)
    if stored_checklist:
        try:
            result = calculate_kakao_score(stored_checklist)
            checklist_result = result["checklist_result"]
            tips             = result["tips"]
            score            = result["score"]
        except Exception as e:
            _logger.warning(f"kakao score 재계산 실패: {e}")
            checklist_result = _empty_checklist_result()
            tips             = []
            score            = stored_score
    else:
        # 아직 체크리스트 미입력 상태
        checklist_result = _empty_checklist_result()
        tips             = [item["tip"] for item in KAKAO_CHECKLIST[:3]]
        score            = 0

    return {
        "biz_id":           biz_id,
        "business_name":    biz["name"],
        "score":            score,
        "checklist_result": checklist_result,
        "tips":             tips,
        "is_registered":    is_registered,
        "has_data":         bool(stored_checklist),
    }


def _empty_checklist_result() -> list[dict]:
    """체크리스트 미입력 시 빈 결과 반환 (모든 항목 unchecked)."""
    return [
        {
            "key":     item["key"],
            "label":   item["label"],
            "weight":  item["weight"],
            "auto":    item["auto"],
            "checked": False,
            "tip":     item["tip"],
        }
        for item in KAKAO_CHECKLIST
    ]
