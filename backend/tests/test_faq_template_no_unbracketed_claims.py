"""
FAQ 답변 템플릿(briefing_engine._FAQ_TEMPLATES)에서 대괄호([ ]) 밖에 확인되지 않은 사실을 단정하는 문구가 남지 않았는지 검사.

2026-10-31 점검: 사장님이 그대로 복사해 게시하는 문구에 "전용 공간 예약이 가능", "도보 2분 거리에 약국",
"키즈 코너도 마련", "방음 시설을 갖추고" 같은 단정이 대괄호 없이 들어 있었다(가게마다 다른 사실).
대괄호 안은 사장님이 확인해 채우는 자리라 허용하고, 밖에 남은 단정만 막는다.
"""
import re

from services.briefing_engine import _FAQ_TEMPLATES

# 확인 없이 단정하면 안 되는 시설·조건 표현 (대괄호 밖에서 발견되면 실패)
_FORBIDDEN_OUTSIDE_BRACKETS = [
    "전용 공간",
    "단체 할인",
    "키즈 코너",
    "도보 2분",
    "약국이 있어",
    "방음 시설을 갖추고",
    "프로페셔널 장비",
    "무료로 이용하실 수 있습니다",
    "대부분 자리가 있습니다",
    "선착순 배정",
]


def _outside_brackets(text: str) -> str:
    return re.sub(r"\[[^\]]*\]", "", text)


def test_no_unbracketed_factual_claims_in_faq_templates():
    offenders = []
    for key, items in _FAQ_TEMPLATES.items():
        for item in items:
            outside = _outside_brackets(item["a"])
            for phrase in _FORBIDDEN_OUTSIDE_BRACKETS:
                if phrase in outside:
                    offenders.append((key, item["q"], phrase))
    assert not offenders, f"대괄호 밖 단정 문구: {offenders}"


def test_helper_strips_bracketed_text_only():
    # 헬퍼 자체 검증 — 대괄호 안의 문구는 허용 대상이라 제거되어야 하고 밖은 남아야 한다
    assert "전용 공간" not in _outside_brackets("[전용 공간 예약 가능] 문의해 주세요")
    assert "전용 공간" in _outside_brackets("전용 공간 예약이 가능합니다 [OO]")
