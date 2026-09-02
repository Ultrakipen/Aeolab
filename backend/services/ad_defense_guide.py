"""
ChatGPT 광고 한국 도입 대응 가이드 생성 서비스
ChatGPT 광고(ChatGPT Ads) 확대 대응 — 유기적 AI 노출 전략 (Claude Sonnet)
"""
import logging
import os
import anthropic

from services.ai_usage_logger import log_ai_usage

_logger = logging.getLogger("aeolab")

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
        competitor_mentioned_names: list[str] | None = None,
        prev_global_channel_score: float | None = None,
        prev_risk_level: str | None = None,
        naver_weight: float | None = None,
        global_weight: float | None = None,
    ) -> dict:
        """ChatGPT 광고 대응 가이드 생성"""
        score = scan_result.get("total_score", 0)
        global_channel_score = scan_result.get("global_channel_score")
        naver_channel_score = scan_result.get("naver_channel_score")

        # 리스크 결정론적 계산(2026-09-02 추가) — ChatGPT 광고는 글로벌(Track2) 채널에만
        # 영향을 준다. 네이버 비중이 큰 업종(예: 음식점 80%)은 Track2가 약해도 실질
        # 리스크가 작고, 글로벌 비중이 큰 업종(예: 법률 80%)은 Track2가 약하면 리스크가
        # 크다. Claude 자유판단에 맡기면 이 비율과 무관한 risk_level이 나올 수 있음
        # (실측 QA: 네이버80% 업종인데 risk_level="high"로 나온 사례 확인) — 아래 계산값을
        # Claude 응답 파싱 후 강제 덮어써서 항상 이 비율과 일치하도록 보장.
        #
        # exposure(0~100)의 의미: "글로벌 채널이 약해서 위험에 노출된 unified score의
        # 비율(%)". global_weight가 이 업종의 unified score 중 글로벌 채널 비중이고,
        # track2_weakness가 그 채널이 얼마나 약한지(%)이므로 곱하면 "unified score 중
        # 몇 %가 약한 글로벌 채널에 걸려있는가"가 된다. 임계값 20/40은 표본 데이터로
        # 보정한 값이 아니라 이 의미 자체를 3등분한 것(<20%=낮음, 20~40%=보통, 40%+=
        # 높음) — 활성 구독자가 소수(2026-09 기준)라 실사용 분포로 보정할 표본이 아직
        # 없다. 향후 표본이 쌓이면 아래 log_ai_usage 인접 로그(risk_calc)로 실제 분포를
        # 확인해 재보정할 것.
        #
        # 히스테리시스: 임계값 경계 근처(예: exposure 18~22)에서는 스캔마다 값이
        # 흔들려 risk_level이 재생성할 때마다 low↔medium으로 뒤집힐 수 있음(실측:
        # 한 사업장의 global_channel_score가 하루 만에 4.3→19.1로 변동한 사례 확인).
        # 직전 가이드의 risk_level이 있으면 그 밴드를 5%p 넓게 유지해 경계 근처
        # 미세 변동으로 라벨이 흔들리지 않게 한다 — 실제로 경계를 크게 넘어야만 전환.
        risk_level: str | None = None
        exposure: float | None = None
        if global_channel_score is not None and global_weight is not None:
            track2_weakness = max(0.0, 100.0 - global_channel_score)
            exposure = global_weight * track2_weakness  # 0~100 스케일(unified score 중 위험 노출 비율 %)
            _BUF = 5
            if prev_risk_level == "low" and exposure < 20 + _BUF:
                risk_level = "low"
            elif prev_risk_level == "medium" and 20 - _BUF <= exposure < 40 + _BUF:
                risk_level = "medium"
            elif prev_risk_level == "high" and exposure >= 40 - _BUF:
                risk_level = "high"
            elif exposure >= 40:
                risk_level = "high"
            elif exposure >= 20:
                risk_level = "medium"
            else:
                risk_level = "low"
            _logger.info(
                "[ad_defense] risk_calc biz=%s category=%s global_weight=%.2f "
                "global_channel_score=%.1f exposure=%.1f prev_risk=%s -> risk_level=%s",
                biz.get("id"), biz.get("category"), global_weight,
                global_channel_score, exposure, prev_risk_level, risk_level,
            )

        # 네이버(Track1) 상태는 개별 항목이 아니라 종합 상태 텍스트로만 전달 — 실행
        # 아이템(organic_strategies)은 아래에서 Track2로 한정하므로 네이버는 "안전망"
        # 서술용 배경 정보로만 쓰인다. 원시 점수는 프롬프트에만 쓰고 사용자 화면엔 노출 안 함.
        track1_status = None
        if naver_channel_score is not None:
            track1_status = "양호" if naver_channel_score >= 70 else "보통" if naver_channel_score >= 40 else "주의 필요"

        # 지난 가이드 대비 변화 — 텍스트 레이블만 계산(2026-09-02 추가). 원시 점수차는
        # 절대 사용자에게 노출하지 않는다(CLAUDE.md "점수 표시 원칙"). 노이즈성 미세변화를
        # "악화"로 오인시키지 않도록 SCORE_01 카톡 알림과 동일한 3점 임계값 사용.
        momentum: str | None = None
        if prev_global_channel_score is not None and global_channel_score is not None:
            delta = global_channel_score - prev_global_channel_score
            if delta >= 3:
                momentum = "improved"
            elif delta <= -3:
                momentum = "declined"
            else:
                momentum = "steady"
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

        # 약한 영역 — Track2(글로벌 AI)로 한정(2026-09-02 재설계). ChatGPT 광고 대비
        # 가이드인데 기존엔 score_breakdown 전체(Track1 네이버 항목 포함)에서 하위 3개를
        # 뽑아 "네이버 플레이스 최적화"가 1순위 전략으로 나오는 등 주제와 무관한 조언이
        # 섞였음(실측 QA로 확인). score_breakdown엔 v3.0/v3.1 호환용 중복·레거시 키
        # (keyword_gap_score·naver_exposure_confirmed·kakao_completeness 등, v3_1에서는
        # keyword_search_rank·ai_briefing_score 등으로 대체된 구버전 항목)도 섞여 있어
        # 화이트리스트 방식이 안전 — 실제 v3_1 Track2 4항목만 명시 지정.
        _TRACK2_KEYS = ["multi_ai_exposure", "schema_seo", "online_mentions_t2", "google_presence"]
        score_breakdown = scan_result.get("score_breakdown") or {}
        track2_items = [
            (k, score_breakdown[k]) for k in _TRACK2_KEYS
            if isinstance(score_breakdown.get(k), (int, float)) and not isinstance(score_breakdown.get(k), bool)
        ]
        weak_areas = sorted(track2_items, key=lambda x: x[1])[:3]
        weak_areas_text = ", ".join(k for k, _ in weak_areas) if weak_areas else "없음"

        briefing_note = {
            "active": "네이버 AI 브리핑(플레이스형) 대상 업종입니다.",
            "likely": "네이버 AI 브리핑(플레이스형) 확대 예정 업종으로, 아직 전면 대상은 아닙니다. 다만 정보형(블로그·콘텐츠 출처)은 업종 제한이 없어 지금도 노출 가능 — 정보형 콘텐츠 전략도 함께 제안할 것.",
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
        # 실제 AI에 언급이 확인된 경쟁사만(추정치 제외) — 없으면 언급 생략(2026-09-02 추가)
        _comp_mentioned_line = (
            f"- 이미 AI에 언급이 확인된 경쟁사: {', '.join(competitor_mentioned_names)} — 이 격차를 구체적으로 짚어줄 것"
            if competitor_mentioned_names
            else ""
        )
        _momentum_line = {
            "improved": "- 지난 가이드 생성 이후 글로벌 AI 노출 지표가 개선되는 추세입니다 — 이 성과를 언급하고 다음 단계를 제안할 것.",
            "declined": "- 지난 가이드 생성 이후 글로벌 AI 노출 지표가 다소 낮아졌습니다 — 원인 점검을 우선순위로 제안할 것.",
            "steady": "- 지난 가이드 생성 이후 글로벌 AI 노출 지표는 큰 변화가 없습니다.",
        }.get(momentum, "")

        # 듀얼트랙 비율 — situation_summary의 배경 설명용(2026-09-02 추가)
        _ratio_line = ""
        if naver_weight is not None and global_weight is not None:
            _ratio_line = (
                f"- 이 업종의 AI 노출 구성: 네이버 {naver_weight*100:.0f}% / 글로벌 AI(ChatGPT·Gemini 등) {global_weight*100:.0f}%. "
                f"ChatGPT 광고는 글로벌 비중에만 영향을 준다 — 네이버 비중이 높을수록 실제 리스크는 작다."
            )
        _track1_line = f"- 네이버(Track1) 채널 상태: {track1_status}(참고용 배경 정보 — 이 가이드의 실행 항목 대상 아님)" if track1_status else ""
        # risk_level="low"라도 "안심하고 아무것도 안 해도 됨"으로 끝내면 유료 기능으로서
        # 가치가 없다 — 낮은 리스크를 "네이버 안전마진을 지렛대 삼아 글로벌 채널을
        # 공격적으로 선점할 기회"로 재프레이밍하도록 지시(2026-09-02 추가). risk_level이
        # medium/high일 때는 방어(원인 해결)에 집중하도록 별도 지시.
        _risk_framing = {
            "low": "situation_summary에서 \"위험이 낮다\"로 끝내지 말고, 이 안전마진(네이버 강점)을 지렛대 삼아 "
                   "경쟁사보다 먼저 글로벌 AI 채널을 선점할 기회로 프레이밍할 것. organic_strategies도 방어가 아닌 "
                   "선점·확장 관점으로 작성.",
            "medium": "situation_summary에서 지금 보강하지 않으면 격차가 커질 수 있다는 점을 균형 있게 전달할 것.",
            "high": "situation_summary에서 글로벌 채널 의존도가 높은데 노출이 약한 구체적 이유(위 데이터 기반)를 "
                    "짚고, organic_strategies는 방어(원인 해결) 우선순위로 작성할 것.",
        }.get(risk_level, "")
        _risk_line = (
            f"- risk_level은 반드시 \"{risk_level}\"로 고정해서 응답할 것(위 비율·데이터 기반 확정값). {_risk_framing}"
            if risk_level else ""
        )

        prompt = f"""당신은 한국 AI 검색 광고 전략 전문가입니다.

사업장 정보:
- 이름: {biz.get('name')}
- 업종: {biz.get('category')}
- 지역: {biz.get('region')}
- {briefing_note}
- ChatGPT 현재 언급 여부: {"측정 실패(데이터 없음)" if not chatgpt_measured else ("언급됨" if chatgpt_mentioned else "미언급")}
- Gemini 노출 측정: {f"{sample_size}회 샘플링 중 {exposure_freq}회 노출" if sample_size > 0 else "이번 스캔에서 측정 실패(데이터 없음)"}
- 개선이 필요한 글로벌 AI 영역: {weak_areas_text}
{_ratio_line}
{_track1_line}
{_risk_line}
{_comp_line}
{_gap_line}
{_comp_mentioned_line}
{_momentum_line}

ChatGPT 광고(ChatGPT Ads)는 2026년 2월 미국에서 시작해 2026년 8월 11일부터 한국을 포함한
9개국으로 노출이 확대됐습니다(무료·Go 등급 사용자 대상, 유료 등급은 광고 없음). 이에 대응하여
유기적(Organic) AI 검색 노출을 강화하는 전략을 아래 JSON 형식으로 제공해줘.
아래 경쟁사·미확보 키워드를 반드시 반영하여 이 사업장 맞춤으로 구체적으로 작성할 것.

중요: organic_strategies·content_actions·schema_recommendations는 반드시 글로벌 AI 채널
(ChatGPT·Gemini 노출, 웹사이트 Schema/SEO, 온라인 언급, Google AI Overview)에만 집중할 것 —
네이버 스마트플레이스·네이버 AI 브리핑 관련 전략은 포함하지 말 것(이 가이드의 대상이 아니며
별도 "AI 개선 가이드"가 다루는 영역). 네이버 상태는 situation_summary에서 "이미 네이버가
튼튼해 리스크가 제한적이다/네이버도 약해 전반적 보강이 필요하다" 식의 배경 설명 1문장으로만 다룰 것.

중요: situation_summary·organic_strategies·content_actions·timeline 어디에도 "노출 O%→O%"
같은 구체적 예측 수치를 쓰지 말 것 — AEOlab은 이런 수치를 예측할 근거 모델이 없고, 섹션마다
서로 다른 숫자를 지어내면(예: 전략에서는 "30%까지 상승", 로드맵에서는 같은 기간에 "20%까지
상승") 서로 모순되는 결과가 나온다(실측 확인된 사례). 개선 효과는 "노출 빈도를 크게 늘릴
수 있는 직접적 레버다", "인용 확률을 유의미하게 높인다" 같은 정성적 표현으로만 서술할 것.
Gemini 노출 실측값(위에 제공된 "N회 샘플링 중 M회")은 현재 상태 설명에 그대로 인용해도
되지만, 그 값이 앞으로 몇 %로 바뀔지는 예측하지 말 것.

{{
  "situation_summary": "현재 상황 2문장 요약 — 듀얼트랙 비율과 네이버 상태를 배경으로 반영",
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

        from services.anthropic_retry import create_message_with_retry
        try:
            msg = await create_message_with_retry(
                self.client,
                model="claude-sonnet-4-6",
                max_tokens=6000,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-sonnet-4-6", f"ad_defense_guide:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-sonnet-4-6", "ad_defense_guide", msg.usage.input_tokens, msg.usage.output_tokens)
        except Exception as _le:
            _logger.debug("ad_defense_guide usage 로깅 실패(무시): %s", _le)
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

        # risk_level 결정론적 값으로 강제 — 프롬프트 지시를 Claude가 어길 가능성을
        # 코드 레벨에서 차단(momentum과 동일 원칙: 사실성 있는 필드는 AI 자유판단에 맡기지 않음)
        if risk_level is not None and isinstance(guide, dict):
            guide["risk_level"] = risk_level

        return {
            "business_id": biz.get("id"),
            "business_name": biz.get("name"),
            "guide": guide,
            "current_score": score,
            "chatgpt_mentioned": chatgpt_mentioned,
            "chatgpt_measured": chatgpt_measured,
            "exposure_freq": exposure_freq,
            "sample_size": sample_size,
            # 다음 생성 때의 momentum 비교용 스냅샷(원시 점수, 사용자에게 직접 노출 금지 —
            # 프론트는 momentum 텍스트 레이블만 사용할 것) + 결정론적 momentum 레이블
            "global_channel_score": global_channel_score,
            "momentum": momentum,
        }
