"""블로그 초안 3종의 세 번째('리뷰_모음') 정책 — 가공 후기를 만들지 않는다 (2026-11-06).

문제(서버 실호출 5개 업종 5/5 확인): 이 초안이 "남편 생일을 맞아 케이크를 찾던 중 방문했어요…" 같은 **지어낸 1인칭 고객 후기**를 만들었고
`[ ]` 빈칸은 0개였다. 프로젝트 원칙(지침 7번: 사장님이 그대로 게시하는 AI 텍스트의 사실 지어내기 금지)과 정면 충돌하고, 공정위 추천·보증 심사지침은
실제 이용하지 않은 상품의 허위 후기를 규율 대상으로 한다(AI가 만든 후기를 게시하는 경우의 명시 기준은 공백이라 합법·불법을 단정하지는 않는다).
네이버도 AI로 조작한 가짜 영수증 리뷰를 제재한다(마케팅 매체 보도, 공지 날짜 미확인).

정책
- 일반 업종: 후기 본문을 쓰지 않고 **'[실제 고객 후기 N: …]' 빈칸 틀** + 후기를 남기는 방법·방문 안내. 사장님이 고객 동의를 받은 실제 후기를 붙여 넣는다.
- 의료·법률(services/regulated_industry.py 근거): 환자·의뢰인 후기·경험담 형식 자체를 쓰지 않고 **방문 전 안내** 글.
- 프롬프트 지시만으로는 LLM이 어기므로(법률 답글이 첫 지침을 어긴 실례) 결과를 검사해 어기면 결정적으로 대체 초안으로 바꾼다.
템플릿 키(리뷰_모음)는 프론트 탭 선택에 쓰이므로 바꾸지 않는다. 순수 함수라 AI 호출 없이 테스트한다.
"""
from __future__ import annotations

import re
from typing import Any

from services.regulated_industry import regulated_group

REVIEW_KEY = "리뷰_모음"
_PLACEHOLDER = re.compile(r"\[[^\]]{2,80}\]")
_MIN_PLACEHOLDERS = 2
_TESTIMONIAL_WORDS = ("후기", "경험담")

_PH = "[실제 고객 후기 {n}: 고객 동의를 받은 후기 문구를 붙여넣으세요]"

_GENERAL = {
    "title": "고객 후기 소개 포스트 제목 (실제 후기를 넣는 틀, 40자 이내)",
    "content": ("실제 고객 후기를 넣는 빈칸 틀 (700-900자, 가게 소개 한 문단(입력된 정보만) → "
                "'[실제 고객 후기 1: 고객 동의를 받은 후기 문구를 붙여넣으세요]' 형태의 빈칸 3개 → 후기를 남기는 방법 안내 → 방문 안내 순서. "
                "후기 내용·고객 경험을 지어내지 말 것)"),
    "rule": ("- 리뷰_모음: 고객 후기·경험담을 지어내지 않는다 — 후기가 들어갈 자리는 반드시 '[실제 고객 후기 N: …]' 형태의 빈칸으로 남기고 "
             "후기 본문을 쓰지 않는다. 사장님이 고객 동의를 받은 실제 후기를 붙여 넣는다"),
    "blog_title_fmt": "'{region} {category_ko} 추천', '{business_name} 후기' 형식",
}
_REGULATED = {
    "title": "방문 안내 포스트 제목 (후기·경험담 표현 금지, 40자 이내)",
    "content": "방문 전 안내 본문 (700-900자, 예약·상담 방법→준비물→진행 절차→소요 시간→위치·주차 순서, 입력된 정보 범위에서만, 후기·경험담 톤 금지)",
    "rule": "- 리뷰_모음: 이 업종은 환자·의뢰인 후기나 경험담 형식을 쓰지 않는다 — 위 방문 전 안내 형식으로 작성하고 제목에도 '후기'를 쓰지 않는다",
    "blog_title_fmt": "'{region} {category_ko} 추천', '{business_name} 이용 안내' 형식",
}


def review_draft_specs(category: Any) -> dict:
    """프롬프트에 넣을 세 번째 초안 지시문. 의료·법률이면 방문 안내, 그 외는 빈칸 틀. (title·content·rule·blog_title_fmt)"""
    return dict(_REGULATED if regulated_group(category) else _GENERAL)


def fallback_review_draft(category: Any, business_name: str, region: str, category_ko: str,
                          address: str | None, phone: str | None) -> dict:
    """LLM 실패·검증 실패 시 쓰는 세 번째 초안 — 가공 후기 없이 사장님이 채울 자리는 [ ]로 둔다."""
    where = address or region
    if regulated_group(category):
        return {
            "template_type": REVIEW_KEY,
            "title": f"{business_name} 이용 안내",
            "content": (
                f"{region} {category_ko} {business_name} 이용 안내입니다.\n\n"
                f"■ 예약·상담 방법\n[예약 또는 상담 방법을 입력하세요] (전화: {phone or '문의 주세요'})\n\n"
                f"■ 방문 전 준비물\n[필요한 준비물을 입력하세요]\n\n"
                f"■ 위치\n{where}"
            ),
            "target_keyword": f"{region} {category_ko} 이용 안내",
        }
    return {
        "template_type": REVIEW_KEY,
        "title": f"{business_name} 고객 후기 모음",
        "content": (
            f"{region} {category_ko} {business_name}에 대한 실제 고객 후기를 소개합니다.\n\n"
            f"{_PH.format(n=1)}\n\n{_PH.format(n=2)}\n\n{_PH.format(n=3)}\n\n"
            f"■ 후기를 남기는 방법\n[후기를 남길 수 있는 방법(네이버 플레이스 리뷰 등)을 입력하세요]\n\n"
            f"■ 방문 안내\n{where} | 전화: {phone or '문의 주세요'}"
        ),
        "target_keyword": f"{region} {category_ko} 후기",
    }


def is_valid_review_draft(category: Any, draft: Any) -> bool:
    """정책을 지킨 초안인가. 일반: [ ] 빈칸이 2개 이상. 의료·법률: 제목·본문에 '후기'·'경험담'이 없음."""
    if not isinstance(draft, dict):
        return False
    title = str(draft.get("title") or "")
    content = str(draft.get("content") or "")
    if regulated_group(category):
        return not any(w in title or w in content for w in _TESTIMONIAL_WORDS)
    # 후기 자리 빈칸만 센다 — 지어낸 후기에 섞인 [사진]·[메뉴] 같은 무관한 대괄호로 우회되지 않게(자체 재검증에서 발견한 허점)
    review_blanks = [m for m in _PLACEHOLDER.findall(content) if "후기" in m]
    return len(review_blanks) >= _MIN_PLACEHOLDERS


def ensure_review_draft(drafts: Any, category: Any, business_name: str, region: str, category_ko: str,
                        address: str | None, phone: str | None) -> tuple[Any, bool]:
    """블로그 초안 목록에서 '리뷰_모음' 초안이 정책을 어기면 대체 초안으로 바꾼다. (목록, 바꿨는지) 반환 — 원본은 바꾸지 않는다.

    '리뷰_모음'이 아예 없으면 그대로 둔다(다른 초안은 건드리지 않는다)."""
    if not isinstance(drafts, list):
        return drafts, False
    out: list = []
    replaced = False
    for d in drafts:
        if isinstance(d, dict) and d.get("template_type") == REVIEW_KEY and not is_valid_review_draft(category, d):
            out.append(fallback_review_draft(category, business_name, region, category_ko, address, phone))
            replaced = True
        else:
            out.append(d)
    return out, replaced
