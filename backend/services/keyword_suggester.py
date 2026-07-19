"""
키워드 자동 추천 서비스 (Claude Haiku + 검색광고 API)
service_unification_v1.0.md §4.2

사용 시점:
  - 사업장 등록 폼에서 사장님이 "키워드 자동 추천" 클릭
  - Free 플랜 가입 시 1회 무료, Basic 월 1회, Pro 월 4회…

폴백 (작업 지침 #7):
  - Claude Haiku 실패 → keyword_taxonomy 베이스 키워드 5개 반환
  - "수동 입력 안내" + 임의 추천 금지

비용 (실측 검증 필요 — Phase A-4.5):
  - 프롬프트 ~500토큰 + 응답 ~300토큰 ≈ ₩2~3원/요청 추정
  - 첫 5건 호출 후 Anthropic 콘솔에서 실측 후 본 문서 갱신
"""
import os
import json
import re
import logging
from typing import Optional

from services.ai_usage_logger import log_ai_usage

_logger = logging.getLogger("aeolab")

KEYWORD_SUGGEST_MODEL = os.getenv("KEYWORD_SUGGEST_MODEL", "claude-haiku-4-5-20251001")
KEYWORD_SUGGEST_TIMEOUT = float(os.getenv("KEYWORD_SUGGEST_TIMEOUT", "30.0"))

# AsyncAnthropic 클라이언트 재사용 — 호출마다 새로 만들면 커넥션풀을 재사용하지
# 못해 동시 사용자 늘 때 지연이 누적됨(2026-07-15).
_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic
        api_key = os.getenv("ANTHROPIC_API_KEY")
        _client = anthropic.AsyncAnthropic(api_key=api_key, timeout=KEYWORD_SUGGEST_TIMEOUT)
    return _client


_PROMPT_TMPL = """당신은 한국 소상공인의 네이버 검색·AI 노출 최적화 전문가입니다.

[사업장 정보]
- 가게명: {name}
- 업종: {category_label}
- 지역: {region}

위 사업장이 네이버 통합검색·플레이스·AI 브리핑·ChatGPT 등에서 노출되어야 할
핵심 검색 키워드 {count}개를 추천해주세요.

{existing_block}
[작성 원칙]
1. 한국 소비자가 실제로 검색하는 표현 (격식체 X)
2. "지역명 + 업종" 조합 우선 (예: "강남 영어학원")
3. 너무 일반적인 단어(예: "학원")만으로 끝내지 말 것
4. 너무 긴 문장(15자 초과) 회피
5. 사업장명 자체는 제외 (브랜드 검색은 자동 노출됨)

반드시 아래 JSON 형식으로만 응답하세요. 추가 설명·마크다운 금지:
[
  {{"keyword": "키워드1", "rationale": "추천 이유 (15자 이내)"}},
  ...
]
"""

_EXISTING_BLOCK_TMPL = """[이미 등록된 키워드 — 제외 대상]
아래 키워드는 사장님이 이미 보유 중이므로 추천 목록에서 반드시 제외하세요:
{existing_list}

"""


def _fallback_suggestions(category: str, region: str, count: int) -> list[dict]:
    """외부 API 실패 시 keyword_taxonomy 베이스 키워드로 폴백.
    임의 추천 금지 — taxonomy에 등록된 검증된 키워드만 사용.
    """
    try:
        from services.keyword_taxonomy import get_category_keywords
    except ImportError:
        return []

    try:
        base = get_category_keywords(category) or []
    except Exception as e:
        _logger.warning("keyword_suggester fallback: get_category_keywords 실패 (%s): %s", category, e)
        base = []

    region_short = (region or "").split()[0] if region else ""
    out: list[dict] = []
    for kw in base[:count]:
        if region_short and region_short not in kw:
            kw_with_region = f"{region_short} {kw}"
        else:
            kw_with_region = kw
        out.append({
            "keyword": kw_with_region,
            "rationale": "기본 추천 (수동 입력 권장)",
            "source": "fallback",
        })
    return out


async def generate_keyword_suggestions(
    name: str,
    category: str,
    region: str,
    count: int = 10,
    existing_keywords: list[str] | None = None,
) -> dict:
    """키워드 자동 추천.

    Args:
        name: 사업장명
        category: 업종 키 (restaurant, cafe 등)
        region: 지역 (예: "서울시 강남구")
        count: 추천 키워드 개수 (기본 10)
        existing_keywords: 이미 보유한 키워드 목록 — 추천에서 제외

    Returns:
        {
          "suggestions": [{"keyword": "...", "rationale": "...", "source": "ai|fallback"}, ...],
          "_context": {
            "model": "...",
            "fallback_used": bool,
            "error": str | None
          }
        }
    """
    # 입력 검증 (빈 입력 방어)
    if not name or not category:
        return {
            "suggestions": [],
            "_context": {"error": "name·category 필수", "fallback_used": False},
        }

    try:
        from services.keyword_taxonomy import normalize_category
        cat_key = normalize_category(category)
    except Exception as e:
        _logger.warning("keyword_suggester: normalize_category 실패 (%s): %s", category, e)
        cat_key = category

    category_label = cat_key  # 추후 한글 라벨 매핑 가능
    region_clean = (region or "").strip() or "전국"

    # 기존 키워드 정규화 (소문자, 공백 제거) — 띄어쓰기 차이 흡수
    existing_set: set[str] = set()
    if existing_keywords:
        existing_set = {k.strip().replace(" ", "").lower() for k in existing_keywords if k and k.strip()}

    if existing_set:
        existing_block = _EXISTING_BLOCK_TMPL.format(
            existing_list=", ".join(sorted(existing_set))
        )
    else:
        existing_block = ""

    prompt = _PROMPT_TMPL.format(
        name=name,
        category_label=category_label,
        region=region_clean,
        count=count,
        existing_block=existing_block,
    )

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        _logger.warning("keyword_suggester: ANTHROPIC_API_KEY 미설정 → 폴백")
        return {
            "suggestions": _fallback_suggestions(cat_key, region_clean, count),
            "_context": {"fallback_used": True, "error": "no_api_key"},
        }

    try:
        from services.anthropic_retry import create_message_with_retry
        client = _get_client()
        try:
            msg = await create_message_with_retry(
                client,
                model=KEYWORD_SUGGEST_MODEL,
                max_tokens=1200,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as _ce:
            log_ai_usage("claude", KEYWORD_SUGGEST_MODEL, f"keyword_suggest:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", KEYWORD_SUGGEST_MODEL, "keyword_suggest", msg.usage.input_tokens, msg.usage.output_tokens)
        except Exception as _le:
            _logger.debug("keyword_suggest usage 로깅 실패(무시): %s", _le)
        raw = (msg.content[0].text or "").strip()
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if not m:
            raise ValueError("JSON 응답 형식 불일치")
        parsed = json.loads(m.group())
        if not isinstance(parsed, list):
            raise ValueError("응답이 리스트가 아님")

        # 정규화 + 사업장명 자체 제외 + 기존 키워드 중복 제외
        suggestions: list[dict] = []
        biz_name_low = name.lower()
        for item in parsed:
            if not isinstance(item, dict):
                continue
            kw = (item.get("keyword") or "").strip()
            if not kw or len(kw) > 25:
                continue
            if biz_name_low and biz_name_low in kw.lower():
                continue
            # 이미 보유한 키워드 제외 (부분 일치 + 띄어쓰기 차이 흡수)
            kw_low = kw.lower().replace(" ", "")
            if any(ex in kw_low or kw_low in ex for ex in existing_set if len(ex) >= 2):
                continue
            suggestions.append({
                "keyword": kw,
                "rationale": (item.get("rationale") or "")[:30],
                "source": "ai",
            })
            if len(suggestions) >= count:
                break

        if not suggestions:
            raise ValueError("유효한 추천 0건")

        return {
            "suggestions": suggestions,
            "_context": {"model": KEYWORD_SUGGEST_MODEL, "fallback_used": False},
        }

    except Exception as e:
        _logger.warning(f"keyword_suggester Claude 호출 실패: {e}")
        return {
            "suggestions": _fallback_suggestions(cat_key, region_clean, count),
            "_context": {
                "fallback_used": True,
                "error": f"{type(e).__name__}: {str(e)[:80]}",
            },
        }
