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

_logger = logging.getLogger("aeolab")
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

_DIMENSION_LABELS = {
    "exposure_freq":     "AI 검색 노출 빈도",
    "review_quality":    "리뷰 품질",
    "schema_score":      "정보 구조화",
    "online_mentions":   "온라인 언급",
    "info_completeness": "정보 완성도",
    "content_freshness": "콘텐츠 최신성",
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

SYSTEM_PROMPT = """당신은 한국 소상공인의 네이버 AI 브리핑 노출을 개선하는 전문 컨설턴트입니다.

핵심 원칙:
1. 소상공인 사장님 눈높이로 — 기술 용어 금지, 초등학생도 이해할 수 있는 말로
2. "이번 주에 할 수 있는 것" 중심 — 시간이 많지 않은 분들이므로 즉시 실행 가능한 것만
3. 근거 없는 수치 금지 — "노출 +15%" 같은 예측은 절대 쓰지 마세요. 대신 "가능성이 높아집니다"처럼 서술
4. 경쟁사 언급 시 실제 제공된 데이터만 사용 — 없는 정보를 만들어내지 마세요
5. 리뷰 키워드가 제공된 경우 반드시 활용 — 가장 중요한 실행 항목으로 배치

응답은 반드시 JSON 형식으로만 출력하세요."""


class GuideGenerator:
    def __init__(self):
        self.client = client

    async def generate(
        self,
        biz: dict,
        score_data: dict,
        competitor_data: list,
        keyword_gap: dict | None = None,
        growth_stage: dict | None = None,
    ) -> dict:
        """Claude Sonnet으로 한국어 AI 노출 개선 가이드 생성 (하위호환 dict 반환)"""
        prompt = self._build_prompt(biz, score_data, competitor_data, keyword_gap, growth_stage)
        raw = await asyncio.to_thread(self._call_claude, prompt)
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

        # Claude 가이드 생성 — 키워드 갭 데이터 포함
        prompt = self._build_prompt(biz, score_data, competitor_data, keyword_gap, growth_stage)
        raw = await asyncio.to_thread(self._call_claude, prompt)
        guide = self._parse_response(raw)

        # ActionItem 목록 구성
        items = self._build_action_items(guide, ctx)
        quick_wins = [item for item in items if item.is_quick_win]

        # ActionTools 생성 (context별 분기)
        tools = await build_action_tools(
            biz=biz,
            context=context,
            website_health=website_health,
            naver_data=naver_data,
            scan_id=scan_id,
        )

        return ActionPlan(
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

    def _build_action_items(self, guide: dict, ctx: ScanContext) -> list[ActionItem]:
        """Claude 응답에서 ActionItem 목록 생성"""
        raw_items = guide.get("priority_items", [])
        quick_wins_raw = set(guide.get("quick_wins", []))
        items = []

        _dimension_map = {
            "리뷰": "review_quality",
            "리뷰키워드": "review_quality",  # Claude 프롬프트 반환값과 일치
            "스마트플레이스": "info_completeness",
            "키워드": "online_mentions",
            "Schema": "schema_score",
            "콘텐츠": "content_freshness",
            "정보완성도": "info_completeness",
            "채널최적화": "schema_score",
            "AI노출": "exposure_freq",
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

    def _call_claude(self, user_prompt: str) -> str:
        message = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return message.content[0].text

    @staticmethod
    def _format_competitor_gaps_static(my_breakdown: dict, top_competitors: list) -> str:
        """상위 경쟁사 대비 차원별 격차를 텍스트로 변환 (프롬프트용)"""
        return _format_competitor_gaps(my_breakdown, top_competitors)

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

        # 네이버 AI 브리핑 노출 여부
        naver_in_briefing = (scan_result.get("naver_result") or {}).get("mentioned", False)

        # 채널별 상태 요약
        channel_lines = []
        if naver_channel is not None:
            channel_lines.append(f"- 네이버 AI 채널: {naver_channel}/100")
        if global_channel is not None:
            channel_lines.append(f"- 글로벌 AI 채널: {global_channel}/100")
        channel_lines.append("- 주의: 네이버는 ChatGPT·Gemini 크롤링을 차단 중 → 스마트플레이스가 없으면 글로벌 AI에서 비노출")
        channel_section = "\n## 채널 현황\n" + "\n".join(channel_lines)

        # 웹사이트 문제 요약
        website_issues = []
        if website_check:
            if not website_check.get("has_json_ld"):
                website_issues.append("JSON-LD 없음 (AI가 사업장 정보 파악 불가)")
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

        # 성장 단계 섹션
        stage_section = ""
        if growth_stage:
            stage_section = f"""
## 현재 성장 단계: {growth_stage.get('stage_label', '')} ({growth_stage.get('score_range', '')})
- 지금 집중할 것: {growth_stage.get('focus_message', '')}
- 하지 말아야 할 것: {growth_stage.get('do_not_do', '')}"""

        return f"""다음 사업장의 AI 검색 개선 가이드를 생성해주세요.

## 사업장 정보
- 상호명: {biz.get('name', '')}
- 업종: {biz.get('category', '')}
- 지역: {biz.get('region', '온라인/전문직')}
- 웹사이트: {'있음' if biz.get('website_url') else '없음'}
- 리뷰 수: {biz.get('review_count', 0)}개 / 평점: {biz.get('avg_rating', 0)}
{context_note}

## AI 스캔 결과
- 현재 AI 노출 빈도: {my_freq}/100회 (종합 {my_score:.1f}점)
- 네이버 AI 브리핑 노출: {'있음 ✅' if naver_in_briefing else '없음 ❌ — 가장 먼저 해결해야 할 문제'}
- ChatGPT 노출: {'있음' if (scan_result.get('chatgpt_result') or {}).get('mentioned') else '없음'}
- Perplexity 노출: {'있음' if (scan_result.get('perplexity_result') or {}).get('mentioned') else '없음'}
{channel_section}{website_section}{kakao_section}{keyword_section}{stage_section}

## 경쟁사 대비 취약 점수 (gap 큰 순)
{_format_competitor_gaps(breakdown, top_comp)}

## 요청
위 데이터를 분석해서 아래 JSON 형식으로 개선 가이드를 생성해주세요.

중요 지침:
- 리뷰 키워드 갭이 있다면 rank 1 항목은 반드시 그 키워드 확보 행동으로 작성
- competitor_example은 제공된 데이터에 있는 경쟁사만 언급, 없으면 생략
- action은 사장님이 지금 당장 할 수 있는 단계별 행동 (URL 포함 가능)

{{
  "summary": "3줄 이내 현황 요약 — 잘 되고 있는 것 1개 + 가장 급한 문제 1개 포함",
  "priority_items": [
    {{
      "rank": 1,
      "category": "리뷰키워드/스마트플레이스/Schema/콘텐츠/정보완성도/채널최적화 중 하나",
      "title": "개선 항목 제목 (20자 이내, 사장님이 이해하는 말로)",
      "action": "구체적 실행 방법 — 1단계, 2단계로 나눠서 사장님 관점 2~3문장",
      "difficulty": "easy/medium/hard",
      "time_required": "예: 10분, 1시간, 일주일",
      "competitor_example": "제공된 경쟁사 데이터에 있을 경우만 작성, 없으면 null"
    }}
  ],
  "quick_wins": ["지금 당장 10분 안에 할 수 있는 것 2~3가지 (구체적인 행동으로)"],
  "next_month_goal": "한 달 후 사장님이 체감할 수 있는 변화 (숫자 예측 금지)"
}}"""

    def _parse_response(self, text: str) -> dict:
        clean = text.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            clean = "\n".join(lines).strip()
        start = clean.find("{")
        if start != -1:
            depth = 0
            for i, ch in enumerate(clean[start:], start):
                if ch == "{": depth += 1
                elif ch == "}": depth -= 1
                if depth == 0:
                    try:
                        return json.loads(clean[start:i + 1])
                    except json.JSONDecodeError:
                        break
        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            pass
        return {"summary": text, "priority_items": [], "quick_wins": []}


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
    스마트플레이스 소개글 + 블로그 포스트 초안 생성 (Claude Sonnet 4.6)
    schema_gen.py 라우터에서 호출 — 비용 정책 허용 경로 (guide_generator.py)
    """
    prompt = f"""다음 사업장 정보로 네이버 스마트플레이스 소개글과 블로그 포스트 초안을 작성해주세요.

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
  "blog_title": "네이버 블로그 포스트 제목 (검색 최적화, 지역+업종+특징 포함, 40자 이내)",
  "blog_content": "블로그 포스트 본문 (800-1200자, 단락 구분 \\n\\n 사용, 가게 소개→메뉴·서비스→위치·교통→영업시간→자주 묻는 질문 2개 순서)"
}}

작성 기준:
- 소개글: 스마트플레이스 소개글 칸에 그대로 붙여넣을 수 있는 완성 텍스트
- 블로그 제목: '{region} {category_ko} 추천', '{business_name} 후기' 형식
- 블로그 본문: 고객 입장에서 쓴 자연스러운 후기+정보 혼합 형식, FAQ 포함"""

    try:
        loop = asyncio.get_event_loop()
        message = await loop.run_in_executor(
            None,
            lambda: client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        _logger.warning(f"generate_smartplace_intro failed: {e}")
        return {
            "smartplace_intro": (
                f"{business_name}은 {region}에 위치한 {category_ko}입니다.\n"
                f"{description or f'{region} {category_ko} 전문점으로 지역 주민들에게 사랑받고 있습니다.'}\n\n"
                f"위치: {address or region} | 전화: {phone or '문의 주세요'}\n"
                f"영업시간: {opening_hours or '전화 문의'}"
            ),
            "blog_title": f"{business_name} | {region} {category_ko} 정보 총정리",
            "blog_content": (
                f"안녕하세요, {business_name}을 소개합니다!\n\n"
                f"{region}에 위치한 {category_ko}으로, "
                f"{description or '지역 주민들에게 사랑받고 있습니다.'}\n\n"
                f"■ 위치 및 연락처\n주소: {address or region}\n전화: {phone or '문의 주세요'}\n\n"
                f"■ 영업시간\n{opening_hours or '영업시간은 전화로 확인해 주세요.'}\n\n"
                f"■ 자주 묻는 질문\nQ. {business_name} 위치가 어디인가요?\nA. {address or region}에 있습니다.\n\n"
                f"Q. 예약이 필요한가요?\nA. {phone or '전화'}로 문의해 주세요."
            ),
        }
