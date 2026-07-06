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
        # sample_n() 기반 Basic/Full 스캔 결과엔 "mentioned" 키가 없다 — exposure_freq로 폴백
        # (guide.py:606-607의 chatgpt_mentioned 판정과 동일 패턴)
        chatgpt_mentioned = bool(
            chatgpt_result.get("mentioned")
            or (chatgpt_result.get("exposure_freq", 0) or 0) > 0
        )
        gemini_result = scan_result.get("gemini_result") or {}
        exposure_freq = gemini_result.get("exposure_freq", 0)
        # 스캔 실패 시 gemini_result에 sample_size 키 자체가 없음 — 50으로 기본값을 주면
        # "50회 측정해서 0회 노출"이라는 허위 확신을 프롬프트·응답에 심게 됨
        sample_size = gemini_result.get("sample_size", 0)

        # 약한 영역 상위 3개 추출 (가이드 품질 향상)
        # score_breakdown은 0~100 척도 점수 외에 불리언(google_captcha_blocked)·dict(track1_detail)·
        # 문자열(user_group/model_version) 필드가 섞여 있음. bool은 int 서브클래스라
        # isinstance(v, (int, float))를 통과하므로 명시적으로 제외해야 함.
        _NON_SCORE_KEYS = {"google_captcha_blocked", "track1_detail", "user_group", "model_version"}
        score_breakdown = scan_result.get("score_breakdown") or {}
        weak_areas = sorted(
            [
                (k, v) for k, v in score_breakdown.items()
                if k not in _NON_SCORE_KEYS
                and isinstance(v, (int, float)) and not isinstance(v, bool)
                and v < 50
            ],
            key=lambda x: x[1]
        )[:3]
        weak_areas_text = ", ".join(k for k, _ in weak_areas) if weak_areas else "없음"

        prompt = f"""당신은 한국 AI 검색 광고 전략 전문가입니다.

사업장 정보:
- 이름: {biz.get('name')}
- 업종: {biz.get('category')}
- 지역: {biz.get('region')}
- ChatGPT 현재 언급 여부: {"언급됨" if chatgpt_mentioned else "미언급"}
- Gemini 노출 측정: {f"{sample_size}회 샘플링 중 {exposure_freq}회 노출" if sample_size > 0 else "이번 스캔에서 측정 실패(데이터 없음)"}
- 개선이 필요한 영역: {weak_areas_text}

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
            "sample_size": sample_size,
        }
