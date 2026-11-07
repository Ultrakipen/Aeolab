"""FAQ 템플릿·행동 처방 Q&A가 확인되지 않은 채널·혜택·시설·운영 사실을 대괄호 밖에서 단정하지 않는다 (2026-11-07).

사장님이 그대로 복사해 게시하는 문구다(작업 지침 7번). 대시보드의 "[ ] 안을 채우세요" 경고는 텍스트에 '['가 있을 때만 뜨므로,
대괄호가 없는 답변은 경고 없이 게시된다. 기존 검사(test_faq_template_no_unbracketed_claims)는 금지 구절 10개만 막아
"네이버 예약", "무료 컨설팅", "할인", "카카오톡" 같은 단정이 54개 중 상당수에 남아 있었고, 부동산·인테리어·자동차 템플릿은
처음부터 점검 범위(420행 이전) 밖이었다.

전화([전화번호])는 번호 자리가 빈칸이라 허용한다.
"""
import re

import pytest

from services import briefing_engine as be

# 대괄호 밖에 있으면 안 되는 표현: 채널 단정, 혜택·비용 단정, 평판·인기, 시설·운영 단정
_FORBIDDEN = (
    "네이버 예약", "카카오톡", "카톡", "인스타", "무료", "할인", "환영", "인기", "많이 선택",
    "모두 가능", "전용", "상주", "구비", "보장", "대부분", "자주 진행", "당일 워크인",
)


def _outside(text: str) -> str:
    # 중첩 대괄호("[... 전화([전화번호]) ...]")는 안쪽부터 반복해서 벗긴다
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r"\[[^\[\]]*\]", "", text)
    return text


def _all_answers():
    for key, items in be._FAQ_TEMPLATES.items():
        for it in items:
            yield key, it["q"], it["a"]


def test_templates_cover_more_than_the_old_audit_range():
    keys = set(be._FAQ_TEMPLATES)
    assert {"realestate", "interior", "auto", "pharmacy"} <= keys      # 이전 감사에서 빠졌던 업종 포함
    assert sum(len(v) for v in be._FAQ_TEMPLATES.values()) >= 60


@pytest.mark.parametrize("key,q,a", list(_all_answers()))
def test_faq_template_answer_has_no_unbracketed_claims(key, q, a):
    out = _outside(a)
    hit = [w for w in _FORBIDDEN if w in out]
    assert not hit, f"{key} / {q}: 대괄호 밖 단정 {hit}\n{a[:200]}"


def test_helper_only_strips_bracketed_text():
    assert "네이버 예약" not in _outside("[네이버 예약 가능] 문의")
    assert "네이버 예약" in _outside("네이버 예약으로 가능 [OO]")
    assert "네이버 예약" not in _outside("[예: 전화([전화번호]), 네이버 예약]")      # 중첩 대괄호


def test_competitor_keyword_faq_does_not_assert_availability_or_channel():
    out = be._make_faq_content(["단체석"], "한결식당", "restaurant", "경상남도 창원시",
                               {"c1": ["단체석"], "c2": ["단체석"]})
    first = out.split("\n\n")[0]
    assert "단체석" in first and "[" in first
    assert not [w for w in _FORBIDDEN if w in _outside(first)], first


def test_action_tool_faq_copy_does_not_assert_naver_reservation():
    from pathlib import Path
    src = (Path(__file__).resolve().parents[1] / "services" / "action_tools.py").read_text(encoding="utf-8")
    assert "네이버 예약으로 가능합니다" not in src
    assert "네, {top_kw} 가능합니다" not in src


def test_count_placeholders_counts_top_level_blanks_including_long_and_nested():
    c = be.count_placeholders
    assert c("") == 0 and c(None) == 0 and c("빈칸 없음") == 0
    assert c("전화([전화번호])") == 1                                            # 예전 규칙도 세던 짧은 빈칸
    assert c("[확인한 뒤 작성하세요. 예: 소규모 당일 방문 가능]. [문의 방법은 실제 운영 중인 것만 적어 주세요]") == 2   # 20자를 넘는 긴 빈칸
    assert c("[예약 방법은 실제 운영 중인 것만 적어 주세요. 예: 전화([전화번호]), 네이버 예약]") == 1   # 중첩은 바깥 하나
    assert c("[예: 10,000원] 안내") == 0                                          # 예시 설명은 빈칸이 아니다
    assert c("[a] [] [  ]") == 0                                                 # 너무 짧거나 빈 묶음
    assert c("닫는 대괄호만 ] 있음 [열기만") == 0                                   # 짝이 안 맞아도 깨지지 않는다


def test_every_unverified_faq_template_answer_counts_at_least_one_blank():
    # 사실 단정을 빈칸으로 바꾼 답변은 '채울 곳이 있다'고 세어져야 한다(약국 일반의약품 안내 같은 일반 사실은 제외)
    no_blank = [(k, it["q"]) for k, items in be._FAQ_TEMPLATES.items() for it in items if be.count_placeholders(it["a"]) == 0]
    assert len(no_blank) <= 3, no_blank
