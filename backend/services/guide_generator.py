"""
개선 가이드 생성 서비스
- AI 개선 가이드: Claude Sonnet 4.6
- 소개글·블로그 초안(generate_smartplace_intro): Claude Haiku 4.5 (2026-06-17 전환)
- FAQ·채팅방 메뉴: Claude Haiku 4.5
도메인 모델 v2.1 Phase D: ActionPlan + ActionTools 생성
"""
import os
import json
import re
import uuid
import asyncio
import logging
from datetime import datetime, timedelta, timezone
import anthropic

from models.context import ScanContext
from models.action import ActionItem, ActionPlan
from services.action_tools import build_action_tools
from services.industry_prompt_rules import build_industry_system_prompt
from services.ai_usage_logger import log_ai_usage
from services.briefing_engine import _select_josa
# 의료·법률 업종 광고 규정 가드(2026-11-06): 해당 업종이 아니면 프롬프트·결과 모두 그대로다
from services.regulated_industry import prompt_note as _reg_note, scrub_generated as _reg_scrub
# 블로그 초안 3번째(리뷰_모음) 정책(2026-11-06): 가공 후기 금지 — 일반 업종은 빈칸 틀, 의료·법률은 방문 안내
from services.review_draft_policy import review_draft_specs, ensure_review_draft, fallback_review_draft

_logger = logging.getLogger("aeolab")

# 네이버 AI 브리핑 게이팅 (v4.1) — import 실패 시 fallback "active"
try:
    from services.score_engine import get_briefing_eligibility as _get_eligibility, DUAL_TRACK_RATIO, DEFAULT_DUAL_TRACK_RATIO, normalize_category as _normalize_category
except Exception as _elig_import_err:
    _logger.warning(f"get_briefing_eligibility import 실패, fallback active 처리: {_elig_import_err}")
    def _get_eligibility(category: str, is_franchise: bool = False) -> str:  # type: ignore[misc]
        return "active"
    def _normalize_category(cat: str) -> str:  # type: ignore[misc]
        return cat
    DUAL_TRACK_RATIO: dict = {}
    DEFAULT_DUAL_TRACK_RATIO: dict = {"naver": 0.60, "global": 0.40}


def _briefing_strategy_header(eligibility: str, is_franchise: bool) -> str:
    """eligibility/is_franchise 기반 상단 안내 한 줄 반환 (ACTIVE는 빈 문자열)."""
    if eligibility == "active":
        return ""
    if eligibility == "likely":
        return (
            "ℹ️ 이 업종은 '플레이스형' AI 브리핑 확대 예상 업종입니다. "
            "미리 5단계를 완료해두면 확대 즉시 노출됩니다. "
            "단, 블로그·콘텐츠 기반 '정보형 AI 브리핑'은 지금도 노출 가능합니다."
        )
    # inactive
    if is_franchise:
        return (
            "🏢 프랜차이즈 가맹점은 '플레이스형' 네이버 AI 브리핑 제공 대상에서 제외됩니다(추후 확대 예정). "
            "단, 블로그·콘텐츠 기반 '정보형 AI 브리핑'과 글로벌 AI 노출은 가능합니다."
        )
    return (
        "ℹ️ 이 업종은 '플레이스형' 네이버 AI 브리핑 비대상이지만, "
        "블로그·콘텐츠 강화는 '정보형 네이버 AI 브리핑'과 ChatGPT·Gemini·Google AI 노출에 동일하게 효과적입니다."
    )


def _regen_config() -> tuple[int, float]:
    """(최대 재생성 횟수, 재생성 기준 점수) — 가이드 전용 환경변수 (2026-11-05).

    가이드 1건은 Sonnet 호출당 약 118원이고, 예전 설정(70점 미만이면 최대 2회 재생성)은 관측 6건에서 평균 2.5회·약 295원을 썼다.
    재생성이 점수를 올린 것은 첫 점수가 43.7로 아주 낮던 1건뿐이고 68.7처럼 애매한 점수에서는 올린 적이 없다(표본 작음).
    그래서 기본값은 "60점 미만일 때만 최대 1회". GUIDE_MAX_REGEN=0이면 재생성 안 함, GUIDE_REGEN_BELOW로 기준 조정, 잘못된 값은 기본값으로 돌아간다.
    ⚠ MAX_CLAUDE_CALLS_PER_JOB은 jobs.py 3곳(기본 50)이 같이 쓰는 변수라 가이드 때문에 줄이면 그 잡들의 한도까지 줄어든다 — 여기서 쓰지 않는다.
    """
    try:
        n = int(os.getenv("GUIDE_MAX_REGEN", "1"))
    except ValueError:
        n = 1
    try:
        below = float(os.getenv("GUIDE_REGEN_BELOW", "60"))
    except ValueError:
        below = 60.0
    return max(0, min(n, 2)), below


def _sp_num(v):
    """숫자(정수·실수)만 돌려준다. None·문자열·bool은 None — 값이 없는 것을 0이나 비교 대상으로 쓰지 않는다."""
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def format_smart_place_detail(sp_json) -> str:
    """스마트플레이스 자동 분석 결과를 가이드 프롬프트 문단으로 만든다.

    값이 None이거나 AEOlab이 읽지 못한 항목(*_measured=false·recent_post_state='unmeasured')은 숫자 비교에 쓰지 않고
    "확인 전"으로 쓴다. `sp_json.get(key, 0)`은 키가 있고 값이 None이면 기본값을 주지 못해 `None >= 5`로 가이드 생성이 통째로 실패했고
    (2026-11-04 가입 후 체험: 점검이 성공하자 처음 드러남), 읽지 못한 소식을 "소식 없음"으로 단정해 AI에 넘기고 있었다.
    """
    if not isinstance(sp_json, dict) or not sp_json or sp_json.get("error"):
        return ""
    intro_chars = _sp_num(sp_json.get("intro_char_count"))
    photo_cnt = _sp_num(sp_json.get("photo_count"))
    recent_post_date = sp_json.get("recent_post_date") or ""
    intro_read = sp_json.get("intro_measured") is not False and intro_chars is not None
    post_read = sp_json.get("recent_post_measured") is not False and sp_json.get("recent_post_state") != "unmeasured"

    lines = ["\n## 스마트플레이스 자동 분석 결과 (체크박스 대신 이 실제 데이터 우선 사용)"]
    unknown = False
    # 소개글 Q&A 개수는 자동으로 확인하지 못한다 — 사장님 Q&A 탭 폐기(2026-05-01)로 감지를 중단해 faq_count는 항상 0인 상수다.
    # 이 0을 "현재 Q&A 0개"로 AI에 넘기면 가이드가 측정하지 않은 사실을 말한다(2026-11-04). 개수는 말하지 않고 추가만 권하게 한다.
    lines.append("- 소개글 Q&A: 자동으로 확인하지 못하는 항목 (개수는 언급하지 말고, 소개글 하단에 Q&A를 추가하라는 안내만 할 것)")
    if intro_read:
        intro_ok = "✅" if intro_chars >= 200 else f"❌ {200 - int(intro_chars)}자 부족 (최소 200자 권장)"
        lines.append(f"- 소개글 길이: {int(intro_chars)}자 {intro_ok}")
    else:
        lines.append("- 소개글 길이: 확인 전 (읽지 못함)")
        unknown = True
    if post_read:
        lines.append(f"- 최근 소식: {recent_post_date or '없음'} {'✅' if recent_post_date else '❌ 소식 없음'}")
    else:
        lines.append("- 최근 소식: 확인 전 (읽지 못함)")
        unknown = True
    if photo_cnt is None:
        lines.append("- 사진 수: 확인 전")
        unknown = True
    else:
        lines.append(f"- 사진 수: {int(photo_cnt)}장 {'✅' if photo_cnt >= 5 else '⚠️ 5장 이상 권장'}")
    if unknown:
        lines.append("- 주의: '확인 전'은 AEOlab이 읽지 못한 값이다. 있다/없다로 단정하지 말고, 사장님이 스마트플레이스에서 직접 확인하도록 안내할 것")
    return "\n".join(lines)


def _faq_missing_msg(eligibility: str) -> str:
    if eligibility == "inactive":
        return "FAQ는 ChatGPT·Gemini가 사용자 질문에 답변할 때 참고할 수 있는 정보입니다"
    return "소개글 Q&A 없음 — 네이버 AI 브리핑 노출에 가장 효과 큰 항목 (소개글 하단에 추가)"


def _intro_missing_msg(eligibility: str) -> str:
    if eligibility == "inactive":
        return "소개글 핵심 정보 정리는 AI탭 노출에 효과적입니다. ChatGPT·Gemini 노출은 구글 비즈니스 프로필 등록이 더 직접적입니다"
    return "소개글(인트로) 없음 — 키워드 3~5개 포함한 2~3문장 소개글 필요"


def _post_missing_msg(eligibility: str) -> str:
    """소식 없음 메시지 — eligibility에 무관하게 공통이나 INACTIVE는 톤 완화."""
    if eligibility == "inactive":
        return "소식 게시물 없음 — 최신 정보 업데이트로 AI 정보 정확도 향상"
    return "소식 게시물 없음 — 주 1회 업로드 시 최신성 점수 유지됨"


def _naver_briefing_exposure_msg(naver_in_briefing: bool, eligibility: str, unmeasured: bool = False) -> str:
    if naver_in_briefing:
        return "있음 ✅"
    if unmeasured:
        return "측정 실패(일시적 차단·오류) — 다음 측정에서 재확인 필요, 현재 결과로 미노출 단정 불가"
    if eligibility == "inactive":
        return "플레이스형 네이버 AI 브리핑은 현재 이 업종 비대상입니다 — 블로그·콘텐츠로 정보형 AI 브리핑 + ChatGPT·Gemini·Google AI 노출 개선 가능"
    if eligibility == "likely":
        return "없음 ⚠️ — 확대 예상 업종, 미리 준비 권장 (블로그·콘텐츠로 정보형 AI 브리핑 노출은 지금도 가능)"
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
        ("유튜브 Shorts", "짧은 운동 팁 영상 업로드 (검색 노출 효과)"),
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

# 이 모듈의 모든 Claude 호출부(GuideGenerator._call_claude_async·generate_smartplace_intro·
# generate_naver_intro·generate_global_ai_intro·generate_talktalk_faq)가 공유하는 AsyncAnthropic
# 싱글턴 — 이전엔 동기 Anthropic 클라이언트를 asyncio.to_thread()로 호출해, 긴 응답(가이드 생성은
# max_tokens=8192 + 재시도 최대 3회×2모델, schema는 4096) 내내 DB 호출과 공유하는 스레드풀 슬롯을
# 붙잡아 동시 사용자가 늘면 스레드풀 고갈로 사이트 전체가 느려질 수 있었음. 전부 진짜 async
# 클라이언트로 전환해 스레드풀을 아예 안 씀 — 동기 클라이언트(_client/_get_client)는 더 이상
# 쓰는 곳이 없어 제거함(2026-07-15).
_async_client: anthropic.AsyncAnthropic | None = None


def _get_async_client() -> anthropic.AsyncAnthropic:
    global _async_client
    if _async_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다")
        _async_client = anthropic.AsyncAnthropic(api_key=api_key, timeout=60.0)
    return _async_client


async def _create_message_with_retry(**kwargs):
    """429(rate limit) 한정 1회 재시도 — services/anthropic_retry.py 공유 헬퍼로 위임(2026-07-15).
    generate_smartplace_intro·generate_faq_drafts·generate_naver_intro·
    generate_global_ai_intro·generate_talktalk_faq 5곳이 공유. _call_claude_async는
    이미 자체 모델폴백+529재시도 루프가 있어 대상에서 제외."""
    from services.anthropic_retry import create_message_with_retry
    return await create_message_with_retry(_get_async_client(), **kwargs)


# v3.0 breakdown 키 기준 (score_engine.py calculate_score() 반환 breakdown과 일치)
# v3.1 신규 4개 항목 추가 — model_version=="v3.1" 시 breakdown에 평탄화되어 존재
_DIMENSION_LABELS = {
    # v3.0 호환 항목
    "keyword_gap_score":        "빠진 검색어",
    "review_quality":           "리뷰 품질",
    "smart_place_completeness": "스마트플레이스 완성도",
    "naver_exposure_confirmed": "네이버 AI 브리핑 노출",
    "multi_ai_exposure":        "멀티 AI 노출",
    "schema_seo":               "AI 인식 코드",
    # v3.1 신규 항목
    "keyword_search_rank":      "네이버 키워드 검색 순위",
    "blog_crank":               "블로그 현황",
    "local_map_score":          "지도·플레이스 노출",
    "ai_briefing_score":        "AI 브리핑 노출",
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
        raw = await self._call_claude_async(prompt, system_prompt)
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
        raw = await self._call_claude_async(prompt, system_prompt)
        guide = self._parse_response(raw)

        # §C 콘텐츠 품질 게이트 — 70점 미만 시 자동 재생성 (최대 2회)
        # content_validator.validate_intro_dia()는 원래 소개글(마케팅 카피)용이라 "information"
        # (가격·시간·위치 구체 수치)·"authority"(운영 연수·수상) 두 요소는 실제 입력 데이터에 없는
        # 사실을 채워 넣으라는 신호가 되기 쉬움 — 가이드는 소개글이 아니라 행동지침이라 이 두 요소는
        # 게이팅/재생성 지시에서 제외(diversity·timeliness·originality만 사용, 60점 만점 재환산).
        # (2026-08-09 발견 — 실측 시뮬레이션 결과 이 두 요소 제외 전엔 70점 문턱을 사실상 넘을 수
        # 없어 매 생성마다 사실 지어내기 압력이 담긴 재생성이 거의 항상 발동했음)
        _DIA_DIMS = ("diversity", "timeliness", "originality")
        _DIA_DIM_MAX = {"diversity": 25, "timeliness": 15, "originality": 20}
        _DIA_MAX_TOTAL = sum(_DIA_DIM_MAX.values())

        def _guide_quality_score(dia: dict) -> float:
            total = 0.0
            for _elem, _mx in _DIA_DIM_MAX.items():
                _d = dia.get(_elem, {})
                total += _d.get("score", 0) if isinstance(_d, dict) else 0
            return round(total / _DIA_MAX_TOTAL * 100, 1) if _DIA_MAX_TOTAL else 0.0

        _dia_score: float = 0.0
        _dia_validation: dict = {}
        _dia_regenerated: int = 0
        _max_retries, _regen_below = _regen_config()   # 초기 1회 + 재생성 최대 _max_retries회, _regen_below 미만일 때만
        try:
            from services.content_validator import validate_intro_dia
            _biz_keywords = biz.get("keywords") or []

            def _run_dia(text: str) -> dict:
                return validate_intro_dia(text, keywords=_biz_keywords, lsi_keywords=_biz_keywords)

            _dia_validation = _run_dia(raw or "")
            _dia_score = _guide_quality_score(_dia_validation)
            # 재생성이 오히려 점수를 낮추는 경우가 실제로 있었다(2026-11-04: 68.7 → 43.7 — 낮은 쪽이 저장됨). 가장 좋은 시도를 남긴다.
            _best = (_dia_score, guide, _dia_validation)

            # 재생성 루프
            for _retry in range(_max_retries):
                if _dia_score >= _regen_below:
                    break
                # 부족 요소 분석
                _weak_elements = []
                for _elem in _DIA_DIMS:
                    _elem_data = _dia_validation.get(_elem, {})
                    _elem_score = _elem_data.get("score", 0) if isinstance(_elem_data, dict) else 0
                    _elem_max = _DIA_DIM_MAX.get(_elem, 20)
                    if _elem_score < _elem_max * 0.6:
                        _weak_elements.append(_elem)
                _weak_labels = {
                    "diversity": "다양성(LSI 키워드 4개 이상 포함)",
                    "timeliness": "적시성(YYYY년 MM월 형태의 날짜 마커)",
                    "originality": "독창성(시그니처·전용·차별 표현, 추상어 제거)",
                }
                _weak_desc = ", ".join(_weak_labels.get(e, e) for e in _weak_elements) or "전체 요소"
                _regen_system = (
                    system_prompt
                    + f"\n\n[재생성 지시] 이전 답변의 콘텐츠 품질 점수가 {_dia_score:.0f}/100이었습니다. "
                    f"다음 부족 요소를 반드시 보강하세요: {_weak_desc}. "
                    "(확인되지 않은 가격·운영기간·수상 등 사실을 지어내지 말 것 — 제공된 데이터 범위 내에서만 보강)"
                )
                _logger.warning(
                    f"[guide_generator] 콘텐츠 품질 점수 {_dia_score}/100 — 재생성 {_retry + 1}/{_max_retries} 시도 "
                    f"(부족: {_weak_elements})"
                )
                raw = await self._call_claude_async(prompt, _regen_system)
                guide = self._parse_response(raw)
                _dia_validation = _run_dia(raw or "")
                _dia_score = _guide_quality_score(_dia_validation)
                _dia_regenerated += 1
                if _dia_score > _best[0]:
                    _best = (_dia_score, guide, _dia_validation)

            if _best[0] > _dia_score:
                _logger.info(f"[guide_generator] 재생성 결과({_dia_score})보다 앞선 시도({_best[0]})를 사용")
                _dia_score, guide, _dia_validation = _best

            # 최종 점수 로깅
            if _dia_score < _regen_below:
                _logger.error(
                    f"[guide_generator] 콘텐츠 품질 재생성 {_dia_regenerated}회 후에도 "
                    f"점수 미달 ({_dia_score}/100) — 현재 가이드 반환 (서비스 가용성 우선)"
                )
            elif _dia_regenerated > 0:
                _logger.info(
                    f"[guide_generator] 콘텐츠 품질 재생성 {_dia_regenerated}회 후 {_dia_score}/100 달성"
                )
        except Exception as _dia_e:
            _logger.warning(f"[guide_generator] 콘텐츠 품질 검증/재생성 실패 — {_dia_e}")

        # 콘텐츠 품질 점수별 차등 필드 주입
        guide["dia_score"] = _dia_score
        guide["dia_regenerated"] = _dia_regenerated
        if _dia_score >= 70:
            # 70~89점: 낮은 요소 힌트 포함
            _hint_elems = []
            for _elem in _DIA_DIMS:
                _elem_data = _dia_validation.get(_elem, {})
                _elem_score = _elem_data.get("score", 0) if isinstance(_elem_data, dict) else 0
                _elem_max = _DIA_DIM_MAX.get(_elem, 20)
                if _elem_score < _elem_max * 0.8:
                    _hint_elems.append(_elem)
            if _hint_elems and _dia_score < 90:
                guide["dia_improvement_hints"] = _hint_elems[:2]

        # 확인된 사실과 어긋나는 AI 문구를 걸러낸다(이미 등록된 가게에 "등록하세요", 소식·Q&A 개수 단정 등 — services/guide_fact_guard.py).
        # 가드가 실패해도 가이드 생성은 막지 않는다(원본 사용 + 경고).
        try:
            from services.guide_fact_guard import build_facts, guard_guide
            guide, _guard_notes = guard_guide(guide, build_facts(biz))
            if _guard_notes:
                _logger.info(f"[guide_generator] 사실 가드 적용 biz={biz.get('id')}: {'; '.join(_guard_notes)}")
        except Exception as _guard_e:
            _logger.warning(f"[guide_generator] 사실 가드 실패 — 원본 가이드 사용: {_guard_e}")

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
            except Exception as exc:  # 파싱 실패 시 컨텍스트 부족 가이드 생성 → 로그 필수
                _logger.warning("guide_generator: keyword_gap 파싱 실패 → 빈 dict 사용 (%s)", exc)
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
        # D.I.A. 품질 필드 주입
        plan.dia_score = guide.get("dia_score")
        plan.dia_regenerated = guide.get("dia_regenerated")
        plan.dia_improvement_hints = guide.get("dia_improvement_hints")
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

    async def _call_claude_async(self, user_prompt: str, system_prompt: str | None = None) -> str:
        """AsyncAnthropic 진짜 비동기 호출 — 이전엔 동기 클라이언트를 asyncio.to_thread()로
        감싸 호출해, 재시도(최대 3회 × 2모델)·529 백오프(time.sleep, 최대 30초)까지 전부
        DB 호출과 공유하는 스레드풀 슬롯 하나를 점유했음. /api/guide/generate의 핵심 호출부라
        가장 자주·가장 오래 스레드풀을 붙잡던 지점 — async 전환으로 스레드풀을 아예 안 씀(2026-07-15)."""
        if system_prompt is None:
            system_prompt = build_industry_system_prompt("other")
        models = ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
        last_err = None
        for model in models:
            for attempt in range(3):
                try:
                    message = await _get_async_client().messages.create(
                        model=model,
                        max_tokens=8192,
                        system=system_prompt,
                        messages=[{"role": "user", "content": user_prompt}],
                        timeout=150.0,
                    )
                    try:
                        log_ai_usage("claude", model, "guide_generate", message.usage.input_tokens, message.usage.output_tokens)
                    except Exception as _le:
                        _logger.debug("guide_generate usage 로깅 실패(무시): %s", _le)
                    return message.content[0].text
                except Exception as e:
                    last_err = e
                    is_rate_limit = type(e).__name__ == "RateLimitError" or "429" in str(e)
                    # 529 Overloaded / 429 Rate limit: 대기 후 재시도
                    if "529" in str(e) or "overloaded" in str(e).lower():
                        wait = (attempt + 1) * 10
                        _logger.warning(f"Claude {model} 과부하(529), {wait}초 대기 후 재시도 ({attempt+1}/3)")
                        await asyncio.sleep(wait)
                    elif is_rate_limit:
                        wait = 1.5
                        _logger.warning(f"Claude {model} rate-limited(429), {wait}초 대기 후 재시도 ({attempt+1}/3)")
                        await asyncio.sleep(wait)
                    else:
                        break  # 529/429 외 오류는 즉시 다음 모델로
        try:
            log_ai_usage("claude", models[-1], f"guide_generate:FAILED:{type(last_err).__name__}", 0, 0)
        except Exception as _le:
            _logger.debug("guide_generate 실패 로깅 실패(무시): %s", _le)
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
        # 실제 샘플 크기는 스캔마다 다름(scan_all()은 100회, trial/quick 등은 5회) — 프롬프트에
        # 고정값을 쓰면 실제 노출률을 Claude가 과대·과소평가해 서술할 수 있어 sample_size를 직접 읽음
        my_freq_max = int((scan_result.get("gemini_result") or {}).get("sample_size") or 50)
        # D.I.A. 적시성(timeliness) 게이팅용 — content_validator._check_timeliness()가 "20XX년 X월"
        # 패턴을 찾는데 이 프롬프트가 날짜 마커를 요청하지 않으면 첫 생성이 거의 항상 0점 처리돼
        # 불필요한 재생성(Claude 호출 2~3배)이 발동함 (2026-08-10 발견)
        _now_kst = datetime.now(timezone.utc) + timedelta(hours=9)
        _current_year_month = f"{_now_kst.year}년 {_now_kst.month}월"
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

        # 네이버 AI 브리핑 노출 여부 — mentioned은 일반 플레이스 검색 노출까지 포함하는 넓은 신호,
        # in_briefing이 실제 AI 브리핑 박스 인용 여부다(naver_scanner.py:244-245 참고).
        # "있음 ✅"으로 Claude 프롬프트에 단정하려면 in_briefing을 봐야 한다.
        _naver_res_gg = scan_result.get("naver_result") or {}
        naver_in_briefing = _naver_res_gg.get("in_briefing", False)
        # CAPTCHA 차단·API 오류로 측정 자체가 안 된 경우 "미노출"로 단정하지 않음
        naver_unmeasured = bool(_naver_res_gg.get("captcha_detected")) or bool(_naver_res_gg.get("error"))

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
            _blocked_bots = website_check.get("ai_crawler_blocked_bots") or []
            if _blocked_bots:
                website_issues.append(
                    "robots.txt에서 AI 크롤러 차단 중 (" + ", ".join(_blocked_bots) + ") "
                    "— 다른 개선보다 최우선으로 robots.txt 수정 필요 (구조적 노출 차단)"
                )
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
        avg_rating_str = f"{avg_rating}점" if avg_rating > 0 else "정보 없음 (네이버 방문자 별점 2021년 종료)"
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

        # INACTIVE 업종 Track2 집중 섹션
        # 조건: DUAL_TRACK_RATIO에 등록된 카테고리이면서 global 비중 > 50%인 경우에만 적용
        # (등록 안 된 카테고리는 DEFAULT naver 60% 폴백 → 글로벌 집중 지시 금지)
        track2_focus_section = ""
        if eligibility == "inactive":
            category = biz.get("category", "")
            # normalize_category 적용 — education→academy 등 alias 업종도 정확히 lookup
            ratio = DUAL_TRACK_RATIO.get(_normalize_category(category)) or DUAL_TRACK_RATIO.get(category)
            if ratio is not None:
                global_pct = int(ratio.get("global", 0.40) * 100)
                naver_pct  = int(ratio.get("naver",  0.60) * 100)
                if global_pct > 50:
                    track2_focus_section = f"""
## Track2(글로벌 AI) 집중 지시 — 이 업종은 글로벌 AI 비중 {global_pct}% (네이버 {naver_pct}%)
- 이 업종 사용자는 ChatGPT·Gemini·Google AI에서 업체 정보를 검색하는 비율이 높음
- 가이드의 priority_items 최상위 2개는 반드시 아래 Track2 액션 중에서 선정할 것:
  1. JSON-LD 구조화 데이터 추가 (schema.org/LocalBusiness — AI가 사업장 데이터 직접 파싱)
  2. 웹사이트 또는 블로그에 영문 요약 1단락 작성 (ChatGPT 학습 데이터·Google AI Overview 인식)
  3. Google 비즈니스 프로필 등록·최적화 (Google AI Overview 노출 전제 조건)
  4. 외부 권위 링크 획득 (블로그 포스팅·언론 노출·카카오채널 — AI 신뢰도 지표)
  5. 자주 묻는 질문(FAQ) Schema 마크업 (ChatGPT가 즉답 인용)
- 네이버 스마트플레이스 가이드는 참고용으로만 제공하되 우선순위 최하위로 배치"""

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
- ★ 아래 키워드는 업종 표준 사전에서 뽑은 "확보해야 할 검색어"이지, 이 가게가 실제로 갖춘 특징(분위기·시설·메뉴 등)이 아니다. 가게가 그런 특징을 가졌는지는 확인되지 않았으므로 예시 문장에서 가게의 특징으로 단정하지 말고, 사장님이 실제로 해당될 때만 쓰도록 "[실제로 해당하면 적으세요]"로 안내할 것 특히 "…있음"·"…가능"처럼 시설·서비스형 키워드(단체석 있음·주차 가능 등)는 가게에 실제로 있을 때만 리뷰로 유도하라고 제목에도 "(실제로 있다면)"을 붙일 것
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
            # 순위 점수는 아직 점수에 연결되지 않아(미측정은 항목 생략) 과거 기록의 0.0은 "측정 못 함"이지
            # 실제 0점이 아니다 — 0.0을 "0.0점"으로 가이드에 쓰지 않는다. (순위를 점수에 연결할 때 이 줄 재검토)
            if kw_rank_score is not None and not kw_rank_score:
                kw_rank_score = None
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
| ④ 블로그 생태계 | {_score_str(blog_cr_score)} | 공통 10% |
| ⑤ 지도·플레이스 노출 | {_score_str(local_map_sc)} | ACTIVE 10% / LIKELY 10% / INACTIVE 15% |
| ⑥ AI 브리핑 노출 | {_score_str(ai_brief_sc)} | ACTIVE 25% / LIKELY 15% / INACTIVE 0% |
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
            except Exception as _e:
                _logger.warning(f"[guide_generator] blog_analysis_json 파싱 실패 — {_e}")
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
            except Exception as _e:
                _logger.warning(f"[guide_generator] sp_completeness_json 파싱 실패 — {_e}")
                _sp_raw = {}
        sp_json = _sp_raw
        # None·미측정 값을 숫자 비교에 쓰면 가이드 생성이 통째로 실패하고 읽지 못한 항목이 "없음"으로 단정된다 → format_smart_place_detail
        sp_detail_section = format_smart_place_detail(sp_json)

        # ★ 외부 언급 전략 섹션 (업종별 맞춤 채널)
        try:
            from services.keyword_taxonomy import build_location_service_keywords
            location_kws = build_location_service_keywords(biz.get("region", ""), biz.get("category", ""))
        except Exception as _e:
            _logger.warning(f"[guide_generator] build_location_service_keywords 실패 — {_e}")
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
            except Exception as _e:
                _logger.warning(f"[guide_generator] ch_action.format 실패 — {_e}")
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
            _summary_briefing_hint = "이 업종은 '플레이스형' 네이버 AI 브리핑 비대상 — 블로그·콘텐츠 기반 '정보형 AI 브리핑' + ChatGPT·Gemini·Google AI 노출 개선이 핵심"
        elif eligibility == "likely":
            _summary_briefing_hint = "'플레이스형' AI 브리핑 확대 예상 업종 — 미리 5단계 준비 권장. 단, 블로그·콘텐츠 기반 '정보형 AI 브리핑'은 지금도 노출 가능"
        else:
            _summary_briefing_hint = "네이버 AI 브리핑 미노출이 가장 큰 문제"

        return f"""다음 사업장의 AI 검색 개선 가이드를 생성해주세요.

## 사업장 정보
- 상호명: {biz.get('name', '')}
- 업종: {biz.get('category', '')}
- 지역: {biz.get('region', '온라인/전문직')}
- 등록 키워드: {keywords_str}
- 웹사이트: {'있음 (' + biz.get('website_url') + ')' if biz.get('website_url') else '없음'}
- 평점: {avg_rating_str}
{context_note}{briefing_header_section}
{smart_place_section}

## AI 스캔 결과
- 현재 AI 노출 빈도: {my_freq}/{my_freq_max}회 (종합 {my_score:.1f}점)
- 네이버 AI 브리핑 노출: {_naver_briefing_exposure_msg(naver_in_briefing, eligibility, naver_unmeasured)}
- ChatGPT 노출: {'있음' if ((scan_result.get('chatgpt_result') or {}).get('mentioned') or (scan_result.get('chatgpt_result') or {}).get('exposure_freq', 0) > 0) else ('측정하지 못함(확인 불가)' if (scan_result.get('chatgpt_result') or {}).get('error') else '이번 측정에서는 확인되지 않음')}

{channel_section}{cross_ai_section}{track2_focus_section}{website_section}{kakao_section}{keyword_section}{v3_1_section}{stage_section}{blog_section}{sp_detail_section}{external_section}{seasonal_section}

## 경쟁사 대비 취약 점수 (gap 큰 순)
{_format_competitor_gaps(breakdown, top_comp)}

## 요청
위 데이터를 분석해서 아래 JSON 형식으로 개선 가이드를 생성해주세요.

중요 지침:
- "이미 완료된 항목"에 있는 것은 절대 재추천하지 말 것 (예: 이미 스마트플레이스 등록됨 → 등록하라고 하지 말 것, 리뷰가 있음 → 리뷰가 없다고 하지 말 것)
- "현재 미완성 항목"에서 우선순위를 정해 구체적 행동만 추천
- action은 "네이버 스마트플레이스(place.naver.com) 접속 → [탭명] 클릭 → [구체적 내용]" 형태로 단계 명시. 반드시 "복사해서 붙여넣을 수 있는 예시 텍스트"를 포함할 것 (예: 소개글 Q&A 추가면 실제 질문·답변 예시 전문, 소개글 본문이면 완성 문장 예시) — Q&A는 반드시 "스마트플레이스 → 업체정보 → 소개글 안" 경로로 안내할 것 (Q&A 탭은 2026-05 폐기)
- ★ 사실 지어내기 금지: 복사·붙여넣기 예시 텍스트(Q&A 답변·소개글·소식 문장)는 사장님이 그대로 게시한다. [사업장 정보]에 실제로 제공된 값(가게 이름·지역·주소·전화·실제 키워드)만 사실로 쓰고, 시설·좌석·분위기·메뉴·가격·영업시간·수용 인원·운영 기간·수상·예약 가능 여부처럼 확인되지 않은 내용은 쓰지 말 것. 그런 부분은 "[사장님이 실제 내용을 직접 적어 주세요]"처럼 빈칸으로 남기고, 답변을 "네, 가능합니다"처럼 단정하지 말 것
- ★ "확인 전"으로 표시된 항목과 소개글 Q&A는 "현재 0개"·"없음"으로 단정하지 말고 "스마트플레이스에서 직접 확인해 보세요"로 안내할 것
- ★ 구글 비즈니스 프로필·카카오맵·인스타그램처럼 등록 여부가 확인되지 않은 채널은 "등록하세요"로 단정하지 말고 "등록돼 있는지 먼저 확인하고, 없으면 등록"으로 안내할 것
- ★ 측정 결과가 0회·미노출이어도 "전혀"·"절대" 같은 절대 표현을 쓰지 말고 "이번 측정에서는 확인되지 않았습니다"로 쓸 것(검색을 켠 화면에서는 다를 수 있다)
- 리뷰 키워드 갭이 있다면 rank 1은 반드시 그 키워드 확보 행동으로 작성
- competitor_example은 제공된 데이터에 있는 경쟁사만 언급, 없으면 null
- 근거 없는 수치 예측 절대 금지 — "노출률 XX% 향상", "순위 X위 진입" 같은 문구 삽입 금지
- 측정 데이터가 없으면 ("미측정" 표시된 항목) 임의 수치를 만들지 말고 "측정 후 가이드 제공" 안내만 할 것
- next_month_goal 문장 안에 "{_current_year_month} 기준"이라는 표현을 자연스럽게 반드시 포함할 것 (예: "{_current_year_month} 기준으로 한 달 후...")
- this_week_mission은 반드시 "easy" 난이도이면서 가장 점수 영향이 큰 1가지만 선택
- weekly_roadmap은 4주간 단계별 실행 계획: 1주차는 즉시 가능한 것, 4주차는 medium 난이도
- JSON 문자열 값에 literal 줄바꿈 절대 금지 — 여러 문장은 한 줄에 공백으로 연결 (예: "1단계: 접속. 2단계: 클릭.")

{{
  "summary": "사장님이 바로 이해할 2문장: 반드시 'AI {my_freq}회/{my_freq_max}회 노출' 빈도로 시작(분모는 이번 측정의 실제 표본 수이며 바꾸지 말 것. 표본이 10회 미만이면 '표본이 적어 참고용'이라고 덧붙일 것. 점수·등급 숫자는 절대 언급 금지) → {_summary_briefing_hint} → 지금 당장 할 구체적 조치 1개. 수치 없는 일반론 금지.",
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
  "next_month_goal": "'{_current_year_month} 기준'을 문장 안에 자연스럽게 포함해서, 한 달 후 사장님이 체감할 수 있는 변화 서술 (숫자 예측 금지)",
  "weekly_roadmap": [
    {{
      "week": 1,
      "title": "1주차: 즉시 가능한 것부터 (easy)",
      "tasks": ["구체적 행동 1 — 복사·붙여넣기 가능한 텍스트 포함", "구체적 행동 2"]
    }},
    {{
      "week": 2,
      "title": "2주차 제목",
      "tasks": ["구체적 행동 1", "구체적 행동 2"]
    }},
    {{
      "week": 3,
      "title": "3주차 제목",
      "tasks": ["구체적 행동 1", "구체적 행동 2"]
    }},
    {{
      "week": 4,
      "title": "4주차: 중급 과제 (medium)",
      "tasks": ["구체적 행동 1", "구체적 행동 2"]
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
    category: str | None = None,
) -> dict:
    """
    스마트플레이스 소개글 + 블로그 포스트 초안 3종 생성 (Claude Haiku 4.5 — 2026-06-17 Sonnet→Haiku 전환)
    schema_gen.py 라우터에서 호출 — 비용 정책 허용 경로 (guide_generator.py)

    반환 구조:
      smartplace_intro  : 소개글 (400-500자)
      blog_drafts       : 3종 블로그 초안 목록
      blog_title        : 하위호환 (blog_drafts[0].title)
      blog_content      : 하위호환 (blog_drafts[0].content)
    """
    _reg_cat = category or category_ko     # 코드가 없으면 한글 라벨로도 판정(regulated_industry가 라벨 지원)
    _rv = review_draft_specs(_reg_cat)     # 세 번째 초안: 의료·법률=방문 안내, 그 외=가공 후기 없는 빈칸 틀(review_draft_policy)
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
      "content": "블로그 포스트 본문 (800-1200자, 단락 구분 \\n\\n 사용, 가게 소개→메뉴·서비스→위치·교통→영업시간→자주 묻는 질문 2개 순서. 영업시간은 [사업장 정보]에 있을 때만 쓰고 없으면 생략하거나 '스마트플레이스에서 확인해 주세요'로 안내)",
      "target_keyword": "이 포스트가 타겟하는 핵심 키워드 1개 (예: 강남 음식점 추천)"
    }},
    {{
      "template_type": "메뉴_소개",
      "title": "대표 메뉴·서비스를 중심으로 한 포스트 제목 (40자 이내)",
      "content": "대표 메뉴·서비스 상세 소개 본문 (800-1000자, 메뉴 설명→재료·특징→가격 정보→추천 대상→방문 팁 순서. 재료·가격은 [사업장 정보]에 있을 때만 쓰고 없으면 그 단계는 생략하거나 '스마트플레이스에서 확인해 주세요'로 안내)",
      "target_keyword": "이 포스트가 타겟하는 핵심 키워드 1개 (예: 강남 점심 특선)"
    }},
    {{
      "template_type": "리뷰_모음",
      "title": "{_rv['title']}",
      "content": "{_rv['content']}",
      "target_keyword": "이 포스트가 타겟하는 핵심 키워드 1개 (예: 강남 음식점 후기)"
    }}
  ]
}}

작성 기준:
- 사실 지어내기 금지: 위 [사업장 정보]에 실제로 적힌 값만 사실로 쓴다. "미입력"·"없음"인 항목(가격·영업시간·재료·좌석/수용 인원·주차·시설·운영 기간·수상·인증)은 지어내지 말고 그 부분을 생략하거나 "스마트플레이스에서 확인해 주세요"로 안내한다. 메뉴·서비스 가격, 재료·원산지, 자주 묻는 질문의 답도 제공된 정보 안에서만 쓰고 근거가 없으면 확인 안내로 답한다
- 근거 없는 평판·인기 표현 금지: "많은 고객이 사랑하는", "입소문이 난", "인기 있는", "유명한", "정평이 난", "신뢰할 수 있는"처럼 입력값에 근거가 없는 평판·인기·고객 수 표현은 쓰지 않는다. 사장님이 입력한 '특징·강점'·'추가 설명'에 있는 내용만 쓴다
{_rv['rule']}
- 소개글: 스마트플레이스 소개글 칸에 그대로 붙여넣을 수 있는 완성 텍스트
- 블로그 제목: {_rv['blog_title_fmt'].format(region=region, category_ko=category_ko, business_name=business_name)}, 각각 다른 키워드 타겟
- 블로그 본문: 사장님이 약간만 수정해 바로 올릴 수 있는 완성 텍스트
- target_keyword는 실제 네이버 검색에서 사용될 법한 구체적인 구문"""
    prompt += _reg_note(_reg_cat)

    try:
        try:
            message = await _create_message_with_retry(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", f"smartplace_intro:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", "smartplace_intro", message.usage.input_tokens, message.usage.output_tokens)
        except Exception as _le:
            _logger.debug("smartplace_intro usage 로깅 실패(무시): %s", _le)
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
        result["is_fallback"] = False
        result, _reg_notes = _reg_scrub(_reg_cat, result)     # 의료·법률: 확실히 금지되는 유형의 문장만 뺀다
        if _reg_notes:
            _logger.info("smartplace_intro 규제 표현 정리(%s): %s", _reg_cat, _reg_notes)
        # 세 번째 초안이 정책(가공 후기 금지)을 어기면 대체 초안으로 — 프롬프트 지시는 LLM이 어길 수 있다(서버 실호출 5/5가 가공 후기)
        _drafts, _swapped = ensure_review_draft(result.get("blog_drafts"), _reg_cat, business_name, region, category_ko, address, phone)
        if _swapped:
            result["blog_drafts"] = _drafts
            _logger.info("smartplace_intro 리뷰_모음 초안이 정책 위반이라 대체(%s)", _reg_cat)
        return result
    except Exception as e:
        _logger.warning(f"generate_smartplace_intro failed: {e}")
        fallback_intro = (
            f"{business_name}{_select_josa(business_name, '은', '는')} {region}에 위치한 {category_ko}입니다.\n"
            f"{description or f'{region} {category_ko} 전문점으로 지역 주민들에게 사랑받고 있습니다.'}\n\n"
            f"위치: {address or region} | 전화: {phone or '문의 주세요'}\n"
            f"영업시간: {opening_hours or '전화 문의'}"
        )
        fallback_blog_content = (
            f"안녕하세요, {business_name}{_select_josa(business_name, '을', '를')} 소개합니다!\n\n"
            f"{region}에 위치한 {category_ko}{_select_josa(category_ko, '으로', '로')}, "
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
                        f"■ 메뉴·서비스\n{menu_items or '메뉴·서비스는 스마트플레이스에서 확인해 주세요.'}\n\n"
                        f"■ 특징\n{specialty or '특징은 스마트플레이스에서 확인해 주세요.'}\n\n"
                        f"■ 방문 안내\n주소: {address or region} | 전화: {phone or '문의 주세요'}"
                    ),
                    "target_keyword": f"{region} {category_ko} 메뉴",
                },
                fallback_review_draft(_reg_cat, business_name, region, category_ko, address, phone),
            ],
            "blog_title": fallback_title,
            "blog_content": fallback_blog_content,
            "is_fallback": True,
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
        f"- 업종 특성에 맞는 키워드 자연스럽게 포함\n"
        f"- {count}개 답변의 문장 길이·시작 방식을 서로 다르게 쓸 것 (전부 같은 어투·같은 구조로 시작하지 말 것)\n\n"
        f"반드시 아래 JSON 형식으로만 응답:\n"
        '[{"question": "질문1", "answer": "답변1"}]'
    ) + _reg_note(category)
    try:
        try:
            msg = await _create_message_with_retry(
                model="claude-haiku-4-5-20251001",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", f"faq_drafts:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", "faq_drafts", msg.usage.input_tokens, msg.usage.output_tokens)
        except Exception as _le:
            _logger.debug("faq_drafts usage 로깅 실패(무시): %s", _le)
        raw = msg.content[0].text.strip()
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if m:
            drafts, _reg_notes = _reg_scrub(category, json.loads(m.group()))
            if _reg_notes:
                _logger.info("faq_drafts 규제 표현 정리(%s): %s", category, _reg_notes)
            return drafts
        return []
    except Exception as e:
        _logger.warning("generate_faq_drafts error: %s", e)
        return []


# ─── 소개글 + 톡톡 채팅방 메뉴 생성 (Claude Sonnet — guide_generator.py 허용 경로) ──────

_INTRO_PROMPT_TMPL = """당신은 네이버 스마트플레이스 소개글 전문 작가입니다.

다음 사업장 정보를 바탕으로 네이버 AI 브리핑(C-rank · D.I.A.) + 일반 검색 노출에 최적화된 소개글을 작성하세요.

[사업장 정보]
- 가게명: {name}
- 업종: {category_label}
- 지역: {region}
- 핵심 키워드: {keywords}
- 주요 서비스: {services}
- 주소: {address}
- 전화: {phone}
- 리뷰 수: {review_count}
- 평균 평점: {avg_rating}
- 수상·인증·자격증(사장님 직접 입력, 실제 사실): {awards}
- 시그니처 메뉴·서비스·강점(사장님 직접 입력, 실제 사실): {signature}
- LSI 연관 키워드(자연 배치 권장): {lsi_keywords}

[작성 원칙]
1. 첫 문장: "{region} {category_label} 전문 {name}입니다." 형태로 시작
2. 글자수: {target_length}자 ±50자 (한글 기준)
3. 자주 묻는 질문 5개를 Q&A 형식으로 포함:
   "[자주 묻는 질문]" 제목 후 "Q. [질문]\\nA. [답변]" 형식
4. 지역명 + 서비스명 조합을 3회 이상 자연스럽게 반복
5. 구체적 정보 포함 — 단, 위 [사업장 정보]에 실제로 제공된 값(주소·전화·리뷰 수·평균 평점·핵심 키워드)만 사용. 가격대·운영시간·수용인원·좌석/편의시설(단체석·프라이빗룸·유아의자·주차 대수 등)은 입력값에 없으면 절대 지어내지 말 것.
6. 추상적 표현 금지 ("최고", "최상" 등 → 구체적 수치·사실로) — 단, "구체적으로"가 "확인되지 않은 시설·수치를 지어내라"는 뜻은 아님. 실제 데이터가 없으면 "스마트플레이스에서 확인하세요" 안내로 대체.
7. 검색 최적화: 핵심 키워드를 소개글 앞부분에 자연스럽게 배치
8. 문체: 문장 길이에 자연스러운 변화를 줄 것(짧은 문장+긴 문장 혼합, 매 문단 같은 구조 반복 금지)
9. 다음과 같이 어느 가게에나 붙일 수 있는 상투적 클리셰 문구는 쓰지 말 것 — "고객 만족 중심 운영을 이어가고 있습니다", "최선을 다하겠습니다", "여러분을 모십니다", "정성을 다해 준비했습니다" 등. 대신 실제 제공된 핵심 키워드·리뷰 수·평점 중 하나를 구체적으로 언급하며 마무리할 것

[D.I.A. 5요소 — 반드시 모두 적용]
D(Diversity, 다양성): LSI 연관 키워드 중 4개 이상을 본문에 자연스럽게 사용 (단순 나열 금지). **단, 예외 없이 지킬 것 — 업종 불문(음식점·미용실·학원·병원 등 전 업종 동일 적용)** — LSI 키워드가 이 사업장이 실제로 제공하는지 확인되지 않은 시설·서비스·운영방식·정책·수용범위를 암시하면(예: 음식점 "프라이빗룸"·"30명 수용"·"단체석 있음"·"유아 의자 있음"·"단체 예약 가능"·"회식 장소"·"반려견 동반 가능", 학원 "소수정예"·"1:1 맞춤"·"레벨테스트 실시"·"국가 자격증반 개설", 미용실 "1:1 전담 관리"·"프라이빗 공간"·"당일 예약 가능", 병원 "야간 진료"·"주말 진료"·"대기 없음" 등 — 이 목록은 예시일 뿐 전부가 아님, 업종을 막론하고 같은 성격의 다른 키워드도 동일하게 취급할 것) 절대 사실 단정문("~가능합니다", "~을 갖추고 있습니다", "~로 운영합니다", "~로 진행합니다", "~로 활용하기 좋습니다")으로 쓰지 말 것. 반드시 "~가능 여부는 스마트플레이스 또는 전화로 확인해 주세요"처럼 유보·확인유도 표현으로 쓰거나, 자연스러운 문장이 안 되면 해당 키워드는 생략할 것. "일반적으로 흔한 관행이라 사실일 가능성이 높다"는 이유로 예외를 두지 말 것 — 흔한 관행이어도 이 사업장이 실제로 그렇게 운영하는지 확인된 바 없으면 동일하게 유보 표현을 쓸 것. 이 사업장의 실제 정보(주소·전화·리뷰수·평점·핵심 키워드/메뉴)에서 직접 확인되는 내용만 단정문으로 써도 된다.
I(Information, 정보 충실성): 위 [사업장 정보]에 실제로 제공된 값(주소·전화·리뷰 수·평균 평점 등)만 활용해 구체적으로 작성. 확인되지 않은 가격대·운영시간·수용인원·결제수단·좌석/편의시설(단체석·프라이빗룸·유아의자 등)은 절대 지어내지 말 것. 정보가 없는 항목은 "스마트플레이스에서 확인하세요" 같은 안내로 대체하거나 생략할 것.
A(Authority, 권위): 리뷰 수·평균 평점이 제공된 경우(0이 아닌 실제 값) 반드시 그 수치를 "리뷰 000개, 평균 평점 0.0" 형식 그대로 본문에 포함할 것 — 생략 금지. 수상·인증·자격증이 "(미입력)"이 아니면 그 내용을 그대로(과장·재해석 없이) 권위 근거로 반드시 1회 이상 언급할 것. 확인되지 않은 운영 연수·수상·인증은 절대 지어내지 말 것. 리뷰 수·평점·수상 모두 미제공이면 이 요소는 생략.
T(Timeliness, 적시성): 마지막 문단 끝에 "[{current_year}년 {current_month}월 기준]" 자동 삽입 (필수)
O(Originality, 독창성): 시그니처 메뉴·서비스·강점이 "(미입력)"이 아니면 그 내용을 그대로(과장·재해석 없이) 활용해 "시그니처", "전용", "차별점", "특화" 중 자연스러운 표현 하나를 넣어 명확한 차별점 문장을 반드시 구성할 것(예: "이곳의 시그니처는 [입력값]입니다"). "(미입력)"이면 차별점은 실제 제공된 핵심 키워드(메뉴·서비스명)에서만 도출. 확인되지 않은 분위기·시설·가격 정책(프라이빗룸·단체석 규모·유아의자 등)을 지어내 차별점으로 제시하지 말 것.

[Q&A 5가지 추천 질문 카테고리]
1. 가격/비용 — 실제 가격 정보가 없으면 "스마트플레이스·전화 문의 안내"로 답변할 것
2. 운영시간/예약 — 실제 운영시간 정보가 없으면 "스마트플레이스 확인 안내"로 답변할 것
3. 위치/주차 — 주소가 제공된 경우만 구체적으로, 주차 가능 여부는 확인 안내로 답변할 것
4. 주요 서비스 차별점 (제공된 키워드 기반, 시설 지어내기 금지)
5. 결제/취소 정책 — 확인 안내로 답변할 것

소개글만 출력하세요. 다른 설명·인사말 금지. 적시성 마커 "[{current_year}년 {current_month}월 기준]"는 반드시 본문 끝에 포함."""

_TALKTALK_FAQ_PROMPT_TMPL = """당신은 네이버 톡톡 챗봇 콘텐츠 전문가입니다.

다음 사업장의 톡톡 채팅방 메뉴에 등록할 자주 묻는 질문 {count}개와 메뉴 5개를 생성하세요.

[사업장 정보 — 아래 값만 실제 확인된 사실입니다]
- 가게명: {name}
- 업종: {category_label}
- 지역: {region}
- 주요 서비스(키워드): {services}

[FAQ 작성 원칙]
1. 톡톡 채팅창에서 고객이 클릭할 만한 자연스러운 질문
2. 답변은 친근하지만 정보가 명확한 2~4문장
3. 가격·예약·위치·서비스·결제 카테고리에서 골고루 선정
4. 답변마다 문장 길이·시작 방식을 다르게 쓸 것 (전부 같은 어투로 시작하지 말 것)
5. 위 [사업장 정보]에 실제로 제공된 값(가게명·업종·지역·주요 서비스 키워드)만 사실로 사용할 것. 가격대·운영시간·수용인원·할인/이벤트 정책·결제수단·좌석/편의시설(단체석·프라이빗룸·유아의자·주차 대수 등)은 입력값에 없으므로 절대 지어내지 말 것 — 이런 항목을 묻는 질문에는 "정확한 [항목]은 매장 전화 또는 스마트플레이스에서 확인해 주세요" 같은 확인 안내 답변으로 대체할 것
6. "물론입니다!", "네, 가능합니다" 같은 확답으로 시작해 미확인 사실을 단정하지 말 것 — 확인되지 않은 내용은 확답 대신 안내로 답할 것

[채팅방 메뉴 원칙]
1. 5개 정확히 (네이버 톡톡 메뉴 권장 개수)
2. 명사형 짧은 제목 (반드시 6자 이내 — 예: "가격안내", "예약하기", "오시는길")
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
    lsi_keywords: list[str] | None = None,
    category: str | None = None,
    address: str | None = None,
    phone: str | None = None,
    review_count: int | None = None,
    avg_rating: float | None = None,
    awards: str | None = None,
    signature: str | None = None,
    excluded_keywords: list[str] | None = None,
) -> str:
    """네이버 스마트플레이스 소개글 생성 (Claude Sonnet — guide_generator.py 허용 경로).

    D.I.A. 5요소(다양성·정보·권위·적시성·독창성) 강제 적용된 Q&A 5개 포함 300~500자 소개글 반환.

    Args:
        lsi_keywords: 자연 배치할 LSI 키워드. None이면 category로부터 자동 추출.
        category: lsi_keywords가 None일 때 LSI 자동 추출에 사용할 업종 코드.
        excluded_keywords: 사장님이 '제외'한 키워드 — LSI 후보에서 뺀다(자동 추출·전달값 모두). 소개글은 사장님이
            그대로 게시하는 텍스트라, 제공하지 않는다고 밝힌 시설·서비스 키워드가 들어가면 안 된다.
    """
    from services.keyword_taxonomy import drop_excluded
    if lsi_keywords is None and category:
        try:
            from services.keyword_taxonomy import get_all_keywords_flat
            # 제외분을 먼저 빼고 8개를 고른다 — 뺀 만큼 다른 후보로 채워 LSI 수가 줄지 않게
            lsi_keywords = drop_excluded(get_all_keywords_flat(category), excluded_keywords)[:8]
        except Exception as e:
            _logger.warning(f"generate_naver_intro LSI auto extract failed: {e}")
            lsi_keywords = []
    lsi_keywords = drop_excluded(lsi_keywords or [], excluded_keywords)

    now_kst = datetime.now(timezone.utc) + timedelta(hours=9)
    prompt = _INTRO_PROMPT_TMPL.format(
        name=biz_name,
        category_label=category_label,
        region=region,
        keywords=", ".join(keywords[:8]) if keywords else "미등록",
        services="(미입력 — 업종 기반으로 일반적인 서비스 작성)",
        address=address or "(미입력)",
        phone=phone or "(미입력)",
        review_count=f"{review_count}개" if review_count else "(미입력)",
        avg_rating=f"{avg_rating}점" if avg_rating else "(미입력)",
        awards=awards.strip()[:200] if awards and awards.strip() else "(미입력)",
        signature=signature.strip()[:200] if signature and signature.strip() else "(미입력)",
        target_length=max(300, min(500, target_length)),
        lsi_keywords=", ".join(lsi_keywords) if lsi_keywords else "(없음 — 핵심 키워드만 사용)",
        current_year=now_kst.year,
        current_month=now_kst.month,
    )
    _reg_cat = category or category_label
    prompt += _reg_note(_reg_cat)
    try:
        try:
            message = await _create_message_with_retry(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
                timeout=60.0,
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-sonnet-4-6", f"naver_intro:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-sonnet-4-6", "naver_intro", message.usage.input_tokens, message.usage.output_tokens)
        except Exception as _le:
            _logger.debug("naver_intro usage 로깅 실패(무시): %s", _le)
        text = message.content[0].text.strip()
        text, _reg_notes = _reg_scrub(_reg_cat, text)    # 의료·법률: 확실히 금지되는 유형의 문장만 뺀다
        if _reg_notes:
            _logger.info("naver_intro 규제 표현 정리(%s): %s", _reg_cat, _reg_notes)
        # 적시성 마커 폴백 (Claude가 누락한 경우 자동 보강)
        if not re.search(r"\[20\d{2}년\s*\d{1,2}월", text):
            text = text.rstrip() + f"\n\n[{now_kst.year}년 {now_kst.month}월 기준]"
        return text
    except Exception as e:
        _logger.warning(f"generate_naver_intro failed: {e}")
        raise


_GLOBAL_AI_INTRO_PROMPT_TMPL = """당신은 ChatGPT·Google AI Overview·Gemini 최적화 콘텐츠 전문 작가입니다.

다음 사업장 정보를 바탕으로 글로벌 AI 검색 노출에 최적화된 소개글을 작성하세요.
(네이버 소개글과 달리, 구조화된 정보·FAQ·권위 신호가 핵심입니다.)

[사업장 정보]
- 가게명: {name}
- 업종: {category_label}
- 지역: {region}
- 핵심 키워드: {keywords}
- 주소: {address}
- 전화: {phone}
- 리뷰 수: {review_count}
- 평균 평점: {avg_rating}

[작성 원칙 — ChatGPT·Gemini·Google AI 노출 최적화]
1. 첫 문단: 사업장 소개를 명사 중심으로 간결하게 (3줄 이내)
   예: "{name}은 {region}에 위치한 {category_label}입니다. [핵심 서비스 1줄]"
2. 구조화된 FAQ 섹션 필수 포함 — ChatGPT는 Q&A 형식 콘텐츠를 직접 인용:
   형식: "Q. [질문]\nA. [구체적 답변]" (5개)
3. 권위 신호 포함: 리뷰 수·평균 평점이 제공된 경우 그 수치를 우선 활용. 제공되지 않은 운영 기간·자격·수상은 지어내지 말 것
4. 제공된 실제 정보(주소·전화·리뷰 수·평균 평점)만 수치로 활용. 확인되지 않은 가격대·영업시간·수용인원·좌석/편의시설(단체석·프라이빗룸·유아의자 등)은 절대 지어내지 말 것. 없으면 해당 항목 생략.
5. 마지막에 "[{current_year}년 {current_month}월 기준]" 삽입 필수
6. 문체: 문장 길이에 자연스러운 변화를 줄 것(짧은 문장+긴 문장 혼합, 매 문단 같은 구조 반복 금지)

[글자 수]: {target_length}자 ±50자

[차별점 — 네이버 소개글과의 차이]
- 지역명 반복 최소화 (ChatGPT는 키워드 반복을 낮게 평가)
- FAQ를 소개글 본문 중간에 배치 (하단 배치보다 인용률 높음)
- 권위 신호를 첫 문단에 포함 (Authority-first 구조)

소개글만 출력하세요. 다른 설명·인사말 금지."""


async def generate_global_ai_intro(
    biz_name: str,
    category_label: str,
    region: str,
    keywords: list,
    target_length: int = 400,
    address: str | None = None,
    phone: str | None = None,
    review_count: int | None = None,
    avg_rating: float | None = None,
    category: str | None = None,
) -> str:
    """ChatGPT·Gemini·Google AI 노출 최적화 소개글 생성.

    네이버 소개글(generate_naver_intro)과 달리 구조화된 FAQ·권위 신호·수치 중심.
    """
    now_kst = datetime.now(timezone.utc) + timedelta(hours=9)
    prompt = _GLOBAL_AI_INTRO_PROMPT_TMPL.format(
        name=biz_name,
        category_label=category_label,
        region=region,
        keywords=", ".join(keywords[:8]) if keywords else "미등록",
        address=address or "(미입력)",
        phone=phone or "(미입력)",
        review_count=f"{review_count}개" if review_count else "(미입력)",
        avg_rating=f"{avg_rating}점" if avg_rating else "(미입력)",
        target_length=max(300, min(500, target_length)),
        current_year=now_kst.year,
        current_month=now_kst.month,
    )
    _reg_cat = category or category_label
    prompt += _reg_note(_reg_cat)
    try:
        try:
            message = await _create_message_with_retry(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
                timeout=60.0,
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-sonnet-4-6", f"global_ai_intro:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-sonnet-4-6", "global_ai_intro", message.usage.input_tokens, message.usage.output_tokens)
        except Exception as _le:
            _logger.debug("global_ai_intro usage 로깅 실패(무시): %s", _le)
        text = message.content[0].text.strip()
        text, _reg_notes = _reg_scrub(_reg_cat, text)    # 의료·법률: 확실히 금지되는 유형의 문장만 뺀다
        if _reg_notes:
            _logger.info("global_ai_intro 규제 표현 정리(%s): %s", _reg_cat, _reg_notes)
        if not re.search(r"\[20\d{2}년\s*\d{1,2}월", text):
            text = text.rstrip() + f"\n\n[{now_kst.year}년 {now_kst.month}월 기준]"
        return text
    except Exception as e:
        _logger.warning(f"generate_global_ai_intro failed: {e}")
        raise


async def generate_talktalk_faq(
    biz_name: str,
    category_label: str,
    region: str,
    services: str,
    count: int = 10,
    category: str | None = None,
) -> dict:
    """톡톡 채팅방 메뉴 + 자주 묻는 질문 생성 (Claude Haiku — guide_generator.py 허용 경로).

    반환 구조: {"items": [...], "chat_menus": [...]}
    """
    prompt = _TALKTALK_FAQ_PROMPT_TMPL.format(
        name=biz_name,
        category_label=category_label,
        region=region,
        services=services,
        count=count,
    )
    _reg_cat = category or category_label
    prompt += _reg_note(_reg_cat)
    try:
        try:
            message = await _create_message_with_retry(
                model="claude-haiku-4-5-20251001",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
                timeout=60.0,
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", f"talktalk_faq:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", "talktalk_faq", message.usage.input_tokens, message.usage.output_tokens)
        except Exception as _le:
            _logger.debug("talktalk_faq usage 로깅 실패(무시): %s", _le)
        raw = message.content[0].text.strip()
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
            parsed, _reg_notes = _reg_scrub(_reg_cat, json.loads(clean[start:end + 1]))
            if _reg_notes:
                _logger.info("talktalk_faq 규제 표현 정리(%s): %s", _reg_cat, _reg_notes)
            return parsed
    except Exception as parse_err:
        _logger.warning(f"generate_talktalk_faq JSON parse failed: {parse_err}. raw={raw[:200]}")

    raise ValueError("톡톡 채팅방 메뉴 JSON 파싱 실패 — fallback 처리 필요")
