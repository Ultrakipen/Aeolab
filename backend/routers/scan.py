import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from models.schemas import ScanRequest, TrialScanRequest
from services.ai_scanner.multi_scanner import MultiAIScanner
from services.score_engine import calculate_score
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
import utils.cache as _cache

_logger = logging.getLogger("aeolab")

# 업종 value → 한국어 검색 키워드 매핑
_CATEGORY_KO: dict[str, str] = {
    "restaurant": "음식점", "cafe": "카페", "chicken": "치킨", "bbq": "고기집",
    "seafood": "횟집", "bakery": "베이커리", "bar": "술집", "snack": "분식",
    "delivery": "배달음식", "health_food": "건강식",
    "hospital": "병원", "dental": "치과", "oriental": "한의원", "pharmacy": "약국",
    "skincare": "피부과", "eye": "안과", "mental": "심리상담", "rehab": "물리치료",
    "checkup": "건강검진", "fitness": "헬스장", "yoga": "요가 필라테스", "swimming": "수영장",
    "academy": "학원", "language": "영어학원", "coding": "코딩학원", "daycare": "어린이집",
    "tutoring": "과외", "music_edu": "음악학원", "art_studio": "미술학원",
    "art_edu": "미술공예학원", "sports_edu": "태권도학원", "driving": "운전학원",
    "law": "법률사무소", "tax": "세무회계", "realestate": "부동산", "architecture": "건축설계",
    "insurance": "보험", "it": "IT개발", "design": "디자인", "marketing": "마케팅",
    "photo": "사진관", "photo_wedding": "웨딩 스튜디오", "video": "영상제작",
    "consulting": "컨설팅", "translation": "번역통역", "funeral": "장례",
    "beauty": "미용실", "nail": "네일샵", "makeup": "메이크업", "spa": "마사지 스파",
    "clothing": "의류", "shoes": "신발", "eyewear": "안경", "sportswear": "스포츠웨어",
    "shop": "쇼핑몰", "grocery": "식자재", "electronics": "전자제품", "furniture": "가구",
    "stationery": "문구", "book": "서점", "instrument": "악기", "supplement": "건강식품",
    "baby": "유아용품", "interior": "인테리어", "auto": "자동차정비", "auto_trade": "중고차",
    "laundry": "세탁소", "pet": "반려동물", "vet": "동물병원", "cleaning": "청소대행",
    "moving": "이사", "repair": "가전수리", "locksmith": "열쇠", "flower": "꽃집",
    "funeral_supp": "장례용품", "music_live": "라이브공연", "music_cafe": "뮤직카페",
    "recording": "녹음실", "perform_plan": "공연기획", "instrument_lesson": "악기레슨",
    "karaoke_pro": "노래방", "wedding_hall": "웨딩홀 예식장", "wedding_plan": "웨딩플래너",
    "event_plan": "이벤트 행사기획", "party_room": "파티룸", "catering": "케이터링",
    "photo_event": "행사 사진촬영", "flower_event": "플라워 꽃장식", "mc_dj": "MC DJ",
    "accommodation": "숙박 펜션", "guesthouse": "게스트하우스", "camping": "캠핑 글램핑",
    "travel": "여행사", "sports": "스포츠 레저", "jjimjil": "찜질방", "entertainment": "노래방 PC방",
    "kids": "키즈카페", "study_cafe": "스터디카페", "workshop": "공방 클래스",
    "culture": "공연 전시", "agriculture": "농업", "manufacturing": "제조", "other": "",
}

_PLATFORM_LABELS = {
    "gemini": "Gemini", "chatgpt": "ChatGPT", "perplexity": "Perplexity",
    "grok": "Grok", "naver": "Naver AI 브리핑", "claude": "Claude",
"google": "Google AI Overview",
}

router = APIRouter()

# ── 무료 체험 IP 레이트 리밋 설정 ─────────────────────────────────────────
_TRIAL_LIMIT_PER_DAY = 3          # IP당 하루 최대 체험 횟수
_TRIAL_WINDOW_SEC    = 86_400     # 24시간

# 관리자 우회: ADMIN_IPS 환경변수 (쉼표 구분) 또는 X-Admin-Key 헤더
_ADMIN_IPS: set[str] = {
    ip.strip()
    for ip in os.getenv("ADMIN_IPS", "127.0.0.1,::1").split(",")
    if ip.strip()
}


def _get_client_ip(request: Request) -> str:
    """실제 클라이언트 IP 추출 (Nginx 리버스 프록시 고려)"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _is_admin_request(request: Request) -> bool:
    """관리자 요청 여부 확인: IP 화이트리스트 또는 Admin 헤더 키 일치"""
    ip = _get_client_ip(request)
    if ip in _ADMIN_IPS:
        return True
    admin_key = request.headers.get("X-Admin-Key", "")
    secret = os.getenv("ADMIN_SECRET_KEY", "")
    if admin_key and secret and secrets.compare_digest(admin_key, secret):
        return True
    return False


def _check_trial_rate_limit(ip: str) -> None:
    """IP 기반 무료 체험 횟수 초과 시 429 반환"""
    key = f"trial_ip:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _TRIAL_LIMIT_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "TRIAL_LIMIT",
                "message": f"하루 {_TRIAL_LIMIT_PER_DAY}회 무료 체험 한도에 도달했습니다. 내일 다시 시도하거나 회원가입 후 이용하세요.",
                "retry_after": _TRIAL_WINDOW_SEC,
            },
        )
    # 첫 요청이면 TTL=24h로 신규 생성, 이후엔 카운트만 증가 (TTL 유지)
    if count == 0:
        _cache.set(key, 1, _TRIAL_WINDOW_SEC)
    else:
        _cache.set(key, count + 1, _TRIAL_WINDOW_SEC)


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
async def trial_scan(req: TrialScanRequest, request: Request, bg: BackgroundTasks):
    """랜딩 무료 체험: Gemini + (location: 네이버+카카오 / non_location: 웹사이트) 병렬 스캔
    도메인 모델 v2.1 § 10.1 — ScanContext별 분기
    """
    import asyncio, hashlib

    if not _is_admin_request(request):
        ip = _get_client_ip(request)
        _check_trial_rate_limit(ip)

    scanner = MultiAIScanner(mode="trial")
    keyword_ko = req.keyword.strip() if req.keyword else _CATEGORY_KO.get(req.category, req.category)
    is_non_location = (req.business_type == "non_location") or not req.region

    if is_non_location:
        query = f"{keyword_ko} 추천"
    else:
        query = f"{req.region} {keyword_ko} 추천"

    # ── context별 병렬 실행 ──────────────────────────────────────────
    if is_non_location:
        # non_location: Gemini + 웹사이트 체크 (naver/kakao 생략)
        coros = [scanner.scan_single(query, req.business_name)]
        if req.website_url:
            from services.website_checker import check_website_seo
            coros.append(check_website_seo(req.website_url))
        else:
            coros.append(asyncio.sleep(0))  # placeholder

        results = await asyncio.gather(*coros, return_exceptions=True)
        ai_result = results[0] if not isinstance(results[0], Exception) else {}
        website_data = results[1] if (req.website_url and not isinstance(results[1], Exception)) else None
        naver_data = None
        kakao_data = None
    else:
        # location_based: Gemini + 네이버 + 카카오
        from services.naver_visibility import get_naver_visibility
        from services.kakao_visibility import get_kakao_visibility

        ai_result, naver_data, kakao_data = await asyncio.gather(
            scanner.scan_single(query, req.business_name),
            get_naver_visibility(req.business_name, keyword_ko, req.region or ""),
            get_kakao_visibility(req.business_name, keyword_ko, req.region or ""),
            return_exceptions=True,
        )
        if isinstance(ai_result, Exception):
            ai_result = {}
        if isinstance(naver_data, Exception):
            naver_data = None
        if isinstance(kakao_data, Exception):
            kakao_data = None
        website_data = None

    # 카카오 결과 병합 (채널 점수 계산용)
    combined_result = {**ai_result}
    if kakao_data:
        combined_result["kakao"] = kakao_data
    if website_data:
        combined_result["website_check"] = website_data

    biz_ctx = {"business_type": req.business_type or "location_based", "website_url": req.website_url}
    score = calculate_score(
        combined_result,
        biz=biz_ctx,
        naver_data=naver_data or {},
        context=req.business_type or "location_based",
    )

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

    # trial_scans DB 저장 (백그라운드)
    async def _save():
        try:
            ip = _get_client_ip(request)
            ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]
            naver = naver_data or {}
            kakao = kakao_data or {}
            ai_mentioned = bool(ai_result.get("gemini", {}).get("mentioned"))
            supabase = get_client()
            await execute(supabase.table("trial_scans").insert({
                "business_name": req.business_name,
                "category": req.category,
                "region": req.region,
                "keyword": keyword_ko,
                "email": req.email,
                "is_smart_place": naver.get("is_smart_place"),
                "naver_rank": naver.get("my_rank"),
                "blog_mentions": naver.get("blog_mentions"),
                "search_query": naver.get("search_query") or query,
                "naver_competitors": naver.get("naver_competitors"),
                "top_competitor_name": naver.get("top_competitor_name"),
                "top_competitor_blog_count": naver.get("top_competitor_blog_count"),
                "kakao_rank": kakao.get("my_rank"),
                "is_on_kakao": kakao.get("is_on_kakao"),
                "kakao_competitors": kakao.get("kakao_competitors"),
                "ai_mentioned": ai_mentioned,
                "total_score": score.get("total_score"),
                "grade": score.get("grade"),
                "score_breakdown": score.get("breakdown"),
                "ip_hash": ip_hash,
            }))
        except Exception as e:
            _logger.warning(f"trial_scans save failed: {e}")
    bg.add_task(_save)

    competitors = ai_result.get("gemini", {}).get("competitors", [])

    # ── v3.0 필드: 키워드 갭 + 성장 단계를 최상위 응답에 노출 ──────────────
    try:
        from services.keyword_taxonomy import get_all_keywords_flat, analyze_keyword_coverage
        all_kws = get_all_keywords_flat(req.category or "restaurant")
        # trial 스캔에서는 리뷰 발췌문 없으므로 빈 리스트로 coverage 분석
        kw_analysis = analyze_keyword_coverage(req.category or "restaurant", [])
        top_missing_keywords = kw_analysis.get("missing", all_kws[:3])[:3]
        pioneer_keywords = kw_analysis.get("pioneer", [])[:2]
    except Exception as _e:
        _logger.warning(f"trial keyword analysis failed: {_e}")
        top_missing_keywords = []
        pioneer_keywords = []

    # FAQ 복사 텍스트 — 업종 1순위 키워드 기반 기본 템플릿
    faq_copy_text = ""
    if top_missing_keywords:
        kw1 = top_missing_keywords[0]
        biz_nm = req.business_name
        faq_copy_text = (
            f"Q: {keyword_ko} 중에서 {kw1}(으)로 유명한 곳인가요?\n"
            f"A: 네, 저희 {biz_nm}은(는) {kw1}을(를) 전문으로 하고 있습니다. "
            "고객님께서 방문하시면 직접 확인하실 수 있습니다."
        )

    return {
        # v3.0 핵심 필드 (프론트엔드 trial/page.tsx에서 직접 참조)
        "track1_score": score.get("track1_score"),
        "track2_score": score.get("track2_score"),
        "unified_score": score.get("unified_score"),
        "naver_weight": score.get("naver_weight"),
        "global_weight": score.get("global_weight"),
        "growth_stage": score.get("growth_stage"),
        "growth_stage_label": score.get("growth_stage_label"),
        "top_missing_keywords": top_missing_keywords,
        "pioneer_keywords": pioneer_keywords,
        "faq_copy_text": faq_copy_text,
        # 기존 필드 (하위호환)
        "score": score,
        "result": ai_result,
        "query": query,
        "competitors": competitors,
        "naver": naver_data,
        "kakao": kakao_data,
        "website_health": website_data,
        "context": req.business_type or "location_based",
        "message": "무료 원샷 체험 결과입니다. 100회 샘플링 전체 분석은 구독 후 이용 가능합니다.",
    }


@router.post("/full")
async def full_scan(req: ScanRequest, bg: BackgroundTasks, user=Depends(get_current_user)):
    """전체 AI 병렬 스캔 (구독자 전용, 백그라운드)"""
    if not req.business_id:
        raise HTTPException(status_code=400, detail="business_id required")

    x_user_id = str(user["id"])
    from middleware.rate_limit import check_monthly_scan_limit
    await check_monthly_scan_limit(x_user_id, get_client())
    from middleware.plan_gate import check_manual_scan_limit
    await check_manual_scan_limit(x_user_id, get_client())

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
    biz = (await execute(supabase.table("businesses").select("id, name, category, region, business_type, website_url, keywords").eq("id", biz_id).single())).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    req = ScanRequest(
        business_name=biz["name"],
        category=biz["category"],
        region=biz.get("region") or "",
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
            from middleware.plan_gate import check_manual_scan_limit
            try:
                await check_manual_scan_limit(user_id, get_client())
            except HTTPException as e:
                yield f"data: {json.dumps({'error': e.detail}, ensure_ascii=False)}\n\n"
                return

            scanner = MultiAIScanner(mode="full")
            scan_results: dict = {}
            async for progress in scanner.scan_with_progress(req, include_perplexity=False):
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
async def get_scan(scan_id: str, user: dict = Depends(get_current_user)):
    """스캔 결과 조회 (인증 + 소유권 검증)"""
    supabase = get_client()
    result = await execute(supabase.table("scan_results").select("id, business_id, scanned_at, query_used, exposure_freq, total_score, score_breakdown, naver_channel_score, global_channel_score, gemini_result, chatgpt_result, perplexity_result, grok_result, naver_result, claude_result, google_result, kakao_result, website_check_result, competitor_scores, rank_in_query").eq("id", scan_id).single())
    if not result.data:
        raise HTTPException(status_code=404, detail="Scan not found")
    # 소유권 검증: scan이 속한 business의 user_id 확인
    biz_check = await execute(supabase.table("businesses").select("user_id").eq("id", result.data["business_id"]).single())
    if not biz_check.data or biz_check.data.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="접근 권한 없음")
    return result.data


async def _save_scan_results(business_id: str, req: ScanRequest, results: dict):
    """스트림 스캔 완료 후 DB 저장 (weekly_change 계산 + competitor_scores 포함)"""
    import asyncio as _asyncio
    from datetime import date as _date
    from services.ai_scanner.gemini_scanner import GeminiScanner
    from services.kakao_visibility import get_kakao_visibility
    from services.website_checker import check_website_seo

    supabase = get_client()
    biz = (await execute(supabase.table("businesses").select("id, name, category, region, business_type, website_url, naver_place_url, keywords, naver_place_id, google_place_id, kakao_place_id, review_count, avg_rating, keyword_diversity, receipt_review_count").eq("id", business_id).single())).data

    # 카카오 가시성 + 웹사이트 SEO 체크 + 스마트플레이스 병렬 실행
    keyword_ko = _CATEGORY_KO.get((biz or {}).get("category", req.category), req.category)
    naver_place_url = (biz or {}).get("naver_place_url", "") or ""
    from services.naver_place_stats import check_smart_place_completeness
    kakao_data, website_check, smart_place_check = await _asyncio.gather(
        get_kakao_visibility(req.business_name, keyword_ko, req.region),
        check_website_seo((biz or {}).get("website_url", "")),
        check_smart_place_completeness(naver_place_url) if naver_place_url else _asyncio.sleep(0),
        return_exceptions=True,
    )
    if isinstance(kakao_data, Exception):
        _logger.warning(f"kakao_visibility failed (stream): {kakao_data}")
        kakao_data = None
    if isinstance(website_check, Exception):
        _logger.warning(f"website_checker failed (stream): {website_check}")
        website_check = None
    if isinstance(smart_place_check, Exception):
        _logger.warning(f"smart_place_completeness failed (stream): {smart_place_check}")
        smart_place_check = None
    elif not naver_place_url:
        smart_place_check = None

    # 카카오·웹사이트 결과를 scan_results에 병합해 채널 점수 계산
    combined_results = {**results, "kakao": kakao_data or {}, "website_check": website_check or {}}
    score = calculate_score(combined_results, biz or {})
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
        except Exception as e:
            _logger.warning(f"competitor_scores scan failed (stream biz={business_id}): {e}")

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
        "google_result":     results.get("google"),
        "kakao_result":      kakao_data or None,
        "website_check_result": website_check or None,
        "exposure_freq": (results.get("gemini") or {}).get("exposure_freq", 0),
        "total_score": score["total_score"],
        "score_breakdown": score["breakdown"],
        "naver_channel_score": score.get("naver_channel_score"),
        "global_channel_score": score.get("global_channel_score"),
        "unified_score": score.get("unified_score"),
        "track1_score": score.get("track1_score"),
        "track2_score": score.get("track2_score"),
        "keyword_coverage": score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100,
        "competitor_scores": competitor_scores or None,
        "smart_place_completeness_result": smart_place_check or None,
    }))).data

    # smart_place_auto_checked_at 업데이트 (스마트플레이스 URL 있는 경우)
    if naver_place_url and smart_place_check and not smart_place_check.get("error"):
        try:
            from datetime import datetime, timezone as _tz
            await execute(
                supabase.table("businesses").update({
                    "smart_place_auto_checked_at": datetime.now(_tz.utc).isoformat(),
                }).eq("id", business_id)
            )
        except Exception as e:
            _logger.warning(f"smart_place_auto_checked_at update failed (stream): {e}")

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
                    "sentiment": r.get("sentiment") or "neutral",
                    "mention_type": r.get("mention_type") or "information",
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
                    "naver_channel_score": score.get("naver_channel_score"),
                    "global_channel_score": score.get("global_channel_score"),
                    "unified_score": score.get("unified_score"),
                    "track1_score": score.get("track1_score"),
                    "track2_score": score.get("track2_score"),
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
    except Exception as e:
        _logger.warning(f"rank_in_category update failed (stream biz={business_id}): {e}")

    # 스캔 완료 즉시 카카오톡 알림 (kakao_scan_notify 설정 ON + 전화번호 있는 경우만)
    try:
        biz_user_id = (biz or {}).get("user_id")
        if biz_user_id:
            profile = (
                await execute(
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("user_id", biz_user_id)
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
    except Exception as e:
        _logger.warning(f"kakao scan_complete notify failed (biz={business_id}): {e}")


async def _run_full_scan(scan_id: str, req: ScanRequest):
    """백그라운드 전체 스캔 실행"""
    import asyncio as _asyncio
    from datetime import date as _date
    from services.ai_scanner.gemini_scanner import GeminiScanner
    from services.kakao_visibility import get_kakao_visibility
    from services.website_checker import check_website_seo

    try:
        scanner = MultiAIScanner(mode="full")
        query = f"{req.region} {req.category} 추천"
        if req.keywords:
            query = f"{req.region} {req.keywords[0]}"

        supabase = get_client()
        biz = (await execute(supabase.table("businesses").select("id, name, category, region, business_type, website_url, naver_place_url, keywords, naver_place_id, google_place_id, kakao_place_id, review_count, avg_rating, keyword_diversity, receipt_review_count").eq("id", req.business_id).single())).data

        # AI 스캔 + 카카오 가시성 + 웹사이트 SEO + 스마트플레이스 병렬 실행
        keyword_ko = _CATEGORY_KO.get(req.category, req.category)
        naver_place_url = (biz or {}).get("naver_place_url", "") or ""
        from services.naver_place_stats import check_smart_place_completeness
        result, kakao_data, website_check, smart_place_check = await _asyncio.gather(
            scanner.scan_all_no_perplexity(query, req.business_name),
            get_kakao_visibility(req.business_name, keyword_ko, req.region),
            check_website_seo((biz or {}).get("website_url", "")),
            check_smart_place_completeness(naver_place_url) if naver_place_url else _asyncio.sleep(0),
            return_exceptions=True,
        )
        if isinstance(result, Exception):
            raise result
        if isinstance(kakao_data, Exception):
            _logger.warning(f"kakao_visibility failed (full): {kakao_data}")
            kakao_data = None
        if isinstance(website_check, Exception):
            _logger.warning(f"website_checker failed (full): {website_check}")
            website_check = None
        if isinstance(smart_place_check, Exception):
            _logger.warning(f"smart_place_completeness failed (full): {smart_place_check}")
            smart_place_check = None
        elif not naver_place_url:
            smart_place_check = None

        # 카카오·웹사이트 결과를 병합해 채널 점수 계산
        combined_result = {**result, "kakao": kakao_data or {}, "website_check": website_check or {}}
        score = calculate_score(combined_result, biz or {})

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
            except Exception as e:
                _logger.warning(f"competitor_scores scan failed (full biz={req.business_id}): {e}")

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
                    "google_result": result.get("google"),
                    "kakao_result": kakao_data or None,
                    "website_check_result": website_check or None,
                    "exposure_freq": result.get("gemini", {}).get("exposure_freq", 0),
                    "total_score": score["total_score"],
                    "score_breakdown": score["breakdown"],
                    "naver_channel_score": score.get("naver_channel_score"),
                    "global_channel_score": score.get("global_channel_score"),
                    "unified_score": score.get("unified_score"),
                    "track1_score": score.get("track1_score"),
                    "track2_score": score.get("track2_score"),
                    "keyword_coverage": score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100,
                    "competitor_scores": competitor_scores or None,
                    "smart_place_completeness_result": smart_place_check or None,
                }
            )
        )

        # smart_place_auto_checked_at 업데이트 (스마트플레이스 URL 있는 경우)
        if naver_place_url and smart_place_check and not smart_place_check.get("error"):
            try:
                from datetime import datetime, timezone as _tz
                await execute(
                    supabase.table("businesses").update({
                        "smart_place_auto_checked_at": datetime.now(_tz.utc).isoformat(),
                    }).eq("id", req.business_id)
                )
            except Exception as e:
                _logger.warning(f"smart_place_auto_checked_at update failed: {e}")

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
                    "sentiment": r.get("sentiment") or "neutral",
                    "mention_type": r.get("mention_type") or "information",
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
                    "naver_channel_score": score.get("naver_channel_score"),
                    "global_channel_score": score.get("global_channel_score"),
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
