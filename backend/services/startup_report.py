"""
창업 패키지 리포트 서비스
업종·지역 경쟁 강도 분석 + 진입 전략 가이드 (Claude Sonnet)
"""
import asyncio
import os
import anthropic
from db.supabase_client import get_client


class StartupReportService:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

    async def generate(self, category: str, region: str, business_name: str = "") -> dict:
        """창업 패키지 리포트 생성"""
        supabase = get_client()

        # 해당 업종·지역 기존 사업장 평균 점수 조회
        businesses = (
            supabase.table("businesses")
            .select("id, name")
            .eq("category", category)
            .eq("region", region)
            .eq("is_active", True)
            .execute()
            .data or []
        )

        avg_score = 0.0
        top_competitors = []
        competitor_count = len(businesses)

        if businesses:
            scores = []
            for biz in businesses[:10]:
                scan = (
                    supabase.table("scan_results")
                    .select("total_score, exposure_freq, scanned_at")
                    .eq("business_id", biz["id"])
                    .order("scanned_at", desc=True)
                    .limit(1)
                    .execute()
                    .data
                )
                if scan:
                    scores.append(scan[0]["total_score"])
                    top_competitors.append({
                        "name": biz["name"],
                        "score": scan[0]["total_score"],
                        "exposure_freq": scan[0]["exposure_freq"],
                    })
            if scores:
                avg_score = round(sum(scores) / len(scores), 1)
            top_competitors.sort(key=lambda x: x["score"], reverse=True)

        # 경쟁 강도 등급 (낮을수록 진입 유리)
        if avg_score >= 70:
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

        # Claude로 진입 전략 생성
        top_names = ", ".join(c["name"] for c in top_competitors[:3]) if top_competitors else "데이터 없음"
        prompt = f"""한국 {region} {category} 업종 창업 분석:

- 기존 사업장 수: {competitor_count}개
- AI 검색 노출 평균 점수: {avg_score}점/100점
- 경쟁 강도: {competition_level}
- 상위 경쟁사: {top_names}
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
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()

        import json, re
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        strategy = json.loads(json_match.group()) if json_match else {"entry_strategy": raw}

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
        }
