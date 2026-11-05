"""의료·법률 업종 광고 규제 가드 (2026-11-06).

사장님이 스마트플레이스·블로그에 **그대로 게시하는** AI 생성 문구는 의료·법률 업종에서 광고 규제에 걸릴 수 있다.
이 모듈은 (1) 해당 업종 생성 프롬프트에 금지 표현 지침을 붙이고, (2) 생성 결과에서 확실히 금지되는 유형의 문장만 결정적으로 걸러낸다.

근거(2026-11-06 조사, 법적 판단은 변호사·심의기관 확인 필요):
- 의료: 의료법 제56조 제2항·시행령 제23조 — 치료경험담으로 치료 효과를 오인하게 하는 광고, 거짓·과장 광고,
  다른 의료인과의 비교·비방, 객관적 사실을 과장하는 광고, 특정 치료가 반드시 효과가 있다는 표현 등이 금지 유형.
- 법률: 「변호사 광고에 관한 규정」 — 승소율·석방률 등 업무수행결과에 부당한 기대를 갖게 하는 광고 금지(대한변협 안내 보도).
  2026-06 판결 보도: "성공사례 N건"을 집계 기준·근거 없이 단정한 홈페이지 문구가 부당한 기대 유발로 징계 정당 판단,
  "100% 환불"·"2배 높은 성공률"도 문제가 됨.
확인하지 못한 것(= 이 모듈이 다루지 않는 것): 현행 변호사 광고 규정 조문 번호·개정 해석, 세무사·공인중개사·약국·동물병원·학원의 개별 광고 규정,
의료광고 사전심의 대상 여부, 시술 전후 사진 게시 조건. 이 모듈은 알려진 확실한 유형만 다루며 새 유형은 프롬프트 지침이 1차다.
순수 함수라 AI 호출 없이 테스트한다.
"""
from __future__ import annotations

import re
from typing import Any

# 정규화된 taxonomy 키 / 원본 값 → 규제 그룹
_MEDICAL_NORMALIZED = {"clinic", "dental", "oriental_medicine"}
_MEDICAL_RAW = {"medical", "clinic", "hospital", "dental", "oriental_medicine", "oriental", "eye", "checkup"}
_LEGAL_NORMALIZED = {"legal"}
_LEGAL_RAW = {"legal", "law", "lawyer"}
# 약국은 약사법 소관(의료법 아님) — normalize_category가 "약국"→"clinic"으로 보내므로 먼저 제외한다
_NOT_REGULATED_RAW = {"pharmacy", "약국", "약사"}
# 화면·API가 한글 라벨을 넘기는 경로(generate_smartplace_intro의 category_ko 등)
_LABEL_GROUP = {
    "치과": "medical", "한의원": "medical", "병원·의원": "medical", "의원·병원": "medical",
    "병원": "medical", "의원": "medical", "한방병원": "medical", "안과": "medical", "건강검진": "medical",
    "법률사무소": "legal", "법률": "legal", "변호사": "legal", "법무법인": "legal", "법률 사무소": "legal",
}


def regulated_group(category: Any) -> str | None:
    """'medical' | 'legal' | None. 모르면 None(= 아무것도 하지 않는다)."""
    if not category or not isinstance(category, str):
        return None
    raw = category.strip()
    low = raw.lower()
    if low in _NOT_REGULATED_RAW or raw in _NOT_REGULATED_RAW:
        return None
    if raw in _LABEL_GROUP:
        return _LABEL_GROUP[raw]
    if low in _MEDICAL_RAW:
        return "medical"
    if low in _LEGAL_RAW:
        return "legal"
    try:
        from services.keyword_taxonomy import _CATEGORY_ALIASES
        norm = _CATEGORY_ALIASES.get(low)   # 알 수 없는 값은 None — normalize_category의 restaurant 폴백을 쓰지 않는다
    except Exception:
        return None
    if norm in _MEDICAL_NORMALIZED:
        return "medical"
    if norm in _LEGAL_NORMALIZED:
        return "legal"
    return None


_MEDICAL_RULES = """

## 의료광고 준수 (의료법 제56조 제2항·시행령 제23조 기준) — 이 업종 글에서 아래 표현은 만들지 말 것
- 환자 후기·치료경험담으로 치료 효과를 알리는 문장, 환자 사례를 지어내거나 인용하는 문장
- "완치·100% 효과·반드시 낫는다·부작용 없음·통증 없음" 같은 효과 보장·단정 표현
- 다른 의료기관·의료인과의 비교·비방, "최고·1위·유일·국내 최초" 같은 객관적 근거 없는 최상급 표현
- 의료진 자격·경력·전문의 여부·장비·보험 적용 여부는 입력값에 있을 때만 쓰고, 없으면 "[확인 후 기재]"로 비워 둘 것
- 확실하지 않은 표현은 쓰지 말고, 사장님이 의료광고 심의 기준을 직접 확인하도록 안내할 것"""

_LEGAL_RULES = """

## 변호사 광고 준수 (변호사 광고에 관한 규정 취지) — 이 업종 글에서 아래 표현은 만들지 말 것
- 승소율·석방률·성공률·무죄율, "N건 성공사례"처럼 집계 기준 없는 건수·비율, 결과를 약속하는 표현("무조건·반드시·100% 승소/환불")
- 다른 변호사·법무법인과의 비교·비방, "최고·1위" 같은 객관적 근거 없는 최상급 표현
- 사건 결과를 홍보하지 말고 업무 분야·상담 절차·진행 방식 안내 중심으로 쓸 것
- 경력·수상·자격은 입력값에 있을 때만 쓰고, 없으면 "[확인 후 기재]"로 비워 둘 것
- 확실하지 않은 표현은 쓰지 말고, 사장님이 대한변협 광고 규정을 직접 확인하도록 안내할 것"""


def prompt_note(category: Any) -> str:
    """해당 업종이면 프롬프트에 덧붙일 규제 지침, 아니면 빈 문자열."""
    g = regulated_group(category)
    if g == "medical":
        return _MEDICAL_RULES
    if g == "legal":
        return _LEGAL_RULES
    return ""


# 확실히 금지/문제되는 유형만(오탐 방지: "100%"는 효과·결과 단어와 붙을 때만, "최초"는 '국내 최초'만)
_MEDICAL_PATTERNS = [re.compile(p) for p in (
    r"완치",
    r"100\s*%\s*(?:완치|효과|만족|성공|안전|치료|보장)",
    r"부작용\s*(?:이|은|도)?\s*(?:전혀\s*|거의\s*)?(?:없|제로)",
    r"통증\s*(?:이|은)?\s*(?:전혀\s*)?없",
    r"(?:반드시|무조건|확실히)\s*(?:낫|나아|치료|효과)",
    r"치료\s*(?:후기|경험담)",
    r"국내\s*(?:최초|최고|1위|유일)",
    r"(?:지역|동네|업계)\s*(?:최고|1위|유일)",
    r"(?:최고|최상)의\s*(?:의료|진료|치료|의료진|실력|병원|의원|치과|한의원)",
)]
_LEGAL_PATTERNS = [re.compile(p) for p in (
    r"승소율|석방률|성공률|무죄율",
    r"(?:100\s*%|무조건|반드시)\s*(?:승소|환불|무죄|성공|이깁니다|이길)",
    r"(?:성공|승소)\s*사례\s*\d",
    r"\d[\d,]*\s*건\s*(?:의\s*)?(?:성공|승소)",
    r"(?:국내|지역|업계)\s*(?:최고|1위|유일)",
    r"(?:최고|최상)의\s*(?:변호사|법무법인|로펌|실력|법률)",
)]

BLANK_MARK = "[확인 필요: 이 업종 광고 규정상 사용하기 어려운 표현이 있어 삭제했습니다]"
_SENT_SPLIT = re.compile(r"(?<=[.!?。])\s+")
_Q_LINE = re.compile(r"^\s*Q\s*[.:：]")
_A_LINE = re.compile(r"^\s*A\s*[.:：]")


def _patterns(group: str | None):
    return {"medical": _MEDICAL_PATTERNS, "legal": _LEGAL_PATTERNS}.get(group or "", [])


def has_regulated_expression(category: Any, text: str) -> bool:
    pats = _patterns(regulated_group(category))
    return bool(pats) and isinstance(text, str) and any(p.search(text) for p in pats)


def _scrub_text(text: str, pats) -> tuple[str, int]:
    lines = text.split("\n")
    dropped = 0
    keep: list[bool] = []
    out: list[str] = []
    for ln in lines:
        if not ln.strip():
            out.append(ln)
            keep.append(True)
            continue
        parts = _SENT_SPLIT.split(ln)
        bad = [any(pt.search(p) for pt in pats) for p in parts]
        n_bad = sum(bad)
        if n_bad == 0:
            out.append(ln)
            keep.append(True)
            continue
        dropped += n_bad
        if _Q_LINE.match(ln) or _A_LINE.match(ln):
            # Q/A 줄은 한 문장이라도 걸리면 줄 전체를 뺀다 — 핵심이 빠진 답변("A. 상담해 보세요.")을 남기지 않는다
            out.append("")
            keep.append(False)
            continue
        kept = [p for p, b in zip(parts, bad) if not b]
        if kept:
            out.append(" ".join(kept))
            keep.append(True)
        else:
            out.append("")
            keep.append(False)
    # Q/A 짝: 질문이 지워지면 바로 다음 답변을, 답변이 지워지면 바로 앞 질문을 함께 지운다
    for i, ln in enumerate(lines):
        if not keep[i]:
            if _Q_LINE.match(ln) and i + 1 < len(lines) and _A_LINE.match(lines[i + 1]) and keep[i + 1]:
                keep[i + 1] = False
                dropped += 1
            elif _A_LINE.match(ln) and i - 1 >= 0 and _Q_LINE.match(lines[i - 1]) and keep[i - 1]:
                keep[i - 1] = False
                dropped += 1
    # 지워진 줄은 아예 뺀다(빈 줄 자리를 남기지 않는다). 원래 빈 줄(문단 구분)은 그대로 둔다.
    new = "\n".join(o for o, k in zip(out, keep) if k)
    if dropped and not new.strip():
        return BLANK_MARK, dropped
    return new, dropped


_QA_KEYS = (("question", "answer"), ("q", "a"))


def scrub_generated(category: Any, obj: Any) -> tuple[Any, list[str]]:
    """AI 생성 결과(문자열·dict·list 중첩)에서 규제 표현 문장을 뺀다. (정리된 값, 메모) 반환 — 원본은 바꾸지 않는다.

    해당 업종이 아니면 원본을 그대로 돌려준다(다른 업종에는 어떤 영향도 없다).
    """
    group = regulated_group(category)
    pats = _patterns(group)
    if not pats:
        return obj, []
    counter = {"n": 0, "items": 0}

    def _walk(x):
        if isinstance(x, str):
            new, n = _scrub_text(x, pats)
            counter["n"] += n
            return new
        if isinstance(x, list):
            out = []
            for el in x:
                if isinstance(el, dict):
                    pair = next(((qk, ak) for qk, ak in _QA_KEYS if qk in el and ak in el), None)
                    if pair and any(
                        isinstance(el.get(k), str) and any(p.search(el[k]) for p in pats) for k in pair
                    ):
                        counter["items"] += 1     # 질문·답변 한 쌍은 통째로 뺀다(짝이 안 맞는 항목을 남기지 않는다)
                        continue
                out.append(_walk(el))
            return out
        if isinstance(x, dict):
            return {k: _walk(v) for k, v in x.items()}
        return x

    cleaned = _walk(obj)
    notes: list[str] = []
    if counter["n"]:
        notes.append(f"{'의료' if group == 'medical' else '법률'} 광고 규정상 문제 소지가 큰 문장 {counter['n']}개 삭제")
    if counter["items"]:
        notes.append(f"문제 소지가 큰 Q&A {counter['items']}쌍 삭제")
    return cleaned, notes
