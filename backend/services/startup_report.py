"""
창업 패키지 리포트 서비스
업종·지역 경쟁 강도 분석 + 진입 전략 가이드 (Claude Sonnet)
"""
import logging
import os
import anthropic
from db.supabase_client import get_client, execute

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

        # 해당 업종·지역 기존 사업장 조회
        biz_res = await execute(
            supabase.table("businesses")
            .select("id, name")
            .eq("category", category)
            .eq("region", region)
            .eq("is_active", True)
        )
        businesses = biz_res.data or []
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
        # 등록 사업장은 있으나 전부 미스캔(scores 비어있음) = "데이터 없음"이지 "기회 있음"이 아님 — 혼동 금지
        no_scan_data = bool(businesses) and not scores
        if no_scan_data:
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

        # Claude로 진입 전략 생성 — 점수 숫자 미포함(strategy 텍스트에 노출 방지)
        from services.score_engine import get_briefing_eligibility
        eligibility = get_briefing_eligibility(category, False)
        briefing_note = {
            "active": "이 업종은 네이버 AI 브리핑(플레이스형) 대상입니다.",
            "likely": "이 업종은 네이버 AI 브리핑(플레이스형) 확대 예정 업종으로, 아직 전면 대상은 아닙니다.",
            "inactive": "이 업종은 네이버 AI 브리핑(플레이스형) 비대상입니다 — 'AI 브리핑 노출'을 핵심 전략으로 제안하지 말 것. 정보형(블로그·콘텐츠)·ChatGPT·Gemini·Google 노출 전략 위주로 제안할 것. 프랜차이즈로 창업하는 경우도 동일하게 비대상.",
        }.get(eligibility, "")
        top_names = ", ".join(c["name"] for c in top_competitors[:3]) if top_competitors else "데이터 없음"

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

        prompt = f"""한국 {region} {category} 업종 창업 분석:

- 기존 사업장 수: {competitor_count}개
- 경쟁 강도: {competition_level}
- 상위 경쟁사: {top_names}
- {briefing_note}{trend_line}
{"- 창업 예정 사업장명: " + business_name if business_name else ""}

위 데이터를 바탕으로 아래 형식으로 창업 전략을 JSON으로 제공해줘:
{{
  "entry_strategy": "3~4문장 진입 전략 요약",
  "key_actions": ["핵심 액션 1", "핵심 액션 2", "핵심 액션 3"],
  "ai_optimization_tips": ["AI 노출 최적화 팁 1", "팁 2", "팁 3"],
  "risk_factors": ["주의사항 1", "주의사항 2"],
  "estimated_time_to_visibility": "AI 검색 노출까지 예상 기간 (예: 2~3개월)"
}}"""

        msg = await self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3200,
            messages=[{"role": "user", "content": prompt}],
        )
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
            "search_trend": {
                "trend_direction": search_trend.get("trend_direction", "stable"),
                "trend_delta": search_trend.get("trend_delta", 0.0),
                "trend_data": search_trend.get("trend_data", []),
                "keywords_used": search_trend.get("keywords_used", []),
                "available": bool(search_trend.get("trend_data")),
            } if search_trend else {"available": False},
        }
