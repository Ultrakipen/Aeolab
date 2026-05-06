"""
개선 가이드 생성 서비스 — Claude Sonnet 4.6 기반
도메인 모델 v2.1 Phase D: ActionPlan + ActionTools 생성
"""
import os
import json
import re
import uuid
import asyncio
import logging
from datetime import datetime, timezone
import anthropic

from models.context import ScanContext
from models.action import ActionItem, ActionPlan
from services.action_tools import build_action_tools
from services.industry_prompt_rules import build_industry_system_prompt

_logger = logging.getLogger("aeolab")

# 네이버 AI 브리핑 게이팅 (v4.1) — import 실패 시 fallback "active"
try:
    from services.score_engine import get_briefing_eligibility as _get_eligibility
except Exception as _elig_import_err:
    _logger.warning(f"get_briefing_eligibility import 실패, fallback active 처리: {_elig_import_err}")
    def _get_eligibility(category: str, is_franchise: bool = False) -> str:  # type: ignore[misc]
        return "active"


def _briefing_strategy_header(eligibility: str, is_franchise: bool) -> str:
    """eligibility/is_franchise 기반 상단 안내 한 줄 반환 (ACTIVE는 빈 문자열)."""
    if eligibility == "active":
        return ""
    if eligibility == "likely":
        return (
            "ℹ️ 이 업종은 AI 브리핑 확대 예상 업종입니다. "
            "미리 5단계를 완료해두면 확대 즉시 노출됩니다."
        )
    # inactive
    if is_franchise:
        return (
            "🏢 프랜차이즈 가맹점은 현재 네이버 AI 브리핑 제공 대상에서 제외됩니다(추후 확대 예정). "
            "글로벌 AI 채널 노출에 집중하세요."
        )
    return (
        "ℹ️ 이 업종은 현재 AI 브리핑 비대상이지만, "
        "콘텐츠 강화는 ChatGPT·Gemini·Google AI Overview 노출에 동일하게 효과적입니다."
    )


def _faq_missing_msg(eligibility: str) -> str:
    if eligibility == "inactive":
        return "FAQ는 ChatGPT·Gemini가 사용자 질문에 답변할 때 인용하는 핵심 정보입니다"
    return "소개글 Q&A 없음 — 네이버 AI 브리핑 인용 후보 중 가장 효과 큰 항목 (소개글 하단에 추가)"


def _intro_missing_msg(eligibility: str) -> str:
    if eligibility == "inactive":
        return "소개글은 ChatGPT·Google AI Overview가 업체 정보를 추출하는 1차 소스입니다"
    return "소개글(인트로) 없음 — 키워드 3~5개 포함한 2~3문장 소개글 필요"


def _post_missing_msg(eligibility: str) -> str:
    """소식 없음 메시지 — eligibility에 무관하게 공통이나 INACTIVE는 톤 완화."""
    if eligibility == "inactive":
        return "소식 게시물 없음 — 최신 정보 업데이트로 AI 정보 정확도 향상"
    return "소식 게시물 없음 — 주 1회 업로드 시 최신성 점수 유지됨"


def _naver_briefing_exposure_msg(naver_in_briefing: bool, eligibility: str) -> str:
    if naver_in_briefing:
        return "있음 ✅"
    if eligibility == "inactive":
        return "네이버 AI 브리핑은 현재 이 업종 비대상입니다 — ChatGPT·Gemini·Google AI 노출 개선에 집중"
    if eligibility == "likely":
        return "없음 ⚠️ — 확대 예상 업종, 미리 준비 권장"
    return "없음 ❌ — 가장 먼저 해결해야 할 문제"

# 업종별 외부 언급 채널 맵 (format 키: {region}, {keyword}, {biz_name})
_EXTERNAL_CHANNEL_MAP: dict[str, list[tuple[str, str]]] = {
    "restaurant": [
        ("네이버 카페 맘카페·지역 맛집 카페", "{region} 맛집 추천 글 작성 또는 댓글 참여"),
        ("블로그 리뷰 유도", "방문 고객에게 '네이버 블로그 후기' 부탁 → 리뷰에 '{keyword}' 자연 포함 요청"),
        ("인스타그램 위치태그", "#{keyword} #{region}맛집 해시태그 + 위치태그"),
    ],
    "cafe": [
        ("네이버 카페 '카페투어' 커뮤니티", "{region} 카페 추천 포스팅"),
        ("인스타그램", "#{keyword} #{region}카페 위치태그"),
        ("블로그 협업", "지역 카페 리뷰 블로거에게 방문 제안"),
    ],
    "bakery": [
        ("네이버 카페 지역 맛집 커뮤니티", "{region} 빵집·디저트 추천 글 작성"),
        ("인스타그램", "#{keyword} #{region}베이커리 위치태그 + 신메뉴 사진"),
        ("블로그 리뷰 유도", "방문 고객에게 '네이버 블로그 후기' 부탁 → '{keyword}' 키워드 포함 요청"),
    ],
    "bar": [
        ("네이버 카페 지역 술집·맛집 커뮤니티", "{region} 술집 추천 글 참여"),
        ("인스타그램", "#{keyword} #{region}술집 해시태그 + 분위기 사진"),
        ("블로그 리뷰 유도", "방문 고객에게 '네이버 블로그 후기' 부탁"),
    ],
    "beauty": [
        ("네이버 카페 '뷰티·헤어 커뮤니티'", "{region} {keyword} 후기 공유"),
        ("인스타그램 Before/After", "시술 전후 사진 + #{keyword} #{region}미용 해시태그"),
        ("네이버 지식인", "'{region} {keyword} 추천' 질문에 전문가 답변"),
    ],
    "nail": [
        ("인스타그램 네일아트 커뮤니티", "#{keyword} 디자인 사진 + #{region}네일 위치태그"),
        ("네이버 카페 뷰티 커뮤니티", "{region} 네일 후기 공유"),
        ("핀터레스트", "{keyword} 디자인 업로드로 검색 유입"),
    ],
    "medical": [
        ("네이버 지식인 건강 답변", "'{keyword} 증상' 관련 질문에 전문적 답변"),
        ("네이버 카페 '지역 건강 정보'", "건강 정보 공유 글"),
        ("블로그 건강 정보", "{keyword} 관련 정보성 포스팅"),
    ],
    "pharmacy": [
        ("네이버 지식인 건강·약품 답변", "'{keyword}' 관련 질문에 전문가 답변"),
        ("블로그 건강 정보", "{keyword} 복용법·효능 관련 정보성 포스팅"),
        ("네이버 카페 지역 건강 커뮤니티", "건강 정보 공유 글"),
    ],
    "fitness": [
        ("네이버 카페 '운동·다이어트'", "{region} {keyword} 후기 공유"),
        ("인스타그램 운동 인증", "#{keyword} #{region}헬스 해시태그"),
        ("유튜브 Shorts", "짧은 운동 팁 영상 업로드 (SEO 효과)"),
    ],
    "yoga": [
        ("인스타그램 요가·필라테스 커뮤니티", "#{keyword} #{region}요가 위치태그 + 수업 사진"),
        ("네이버 카페 '다이어트·요가' 커뮤니티", "{region} {keyword} 후기 공유"),
        ("유튜브 Shorts", "짧은 {keyword} 동작 영상 업로드"),
    ],
    "pet": [
        ("네이버 카페 반려동물 커뮤니티", "{region} {keyword} 후기 공유"),
        ("인스타그램 펫 계정", "#{keyword} #{region}반려동물 해시태그 + 귀여운 사진"),
        ("네이버 지식인", "'{keyword} 추천' 질문에 전문 답변"),
    ],
    "education": [
        ("네이버 카페 학부모 커뮤니티", "{region} {keyword} 학원 추천 관련 글 참여"),
        ("네이버 지식인", "'{keyword} 학습법' 전문 답변"),
        ("블로그 교육 콘텐츠", "{keyword} 학습 팁 정보성 포스팅"),
    ],
    "tutoring": [
        ("네이버 카페 학부모·수험생 커뮤니티", "{region} {keyword} 과외 추천 관련 글 참여"),
        ("네이버 지식인", "'{keyword} 공부법' 전문 답변"),
        ("블로그 학습 콘텐츠", "{keyword} 공부 팁 정보성 포스팅"),
    ],
    "legal": [
        ("네이버 지식인 법률 답변", "'{keyword}' 관련 법률 질문에 전문가 답변"),
        ("블로그 법률 정보", "{keyword} 관련 알기 쉬운 법률 정보 포스팅"),
        ("네이버 카페 지역 커뮤니티", "법률 정보 공유 글 (광고 아닌 정보 제공 형태)"),
    ],
    "realestate": [
        ("네이버 카페 지역 부동산 커뮤니티", "{region} {keyword} 시세 정보 공유"),
        ("블로그 부동산 정보", "{region} {keyword} 관련 정보성 포스팅"),
        ("네이버 지식인", "'{region} {keyword} 추천' 질문에 전문 답변"),
    ],
    "interior": [
        ("인스타그램 인테리어 커뮤니티", "시공 전후 사진 + #{keyword} #{region}인테리어 해시태그"),
        ("네이버 카페 '인테리어·집꾸미기' 커뮤니티", "{keyword} 시공 후기 공유"),
        ("블로그 시공 사례", "{keyword} 시공 과정·결과 포스팅"),
    ],
    "auto": [
        ("네이버 카페 자동차 커뮤니티", "{region} {keyword} 관련 정보 공유"),
        ("블로그 자동차 정보", "{keyword} 관련 정보성 포스팅"),
        ("네이버 지식인", "'{keyword} 추천' 질문에 전문 답변"),
    ],
    "cleaning": [
        ("네이버 카페 지역 생활 커뮤니티", "{region} {keyword} 후기 공유"),
        ("블로그 생활 정보", "{keyword} 이용 후기·팁 포스팅"),
        ("네이버 지식인", "'{keyword} 추천' 질문에 전문 답변"),
    ],
    "shopping": [
        ("인스타그램 쇼핑 계정", "#{keyword} 신상품 사진 + 위치태그"),
        ("네이버 쇼핑 리뷰 유도", "구매 고객에게 '네이버 쇼핑 리뷰' 작성 요청 → '{keyword}' 자연 포함"),
        ("블로그 상품 소개", "{keyword} 상품 상세 소개 포스팅"),
    ],
    "fashion": [
        ("인스타그램 패션 계뮤니티", "#{keyword} 코디 사진 + #{region}패션 해시태그"),
        ("네이버 카페 패션 커뮤니티", "{keyword} 착용 후기 공유"),
        ("블로그 패션 콘텐츠", "{keyword} 스타일링 팁 정보성 포스팅"),
    ],
    "accommodation": [
        ("네이버 카페 여행 커뮤니티", "{region} 숙소 추천 후기 공유"),
        ("인스타그램 여행 계정", "#{keyword} #{region}여행 위치태그"),
        ("블로그 여행 후기", "{region} {keyword} 숙소 방문 후기 포스팅"),
    ],
    "photo": [
        ("인스타그램 포토그래퍼 계정", "#{keyword} 작품 공유 + #{region}사진작가 해시태그"),
        ("네이버 카페 웨딩·육아 커뮤니티", "{region} {keyword} 스튜디오 추천 후기 공유"),
        ("블로그 촬영 후기", "{keyword} 촬영 과정·결과물 포스팅"),
    ],
    "video": [
        ("유튜브 포트폴리오", "{keyword} 영상 작업 샘플 업로드"),
        ("인스타그램 릴스", "#{keyword} 짧은 작업 영상 + #{region} 해시태그"),
        ("블로그 작업 후기", "{keyword} 제작 과정 포스팅"),
    ],
    "design": [
        ("인스타그램 디자인 포트폴리오", "#{keyword} 작업물 공유"),
        ("핀터레스트", "{keyword} 디자인 작업물 업로드"),
        ("블로그 작업 사례", "{keyword} 디자인 과정 포스팅"),
    ],
    "other": [
        ("네이버 카페 지역 커뮤니티", "'{region} {keyword}' 관련 글 참여 또는 작성"),
        ("네이버 지식인", "'{keyword} 추천' 질문에 전문 답변 (가게 자연 언급)"),
        ("인스타그램", "#{keyword} #{region} 해시태그 + 위치태그"),
    ],
}

# 모듈 로드 시 즉시 초기화하지 않고 첫 호출 시 생성 (ANTHROPIC_API_KEY 미설정 방지)
_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다")
        _client = anthropic.Anthropic(api_key=api_key, timeout=60.0)
    return _client


# v3.0 breakdown 키 기준 (score_engine.py calculate_score() 반환 breakdown과 일치)
# v3.1 신규 4개 항목 추가 — model_version=="v3.1" 시 breakdown에 평탄화되어 존재
_DIMENSION_LABELS = {
    # v3.0 호환 항목
    "keyword_gap_score":        "키워드 갭",
    "review_quality":           "리뷰 품질",
    "smart_place_completeness": "스마트플레이스 완성도",
    "naver_exposure_confirmed": "네이버 AI 브리핑 노출",
    "multi_ai_exposure":        "멀티 AI 노출",
    "schema_seo":               "Schema/SEO",
    # v3.1 신규 항목
    "keyword_search_rank":      "네이버 키워드 검색 순위",
    "blog_crank":               "블로그 C-rank 추정",
    "local_map_score":          "지도/카카오맵 통합",
    "ai_briefing_score":        "AI 브리핑 인용",
}


def _format_competitor_gaps(my_breakdown: dict, top_competitors: list) -> str:
    """상위 경쟁사 대비 차원별 격차를 텍스트로 변환 — gap 큰 순 정렬"""
    if not top_competitors:
        return "경쟁사 데이터 없음"
    top = top_competitors[0]
    top_bd = top.get("breakdown") or {}
    if not top_bd:
        return f"경쟁사 '{top.get('name', '')}' 차원 데이터 수집 중"
    lines = []
    gaps = []
    for key, label in _DIMENSION_LABELS.items():
        my_val = my_breakdown.get(key, 0)
        top_val = top_bd.get(key, my_val)
        gap = round(top_val - my_val, 1)
        gaps.append((gap, label, round(my_val, 1), round(top_val, 1)))
    gaps.sort(reverse=True)
    for gap, label, my_v, top_v in gaps:
        if gap > 0:
            lines.append(f"- {label}: 내 가게 {my_v}점 vs {top.get('name', '1위')} {top_v}점 → -{gap}점 격차")
        else:
            lines.append(f"- {label}: 내 가게 {my_v}점 ✓ (우위 또는 동등)")
    return "\n".join(lines) if lines else "격차 없음"

# SYSTEM_PROMPT는 industry_prompt_rules.build_industry_system_prompt()로 동적 생성


class GuideGenerator:
    def __init__(self):
        self.client = _get_client()

    async def generate(
        self,
        biz: dict,
        score_data: dict,
        competitor_data: list,
        keyword_gap: dict | None = None,
        growth_stage: dict | None = None,
    ) -> dict:
        """Claude Sonnet으로 한국어 AI 노출 개선 가이드 생성 (하위호환 dict 반환)"""
        system_prompt = build_industry_system_prompt(biz.get("category", "other"))
        prompt = self._build_prompt(biz, score_data, competitor_data, keyword_gap, growth_stage)
        raw = await asyncio.to_thread(self._call_claude, prompt, system_prompt)
        return self._parse_response(raw)

    async def generate_action_plan(
        self,
        biz: dict,
        score_data: dict,
        competitor_data: list,
        scan_id: str,
        context: str = "location_based",
        naver_data: dict = None,
        website_health: dict = None,
        keyword_gap: dict | None = None,
        growth_stage: dict | None = None,
    ) -> ActionPlan:
        """ActionPlan 도메인 모델 반환 (v2.5 업데이트: keyword_gap + growth_stage 활용)"""
        try:
            ctx = ScanContext(context)
        except ValueError:
            ctx = ScanContext.LOCATION_BASED

        # keyword_gap이 ReviewKeywordGap 객체이면 dict로 변환 (_build_prompt dict 기대)
        _kw_gap_for_prompt: dict | None = None
        if keyword_gap is not None:
            try:
                if hasattr(keyword_gap, "model_dump"):
                    _kw_gap_for_prompt = keyword_gap.model_dump()
                elif isinstance(keyword_gap, dict):
                    _kw_gap_for_prompt = keyword_gap
            except Exception as e:
                _logger.warning(f"keyword_gap dict 변환 실패: {e}")

        # Claude 가이드 생성 — 업종별 시스템 프롬프트 + 키워드 갭 데이터 포함
        system_prompt = build_industry_system_prompt(biz.get("category", "other"))
        prompt = self._build_prompt(biz, score_data, competitor_data, _kw_gap_for_prompt, growth_stage)
        raw = await asyncio.to_thread(self._call_claude, prompt, system_prompt)
        guide = self._parse_response(raw)

        # ActionItem 목록 구성
        items = self._build_action_items(guide, ctx)
        quick_wins = [item for item in items if item.is_quick_win]

        # ActionTools 생성 (context별 분기)
        # keyword_gap이 ReviewKeywordGap 객체이면 dict로 변환해 전달
        _kw_gap_dict: dict | None = None
        if keyword_gap is not None:
            try:
                if hasattr(keyword_gap, "model_dump"):
                    _kw_gap_dict = keyword_gap.model_dump()
                elif isinstance(keyword_gap, dict):
                    _kw_gap_dict = keyword_gap
            except Exception:
                pass
        tools = await build_action_tools(
            biz=biz,
            context=context,
            website_health=website_health,
            naver_data=naver_data,
            scan_id=scan_id,
            keyword_gap=_kw_gap_dict,
        )

        plan = ActionPlan(
            plan_id=str(uuid.uuid4()),
            business_id=biz.get("id", ""),
            scan_id=scan_id,
            generated_at=datetime.now(timezone.utc),
            context=ctx,
            summary=guide.get("summary", ""),
            items=items,
            quick_wins=quick_wins,
            next_month_goal=guide.get("next_month_goal", "다음 달까지 AI 노출 빈도 +20% 목표"),
            tools=tools,
        )
        # Claude 응답의 추가 필드를 ActionPlan 정식 필드에 저장
        plan.weekly_roadmap = guide.get("weekly_roadmap")
        plan.this_week_mission = guide.get("this_week_mission")
        return plan

    def _build_action_items(self, guide: dict, ctx: ScanContext) -> list[ActionItem]:
        """Claude 응답에서 ActionItem 목록 생성"""
        raw_items = guide.get("priority_items", [])
        quick_wins_raw = set(guide.get("quick_wins", []))
        items = []

        _dimension_map = {
            # v3.0 호환
            "리뷰": "review_quality",
            "리뷰키워드": "review_quality",  # Claude 프롬프트 반환값과 일치
            "스마트플레이스": "info_completeness",
            "키워드": "online_mentions",
            "Schema": "schema_score",
            "콘텐츠": "content_freshness",
            "정보완성도": "info_completeness",
            "채널최적화": "schema_score",
            "AI노출": "exposure_freq",
            # v3.1 신규 카테고리 매핑
            "키워드순위": "keyword_search_rank",
            "블로그": "blog_crank",
            "지도카카오맵": "local_map_score",
            "AI브리핑": "ai_briefing_score",
        }

        for i, raw in enumerate(raw_items):
            # dimension 매핑
            category = raw.get("category", "")
            dimension = _dimension_map.get(category, "exposure_freq")

            title = raw.get("title", f"개선 항목 {i+1}")
            action = raw.get("action", "")
            difficulty = raw.get("difficulty", "medium")
            if difficulty not in ("easy", "medium", "hard"):
                difficulty = "medium"

            # 빠른 실행 가능 여부 판단
            time_req = raw.get("time_required", "")
            is_quick = (
                difficulty == "easy" or
                "10분" in time_req or "30분" in time_req or
                title in quick_wins_raw or
                any(kw in title for kw in ["등록", "수정", "추가", "입력"])
            )

            items.append(ActionItem(
                rank=i + 1,
                dimension=dimension,
                title=title,
                action=action,
                difficulty=difficulty,
                time_required=time_req or "1시간",
                competitor_example=raw.get("competitor_example"),
                is_quick_win=is_quick,
            ))

        return items

    def _call_claude(self, user_prompt: str, system_prompt: str | None = None) -> str:
        import time as _time
        if system_prompt is None:
            system_prompt = build_industry_system_prompt("other")
        models = ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
        last_err = None
        for model in models:
            for attempt in range(3):
                try:
                    message = self.client.messages.create(
                        model=model,
                        max_tokens=4096,
                        system=system_prompt,
                        messages=[{"role": "user", "content": user_prompt}],
                        timeout=90.0,
                    )
                    return message.content[0].text
                except Exception as e:
                    last_err = e
                    # 529 Overloaded: 대기 후 재시도
                    if "529" in str(e) or "overloaded" in str(e).lower():
                        wait = (attempt + 1) * 10
                        _logger.warning(f"Claude {model} 과부하(529), {wait}초 대기 후 재시도 ({attempt+1}/3)")
                        _time.sleep(wait)
                    else:
                        break  # 529 외 오류는 즉시 다음 모델로
        raise last_err

    @staticmethod
    def _format_competitor_gaps_static(my_breakdown: dict, top_competitors: list) -> str:
        """상위 경쟁사 대비 차원별 격차를 텍스트로 변환 (프롬프트용)"""
        return _format_competitor_gaps(my_breakdown, top_competitors)

    @staticmethod
    def _safe_str(value: object, max_len: int = 200) -> str:
        """프롬프트 인젝션 방지: 외부 데이터를 Claude 프롬프트에 삽입할 때 반드시 통과시킬 것.
        - 제어 문자·이중 줄바꿈 압축·길이 상한 적용
        - ## / INSTRUCTION: 등 지시어 패턴 제거
        """
        s = str(value or "")
        # 마크다운 헤더·지시어 주입 차단
        s = re.sub(r"(?m)^#{1,6}\s+", "", s)
        s = re.sub(r"(?i)(instruction|system|ignore previous|forget)[\s:]+", "", s)
        # 제어 문자 제거 (줄바꿈·탭 제외)
        s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", s)
        return s[:max_len]

    def _build_prompt(
        self,
        biz: dict,
        scan_result: dict,
        competitor_data: list,
        keyword_gap: dict | None = None,
        growth_stage: dict | None = None,
    ) -> str:
        my_score = scan_result.get("total_score", 0)
        my_freq = scan_result.get("exposure_freq", 0)
        top_comp = sorted(competitor_data, key=lambda x: x.get("score", 0), reverse=True)[:3]
        breakdown = scan_result.get("breakdown", scan_result.get("score_breakdown", {}))

        naver_channel = scan_result.get("naver_channel_score")
        global_channel = scan_result.get("global_channel_score")
        website_check = scan_result.get("website_check_result") or {}
        kakao_result = scan_result.get("kakao_result") or {}
        context = scan_result.get("context") or biz.get("business_type") or "location_based"

        # ── v4.1 네이버 AI 브리핑 게이팅 ──────────────────────────────────
        is_franchise = bool(biz.get("is_franchise"))
        eligibility = _get_eligibility(biz.get("category", ""), is_franchise)
        briefing_header = _briefing_strategy_header(eligibility, is_franchise)

        # 네이버 AI 브리핑 노출 여부
        naver_in_briefing = (scan_result.get("naver_result") or {}).get("mentioned", False)

        # 채널별 상태 요약 — INACTIVE는 글로벌 AI 우선 표기
        channel_lines = []
        if eligibility == "inactive":
            if global_channel is not None:
                channel_lines.append(f"- 글로벌 AI 채널 (ChatGPT·Gemini·Google) 우선: {global_channel}/100")
            if naver_channel is not None:
                channel_lines.append(f"- 네이버 AI 채널: {naver_channel}/100")
            channel_lines.append(
                "- 권장 액션: 글로벌 콘텐츠 보강 (블로그 SEO·웹사이트 메타 태그·FAQ 스키마)"
            )
        else:
            if naver_channel is not None:
                channel_lines.append(f"- 네이버 AI 채널: {naver_channel}/100")
            if global_channel is not None:
                channel_lines.append(f"- 글로벌 AI 채널: {global_channel}/100")
            channel_lines.append("- 주의: 네이버는 ChatGPT·Gemini 크롤링을 차단 중 → 스마트플레이스가 없으면 글로벌 AI에서 비노출")
        channel_section = "\n## 채널 현황\n" + "\n".join(channel_lines)

        # Cross-AI 격차 진단 — 15점 이상 차이 시 약한 채널 집중 지시
        cross_ai_section = ""
        if naver_channel is not None and global_channel is not None:
            gap = abs(naver_channel - global_channel)
            if gap >= 15:
                if eligibility == "inactive":
                    # INACTIVE: 항상 글로벌 AI 강화 지시
                    cross_ai_section = (
                        f"\n## Cross-AI 진단 (격차 {gap:.0f}점 — 집중 필요)"
                        f"\n- 글로벌 AI {global_channel:.0f}점 vs 네이버 AI {naver_channel:.0f}점"
                        "\n- 지시사항: 글로벌 AI 개선 항목(웹사이트 메타 태그·FAQ 스키마·블로그 SEO)을 priority_items 상위 2개에 반드시 배치"
                    )
                elif naver_channel > global_channel:
                    cross_ai_section = (
                        f"\n## Cross-AI 진단 (격차 {gap:.0f}점 — 집중 필요)"
                        f"\n- 네이버 AI {naver_channel:.0f}점(강) vs 글로벌 AI {global_channel:.0f}점(약)"
                        "\n- 지시사항: ChatGPT·Google 개선 항목(구글 비즈니스 프로필·AI 인식 정보 코드)을 priority_items 상위 2개에 반드시 배치"
                    )
                else:
                    cross_ai_section = (
                        f"\n## Cross-AI 진단 (격차 {gap:.0f}점 — 집중 필요)"
                        f"\n- 글로벌 AI {global_channel:.0f}점(강) vs 네이버 AI {naver_channel:.0f}점(약)"
                        "\n- 지시사항: 네이버 스마트플레이스·FAQ 개선 항목을 priority_items 상위 2개에 반드시 배치"
                    )

        # 웹사이트 문제 요약
        website_issues = []
        if website_check:
            if not website_check.get("has_json_ld"):
                website_issues.append("AI 인식 정보 코드 없음 (AI가 사업장 정보 파악 불가)")
            if not website_check.get("has_open_graph"):
                website_issues.append("Open Graph 없음 (SNS·AI 공유 미리보기 없음)")
            if not website_check.get("is_mobile_friendly"):
                website_issues.append("모바일 최적화 미흡")
        elif not biz.get("website_url"):
            website_issues.append("웹사이트 없음 (Google AI Overview 노출 불가)")
        website_section = (
            "\n## 웹사이트 문제\n" + "\n".join(f"- {i}" for i in website_issues)
            if website_issues else ""
        )

        # 카카오맵 등록 여부
        kakao_section = ""
        if kakao_result:
            is_on = kakao_result.get("is_on_kakao", False)
            kakao_section = f"\n## 카카오맵: {'등록됨' if is_on else '미등록 — 등록 시 ChatGPT 카카오 채널 노출 가능'}"

        # 위치 무관 사업장 안내
        context_note = ""
        if context == "non_location":
            context_note = "\n## 사업 유형: 온라인/전문직\n- 네이버 스마트플레이스보다 웹사이트·ChatGPT 최적화가 핵심입니다"

        # ★ 스마트플레이스 실제 완성 상태 — 이미 된 것 vs 실제 미완성 항목 구분
        sp_done = []
        sp_missing = []
        is_sp = biz.get("is_smart_place")
        has_faq = biz.get("has_faq")
        has_intro = biz.get("has_intro")
        has_recent_post = biz.get("has_recent_post")
        review_count = biz.get("review_count") or 0
        avg_rating = biz.get("avg_rating") or 0
        visitor_reviews = biz.get("visitor_review_count") or 0
        receipt_reviews = biz.get("receipt_review_count") or 0

        if is_sp:
            sp_done.append("스마트플레이스 등록 ✅")
        else:
            sp_missing.append("스마트플레이스 등록 (최우선)")

        if review_count and review_count > 0:
            sp_done.append(f"리뷰 {review_count}개 보유 (방문자 {visitor_reviews}개, 영수증 {receipt_reviews}개) ✅")
        else:
            sp_missing.append("리뷰 없음 — 키워드 담긴 첫 리뷰 확보 필요")

        if has_faq:
            sp_done.append("FAQ(자주 묻는 질문) 등록 ✅")
        else:
            sp_missing.append(_faq_missing_msg(eligibility))

        if has_intro:
            sp_done.append("소개글 등록 ✅")
        else:
            sp_missing.append(_intro_missing_msg(eligibility))

        if has_recent_post:
            sp_done.append("소식/공지 최근 게시물 있음 ✅")
        else:
            sp_missing.append(_post_missing_msg(eligibility))

        sp_done_text = "\n".join(f"  - {x}" for x in sp_done) if sp_done else "  - 없음"
        sp_missing_text = "\n".join(f"  - {x}" for x in sp_missing) if sp_missing else "  - 없음"

        # v4.1 브리핑 게이팅 안내 헤더 (ACTIVE면 빈 문자열)
        briefing_header_section = (
            f"\n## AI 브리핑 채널 안내\n{briefing_header}" if briefing_header else ""
        )

        # LIKELY 업종은 "가장 먼저 해결" 톤 → "준비 권장" 톤 다운 지시
        sp_tone_note = ""
        if eligibility == "likely":
            sp_tone_note = "\n  ※ 이 업종은 확대 예상 — '가장 먼저 해결' 대신 '준비 권장' 톤으로 안내할 것"

        smart_place_section = f"""
## 스마트플레이스 실제 상태 (이 데이터 기반으로만 조언할 것){sp_tone_note}
### 이미 완료된 항목 — 아래 항목은 절대 재추천하지 말 것:
{sp_done_text}
### 현재 미완성 항목 — 이것만 집중 추천:
{sp_missing_text}"""

        # ★ 핵심: 리뷰 키워드 갭 섹션 (가장 구체적이고 즉시 행동 가능한 정보)
        keyword_section = ""
        if keyword_gap and context == "location_based":
            top_kw = keyword_gap.get("top_priority_keyword") or ""
            comp_only = keyword_gap.get("competitor_only_keywords") or []
            pioneer = keyword_gap.get("pioneer_keywords") or []
            covered = keyword_gap.get("covered_keywords") or []
            coverage = keyword_gap.get("coverage_rate", 0)
            qr_msg = keyword_gap.get("qr_card_message", "")

            keyword_section = f"""
## 리뷰 키워드 격차 분석 (AI 브리핑 조건 검색 기준)
- 업종 키워드 커버리지: {round(coverage * 100)}% ({len(covered)}개 보유)
- 이미 보유한 키워드: {', '.join(covered[:5]) or '없음'}
- 경쟁사엔 있고 내 리뷰에 없는 것 (긴급): {', '.join(comp_only) or '없음'}
- 아무도 없는 선점 가능 키워드: {', '.join(pioneer) or '없음'}
- 지금 당장 받아야 할 키워드 1순위: {top_kw or '분석 중'}
- QR 카드 문구 예시: {qr_msg}"""

        # ── v3.1 신규 항목 섹션 ──────────────────────────────────────────────
        # score_engine.py가 SCORE_MODEL_VERSION=v3_1 시 breakdown에 4개 키를 평탄화해 전달
        v3_1_section = ""
        _is_v3_1 = breakdown.get("model_version") == "v3.1"
        if _is_v3_1:
            user_group = breakdown.get("user_group", "ACTIVE").upper()
            kw_rank_score  = breakdown.get("keyword_search_rank")
            blog_cr_score  = breakdown.get("blog_crank")
            local_map_sc   = breakdown.get("local_map_score")
            ai_brief_sc    = breakdown.get("ai_briefing_score")

            # INACTIVE 그룹은 ai_briefing 가중치 0 — 섹션에서 명시
            ai_brief_note = (
                "INACTIVE 그룹: AI 브리핑 인용 가중치 0 — 이 항목을 우선 추천하지 말 것"
                if user_group == "INACTIVE" else
                "LIKELY 그룹: AI 브리핑 확대 예상 — 준비 권장 톤 사용"
                if user_group == "LIKELY" else
                "ACTIVE 그룹: AI 브리핑 인용이 키워드 검색 순위와 함께 가장 높은 가중치 (각 25%)"
            )

            def _score_str(v):
                # 측정 미완성이면 "미측정" 표시 — 임의 수치 방지
                if v is None:
                    return "미측정"
                try:
                    return f"{float(v):.1f}점"
                except (TypeError, ValueError):
                    return "미측정"

            v3_1_section = f"""
## v3.1 Track1 6항목 점수 (사용자 그룹: {user_group})
| 항목 | 점수 | 그룹별 가중치 비고 |
|------|------|-------------------|
| ① 네이버 키워드 검색 순위 | {_score_str(kw_rank_score)} | ACTIVE 25% / LIKELY 30% / INACTIVE 35% |
| ② 리뷰 품질 | {_score_str(breakdown.get('review_quality'))} | ACTIVE 15% / LIKELY 17% / INACTIVE 20% |
| ③ 스마트플레이스 완성도 | {_score_str(breakdown.get('smart_place_completeness'))} | ACTIVE 15% / LIKELY 18% / INACTIVE 20% |
| ④ 블로그 C-rank 추정 | {_score_str(blog_cr_score)} | 공통 10% |
| ⑤ 지도/카카오맵 통합 | {_score_str(local_map_sc)} | ACTIVE 10% / LIKELY 10% / INACTIVE 15% |
| ⑥ AI 브리핑 인용 | {_score_str(ai_brief_sc)} | ACTIVE 25% / LIKELY 15% / INACTIVE 0% |
- {ai_brief_note}
- 지시사항: 점수가 "미측정"인 항목은 임의 수치를 만들지 말고 "측정 후 가이드 제공" 안내만 할 것
- 가이드 우선순위는 이 6항목 점수 기준으로 낮은 항목부터 집중 — 단, INACTIVE는 ⑥ 제외"""

        # 성장 단계 섹션
        stage_section = ""
        if growth_stage:
            stage_section = f"""
## 현재 성장 단계: {growth_stage.get('stage_label', '')} ({growth_stage.get('score_range', '')})
- 지금 집중할 것: {growth_stage.get('focus_message', '')}
- 하지 말아야 할 것: {growth_stage.get('do_not_do', '')}"""

        # ★ 블로그 분석 섹션 (blog_analysis_json이 businesses 테이블에 저장된 경우)
        blog_section = ""
        _blog_raw = biz.get("blog_analysis_json") or {}
        if isinstance(_blog_raw, str):
            try:
                _blog_raw = json.loads(_blog_raw)
            except Exception:
                _blog_raw = {}
        blog_json = _blog_raw
        if blog_json and not blog_json.get("error"):
            promo_ratio = blog_json.get("promotional_ratio", 0)
            info_ratio = blog_json.get("informational_ratio", 0)
            content_issue = blog_json.get("content_issue", "")
            missing_kws = blog_json.get("missing_keywords", [])
            title_suggestions = blog_json.get("title_suggestions", [])
            post_count_blog = blog_json.get("post_count", 0)
            freshness_val = blog_json.get("freshness", "")

            freshness_map = {
                "fresh": "신선 (30일 이내) ✅",
                "stale": "30~90일 전 ⚠️",
                "outdated": "90일 이상 방치 ❌",
            }
            freshness_label = freshness_map.get(freshness_val, freshness_val)

            title_lines = ""
            if title_suggestions:
                title_lines = "\n- 개선 제목 예시 (이것을 직접 추천할 것):\n"
                title_lines += "\n".join(f"  {i+1}. {self._safe_str(t, 80)}" for i, t in enumerate(title_suggestions))

            issue_line = f"- ⚠️ 문제: {self._safe_str(content_issue, 120)}" if content_issue else "- 콘텐츠 유형 양호"
            parts = [
                "\n## 블로그 실제 분석 결과 (이 데이터 기반으로 블로그 관련 조언할 것)",
                f"\n- 총 포스트: {post_count_blog}개 | 최신성: {freshness_label}",
                f"\n- 콘텐츠 유형: 홍보형 {promo_ratio}% / 정보형 {info_ratio}%",
                f"\n{issue_line}",
                f"\n- 블로그에 없는 키워드: {', '.join(missing_kws[:5]) or '분석 중'}",
                title_lines,
                "\n- 지시사항: 블로그 콘텐츠 유형 문제가 있으면 priority_items에 반드시 포함. 개선 제목 예시가 있으면 그대로 action에 포함할 것",
            ]
            blog_section = "".join(str(p) for p in parts)

        # ★ 스마트플레이스 심층 상태 섹션 (sp_completeness_json이 있는 경우)
        sp_detail_section = ""
        _sp_raw = biz.get("sp_completeness_json") or {}
        if isinstance(_sp_raw, str):
            try:
                _sp_raw = json.loads(_sp_raw)
            except Exception:
                _sp_raw = {}
        sp_json = _sp_raw
        if sp_json and not sp_json.get("error"):
            faq_cnt = sp_json.get("faq_count", 0)
            intro_chars = sp_json.get("intro_char_count", 0)
            recent_post_date = sp_json.get("recent_post_date", "")
            photo_count_sp = sp_json.get("photo_count", 0)
            faq_ok = "✅" if faq_cnt >= 3 else "❌ 3개 이상 필요"
            intro_ok = "✅" if intro_chars >= 200 else f"❌ {200 - intro_chars}자 부족 (최소 200자 권장)"
            post_ok = "✅" if recent_post_date else "❌ 소식 없음"
            photo_ok = "✅" if photo_count_sp >= 5 else "⚠️ 5장 이상 권장"
            sp_detail_section = "\n".join([
                "\n## 스마트플레이스 자동 분석 결과 (체크박스 대신 이 실제 데이터 우선 사용)",
                f"- 소개글 Q&A 수: {faq_cnt}개 {faq_ok}",
                f"- 소개글 길이: {intro_chars}자 {intro_ok}",
                f"- 최근 소식: {recent_post_date or '없음'} {post_ok}",
                f"- 사진 수: {photo_count_sp}장 {photo_ok}",
            ])

        # ★ 외부 언급 전략 섹션 (업종별 맞춤 채널)
        try:
            from services.keyword_taxonomy import build_location_service_keywords
            location_kws = build_location_service_keywords(biz.get("region", ""), biz.get("category", ""))
        except Exception:
            location_kws = []
        biz_name_for_ext = biz.get("name", "우리 가게")
        first_loc_kw = location_kws[0] if location_kws else "업종 키워드"
        loc_kw_str = ", ".join(location_kws[:4]) if location_kws else "지역+업종 키워드"
        _cat = biz.get("category", "other")
        _region_short_ext = biz.get("region", "지역").strip().split()[0] if biz.get("region") else "지역"
        _ext_channels = _EXTERNAL_CHANNEL_MAP.get(_cat) or _EXTERNAL_CHANNEL_MAP["other"]
        channel_lines_ext = []
        for i, (ch_name, ch_action) in enumerate(_ext_channels, 1):
            try:
                ch_action_formatted = ch_action.format(
                    region=_region_short_ext,
                    keyword=first_loc_kw,
                    biz_name=biz_name_for_ext,
                )
            except Exception:
                ch_action_formatted = ch_action
            channel_lines_ext.append(f"  {i}. {ch_name}: {ch_action_formatted}")
        external_section = "\n".join([
            "\n## 외부 언급 전략 (AI는 여러 곳에서 언급된 업체를 신뢰함)",
            f"- 목표 키워드: {loc_kw_str}",
            f"- 핵심 원리: '{biz_name_for_ext}' 이름이 여러 채널에서 일관되게 등장해야 AI가 신뢰함",
            "- 업종 맞춤 추천 채널:",
            *channel_lines_ext,
            "- 지시사항: weekly_roadmap 3~4주차에 외부 언급 전략을 반드시 포함할 것",
        ])

        # ★ 계절 키워드 섹션 (이번 달 주목 키워드)
        seasonal_section = ""
        try:
            import datetime as _dt
            from services.keyword_taxonomy import get_seasonal_keywords
            _current_month = _dt.date.today().month
            _category = biz.get("category", "")
            _seasonal_kws = get_seasonal_keywords(_category, _current_month)
            if _seasonal_kws:
                seasonal_section = (
                    f"\n## 이번 달 주목 계절 키워드 ({_current_month}월)\n"
                    f"{', '.join(_seasonal_kws)}\n"
                    "- 지시사항: 이 키워드들을 리뷰 답변 초안·소개글·FAQ 예시에 자연스럽게 포함할 것."
                    " 단, 계절과 무관한 경우 무리하게 포함하지 말 것."
                )
        except Exception as _sea_err:
            _logger.debug(f"seasonal_keywords skip: {_sea_err}")

        keywords = biz.get("keywords") or []
        keywords_str = ", ".join(keywords[:6]) if keywords else "등록된 키워드 없음"

        # v4.1 summary 내 브리핑 미노출 진단 문구 — eligibility 분기
        if naver_in_briefing:
            _summary_briefing_hint = "네이버 브리핑 노출 중"
        elif eligibility == "inactive":
            _summary_briefing_hint = "이 업종은 네이버 AI 브리핑 비대상 — ChatGPT·Gemini·Google AI 노출 개선이 핵심"
        elif eligibility == "likely":
            _summary_briefing_hint = "AI 브리핑 확대 예상 업종 — 미리 5단계 준비 권장"
        else:
            _summary_briefing_hint = "네이버 AI 브리핑 미노출이 가장 큰 문제"

        return f"""다음 사업장의 AI 검색 개선 가이드를 생성해주세요.

## 사업장 정보
- 상호명: {biz.get('name', '')}
- 업종: {biz.get('category', '')}
- 지역: {biz.get('region', '온라인/전문직')}
- 등록 키워드: {keywords_str}
- 웹사이트: {'있음 (' + biz.get('website_url') + ')' if biz.get('website_url') else '없음'}
- 평점: {avg_rating}점
{context_note}{briefing_header_section}
{smart_place_section}

## AI 스캔 결과
- 현재 AI 노출 빈도: {my_freq}/100회 (종합 {my_score:.1f}점)
- 네이버 AI 브리핑 노출: {_naver_briefing_exposure_msg(naver_in_briefing, eligibility)}
- ChatGPT 노출: {'있음' if ((scan_result.get('chatgpt_result') or {}).get('mentioned') or (scan_result.get('chatgpt_result') or {}).get('exposure_freq', 0) > 0) else '없음'}

{channel_section}{cross_ai_section}{website_section}{kakao_section}{keyword_section}{v3_1_section}{stage_section}{blog_section}{sp_detail_section}{external_section}{seasonal_section}

## 경쟁사 대비 취약 점수 (gap 큰 순)
{_format_competitor_gaps(breakdown, top_comp)}

## 요청
위 데이터를 분석해서 아래 JSON 형식으로 개선 가이드를 생성해주세요.

중요 지침:
- "이미 완료된 항목"에 있는 것은 절대 재추천하지 말 것 (예: 이미 스마트플레이스 등록됨 → 등록하라고 하지 말 것, 리뷰가 있음 → 리뷰가 없다고 하지 말 것)
- "현재 미완성 항목"에서 우선순위를 정해 구체적 행동만 추천
- action은 "네이버 스마트플레이스(place.naver.com) 접속 → [탭명] 클릭 → [구체적 내용]" 형태로 단계 명시. 반드시 "복사해서 붙여넣을 수 있는 예시 텍스트"를 포함할 것 (예: 소개글 Q&A 추가면 실제 질문·답변 예시 전문, 소개글 본문이면 완성 문장 예시) — Q&A는 반드시 "스마트플레이스 → 업체정보 → 소개글 안" 경로로 안내할 것 (Q&A 탭은 2026-05 폐기)
- 리뷰 키워드 갭이 있다면 rank 1은 반드시 그 키워드 확보 행동으로 작성
- competitor_example은 제공된 데이터에 있는 경쟁사만 언급, 없으면 null
- 근거 없는 수치 예측 절대 금지 — "노출률 XX% 향상", "순위 X위 진입" 같은 문구 삽입 금지
- 측정 데이터가 없으면 ("미측정" 표시된 항목) 임의 수치를 만들지 말고 "측정 후 가이드 제공" 안내만 할 것
- this_week_mission은 반드시 "easy" 난이도이면서 가장 점수 영향이 큰 1가지만 선택
- weekly_roadmap은 4주간 단계별 실행 계획: 1주차는 즉시 가능한 것, 4주차는 medium 난이도
- JSON 문자열 값에 literal 줄바꿈 절대 금지 — 여러 문장은 한 줄에 공백으로 연결 (예: "1단계: 접속. 2단계: 클릭.")

{{
  "summary": "사장님이 바로 이해할 2문장: 반드시 'AI {my_freq}회/100회({my_score:.1f}점)' 수치로 시작 → {_summary_briefing_hint} → 지금 당장 할 구체적 조치 1개. 수치 없는 일반론 금지.",
  "priority_items": [
    {{
      "rank": 1,
      "category": "리뷰키워드/스마트플레이스/Schema/콘텐츠/정보완성도/채널최적화/키워드순위/블로그/지도카카오맵/AI브리핑 중 하나",
      "title": "개선 항목 제목 (20자 이내, 사장님이 이해하는 말로)",
      "action": "구체적 실행 방법 — 1단계, 2단계로 나눠서 사장님 관점 2~3문장. 반드시 복사·붙여넣기 가능한 예시 텍스트 포함",
      "difficulty": "easy/medium/hard",
      "time_required": "예: 10분, 1시간, 일주일",
      "competitor_example": "제공된 경쟁사 데이터에 있을 경우만 작성, 없으면 null",
      "deep_link": "https://smartplace.naver.com/places/{{place_id}}/해당탭 — 스마트플레이스 관련이면 직접 URL, 아니면 null"
    }}
  ],
  "quick_wins": ["지금 당장 10분 안에 할 수 있는 것 2~3가지 (구체적인 행동으로)"],
  "next_month_goal": "한 달 후 사장님이 체감할 수 있는 변화 (숫자 예측 금지)",
  "weekly_roadmap": [
    {{
      "week": 1,
      "title": "1주차: 즉시 가능한 것부터 (easy)",
      "tasks": ["구체적 행동 1 — 복사·붙여넣기 가능한 텍스트 포함", "구체적 행동 2"],
      "expected_result": "이 주를 마치면 기대할 수 있는 변화 (숫자 예측 금지)"
    }},
    {{
      "week": 2,
      "title": "2주차 제목",
      "tasks": ["구체적 행동 1", "구체적 행동 2"],
      "expected_result": "이 주를 마치면 기대할 수 있는 변화"
    }},
    {{
      "week": 3,
      "title": "3주차 제목",
      "tasks": ["구체적 행동 1", "구체적 행동 2"],
      "expected_result": "이 주를 마치면 기대할 수 있는 변화"
    }},
    {{
      "week": 4,
      "title": "4주차: 중급 과제 (medium)",
      "tasks": ["구체적 행동 1", "구체적 행동 2"],
      "expected_result": "4주 전체를 마치면 체감할 수 있는 변화"
    }}
  ],
  "this_week_mission": {{
    "title": "이번 주 가장 중요한 1가지 (easy 난이도, 가장 점수 영향 큰 것)",
    "why": "왜 이것이 가장 급한지 1문장",
    "steps": ["1단계: ...", "2단계: ...", "3단계: ..."],
    "time_required": "예: 15분",
    "deep_link": "https://smartplace.naver.com/places/{{place_id}}/해당탭 — 스마트플레이스 관련이면 직접 URL, 아니면 null"
  }}
}}"""

    def _parse_response(self, text: str) -> dict:
        import re as _re

        def _fix_json_string_internals(s: str) -> str:
            # trailing commas 제거, literal 줄바꿈/탭 이스케이프
            s = _re.sub(r',(\s*[}\]])', r'\1', s)
            result = []
            in_string = False
            i = 0
            while i < len(s):
                c = s[i]
                if c == '\\' and in_string and i + 1 < len(s):
                    result.append(c)
                    result.append(s[i + 1])
                    i += 2
                    continue
                if c == '"':
                    in_string = not in_string
                elif in_string and c == '\n':
                    result.append('\\n')
                    i += 1
                    continue
                elif in_string and c == '\r':
                    result.append('\\r')
                    i += 1
                    continue
                elif in_string and c == '\t':
                    result.append('\\t')
                    i += 1
                    continue
                result.append(c)
                i += 1
            return ''.join(result)

        clean = text.strip()

        # 마크다운 코드 블록 제거
        if clean.startswith("```"):
            clean = _re.sub(r"^```[a-z]*\n?", "", clean)
            clean = _re.sub(r"\n?```$", "", clean.rstrip()).strip()

        # 1순위: 전체를 바로 JSON 파싱
        try:
            result = json.loads(clean)
            if isinstance(result, dict):
                return result
        except (json.JSONDecodeError, ValueError):
            pass

        # 2순위: 첫 { ~ 마지막 } 사이 추출 후 파싱
        start = clean.find("{")
        end = clean.rfind("}")
        fragment = clean[start:end + 1] if start != -1 and end != -1 and end > start else clean
        if start != -1 and end != -1 and end > start:
            try:
                result = json.loads(fragment)
                if isinstance(result, dict):
                    return result
            except (json.JSONDecodeError, ValueError):
                pass

        # 3순위: literal newlines + trailing comma 수정 후 재시도
        fixed = _fix_json_string_internals(fragment)
        try:
            result = json.loads(fixed)
            if isinstance(result, dict):
                _logger.warning("guide response: recovered after literal-newline fix")
                return result
        except (json.JSONDecodeError, ValueError):
            pass

        # 4순위: 불완전한 JSON 복구 시도 — 닫히지 않은 괄호 추가
        if start != -1:
            frag_fixed = _fix_json_string_internals(clean[start:])
            open_braces = frag_fixed.count("{") - frag_fixed.count("}")
            if open_braces > 0:
                frag_fixed += "}" * open_braces
            try:
                result = json.loads(frag_fixed)
                if isinstance(result, dict):
                    _logger.warning("guide response: incomplete JSON recovered")
                    return result
            except (json.JSONDecodeError, ValueError):
                pass

        # 5순위: Python 리터럴 → JSON 변환 후 재시도
        try:
            normalized = fixed
            normalized = normalized.replace(": None", ": null").replace(":None", ":null")
            normalized = normalized.replace(": True", ": true").replace(":True", ":true")
            normalized = normalized.replace(": False", ": false").replace(":False", ":false")
            result = json.loads(normalized)
            if isinstance(result, dict):
                _logger.warning("guide response: recovered after Python→JSON literal fix")
                return result
        except (json.JSONDecodeError, ValueError):
            pass

        # 6순위: summary 필드만 regex 추출
        summary_match = _re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"', clean)
        if summary_match:
            extracted_summary = summary_match.group(1).replace('\\"', '"').replace('\\n', '\n')
            _logger.warning(f"guide response: only summary extracted, items lost. raw length={len(text)}")
            return {"summary": extracted_summary, "priority_items": [], "quick_wins": []}

        _logger.warning(f"guide response: JSON parse failed, raw length={len(text)}")
        return {"summary": "가이드 생성에 문제가 발생했습니다. 재생성을 시도해주세요.", "priority_items": [], "quick_wins": []}


async def generate_improvement_guide(biz: dict, scan_result: dict, competitor_data: list) -> dict:
    """모듈 레벨 함수 — 하위호환 (routers/guide.py에서 직접 호출 가능)"""
    return await GuideGenerator().generate(biz, scan_result, competitor_data)


async def generate_smartplace_intro(
    business_name: str,
    category_ko: str,
    region: str,
    address: str | None,
    phone: str | None,
    opening_hours: str | None,
    menu_items: str | None,
    specialty: str | None,
    description: str | None,
) -> dict:
    """
    스마트플레이스 소개글 + 블로그 포스트 초안 3종 생성 (Claude Sonnet 4.6)
    schema_gen.py 라우터에서 호출 — 비용 정책 허용 경로 (guide_generator.py)

    반환 구조:
      smartplace_intro  : 소개글 (400-500자)
      blog_drafts       : 3종 블로그 초안 목록
      blog_title        : 하위호환 (blog_drafts[0].title)
      blog_content      : 하위호환 (blog_drafts[0].content)
    """
    prompt = f"""다음 사업장 정보로 네이버 스마트플레이스 소개글과 블로그 포스트 초안 3종을 작성해주세요.

사업장 정보:
- 이름: {business_name}
- 업종: {category_ko}
- 지역: {region}
- 주소: {address or '미입력'}
- 전화: {phone or '미입력'}
- 영업시간: {opening_hours or '미입력'}
- 메뉴·서비스: {menu_items or '미입력'}
- 특징·강점: {specialty or '미입력'}
- 추가 설명: {description or '없음'}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):

{{
  "smartplace_intro": "스마트플레이스 소개글 (400-500자, 자연스러운 한국어, 지역+업종+핵심 키워드 포함, 사장님이 바로 붙여넣기 가능한 완성 문장)",
  "blog_drafts": [
    {{
      "template_type": "신규_오픈",
      "title": "네이버 블로그 포스트 제목 (검색 최적화, 지역+업종+특징 포함, 40자 이내)",
      "content": "블로그 포스트 본문 (800-1200자, 단락 구분 \\n\\n 사용, 가게 소개→메뉴·서비스→위치·교통→영업시간→자주 묻는 질문 2개 순서)",
      "target_keyword": "이 포스트가 타겟하는 핵심 키워드 1개 (예: 강남 음식점 추천)"
    }},
    {{
      "template_type": "메뉴_소개",
      "title": "대표 메뉴·서비스를 중심으로 한 포스트 제목 (40자 이내)",
      "content": "대표 메뉴·서비스 상세 소개 본문 (800-1000자, 메뉴 설명→재료·특징→가격 정보→추천 대상→방문 팁 순서)",
      "target_keyword": "이 포스트가 타겟하는 핵심 키워드 1개 (예: 강남 점심 특선)"
    }},
    {{
      "template_type": "리뷰_모음",
      "title": "고객 후기 중심 포스트 제목 (40자 이내)",
      "content": "고객 후기 형식의 본문 (700-900자, 방문 동기→주문한 것→맛·분위기→장단점→재방문 의향 순서, 자연스러운 후기 톤)",
      "target_keyword": "이 포스트가 타겟하는 핵심 키워드 1개 (예: 강남 음식점 후기)"
    }}
  ]
}}

작성 기준:
- 소개글: 스마트플레이스 소개글 칸에 그대로 붙여넣을 수 있는 완성 텍스트
- 블로그 제목: '{region} {category_ko} 추천', '{business_name} 후기' 형식, 각각 다른 키워드 타겟
- 블로그 본문: 사장님이 약간만 수정해 바로 올릴 수 있는 완성 텍스트
- target_keyword는 실제 네이버 검색에서 사용될 법한 구체적인 구문"""

    try:
        message = await asyncio.to_thread(
            lambda: _get_client().messages.create(
                model="claude-sonnet-4-6",
                max_tokens=3000,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        # 하위호환 필드 자동 추가
        drafts = result.get("blog_drafts", [])
        if drafts:
            result.setdefault("blog_title", drafts[0].get("title", ""))
            result.setdefault("blog_content", drafts[0].get("content", ""))
        return result
    except Exception as e:
        _logger.warning(f"generate_smartplace_intro failed: {e}")
        fallback_intro = (
            f"{business_name}은 {region}에 위치한 {category_ko}입니다.\n"
            f"{description or f'{region} {category_ko} 전문점으로 지역 주민들에게 사랑받고 있습니다.'}\n\n"
            f"위치: {address or region} | 전화: {phone or '문의 주세요'}\n"
            f"영업시간: {opening_hours or '전화 문의'}"
        )
        fallback_blog_content = (
            f"안녕하세요, {business_name}을 소개합니다!\n\n"
            f"{region}에 위치한 {category_ko}으로, "
            f"{description or '지역 주민들에게 사랑받고 있습니다.'}\n\n"
            f"■ 위치 및 연락처\n주소: {address or region}\n전화: {phone or '문의 주세요'}\n\n"
            f"■ 영업시간\n{opening_hours or '영업시간은 전화로 확인해 주세요.'}\n\n"
            f"■ 자주 묻는 질문\nQ. {business_name} 위치가 어디인가요?\nA. {address or region}에 있습니다.\n\n"
            f"Q. 예약이 필요한가요?\nA. {phone or '전화'}로 문의해 주세요."
        )
        fallback_title = f"{business_name} | {region} {category_ko} 정보 총정리"
        return {
            "smartplace_intro": fallback_intro,
            "blog_drafts": [
                {
                    "template_type": "신규_오픈",
                    "title": fallback_title,
                    "content": fallback_blog_content,
                    "target_keyword": f"{region} {category_ko} 추천",
                },
                {
                    "template_type": "메뉴_소개",
                    "title": f"{business_name} 메뉴·서비스 총정리",
                    "content": (
                        f"{business_name}의 대표 메뉴와 서비스를 소개합니다.\n\n"
                        f"■ 메뉴·서비스\n{menu_items or '다양한 메뉴를 준비하고 있습니다.'}\n\n"
                        f"■ 특징\n{specialty or f'{region} {category_ko} 중 최고의 품질을 자랑합니다.'}\n\n"
                        f"■ 방문 안내\n주소: {address or region} | 전화: {phone or '문의 주세요'}"
                    ),
                    "target_keyword": f"{region} {category_ko} 메뉴",
                },
                {
                    "template_type": "리뷰_모음",
                    "title": f"{business_name} 방문 후기",
                    "content": (
                        f"{region}에서 {category_ko}을 찾다가 {business_name}을 방문했습니다.\n\n"
                        f"{description or '처음 방문이었지만 정말 만족스러웠습니다.'}\n\n"
                        f"위치도 접근하기 편리하고, 직원분들도 친절했습니다.\n\n"
                        f"재방문 의향 있으며, {region} {category_ko}을 찾으신다면 강력 추천합니다!"
                    ),
                    "target_keyword": f"{region} {category_ko} 후기",
                },
            ],
            "blog_title": fallback_title,
            "blog_content": fallback_blog_content,
        }


async def generate_faq_drafts(
    biz_name: str,
    category: str,
    keywords: list,
    count: int = 5,
) -> list:
    """스마트플레이스 Q&A용 FAQ 초안 생성 (Claude Haiku)"""
    import json
    import re
    import os
    import anthropic

    kw_str = ", ".join(keywords[:10]) if keywords else "없음"
    prompt = (
        f"당신은 한국 소상공인의 네이버 스마트플레이스 최적화 전문가입니다.\n\n"
        f"사업장: {biz_name}\n"
        f"업종: {category}\n"
        f"주요 키워드: {kw_str}\n\n"
        f"위 사업장의 소개글 하단 Q&A 섹션 또는 톡톡 채팅방 메뉴에 등록할 FAQ {count}개를 생성해주세요.\n"
        f"(스마트플레이스 Q&A 탭은 2026년 폐기됨 — 소개글 본문 안에 Q&A 형식으로 삽입)\n"
        f"- 고객이 실제로 자주 묻는 질문 형태\n"
        f"- 네이버 AI 브리핑이 인용하기 좋은 구체적인 답변 (50-100자, 첫 문장 30~60자 즉답형)\n"
        f"- 업종 특성에 맞는 키워드 자연스럽게 포함\n\n"
        f"반드시 아래 JSON 형식으로만 응답:\n"
        '[{"question": "질문1", "answer": "답변1"}]'
    )
    try:
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if m:
            return json.loads(m.group())
        return []
    except Exception as e:
        _logger.warning("generate_faq_drafts error: %s", e)
        return []


# ─── 소개글 + 톡톡 채팅방 메뉴 생성 (Claude Sonnet — guide_generator.py 허용 경로) ──────

_INTRO_PROMPT_TMPL = """당신은 네이버 스마트플레이스 소개글 전문 작가입니다.

다음 사업장 정보를 바탕으로 네이버 AI 브리핑 + 일반 검색 노출에 최적화된 소개글을 작성하세요.

[사업장 정보]
- 가게명: {name}
- 업종: {category_label}
- 지역: {region}
- 핵심 키워드: {keywords}
- 주요 서비스: {services}

[작성 원칙]
1. 첫 문장: "{region} {category_label} 전문 {name}입니다." 형태로 시작
2. 글자수: {target_length}자 ±50자 (한글 기준)
3. 자주 묻는 질문 5개를 Q&A 형식으로 포함:
   "[자주 묻는 질문]" 제목 후 "Q. [질문]\\nA. [답변]" 형식
4. 지역명 + 서비스명 조합을 3회 이상 자연스럽게 반복
5. 구체적 정보 포함 (가격대·운영시간·예약방법·위치 특징)
6. 추상적 표현 금지 ("최고", "최상" 등 → 구체적 수치·사실로)
7. 검색 최적화: 핵심 키워드를 소개글 앞부분에 자연스럽게 배치

[Q&A 5가지 추천 질문 카테고리]
1. 가격/비용
2. 운영시간/예약
3. 위치/주차
4. 주요 서비스 차별점
5. 결제/취소 정책

소개글만 출력하세요. 다른 설명·인사말 금지."""

_TALKTALK_FAQ_PROMPT_TMPL = """당신은 네이버 톡톡 챗봇 콘텐츠 전문가입니다.

다음 사업장의 톡톡 채팅방 메뉴에 등록할 자주 묻는 질문 {count}개와 메뉴 5개를 생성하세요.

[사업장 정보]
- 가게명: {name}
- 업종: {category_label}
- 지역: {region}
- 주요 서비스: {services}

[FAQ 작성 원칙]
1. 톡톡 채팅창에서 고객이 클릭할 만한 자연스러운 질문
2. 답변은 친근하지만 정보가 명확한 2~4문장
3. 가격·예약·위치·서비스·결제 카테고리에서 골고루 선정

[채팅방 메뉴 원칙]
1. 5개 정확히 (네이버 톡톡 메뉴 권장 개수)
2. 명사형 짧은 제목 (10자 이내)
3. 고객이 가장 자주 묻는 항목 우선

JSON 형식으로만 출력 (다른 설명 금지):
{{
  "items": [
    {{"question": "...", "answer": "...", "category": "가격"}},
    ...
  ],
  "chat_menus": ["가격 안내", "예약 방법", ...]
}}"""


async def generate_naver_intro(
    biz_name: str,
    category_label: str,
    region: str,
    keywords: list,
    target_length: int = 400,
) -> str:
    """네이버 스마트플레이스 소개글 생성 (Claude Sonnet — guide_generator.py 허용 경로).

    Q&A 5개 포함된 300~500자 소개글 반환.
    """
    prompt = _INTRO_PROMPT_TMPL.format(
        name=biz_name,
        category_label=category_label,
        region=region,
        keywords=", ".join(keywords[:8]) if keywords else "미등록",
        services="(미입력 — 업종 기반으로 일반적인 서비스 작성)",
        target_length=max(300, min(500, target_length)),
    )
    try:
        text = await asyncio.to_thread(
            lambda: _get_client().messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
                timeout=60.0,
            ).content[0].text.strip()
        )
        return text
    except Exception as e:
        _logger.warning(f"generate_naver_intro failed: {e}")
        raise


async def generate_talktalk_faq(
    biz_name: str,
    category_label: str,
    region: str,
    services: str,
    count: int = 10,
) -> dict:
    """톡톡 채팅방 메뉴 + 자주 묻는 질문 생성 (Claude Sonnet — guide_generator.py 허용 경로).

    반환 구조: {"items": [...], "chat_menus": [...]}
    """
    prompt = _TALKTALK_FAQ_PROMPT_TMPL.format(
        name=biz_name,
        category_label=category_label,
        region=region,
        services=services,
        count=count,
    )
    try:
        raw = await asyncio.to_thread(
            lambda: _get_client().messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
                timeout=60.0,
            ).content[0].text.strip()
        )
    except Exception as e:
        _logger.warning(f"generate_talktalk_faq Claude call failed: {e}")
        raise

    # JSON 파싱
    try:
        clean = raw
        if clean.startswith("```"):
            clean = re.sub(r"^```[a-z]*\n?", "", clean)
            clean = re.sub(r"\n?```$", "", clean.rstrip()).strip()
        start = clean.find("{")
        end = clean.rfind("}")
        if start != -1 and end > start:
            return json.loads(clean[start:end + 1])
    except Exception as parse_err:
        _logger.warning(f"generate_talktalk_faq JSON parse failed: {parse_err}. raw={raw[:200]}")

    raise ValueError("톡톡 채팅방 메뉴 JSON 파싱 실패 — fallback 처리 필요")
