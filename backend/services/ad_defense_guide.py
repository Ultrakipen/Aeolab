"""
ChatGPT 광고 한국 도입 대응 가이드 생성 서비스
ChatGPT SearchGPT 광고 모델에 대비하는 유기적 AI 노출 전략 (Claude Sonnet)
"""
import os
import anthropic


class AdDefenseGuideService:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

    async def generate(self, biz: dict, scan_result: dict) -> dict:
        """ChatGPT 광고 대응 가이드 생성"""
        score = scan_result.get("total_score", 0)
        chatgpt_result = scan_result.get("chatgpt_result") or {}
        chatgpt_mentioned = chatgpt_result.get("mentioned", False)
        gemini_result = scan_result.get("gemini_result") or {}
        exposure_freq = gemini_result.get("exposure_freq", 0)

        prompt = f"""당신은 한국 AI 검색 광고 전략 전문가입니다.

사업장 정보:
- 이름: {biz.get('name')}
- 업종: {biz.get('category')}
- 지역: {biz.get('region')}
- 현재 AI Visibility Score: {score}점
- ChatGPT 현재 언급 여부: {"언급됨" if chatgpt_mentioned else "미언급"}
- Gemini 100회 샘플링 노출 빈도: {exposure_freq}회

ChatGPT가 한국에 광고 모델(SearchGPT Ads)을 도입할 경우를 대비하여,
유기적(Organic) AI 검색 노출을 강화하는 전략을 아래 JSON 형식으로 제공해줘:

{{
  "situation_summary": "현재 상황 2문장 요약",
  "risk_level": "low/medium/high",
  "organic_strategies": [
    {{"title": "전략명", "description": "상세 설명", "priority": "high/medium/low"}},
    ...
  ],
  "content_actions": ["즉시 실행 콘텐츠 액션 1", "액션 2", "액션 3"],
  "schema_recommendations": ["Schema.org 적용 권장사항 1", "권장사항 2"],
  "timeline": "단기(1개월)/중기(3개월)/장기(6개월) 실행 로드맵 요약"
}}

organic_strategies는 5개, 소상공인이 직접 실행 가능한 것 위주로."""

        msg = await self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()

        import json, re
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        guide = json.loads(json_match.group()) if json_match else {"situation_summary": raw}

        return {
            "business_id": biz.get("id"),
            "business_name": biz.get("name"),
            "guide": guide,
            "current_score": score,
            "chatgpt_mentioned": chatgpt_mentioned,
            "exposure_freq": exposure_freq,
        }
