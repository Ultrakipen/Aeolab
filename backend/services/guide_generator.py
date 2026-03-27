import os
import json
import re
import asyncio
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """당신은 한국 소상공인의 AI 검색 노출을 개선하는 전문 컨설턴트입니다.
소상공인 사장님이 이해하기 쉬운 말로, 즉시 실행 가능한 개선 방법을 제시합니다.
기술 용어는 최소화하고, 구체적인 행동 지침을 제공합니다.
응답은 반드시 JSON 형식으로만 출력하세요."""


class GuideGenerator:
    def __init__(self):
        self.client = client

    async def generate(self, biz: dict, score_data: dict, competitor_data: list) -> dict:
        """Claude Sonnet으로 한국어 AI 노출 개선 가이드 생성"""
        prompt = self._build_prompt(biz, score_data, competitor_data)
        raw = await asyncio.to_thread(self._call_claude, prompt)
        return self._parse_response(raw)

    def _call_claude(self, user_prompt: str) -> str:
        message = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return message.content[0].text

    def _build_prompt(self, biz: dict, scan_result: dict, competitor_data: list) -> str:
        my_score = scan_result.get("total_score", 0)
        my_freq = scan_result.get("exposure_freq", 0)
        top_comp = sorted(competitor_data, key=lambda x: x.get("score", 0), reverse=True)[:3]
        breakdown = scan_result.get("breakdown", scan_result.get("score_breakdown", {}))

        return f"""다음 사업장의 AI 검색 최적화 개선 가이드를 생성해주세요.

## 사업장 정보
- 상호명: {biz.get('name', '')}
- 업종: {biz.get('category', '')}
- 지역: {biz.get('region', '')}
- 등록 키워드: {', '.join(biz.get('keywords') or [])}
- 웹사이트: {'있음' if biz.get('website_url') else '없음'}
- 리뷰 수: {biz.get('review_count', 0)}개 / 평점: {biz.get('avg_rating', 0)}

## AI 스캔 결과
- 현재 AI 노출 빈도: {my_freq}/100회 ({my_score:.1f}점)
- ChatGPT 노출: {'있음' if (scan_result.get('chatgpt_result') or {}).get('mentioned') else '없음'}
- Perplexity 노출: {'있음' if (scan_result.get('perplexity_result') or {}).get('mentioned') else '없음'}

## 항목별 점수
- AI 노출 빈도: {breakdown.get('exposure_freq', 0)}/100
- 리뷰 품질: {breakdown.get('review_quality', 0):.1f}/100
- Schema 구조화: {breakdown.get('schema_score', 0)}/100
- 온라인 언급: {breakdown.get('online_mentions', 0)}/100
- 정보 완성도: {breakdown.get('info_completeness', 0):.1f}/100
- 콘텐츠 최신성: {breakdown.get('content_freshness', 0)}/100

## 상위 경쟁사 현황
{chr(10).join([f"- {c['name']}: {c.get('score', 0):.1f}점 (노출 {c.get('exposure_freq', 0)}회/100)" for c in top_comp])}

## 요청
위 데이터를 분석해서 아래 JSON 형식으로 개선 가이드를 제공해주세요.
각 항목은 이번 주 내에 실행 가능한 구체적 행동이어야 합니다.

{{
  "summary": "3줄 이내 현황 요약",
  "priority_items": [
    {{
      "rank": 1,
      "category": "리뷰/키워드/Schema/콘텐츠/정보완성도 중 하나",
      "title": "개선 항목 제목 (20자 이내)",
      "action": "구체적 실행 방법 (사장님 관점으로 2~3문장)",
      "expected_effect": "이렇게 하면 AI 노출 빈도 +N% 예상",
      "difficulty": "easy/medium/hard",
      "time_required": "예: 10분",
      "competitor_example": "잘 되는 경쟁 가게의 실제 사례 (있을 경우)"
    }}
  ],
  "quick_wins": ["지금 당장 할 수 있는 것 3가지"],
  "next_month_goal": "한 달 후 목표 노출 빈도"
}}"""

    def _parse_response(self, text: str) -> dict:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
        return {"summary": text, "priority_items": [], "quick_wins": []}


async def generate_improvement_guide(biz: dict, scan_result: dict, competitor_data: list) -> dict:
    """모듈 레벨 함수 (routers/guide.py 에서 직접 호출 가능)"""
    return await GuideGenerator().generate(biz, scan_result, competitor_data)
