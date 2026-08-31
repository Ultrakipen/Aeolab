"""
창업 패키지 리포트 서비스
업종·지역 경쟁 강도 분석 + 진입 전략 가이드 (Claude Sonnet)
"""
import logging
import os
import anthropic
from db.supabase_client import get_client, execute
from utils.region_match import region_matches
from services.ai_usage_logger import log_ai_usage

logger = logging.getLogger(__name__)

# AsyncAnthropic 클라이언트 재사용 — StartupReportService가 요청마다 새로
# 인스턴스화되면서(startup.py:59) 매번 클라이언트도 새로 만들어 커넥션 재사용을
# 못했음. 모듈 레벨 싱글턴으로 전환(2026-07-15).
_ai_client: anthropic.AsyncAnthropic | None = None


def _get_ai_client() -> anthropic.AsyncAnthropic:
    global _ai_client
    if _ai_client is None:
        _ai_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    return _ai_client


class StartupReportService:
    def __init__(self):
        self.client = _get_ai_client()

    async def generate(self, category: str, region: str, business_name: str = "") -> dict:
        """창업 패키지 리포트 생성"""
        supabase = get_client()

        # 해당 업종 기존 사업장 조회 — region은 자유 입력이라 category만 DB에서 필터하고
        # region_matches()로 표기 차이(서울 강남/강남구 등)를 흡수 (get_market_overview/
        # get_timing_index와 동일 기준 공유, startup.py 참조)
        biz_res = await execute(
            supabase.table("businesses")
            .select("id, name, region")
            .eq("category", category)
            .eq("is_active", True)
        )
        businesses = [
            b for b in (biz_res.data or [])
            if region_matches(b.get("region") or "", region)
        ]
        competitor_count = len(businesses)

        avg_score = 0.0
        top_competitors = []
        scores: list[float] = []

        if businesses:
            # competitor_count가 전체 모집단을 기준으로 표시되므로 평균도 동일 모집단으로
            # 계산해야 함 — 앞 N개만 샘플링하면 "N개 중 평균"인데 "전체 평균"인 것처럼 보임
            biz_ids = [b["id"] for b in businesses]
            biz_name_map = {b["id"]: b["name"] for b in businesses}

            # N+1 제거 — 단일 IN 쿼리로 최신 스캔 일괄 조회
            scans_res = await execute(
                supabase.table("scan_results")
                .select("business_id, total_score, exposure_freq, scanned_at")
                .in_("business_id", biz_ids)
                .order("scanned_at", desc=True)
            )
            seen: dict = {}
            for s in (scans_res.data or []):
                bid = s.get("business_id")
                if bid not in seen and s.get("total_score") is not None:
                    seen[bid] = s

            for bid, s in seen.items():
                scores.append(s["total_score"])
                top_competitors.append({
                    "name": biz_name_map.get(bid, ""),
                    "score": s["total_score"],
                    "exposure_freq": s.get("exposure_freq") or 0,
                })

            if scores:
                avg_score = round(sum(scores) / len(scores), 1)
            top_competitors.sort(key=lambda x: x["score"], reverse=True)

        # 경쟁 강도 등급 (낮을수록 진입 유리)
        # 등록 사업장이 0건 = "데이터 없음"이지 "기회 있음"이 아님 — /market, /timing과 동일
        # 기준 적용(2026-07-15 발견: 이 분기가 없어 count=0일 때 else로 떨어져 "기회 있음"
        # 녹색 라벨이 표시되고, 같은 리포트의 timing 섹션은 "데이터 수집 중"이라 자기모순 발생)
        no_business_data = not businesses
        # 등록 사업장은 있으나 전부 미스캔(scores 비어있음) = "데이터 없음"이지 "기회 있음"이 아님 — 혼동 금지
        no_scan_data = bool(businesses) and not scores
        if no_business_data:
            competition_level = "데이터 수집 중"
            level_color = "gray"
            level_score = 0
        elif no_scan_data:
            competition_level = "측정 데이터 부족"
            level_color = "gray"
            level_score = 0
        elif avg_score >= 70:
            competition_level = "매우 치열"
            level_color = "red"
            level_score = 1
        elif avg_score >= 55:
            competition_level = "치열"
            level_color = "orange"
            level_score = 2
        elif avg_score >= 40:
            competition_level = "보통"
            level_color = "yellow"
            level_score = 3
        else:
            competition_level = "기회 있음"
            level_color = "green"
            level_score = 4

        # 네이버 DataLab 실측 검색 트렌드 조회 (graceful — 실패해도 리포트 전체 중단 안 함)
        search_trend: dict = {}
        try:
            from services.naver_datalab import get_datalab_client
            dl_client = get_datalab_client()
            search_trend = await dl_client.get_trend_with_cache(category, region, supabase)
            if search_trend.get("error"):
                logger.warning(f"startup DataLab 트렌드 오류 응답: {search_trend.get('error')}")
                search_trend = {}
        except Exception as _e:
            logger.warning(f"startup DataLab 조회 실패 (graceful): {_e}")

        # 실제 시장 밀도(카카오 total_count 기준) — AEOlab 가입 사업장 수(competitor_count)와
        # 무관하게 항상 실측값을 반환. 등록 사업장이 0건이라도 "데이터 없음"으로 끝내지 않고
        # 실제 시장 규모를 보여주기 위함(2026-08-30). graceful — 실패해도 리포트 중단 안 함.
        real_market: dict = {"available": False, "total_count": 0, "samples": []}
        try:
            from services.local_search import get_market_density
            real_market = await get_market_density(category, region)
        except Exception as _e:
            logger.warning(f"startup 실제 시장 밀도 조회 실패 (graceful): {_e}")

        # Claude로 진입 전략 생성 — 점수 숫자 미포함(strategy 텍스트에 노출 방지)
        from services.score_engine import get_briefing_eligibility
        eligibility = get_briefing_eligibility(category, False)
        briefing_note = {
            "active": "이 업종은 네이버 AI 브리핑(플레이스형) 대상입니다.",
            "likely": "이 업종은 네이버 AI 브리핑(플레이스형) 확대 예정 업종으로, 아직 전면 대상은 아닙니다.",
            "inactive": "이 업종은 네이버 AI 브리핑(플레이스형) 비대상입니다 — 'AI 브리핑 노출'을 핵심 전략으로 제안하지 말 것. 정보형(블로그·콘텐츠)·ChatGPT·Gemini·Google 노출 전략 위주로 제안할 것. 프랜차이즈로 창업하는 경우도 동일하게 비대상.",
        }.get(eligibility, "")
        # AI 검색 노출 예상 기간은 Claude에게 자유 생성시키지 않고 CLAUDE.md에 정리된
        # 실측/공식 근거 기준(네이버 AI브리핑·AI탭 2~4주 추정, ChatGPT·Gemini 수개월~1년 등)으로
        # 백엔드에서 결정론적으로 산정 — 2026-08-31 실측: 근거 없이 자유 생성시켰더니 Claude가
        # "3~5개월"처럼 앱 자체 기준(2~4주)과 4~10배 차이나는 수치를 지어낸 것을 발견해 수정
        # (AI 생성 콘텐츠 사실 지어내기 금지 원칙, git fd946a9~501b37e와 동일 패턴의 재발).
        exposure_timeline = {
            "active": "네이버 AI 브리핑(플레이스형)은 스마트플레이스 등록 후 약 2~4주 내 노출 시작(추정, 네이버 미공개) — 안정적으로 자주 인용되려면 리뷰·콘텐츠가 쌓이는 수개월이 더 걸릴 수 있습니다. ChatGPT·Gemini는 학습 데이터 기반이라 수개월~1년 소요됩니다.",
            "likely": "이 업종은 네이버 AI 브리핑(플레이스형) 확대 예정 업종이라 정확한 노출 시점은 미정입니다. 정보형(블로그·콘텐츠)과 Google AI Overview는 콘텐츠 등록 후 약 2~4주 내 반영 시작, ChatGPT·Gemini는 학습 데이터 기반이라 수개월~1년 소요됩니다.",
            "inactive": "이 업종은 네이버 AI 브리핑(플레이스형) 비대상입니다. 정보형(블로그·콘텐츠)과 Google AI Overview는 콘텐츠 등록 후 약 2~4주 내 반영 시작, ChatGPT·Gemini는 학습 데이터 기반이라 수개월~1년 소요됩니다.",
        }.get(eligibility, "채널별로 노출까지 걸리는 기간이 다릅니다 — 네이버는 콘텐츠 등록 후 2~4주 내 반영 시작, ChatGPT·Gemini는 학습 데이터 기반이라 수개월~1년 소요됩니다.")
        top_names = ", ".join(c["name"] for c in top_competitors[:3]) if top_competitors else "데이터 없음"
        data_caveat = (
            "\n- 참고: 위 경쟁 강도는 AEOlab에 가입한 사업장 기준이며, 등록 사업장이 아직 없어"
            " 실제 시장 경쟁 여부를 판단할 근거가 부족합니다. '경쟁이 없다/기회다'라고 단정하지 말고,"
            " 데이터가 부족하다는 점을 전제로 일반적인 진입 전략을 제시할 것."
            if no_business_data else ""
        )

        # 트렌드 데이터가 있을 때만 프롬프트에 삽입 (빈 경우 "안정 +0.0%" 같은 무의미 문구 방지)
        trend_line = ""
        if search_trend.get("trend_data"):
            direction_label = {"rising": "상승세", "falling": "하락세", "stable": "안정"}.get(
                search_trend.get("trend_direction", "stable"), "안정"
            )
            delta = search_trend.get("trend_delta", 0.0)
            kws = ", ".join(search_trend.get("keywords_used", [])[:3])
            trend_line = (
                f"\n- 네이버 검색 수요(최근 3개월): {direction_label}"
                f" ({delta:+.1f}% 변화) [측정 키워드: {kws}]"
            )

        # AEOlab 가입 사업장(competitor_count)이 적거나 0이어도, 실측 기준 실제 시장
        # 규모를 Claude에게 알려줘 "경쟁이 없다"는 성급한 결론을 방지
        real_market_line = ""
        if real_market.get("available"):
            real_names = ", ".join(s["name"] for s in real_market.get("samples", [])[:3])
            source_label = "국세청 사업자등록 기반 실측" if real_market.get("source") == "sbiz" else "카카오맵 실측"
            radius_km = real_market.get("radius_m", 0) / 1000
            radius_note = (
                f"(입력 지역 중심 반경 {radius_km:g}km 기준 — 행정구역 전체 수치가 아니므로 절대 규모로 단정하지 말 것)"
                if real_market.get("source") == "sbiz" else ""
            )
            real_market_line = (
                f"\n- 실제 시장 규모({source_label}, AEOlab 가입 여부와 무관): 약 {real_market['total_count']}개{radius_note}"
                + (f" [예시: {real_names}]" if real_names else "")
            )

        from services.schema_generator import CATEGORY_KO
        category_ko = CATEGORY_KO.get(category, category)
        prompt = f"""한국 {region} {category_ko} 업종 창업 분석:

- 기존 사업장 수(AEOlab 가입 기준): {competitor_count}개
- 경쟁 강도(AEOlab 가입 사업장 기준): {competition_level}
- 상위 경쟁사: {top_names}
- {briefing_note}{trend_line}{real_market_line}{data_caveat}
{"- 창업 예정 사업장명: " + business_name if business_name else ""}
- 중요: 임대료·평당 시세·인건비·손익분기점 개월 수 등 위에 제공되지 않은 구체적 비용·재무 수치는
  절대 지어내지 말 것. 비용 관련 조언이 필요하면 "목표 상권 인근 부동산·상권분석 서비스에 직접
  확인하세요" 같은 일반 안내로 대체할 것 (AEOlab은 실측 비용 데이터를 보유하지 않음).

위 데이터를 바탕으로 아래 형식으로 창업 전략을 JSON으로 제공해줘:
{{
  "entry_strategy": "3~4문장 진입 전략 요약",
  "key_actions": ["핵심 액션 1", "핵심 액션 2", "핵심 액션 3"],
  "ai_optimization_tips": ["AI 노출 최적화 팁 1", "팁 2", "팁 3"],
  "risk_factors": ["주의사항 1", "주의사항 2"]
}}"""

        from services.anthropic_retry import create_message_with_retry
        try:
            msg = await create_message_with_retry(
                self.client,
                model="claude-sonnet-4-6",
                max_tokens=3200,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-sonnet-4-6", f"startup_report:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-sonnet-4-6", "startup_report", msg.usage.input_tokens, msg.usage.output_tokens)
        except Exception as _le:
            logger.debug("startup_report usage 로깅 실패(무시): %s", _le)
        raw = msg.content[0].text.strip()

        import json, re
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            try:
                strategy = json.loads(json_match.group())
            except json.JSONDecodeError:
                strategy = None
        else:
            strategy = None
        if strategy is None:
            # 파싱 실패(응답 길이 초과로 JSON이 잘린 경우 등) — 코드펜스만 제거해 원문이라도 읽히게
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw).strip()
            strategy = {"entry_strategy": cleaned}
        # Claude가 프롬프트에서 빠진 필드를 임의로 채워 넣을 가능성까지 차단 — 항상 결정론적 값으로 덮어씀
        strategy["estimated_time_to_visibility"] = exposure_timeline

        return {
            "category": category,
            "region": region,
            "business_name": business_name,
            "competitor_count": competitor_count,
            "avg_competitor_score": avg_score,
            "competition_level": competition_level,
            "competition_level_color": level_color,
            "competition_level_score": level_score,  # 1=치열, 4=기회
            "top_competitors": top_competitors[:5],
            "strategy": strategy,
            # 표본 3개 미만이거나 등록 사업장은 있으나 전부 미스캔이면 "평균"의 대표성이 낮음
            "is_estimated": competitor_count < 3 or no_scan_data,
            "no_scan_data": no_scan_data,
            "real_market": real_market,
            "search_trend": {
                "trend_direction": search_trend.get("trend_direction", "stable"),
                "trend_delta": search_trend.get("trend_delta", 0.0),
                "trend_data": search_trend.get("trend_data", []),
                "keywords_used": search_trend.get("keywords_used", []),
                "available": bool(search_trend.get("trend_data")),
            } if search_trend else {"available": False},
        }
