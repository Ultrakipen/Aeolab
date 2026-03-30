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

SYSTEM_PROMPT = """당신은 한국 소상공인의 AI 검색 노출을 개선하는 전문 컨설턴트입니다.
소상공인 사장님이 이해하기 쉬운 말로, 즉시 실행 가능한 개선 방법을 제시합니다.
기술 용어는 최소화하고, 구체적인 행동 지침을 제공합니다.
응답은 반드시 JSON 형식으로만 출력하세요."""


class GuideGenerator:
    def __init__(self):
        self.client = client

    async def generate(self, biz: dict, score_data: dict, competitor_data: list) -> dict:
        """Claude Sonnet으로 한국어 AI 노출 개선 가이드 생성 (하위호환 dict 반환)"""
        prompt = self._build_prompt(biz, score_data, competitor_data)
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
    ) -> ActionPlan:
        """ActionPlan 도메인 모델 반환 (v2.1 신규)"""
        try:
            ctx = ScanContext(context)
        except ValueError:
            ctx = ScanContext.LOCATION_BASED

        # Claude 가이드 생성
        prompt = self._build_prompt(biz, score_data, competitor_data)
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
                expected_effect=raw.get("expected_effect", ""),
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

    def _build_prompt(self, biz: dict, scan_result: dict, competitor_data: list) -> str:
        my_score = scan_result.get("total_score", 0)
        my_freq = scan_result.get("exposure_freq", 0)
        top_comp = sorted(competitor_data, key=lambda x: x.get("score", 0), reverse=True)[:3]
        breakdown = scan_result.get("breakdown", scan_result.get("score_breakdown", {}))

        naver_channel = scan_result.get("naver_channel_score")
        global_channel = scan_result.get("global_channel_score")
        website_check = scan_result.get("website_check_result") or {}
        kakao_result = scan_result.get("kakao_result") or {}
        context = scan_result.get("context") or biz.get("business_type") or "location_based"

        channel_section = ""
        if naver_channel is not None or global_channel is not None:
            channel_section = f"""
## 채널별 노출 점수
- 네이버 AI 채널 점수: {naver_channel if naver_channel is not None else '미측정'}/100
- 글로벌 AI 채널 점수: {global_channel if global_channel is not None else '미측정'}/100
- 채널 갭: {'네이버 강세, 글로벌 AI 보강 필요' if (naver_channel or 0) > (global_channel or 0) + 20 else '글로벌 AI 강세, 네이버 보강 필요' if (global_channel or 0) > (naver_channel or 0) + 20 else '채널 균형'}
- 참고: 네이버는 ChatGPT 등 글로벌 AI 크롤링을 차단 중"""

        website_section = ""
        if website_check:
            issues = []
            if not website_check.get("has_json_ld"):
                issues.append("JSON-LD 구조화 데이터 없음")
            if not website_check.get("has_schema_local_business"):
                issues.append("LocalBusiness Schema 없음")
            if not website_check.get("has_open_graph"):
                issues.append("Open Graph 태그 없음")
            if not website_check.get("is_mobile_friendly"):
                issues.append("모바일 최적화 미흡")
            website_section = (
                "\n## 웹사이트 SEO 문제\n" + "\n".join(f"- {i}" for i in issues)
                if issues else "\n## 웹사이트 SEO: 기본 항목 양호"
            )
        elif not biz.get("website_url"):
            website_section = "\n## 웹사이트 없음\n- Google AI Overview 노출 불가, JSON-LD 등록 불가"

        kakao_section = ""
        if kakao_result:
            is_on = kakao_result.get("is_on_kakao", False)
            kakao_section = f"\n## 카카오맵 등록: {'있음 (ChatGPT-카카오 연동 노출 가능)' if is_on else '없음 — 등록 시 ChatGPT 카카오 채널 노출 가능'}"

        context_note = ""
        if context == "non_location":
            context_note = "\n## 사업 유형: 온라인/전문직 (위치 무관)\n- 네이버 스마트플레이스보다 웹사이트·ChatGPT·Perplexity 최적화가 핵심"

        return f"""다음 사업장의 AI 검색 최적화 개선 가이드를 생성해주세요.

## 사업장 정보
- 상호명: {biz.get('name', '')}
- 업종: {biz.get('category', '')}
- 지역: {biz.get('region', '(온라인/전문직)')}
- 등록 키워드: {', '.join(biz.get('keywords') or [])}
- 웹사이트: {'있음' if biz.get('website_url') else '없음'}
- 리뷰 수: {biz.get('review_count', 0)}개 / 평점: {biz.get('avg_rating', 0)}
{context_note}

## AI 스캔 결과
- 현재 AI 노출 빈도: {my_freq}/100회 ({my_score:.1f}점)
- ChatGPT 노출: {'있음' if (scan_result.get('chatgpt_result') or {}).get('mentioned') else '없음'}
- Perplexity 노출: {'있음' if (scan_result.get('perplexity_result') or {}).get('mentioned') else '없음'}
- 네이버 AI 브리핑 노출: {'있음' if (scan_result.get('naver_result') or {}).get('mentioned') else '없음'}
- Google AI Overview 노출: {'있음' if (scan_result.get('google_result') or {}).get('in_ai_overview') else '없음'}
{channel_section}{website_section}{kakao_section}

## 항목별 점수
- AI 노출 빈도: {breakdown.get('exposure_freq', 0)}/100
- 리뷰 품질: {breakdown.get('review_quality', 0):.1f}/100
- Schema 구조화: {breakdown.get('schema_score', 0)}/100
- 온라인 언급: {breakdown.get('online_mentions', 0)}/100
- 정보 완성도: {breakdown.get('info_completeness', 0):.1f}/100
- 콘텐츠 최신성: {breakdown.get('content_freshness', 0)}/100

## 상위 경쟁사 현황
{chr(10).join([f"- {c.get('name', '')}: {c.get('score', 0):.1f}점 (노출 {c.get('exposure_freq', 0)}회/100)" for c in top_comp])}

## 요청
위 데이터를 분석해서 아래 JSON 형식으로 개선 가이드를 제공해주세요.
채널 갭(네이버 vs 글로벌 AI)이 있다면 가장 큰 기회로 강조해 주세요.
각 항목은 이번 주 내에 실행 가능한 구체적 행동이어야 합니다.

{{
  "summary": "3줄 이내 현황 요약 (채널별 강약점 포함)",
  "priority_items": [
    {{
      "rank": 1,
      "category": "리뷰/키워드/Schema/콘텐츠/정보완성도/채널최적화 중 하나",
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
    """모듈 레벨 함수 — 하위호환 (routers/guide.py에서 직접 호출 가능)"""
    return await GuideGenerator().generate(biz, scan_result, competitor_data)
