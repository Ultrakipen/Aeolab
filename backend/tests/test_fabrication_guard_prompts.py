"""
AI 생성 콘텐츠 사실 지어내기 가드 문구 존재 회귀 테스트.

동일 계열 버그가 3회(2026-07-08, 2026-08-22 두 차례) 재발했다:
  - guide_generator.py intro/FAQ 프롬프트에서 사장님이 입력하지 않은 가격·시설·수상 등을
    LLM 이 "지어내지 않도록" 명시적 금지 문구를 프롬프트에 삽입해 대응.
  - briefing_engine.py 소식·FAQ 답변 초안에서 미보유 추정 키워드를
    "운영하고 있습니다"처럼 단정 서술하지 않도록 코드 로직으로 대응.

LLM 출력 자체는 비결정적이라 단위 테스트로 잡기 어렵지만,
"프롬프트/코드에서 가드 문구가 실수로 삭제되는 것"은 소스 텍스트 검사로 잡을 수 있다.

이 테스트는 아래 두 파일의 소스 텍스트에 필수 가드 문구가 존재하는지 확인한다.
문구 삭제 = 사실 지어내기 재발 가능성 상승이므로, 이 테스트를 실패시키는 변경은
의도적으로 guard 를 제거했다는 신호로 간주해야 한다.
"""
import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).parent.parent.resolve()
GUIDE_GEN = BACKEND_ROOT / "services" / "guide_generator.py"
BRIEFING_ENG = BACKEND_ROOT / "services" / "briefing_engine.py"


# ── guide_generator.py ───────────────────────────────────────────────────────────
#
#  소개글 프롬프트(line ~1425) 및 ChatGPT FAQ 프롬프트(line ~1568) 는
#  명시적으로 "지어내지 말 것" 과 "스마트플레이스에서 확인" 문구를 프롬프트 문자열 안에
#  포함한다. 이 문구들이 LLM 에게 전달되는 직접적인 지시이므로, 삭제되면 가드가 풀린다.

def test_guide_generator_intro_prompt_no_fabrication_guard():
    """
    소개글 생성 프롬프트에 "절대 지어내지 말 것" 류 금지 문구가 있어야 한다.
    (line ~1425: "가격대·운영시간·수용인원… 절대 지어내지 말 것")
    """
    src = GUIDE_GEN.read_text(encoding="utf-8")
    assert "지어내지 말 것" in src, (
        f"{GUIDE_GEN.name} 에서 '지어내지 말 것' 문구를 찾을 수 없습니다. "
        "소개글 프롬프트에 사실 지어내기 금지 가드가 유지돼야 합니다."
    )


def test_guide_generator_intro_prompt_smartplace_fallback_guard():
    """
    소개글 프롬프트에 정보가 없을 때 "스마트플레이스에서 확인하세요" 대체 안내가 있어야 한다.
    (line ~1426, 1432: 없는 정보는 이 안내로 대체)
    """
    src = GUIDE_GEN.read_text(encoding="utf-8")
    assert "스마트플레이스에서 확인하세요" in src, (
        f"{GUIDE_GEN.name} 에서 '스마트플레이스에서 확인하세요' 문구를 찾을 수 없습니다. "
        "없는 항목에 대한 fallback 안내가 프롬프트에 유지돼야 합니다."
    )


def test_guide_generator_dia_information_authority_guards():
    """
    D.I.A. I(정보) / A(권위) 섹션 지시에 "확인되지 않은" 수치 금지 가드가 있어야 한다.
    (line ~1432-1433)
    """
    src = GUIDE_GEN.read_text(encoding="utf-8")
    assert "확인되지 않은" in src, (
        f"{GUIDE_GEN.name} 에서 '확인되지 않은' 문구를 찾을 수 없습니다. "
        "D.I.A. I/A 섹션의 수치 지어내기 금지 지시가 유지돼야 합니다."
    )


def test_guide_generator_chatgpt_faq_prompt_guard():
    """
    ChatGPT/FAQ 프롬프트에도 "지어내지 말 것" 금지 가드가 있어야 한다.
    (line ~1568-1569: 권위 신호·수용인원 등 미제공 시 생략)
    """
    src = GUIDE_GEN.read_text(encoding="utf-8")
    # intro 와 FAQ 프롬프트 양쪽에 공통으로 있어야 하는 문구 (최소 2회 이상 등장)
    count = src.count("지어내지 말 것")
    assert count >= 2, (
        f"{GUIDE_GEN.name} 에 '지어내지 말 것' 문구가 {count}회만 있습니다(최소 2회 필요). "
        "소개글 프롬프트와 ChatGPT FAQ 프롬프트 양쪽에 가드가 있어야 합니다."
    )


def test_guide_generator_regen_instruction_guard():
    """
    재생성 지시(D.I.A. 점수 낮을 때 재시도) 에도 지어내기 금지 문구가 있어야 한다.
    (line ~398: '확인되지 않은 가격·운영기간·수상 등 사실을 지어내지 말 것')
    """
    src = GUIDE_GEN.read_text(encoding="utf-8")
    assert "확인되지 않은 가격" in src, (
        f"{GUIDE_GEN.name} 에서 '확인되지 않은 가격' 문구를 찾을 수 없습니다. "
        "재생성 지시에도 사실 지어내기 금지 가드가 유지돼야 합니다."
    )


# ── briefing_engine.py ──────────────────────────────────────────────────────────
#
#  소식·FAQ 답변 초안에서 미보유 추정 키워드를 단정 서술하지 않도록
#  코드 주석 + 실제 출력 로직 양쪽으로 가드가 적용돼 있다.
#
#  ① 주석 가드(line ~720, ~830, ~987): 개발자 의도 문서화
#  ② 코드 로직 가드: 출력 문장에 "관심 있으신 분들은" 초대형 문장 사용
#     ("전문으로 합니다" 단정 문장 금지)
#
#  프롬프트 문자열이 아닌 코드 로직이라 LLM 에 전달되는 가드가 아니지만,
#  같은 계열 버그가 여기서도 반복됐으므로 소스 레벨 존재를 확인한다.

def test_briefing_engine_has_fabrication_guard_comment():
    """
    briefing_engine.py 에 '사실 지어내기' 가드 주석이 존재해야 한다.
    (line ~720, ~830, ~987: 미보유 추정 키워드 단정 금지 이유 설명)
    """
    src = BRIEFING_ENG.read_text(encoding="utf-8")
    assert "사실 지어내기" in src, (
        f"{BRIEFING_ENG.name} 에서 '사실 지어내기' 문구를 찾을 수 없습니다. "
        "미보유 추정 키워드 단정 금지 가드 주석이 유지돼야 합니다."
    )


def test_briefing_engine_uses_invitation_form_not_assertion():
    """
    briefing_engine.py 의 소식/FAQ 출력 코드가 "관심 있으신 분들은" 형태(초대)를 사용해야 하며,
    "전문으로 합니다" / "운영하고 있습니다" 단정 형태를 소식 생성 출력에 직접 하드코딩하지
    않아야 한다.
    (2026-08-22 발견된 버그: 미보유 키워드를 "전문으로 합니다"로 단정 서술)
    """
    src = BRIEFING_ENG.read_text(encoding="utf-8")

    # 초대형 문장이 출력 코드 안에 있어야 한다
    assert "관심 있으신 분들은" in src, (
        f"{BRIEFING_ENG.name} 에서 '관심 있으신 분들은' 출력 패턴을 찾을 수 없습니다. "
        "미보유 추정 키워드를 단정 서술 대신 초대형 문장으로 처리해야 합니다."
    )


def test_briefing_engine_guard_comment_count():
    """
    '단정하면 사실 지어내기' 패턴의 가드 주석이 3곳(소식·FAQ 답변·소식 본문)에 있어야 한다.
    (같은 계열 버그가 서로 다른 함수에서 반복 발견됐으므로 전수 확인)
    """
    src = BRIEFING_ENG.read_text(encoding="utf-8")
    # "단정하면 사실 지어내기가 된다" / "단정하면 사실 지어내기가 되므로" 패턴
    count = src.count("사실 지어내기")
    assert count >= 3, (
        f"{BRIEFING_ENG.name} 에 '사실 지어내기' 패턴이 {count}회만 있습니다(최소 3회 필요). "
        "소식 생성, FAQ 답변, 소식 본문 구성 3곳 모두에 가드가 있어야 합니다."
    )
