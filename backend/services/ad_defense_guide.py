"""
ChatGPT 광고 한국 도입 대응 가이드 생성 서비스
ChatGPT 광고(ChatGPT Ads) 확대 대응 — 유기적 AI 노출 전략 (Claude Sonnet)
"""
import os
import anthropic

# AsyncAnthropic 클라이언트 재사용 — AdDefenseGuideService가 요청마다 새로
# 인스턴스화되면서(guide.py:637) 매번 클라이언트도 새로 만들어 커넥션 재사용을
# 못했음. 모듈 레벨 싱글턴으로 전환(2026-07-15).
_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    return _client


class AdDefenseGuideService:
    def __init__(self):
        self.client = _get_client()

    async def generate(
        self,
        biz: dict,
        scan_result: dict,
        briefing_eligibility: str = "inactive",
        competitor_names: list[str] | None = None,
        gap_keywords: list[str] | None = None,
    ) -> dict:
        """ChatGPT 광고 대응 가이드 생성"""
        score = scan_result.get("total_score", 0)
        chatgpt_result = scan_result.get("chatgpt_result") or {}
        # sample_n() 기반 Basic/Full 스캔 결과엔 "mentioned" 키가 없다 — exposure_freq로 폴백
        # (guide.py:606-607의 chatgpt_mentioned 판정과 동일 패턴)
        chatgpt_mentioned = bool(
            chatgpt_result.get("mentioned")
            or (chatgpt_result.get("exposure_freq", 0) or 0) > 0
        )
        # 네이버·Gemini와 동일하게 스캔 자체 실패(error)를 "미언급 확정"과 구분 (guide.py:604와 동일 패턴)
        chatgpt_measured = not bool(chatgpt_result.get("error"))
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

        briefing_note = {
            "active": "네이버 AI 브리핑(플레이스형) 대상 업종입니다.",
            "likely": "네이버 AI 브리핑(플레이스형) 확대 예정 업종으로, 아직 전면 대상은 아닙니다.",
            "inactive": "네이버 AI 브리핑(플레이스형) 비대상 업종/가맹점입니다 — '네이버 AI 브리핑 노출'을 전략으로 제안하지 말 것. 정보형(블로그·콘텐츠 출처)과 ChatGPT·Gemini·Google 노출 전략만 제안할 것.",
        }.get(briefing_eligibility, "")

        _comp_line = (
            f"- 주요 경쟁사: {', '.join(competitor_names)}"
            if competitor_names
            else "- 주요 경쟁사: 미등록"
        )
        _gap_line = (
            f"- 미확보 키워드(경쟁사 대비 부족): {', '.join(gap_keywords)}"
            if gap_keywords
            else "- 미확보 키워드: 데이터 없음"
        )

        prompt = f"""당신은 한국 AI 검색 광고 전략 전문가입니다.

사업장 정보:
- 이름: {biz.get('name')}
- 업종: {biz.get('category')}
- 지역: {biz.get('region')}
- {briefing_note}
- ChatGPT 현재 언급 여부: {"측정 실패(데이터 없음)" if not chatgpt_measured else ("언급됨" if chatgpt_mentioned else "미언급")}
- Gemini 노출 측정: {f"{sample_size}회 샘플링 중 {exposure_freq}회 노출" if sample_size > 0 else "이번 스캔에서 측정 실패(데이터 없음)"}
- 개선이 필요한 영역: {weak_areas_text}
{_comp_line}
{_gap_line}

ChatGPT 광고(ChatGPT Ads)는 2026년 2월 미국 출시 이후 이미 확대 운영 중입니다. 이에 대응하여
유기적(Organic) AI 검색 노출을 강화하는 전략을 아래 JSON 형식으로 제공해줘.
아래 경쟁사·미확보 키워드를 반드시 반영하여 이 사업장 맞춤으로 구체적으로 작성할 것:

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
            max_tokens=6000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()

        import json, re
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        guide = None
        if json_match:
            try:
                guide = json.loads(json_match.group())
            except json.JSONDecodeError:
                guide = None
        if guide is None:
            # 파싱 실패(응답 길이 초과로 JSON이 잘린 경우 등) — 코드펜스만 제거해 원문이라도 읽히게
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw).strip()
            guide = {"situation_summary": cleaned}

        return {
            "business_id": biz.get("id"),
            "business_name": biz.get("name"),
            "guide": guide,
            "current_score": score,
            "chatgpt_mentioned": chatgpt_mentioned,
            "chatgpt_measured": chatgpt_measured,
            "exposure_freq": exposure_freq,
            "sample_size": sample_size,
        }
