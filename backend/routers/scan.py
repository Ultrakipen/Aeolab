import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from models.schemas import ScanRequest, TrialScanRequest
from services.ai_scanner.multi_scanner import MultiAIScanner
from services.score_engine import calculate_score
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user

_logger = logging.getLogger("aeolab")

_PLATFORM_LABELS = {
    "gemini": "Gemini", "chatgpt": "ChatGPT", "perplexity": "Perplexity",
    "grok": "Grok", "naver": "Naver AI 브리핑", "claude": "Claude",
    "zeta": "Zeta(뤼튼)", "google": "Google AI Overview",
}

router = APIRouter()

# ── SSE stream 단기 OTP 토큰 저장소 (실운영은 Redis 권장) ──────────────────
_stream_tokens: dict[str, dict] = {}

# ── 진행 중 스캔 추적 (중복 실행 방지, 실운영은 Redis 권장) ────────────────
_active_scans: set[str] = set()


def cleanup_expired_stream_tokens() -> int:
    """만료된 SSE 토큰 정리. 삭제된 수 반환 (스케줄러에서 주기 호출)"""
    now = datetime.now(timezone.utc)
    expired = [t for t, d in list(_stream_tokens.items()) if d["expires_at"] < now]
    for t in expired:
        _stream_tokens.pop(t, None)
    if expired:
        _logger.debug(f"Cleaned up {len(expired)} expired stream tokens")
    return len(expired)


@router.post("/trial")
async def trial_scan(req: TrialScanRequest):
    """랜딩 무료 체험: Gemini Flash 단일 스캔 (비로그인)"""
    scanner = MultiAIScanner(mode="trial")
    query = f"{req.region} {req.category} 추천"
    result = await scanner.scan_single(query, req.business_name)
    score = calculate_score(result)

    # 이메일 수집 (대기자 명단)
    if req.email:
        try:
            supabase = get_client()
            await execute(
                supabase.table("waitlist").upsert(
                    {"email": req.email, "business_name": req.business_name, "category": req.category}
                )
            )
        except Exception as e:
            _logger.warning(f"Waitlist upsert failed for {req.email}: {e}")

    return {
        "score": score,
        "result": result,
        "query": query,
        "message": "무료 원샷 체험 결과입니다. 100회 샘플링 전체 분석은 구독 후 이용 가능합니다.",
    }


@router.post("/full")
async def full_scan(req: ScanRequest, bg: BackgroundTasks, x_user_id: Optional[str] = Header(None)):
    """전체 6개 AI 병렬 스캔 (구독자 전용, 백그라운드)"""
    if not req.business_id:
        raise HTTPException(status_code=400, detail="business_id required")

    if x_user_id:
        from middleware.rate_limit import check_monthly_scan_limit
        await check_monthly_scan_limit(x_user_id, get_client())

    # 중복 스캔 방지
    scan_key = f"{x_user_id or 'anon'}:{req.business_id}"
    if scan_key in _active_scans:
        raise HTTPException(status_code=409, detail="이미 스캔이 진행 중입니다. 잠시 후 다시 시도해주세요.")

    _active_scans.add(scan_key)
    scan_id = str(uuid.uuid4())

    async def _scan_and_cleanup():
        try:
            await _run_full_scan(scan_id, req)
        finally:
            _active_scans.discard(scan_key)

    bg.add_task(_scan_and_cleanup)
    return {"scan_id": scan_id, "status": "started"}


@router.post("/stream/prepare")
async def prepare_stream(biz_id: str, user=Depends(get_current_user)):
    """SSE 스트림 시작 전 단기 토큰 발급 (60초 유효) — Bearer 인증"""
    # 만료된 토큰 정리
    now = datetime.now(timezone.utc)
    expired = [t for t, d in _stream_tokens.items() if d["expires_at"] < now]
    for t in expired:
        _stream_tokens.pop(t, None)

    token = secrets.token_urlsafe(32)
    _stream_tokens[token] = {
        "user_id": user["id"],
        "biz_id": biz_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=60),
    }
    return {"stream_token": token, "expires_in": 60}


@router.get("/stream")
async def stream_scan(stream_token: str):
    """SSE 실시간 진행률 스트리밍 — /stream/prepare 발급 토큰 필수"""
    token_data = _stream_tokens.get(stream_token)
    if not token_data or datetime.now(timezone.utc) > token_data["expires_at"]:
        _stream_tokens.pop(stream_token, None)
        raise HTTPException(status_code=401, detail="Invalid or expired stream token")
    _stream_tokens.pop(stream_token, None)

    user_id = token_data["user_id"]
    biz_id = token_data["biz_id"]

    # 사업장 정보 조회
    supabase = get_client()
    biz = (await execute(supabase.table("businesses").select("*").eq("id", biz_id).single())).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    req = ScanRequest(
        business_name=biz["name"],
        category=biz["category"],
        region=biz["region"],
        business_id=biz_id,
    )

    async def gen():
        # 중복 스캔 방지
        scan_key = f"{user_id}:{biz_id}"
        if scan_key in _active_scans:
            yield f"data: {json.dumps({'error': '이미 스캔이 진행 중입니다'}, ensure_ascii=False)}\n\n"
            return
        _active_scans.add(scan_key)

        try:
            from middleware.rate_limit import check_monthly_scan_limit
            try:
                await check_monthly_scan_limit(user_id, get_client())
            except HTTPException as e:
                yield f"data: {json.dumps({'error': e.detail}, ensure_ascii=False)}\n\n"
                return

            scanner = MultiAIScanner(mode="full")
            scan_results: dict = {}
            async for progress in scanner.scan_with_progress(req):
                yield f"data: {json.dumps(progress, ensure_ascii=False)}\n\n"
                if progress.get("status") == "done" and "result" in progress:
                    scan_results[progress["step"]] = progress["result"]

            # 스캔 완료 시 DB 저장
            if biz_id and scan_results:
                try:
                    await _save_scan_results(biz_id, req, scan_results)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Stream scan save failed: {e}")
        finally:
            _active_scans.discard(scan_key)

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(gen(), media_type="text/event-stream", headers=headers)


@router.get("/{scan_id}")
async def get_scan(scan_id: str):
    """스캔 결과 조회"""
    supabase = get_client()
    result = await execute(supabase.table("scan_results").select("*").eq("id", scan_id).single())
    if not result.data:
        raise HTTPException(status_code=404, detail="Scan not found")
    return result.data


async def _save_scan_results(business_id: str, req: ScanRequest, results: dict):
    """스트림 스캔 완료 후 DB 저장 (weekly_change 계산 + competitor_scores 포함)"""
    import asyncio as _asyncio
    from datetime import date as _date
    from services.ai_scanner.gemini_scanner import GeminiScanner

    supabase = get_client()
    biz = (await execute(supabase.table("businesses").select("*").eq("id", business_id).single())).data
    score = calculate_score(results, biz or {})
    query = f"{req.region} {req.category} 추천"

    # 이전 score_history로 weekly_change 계산
    prev_history = (
        await execute(
            supabase.table("score_history")
            .select("total_score")
            .eq("business_id", business_id)
            .order("score_date", desc=True)
            .limit(1)
        )
    ).data
    weekly_change = round(
        score["total_score"] - prev_history[0]["total_score"], 2
    ) if prev_history else 0.0

    # 경쟁사 단일 스캔으로 competitor_scores 계산
    competitors = (
        await execute(
            supabase.table("competitors")
            .select("id, name")
            .eq("business_id", business_id)
            .eq("is_active", True)
        )
    ).data or []
    competitor_scores: dict = {}
    if competitors:
        try:
            gemini = GeminiScanner()
            comp_results = await _asyncio.gather(
                *[gemini.single_check(query, c["name"]) for c in competitors],
                return_exceptions=True,
            )
            for comp, result in zip(competitors, comp_results):
                if isinstance(result, Exception):
                    continue
                competitor_scores[comp["id"]] = {
                    "name": comp["name"],
                    "mentioned": result.get("mentioned", False),
                    "score": 45 if result.get("mentioned") else 15,
                }
        except Exception:
            pass

    # scan_results 저장
    inserted = (await execute(supabase.table("scan_results").insert({
        "business_id": business_id,
        "query_used": query,
        "gemini_result":     results.get("gemini"),
        "chatgpt_result":    results.get("chatgpt"),
        "perplexity_result": results.get("perplexity"),
        "grok_result":       results.get("grok"),
        "naver_result":      results.get("naver"),
        "claude_result":     results.get("claude"),
        "zeta_result":       results.get("zeta"),
        "google_result":     results.get("google"),
        "exposure_freq": (results.get("gemini") or {}).get("exposure_freq", 0),
        "total_score": score["total_score"],
        "score_breakdown": score["breakdown"],
        "competitor_scores": competitor_scores or None,
    }))).data

    # ai_citations 저장 (언급된 플랫폼만)
    if inserted and inserted[0]:
        new_scan_id = inserted[0]["id"]
        citation_rows = []
        for key, label in _PLATFORM_LABELS.items():
            r = results.get(key) or {}
            if r.get("mentioned"):
                citation_rows.append({
                    "scan_id": new_scan_id,
                    "business_id": business_id,
                    "platform": label,
                    "query": query,
                    "mentioned": True,
                    "excerpt": (r.get("excerpt") or r.get("content") or "")[:500],
                })
        if citation_rows:
            try:
                await execute(supabase.table("ai_citations").insert(citation_rows))
            except Exception as e:
                _logger.warning(f"ai_citations insert failed (biz={business_id}): {e}")

    # keyword_diversity 업데이트 (keywords 중 AI 결과에서 언급된 비율)
    try:
        keywords = (biz or {}).get("keywords") or []
        if keywords:
            all_text = " ".join(
                str((results.get(p) or {}).get("excerpt") or "") +
                str((results.get(p) or {}).get("content") or "")
                for p in _PLATFORM_LABELS
            ).lower()
            matched = sum(1 for kw in keywords if kw.lower() in all_text)
            diversity = round(matched / len(keywords), 2)
            await execute(supabase.table("businesses").update({"keyword_diversity": diversity}).eq("id", business_id))
    except Exception as e:
        _logger.warning(f"keyword_diversity update failed (biz={business_id}): {e}")

    # score_history upsert
    try:
        await execute(
            supabase.table("score_history").upsert(
                {
                    "business_id": business_id,
                    "score_date": str(_date.today()),
                    "total_score": score["total_score"],
                    "exposure_freq": (results.get("gemini") or {}).get("exposure_freq", 0),
                    "rank_in_category": 0,
                    "total_in_category": 0,
                    "weekly_change": weekly_change,
                },
                on_conflict="business_id,score_date",
            )
        )
    except Exception as e:
        _logger.warning(f"score_history upsert failed (biz={business_id}): {e}")

    # rank_in_category 계산 (score_history upsert 후)
    try:
        if biz:
            same_cat_biz_ids = [
                b["id"] for b in (
                    await execute(
                        supabase.table("businesses")
                        .select("id")
                        .eq("category", biz.get("category", ""))
                        .eq("is_active", True)
                    )
                ).data or []
            ]
            if same_cat_biz_ids:
                cat_today = (
                    await execute(
                        supabase.table("score_history")
                        .select("total_score")
                        .in_("business_id", same_cat_biz_ids)
                        .eq("score_date", str(_date.today()))
                    )
                ).data or []
                total_in_category = len(cat_today)
                my_score_val = score["total_score"]
                rank_in_category = sum(1 for r in cat_today if r["total_score"] > my_score_val) + 1
                await execute(
                    supabase.table("score_history").update({
                        "rank_in_category": rank_in_category,
                        "total_in_category": total_in_category,
                    }).eq("business_id", business_id).eq("score_date", str(_date.today()))
                )
    except Exception:
        pass

    # 스캔 완료 즉시 카카오톡 알림 (kakao_scan_notify 설정 ON + 전화번호 있는 경우만)
    try:
        biz_user_id = (biz or {}).get("user_id")
        if biz_user_id:
            profile = (
                await execute(
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("id", biz_user_id)
                    .maybe_single()
                )
            ).data
            phone = (profile or {}).get("phone")
            notify_on = (profile or {}).get("kakao_scan_notify", True)
            if phone and notify_on:
                # 가장 많이 언급된 플랫폼
                mention_platforms = [
                    ("Gemini", (results.get("gemini") or {}).get("mentioned", False)),
                    ("ChatGPT", (results.get("chatgpt") or {}).get("mentioned", False)),
                    ("네이버 AI", (results.get("naver") or {}).get("mentioned", False)),
                    ("Claude", (results.get("claude") or {}).get("mentioned", False)),
                    ("Perplexity", (results.get("perplexity") or {}).get("mentioned", False)),
                ]
                top_platform = next((n for n, m in mention_platforms if m), "없음")
                top_improvement = "개선 가이드 생성을 통해 AI 노출을 높이세요"

                from services.kakao_notify import KakaoNotifier
                notifier = KakaoNotifier()
                import asyncio as _aio
                _aio.create_task(notifier.send_scan_complete(
                    phone=phone,
                    biz_name=(biz or {}).get("name", ""),
                    score=score["total_score"],
                    grade=score["grade"],
                    weekly_change=weekly_change,
                    top_platform=top_platform,
                    top_improvement=top_improvement,
                ))
    except Exception:
        pass


async def _run_full_scan(scan_id: str, req: ScanRequest):
    """백그라운드 전체 스캔 실행"""
    import asyncio as _asyncio
    from datetime import date as _date
    from services.ai_scanner.gemini_scanner import GeminiScanner

    try:
        scanner = MultiAIScanner(mode="full")
        query = f"{req.region} {req.category} 추천"
        if req.keywords:
            query = f"{req.region} {req.keywords[0]}"

        result = await scanner.scan_all(query, req.business_name)

        supabase = get_client()
        biz = (await execute(supabase.table("businesses").select("*").eq("id", req.business_id).single())).data
        score = calculate_score(result, biz or {})

        # weekly_change 계산 (이전 score_history 기준)
        prev_history = (
            await execute(
                supabase.table("score_history")
                .select("total_score")
                .eq("business_id", req.business_id)
                .order("score_date", desc=True)
                .limit(1)
            )
        ).data
        weekly_change = round(
            score["total_score"] - prev_history[0]["total_score"], 2
        ) if prev_history else 0.0

        # 경쟁사 단일 스캔으로 competitor_scores 계산
        competitors = (
            await execute(
                supabase.table("competitors")
                .select("id, name")
                .eq("business_id", req.business_id)
                .eq("is_active", True)
            )
        ).data or []
        competitor_scores: dict = {}
        if competitors:
            try:
                gemini = GeminiScanner()
                comp_results = await _asyncio.gather(
                    *[gemini.single_check(query, c["name"]) for c in competitors],
                    return_exceptions=True,
                )
                for comp, r in zip(competitors, comp_results):
                    if isinstance(r, Exception):
                        continue
                    competitor_scores[comp["id"]] = {
                        "name": comp["name"],
                        "mentioned": r.get("mentioned", False),
                        "score": 45 if r.get("mentioned") else 15,
                    }
            except Exception:
                pass

        await execute(
            supabase.table("scan_results").insert(
                {
                    "id": scan_id,
                    "business_id": req.business_id,
                    "query_used": query,
                    "gemini_result": result.get("gemini"),
                    "chatgpt_result": result.get("chatgpt"),
                    "perplexity_result": result.get("perplexity"),
                    "grok_result": result.get("grok"),
                    "naver_result": result.get("naver"),
                    "claude_result": result.get("claude"),
                    "zeta_result": result.get("zeta"),
                    "google_result": result.get("google"),
                    "exposure_freq": result.get("gemini", {}).get("exposure_freq", 0),
                    "total_score": score["total_score"],
                    "score_breakdown": score["breakdown"],
                    "competitor_scores": competitor_scores or None,
                }
            )
        )

        # ai_citations 저장
        citation_rows = []
        for key, label in _PLATFORM_LABELS.items():
            r = result.get(key) or {}
            if r.get("mentioned"):
                citation_rows.append({
                    "scan_id": scan_id,
                    "business_id": req.business_id,
                    "platform": label,
                    "query": query,
                    "mentioned": True,
                    "excerpt": (r.get("excerpt") or r.get("content") or "")[:500],
                })
        if citation_rows:
            try:
                await execute(supabase.table("ai_citations").insert(citation_rows))
            except Exception as e:
                _logger.warning(f"ai_citations insert failed (biz={req.business_id}): {e}")

        # keyword_diversity 업데이트
        try:
            keywords = (biz or {}).get("keywords") or []
            if keywords:
                all_text = " ".join(
                    str((result.get(p) or {}).get("excerpt") or "") +
                    str((result.get(p) or {}).get("content") or "")
                    for p in _PLATFORM_LABELS
                ).lower()
                matched = sum(1 for kw in keywords if kw.lower() in all_text)
                diversity = round(matched / len(keywords), 2)
                await execute(supabase.table("businesses").update({"keyword_diversity": diversity}).eq("id", req.business_id))
        except Exception as e:
            _logger.warning(f"keyword_diversity update failed (biz={req.business_id}): {e}")

        # score_history 저장 (30일 추세용)
        try:
            await execute(
                supabase.table("score_history").upsert({
                    "business_id": req.business_id,
                    "score_date": str(_date.today()),
                    "total_score": score["total_score"],
                    "exposure_freq": result.get("gemini", {}).get("exposure_freq", 0),
                    "rank_in_category": 0,
                    "total_in_category": 0,
                    "weekly_change": weekly_change,
                }, on_conflict="business_id,score_date")
            )

            # rank_in_category 계산
            if biz:
                same_cat_biz_ids = [
                    b["id"] for b in (
                        await execute(
                            supabase.table("businesses")
                            .select("id")
                            .eq("category", biz.get("category", ""))
                            .eq("is_active", True)
                        )
                    ).data or []
                ]
                if same_cat_biz_ids:
                    cat_today = (
                        await execute(
                            supabase.table("score_history")
                            .select("total_score")
                            .in_("business_id", same_cat_biz_ids)
                            .eq("score_date", str(_date.today()))
                        )
                    ).data or []
                    total_in_category = len(cat_today)
                    rank_in_category = sum(1 for r in cat_today if r["total_score"] > score["total_score"]) + 1
                    await execute(
                        supabase.table("score_history").update({
                            "rank_in_category": rank_in_category,
                            "total_in_category": total_in_category,
                        }).eq("business_id", req.business_id).eq("score_date", str(_date.today()))
                    )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"score_history save failed: {e}")
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Full scan failed: {e}")
