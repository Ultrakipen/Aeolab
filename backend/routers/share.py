"""
공유 카드 이미지 엔드포인트 (카카오톡 Feed 템플릿용 PNG)
기획서 v7.2 홈페이지 개선 v1.0 후속 작업 A안 2-3

GET /api/share/image/{trial_id}           — trial_scans DB 조회 후 PNG
GET /api/share/image?score=67&name=...    — 쿼리 폴백 (DB 저장 전 상태 대응)

- 인증 불필요 (공유 링크 프리페치 대응)
- 인프로세스 LRU-스타일 TTL 캐시 24h, 최대 500건 (RAM 보호)
- trial 미존재·프라이빗 상태인 경우 기본 placeholder 카드 반환 (200)
"""
from __future__ import annotations

import hashlib
import io
import logging
import time
from typing import Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import Response

from db.supabase_client import get_client, execute
from services.share_card import (
    render_placeholder_share_card,
    render_trial_share_card,
    _category_label as category_label,
)

_logger = logging.getLogger("aeolab")

router = APIRouter()

# ── 인프로세스 이미지 캐시 ─────────────────────────────────────
# Redis 미도입 상태 — 단일 PM2 프로세스(aeolab-backend) 기준 인메모리로 충분
# 다중 워커 전환 시 Redis 또는 Supabase Storage 캐시로 승격 권장
_CACHE_TTL_SEC = 24 * 60 * 60   # 24시간
_CACHE_MAX_ITEMS = 500          # RAM 보호 상한 (600x400 PNG ~20KB × 500 = 10MB 상한)

# key → (png_bytes, expires_at_monotonic, inserted_at_monotonic)
_image_cache: dict[str, tuple[bytes, float, float]] = {}


def _cache_get(key: str) -> Optional[bytes]:
    entry = _image_cache.get(key)
    if entry is None:
        return None
    data, expires_at, _ = entry
    if time.monotonic() > expires_at:
        _image_cache.pop(key, None)
        return None
    return data


def _cache_set(key: str, data: bytes) -> None:
    """캐시 저장. 상한 초과 시 가장 오래된 항목 삭제(간단한 LRU 근사)."""
    now = time.monotonic()
    # 상한 초과 시 만료된 것 먼저 정리
    if len(_image_cache) >= _CACHE_MAX_ITEMS:
        # 만료 항목 정리
        expired = [k for k, (_, exp, _) in _image_cache.items() if now > exp]
        for k in expired:
            _image_cache.pop(k, None)
        # 그래도 여전히 상한 이상이면 가장 먼저 삽입된 것 제거
        if len(_image_cache) >= _CACHE_MAX_ITEMS:
            try:
                oldest_key = min(
                    _image_cache.items(),
                    key=lambda kv: kv[1][2],  # inserted_at
                )[0]
                _image_cache.pop(oldest_key, None)
            except ValueError:
                pass
    _image_cache[key] = (data, now + _CACHE_TTL_SEC, now)


def _make_cache_key(*parts) -> str:
    raw = "|".join(str(p) for p in parts if p is not None)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def _png_response(data: bytes) -> Response:
    """동일 이미지가 24h 유효하도록 캐시 헤더 + immutable 플래그.
    main.py의 SecurityHeadersMiddleware가 Cache-Control을 no-store로 덮어쓰지 않도록
    setdefault 패턴이라 여기서 명시하면 우선 적용된다."""
    return Response(
        content=data,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400, immutable",
        },
    )


async def _resolve_category_avg(
    supabase, category: Optional[str], region: Optional[str]
) -> Optional[float]:
    """업종·지역 평균 점수를 최근 90일 trial_scans에서 간단 집계.
    report.py의 벤치마크 로직을 단순화(지역 prefix ilike + category eq + total_score avg).
    데이터 없으면 None.
    """
    if not category:
        return None
    try:
        from datetime import datetime, timedelta, timezone
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        q = (
            supabase.table("trial_scans")
            .select("total_score")
            .eq("category", category)
            .gte("scanned_at", cutoff)
            .not_.is_("total_score", "null")
        )
        if region:
            region_prefix = region.split()[0] if region else region
            if region_prefix:
                q = q.ilike("region", f"{region_prefix}%")
        rows = (await execute(q.limit(500))).data or []
        scores = [
            float(r["total_score"])
            for r in rows
            if r.get("total_score") is not None
        ]
        if not scores:
            return None
        return round(sum(scores) / len(scores), 1)
    except Exception as e:
        _logger.warning(f"share_card category_avg 계산 실패: {e}")
        return None


def _extract_naver_ai_rate(trial_row: dict) -> Optional[float]:
    """trial_scans.naver_result JSON에서 AI 브리핑 노출률 추정.
    현재 스키마에 전용 필드가 없으므로 합리적 폴백:
      - ai_mentioned(True/False) + 샘플 수가 있으면 rate = 100 if mentioned else 0
      - 직접 필드가 있으면 그 값
    없으면 None 반환 → 카드에서 해당 줄 생략.
    """
    naver = trial_row.get("naver_result")
    if isinstance(naver, dict):
        for key in ("ai_briefing_rate", "ai_rate", "briefing_rate"):
            v = naver.get(key)
            if v is not None:
                try:
                    return float(v)
                except (TypeError, ValueError):
                    continue
    # ai_mentioned 폴백 — 단일 샘플이라 불확실하므로 카드에 표기하지 않음(None)
    return None


def _extract_chatgpt_cite_rate(trial_row: dict) -> Optional[float]:
    """trial_scans에서 ChatGPT 인용 횟수 추정 (Trial은 ChatGPT 1회 체크).
    ai_mentioned가 True면 100회 환산 시 ~10회 가정하지 않고, 원시값 없으면 None.
    """
    # ai_evidence에 채널별 상세가 있을 수 있으나, Trial은 단일 쿼리라 비율 추정 부정확
    # 명시 필드 없으므로 None 반환 → 카드에서 해당 줄 생략
    ai_ev = trial_row.get("ai_evidence")
    if isinstance(ai_ev, dict):
        # 혹시 향후 스캐너가 cite_count를 채워주면 여기서 픽업
        for key in ("chatgpt_cite_count", "chatgpt_mentions"):
            v = ai_ev.get(key)
            if v is not None:
                try:
                    return float(v)
                except (TypeError, ValueError):
                    continue
    return None


def _safe_score(trial_row: dict) -> float:
    """trial_scans에서 표시용 점수 추출.
    우선순위: unified_score → total_score → track1_score → 0
    """
    for k in ("unified_score", "total_score", "track1_score"):
        v = trial_row.get(k)
        if v is None:
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return 0.0


@router.get("/image/{trial_id}")  # public — 카카오톡 공유 링크 프리페치 대응 (인증 불필요)
async def share_image_by_trial(trial_id: str, request: Request):
    """trial_id로 진단 결과 조회 후 600×400 공유 카드 PNG 반환.

    - 캐시 HIT: 즉시 PNG 응답
    - 캐시 MISS: Supabase 조회 → 렌더링 → 캐시 저장 → PNG 응답
    - trial_id 미존재 또는 프라이빗 상태: placeholder 카드 반환 (200)
    """
    cache_key = _make_cache_key("trial", trial_id)
    cached = _cache_get(cache_key)
    if cached is not None:
        return _png_response(cached)

    supabase = get_client()
    try:
        res = await execute(
            supabase.table("trial_scans")
            .select(
                "id, business_name, category, region, "
                "total_score, unified_score, track1_score, "
                "ai_mentioned, naver_result, ai_evidence"
            )
            .eq("id", trial_id)
            .maybe_single()
        )
    except Exception as e:
        _logger.warning(f"share_image_by_trial DB 조회 실패 trial_id={trial_id}: {e}")
        res = None

    # supabase-py 2.7.4 패턴: .data 확인 필수 (if not res 는 항상 False)
    if not (res and res.data):
        png = render_placeholder_share_card()
        _cache_set(_make_cache_key("placeholder", "default"), png)
        return _png_response(png)

    row = res.data
    score = _safe_score(row)
    business_name = row.get("business_name") or "내 가게"
    category = row.get("category") or ""
    region = row.get("region") or ""
    cat_lbl = category_label(category)

    category_avg = await _resolve_category_avg(supabase, category, region)
    naver_rate = _extract_naver_ai_rate(row)
    chatgpt_rate = _extract_chatgpt_cite_rate(row)

    try:
        png = render_trial_share_card(
            score=score,
            business_name=business_name,
            category_label=cat_lbl,
            region=region,
            category_avg=category_avg,
            naver_ai_rate=naver_rate,
            chatgpt_cite_rate=chatgpt_rate,
        )
    except Exception as e:
        _logger.warning(f"share_image_by_trial 렌더 실패 trial_id={trial_id}: {e}")
        png = render_placeholder_share_card()

    _cache_set(cache_key, png)
    return _png_response(png)


@router.get("/image")  # public — 카카오톡 공유 링크 프리페치 대응 (인증 불필요)
async def share_image_by_query(
    score: Optional[float] = Query(None, ge=0, le=100),
    name: Optional[str] = Query(None, max_length=60),
    category: Optional[str] = Query(None, max_length=40),
    region: Optional[str] = Query(None, max_length=40),
    category_avg: Optional[float] = Query(None, ge=0, le=100),
    naver_rate: Optional[float] = Query(None, ge=0, le=100),
    chatgpt_rate: Optional[float] = Query(None, ge=0),
):
    """쿼리 파라미터 기반 즉석 공유 카드.
    trial_scans에 아직 저장되지 않은 진단 중 상태나 홈 데모에서 사용.
    필수 파라미터 없음 — 전부 비어있으면 placeholder 반환.
    """
    # 최소한 score 또는 name 중 하나는 있어야 유의미한 카드
    if score is None and not name:
        png = render_placeholder_share_card()
        return _png_response(png)

    cache_key = _make_cache_key(
        "query",
        score, name, category, region, category_avg, naver_rate, chatgpt_rate,
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return _png_response(cached)

    cat_lbl = category_label(category or "")
    try:
        png = render_trial_share_card(
            score=float(score) if score is not None else 0.0,
            business_name=name or "내 가게",
            category_label=cat_lbl,
            region=region,
            category_avg=category_avg,
            naver_ai_rate=naver_rate,
            chatgpt_cite_rate=chatgpt_rate,
        )
    except Exception as e:
        _logger.warning(f"share_image_by_query 렌더 실패: {e}")
        png = render_placeholder_share_card()

    _cache_set(cache_key, png)
    return _png_response(png)
