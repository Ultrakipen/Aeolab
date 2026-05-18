"""콘텐츠 D.I.A. 5요소 사후 검증.

생성된 소개글이 D.I.A.(Diversity, Information, Authority, Timeliness, Originality)
5요소를 얼마나 충족하는지 0~100 점수로 평가.

이 모듈은 AI 호출 0회 — 정규식·문자열 패턴 기반.
"""
from __future__ import annotations
import re
from typing import Dict, List

# 권위 표현 패턴
_AUTHORITY_PATTERNS = [
    r"\d+년\s*(?:운영|영업|경력|개업)",
    r"수상|선정|인증|자격증|면허",
    r"베스트|TOP\s*\d+|1위",
    r"미슐랭|블루리본|모범|전통",
    r"전문\s*(?:가|의|점)",
]

# 구체 정보 패턴 (가격·시간·위치·예약)
_SPECIFIC_INFO_PATTERNS = [
    r"\d{1,3}(?:,\d{3})*\s*원",         # 가격
    r"\d{1,2}\s*(?:시|:)\s*\d{0,2}",    # 시간
    r"\d+\s*분|\d+\s*초",                # 소요 시간
    r"지하철|버스|역|출구",                # 위치
    r"예약|당일|온라인|전화",              # 예약 방법
    r"카드|현금|간편결제|페이",            # 결제 수단
    r"\d+\s*층|\d+\s*호",                 # 층/호수
    r"평|㎡|m²",                          # 면적
]

# 적시성 마커 — 대괄호 유무 모두 인정 ([2026년 5월] 또는 2026년 5월 기준 둘 다)
_TIMELINESS_RE = re.compile(r"20\d{2}년\s*\d{1,2}월")

# Q&A 구조 패턴 (AI탭 친화적 — Q&A 형식 소개글 우선 인용)
_QA_PATTERNS = [
    re.compile(r"Q\s*[:：]", re.IGNORECASE),
    re.compile(r"A\s*[:：]", re.IGNORECASE),
    re.compile(r"자주\s*묻[는는]"),
    re.compile(r"Q&A|FAQ", re.IGNORECASE),
    re.compile(r"궁금[하증]"),
]

def _check_qa_structure(text: str) -> bool:
    """소개글 Q&A 구조 포함 여부 (AI탭 친화적 구조)."""
    return any(p.search(text) for p in _QA_PATTERNS)

# 추상 표현 (감점 대상)
_VAGUE_PATTERNS = ["최고", "최상", "최강", "환상", "역대급"]


def _check_lsi_coverage(text: str, lsi: List[str]) -> Dict:
    """LSI 키워드 본문 포함 비율 (Diversity)."""
    if not lsi:
        return {"included": 0, "total": 0, "ratio": 0.0}
    norm_text = text.lower()
    included = sum(1 for kw in lsi if kw and kw.lower() in norm_text)
    return {
        "included": included,
        "total": len(lsi),
        "ratio": included / len(lsi) if lsi else 0.0,
        "matched": [kw for kw in lsi if kw and kw.lower() in norm_text],
    }


def _count_specific_info(text: str) -> int:
    """가격·시간·위치 등 구체 수치 등장 횟수 (Information)."""
    count = 0
    for pat in _SPECIFIC_INFO_PATTERNS:
        count += len(re.findall(pat, text))
    return count


def _check_authority(text: str) -> List[str]:
    """권위 표현 매칭 결과 (Authority)."""
    matches: List[str] = []
    for pat in _AUTHORITY_PATTERNS:
        m = re.findall(pat, text)
        matches.extend(m)
    return matches


def _check_timeliness(text: str) -> bool:
    """적시성 마커 존재 여부 (Timeliness)."""
    return bool(_TIMELINESS_RE.search(text))


def _check_vague(text: str) -> List[str]:
    """추상 표현 등장 (Originality 감점)."""
    return [v for v in _VAGUE_PATTERNS if v in text]


def _check_originality(text: str) -> Dict:
    """차별점 표현(시그니처·전용·only 등) 존재 여부."""
    patterns = ["시그니처", "전용", "유일", "차별", "특화", "독자", "단독"]
    matched = [p for p in patterns if p in text]
    vague = _check_vague(text)
    return {
        "differentiators": matched,
        "vague_count": len(vague),
        "vague_examples": vague,
    }


def validate_intro_dia(
    text: str,
    keywords: List[str] | None = None,
    lsi_keywords: List[str] | None = None,
) -> Dict:
    """D.I.A. 5요소 사후 검증 — 0~100 점수.

    각 요소 만점:
    - Diversity: 25점 (LSI 8개 중 4개 이상 = 만점, 비례)
    - Information: 25점 (구체 수치 5개 이상 = 만점)
    - Authority: 15점 (권위 표현 1개 이상 = 만점)
    - Timeliness: 15점 (적시성 마커 = 만점)
    - Originality: 20점 (차별점 1개 + 추상 표현 0개 = 만점)
    """
    keywords = keywords or []
    lsi_keywords = lsi_keywords or []

    # Diversity
    div = _check_lsi_coverage(text, lsi_keywords)
    # 4개 이상이면 만점, 그 미만은 비례
    target_lsi = 4
    div_score = min(25, (div["included"] / target_lsi) * 25) if target_lsi else 0

    # Information
    info_count = _count_specific_info(text)
    has_qa = _check_qa_structure(text)
    qa_bonus = 5.0 if has_qa else 0.0
    info_score = min(25, (info_count / 5) * 25 + qa_bonus)

    # Authority
    auth_matches = _check_authority(text)
    auth_score = 15 if auth_matches else 0

    # Timeliness
    has_time = _check_timeliness(text)
    time_score = 15 if has_time else 0

    # Originality (차별점 1+, 추상 표현 0이면 만점)
    orig = _check_originality(text)
    orig_base = 20 if orig["differentiators"] else 5
    orig_penalty = min(orig_base, len(orig["vague_examples"]) * 4)
    orig_score = max(0, orig_base - orig_penalty)

    total = round(div_score + info_score + auth_score + time_score + orig_score, 1)

    return {
        "score": total,
        "diversity": {"score": round(div_score, 1), **div},
        "information": {"score": round(info_score, 1), "specific_count": info_count, "has_qa_structure": has_qa},
        "authority": {"score": auth_score, "matches": auth_matches},
        "timeliness": {"score": time_score, "has_marker": has_time},
        "originality": {"score": orig_score, **orig},
    }
