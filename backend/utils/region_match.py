"""
지역 문자열 매칭 — 사용자가 자유 입력한 지역명과 사업장 등록 지역명을
행정단위 표기 차이(예: "서울 강남" vs "강남구" vs "서울특별시 강남구")에
관계없이 매칭하기 위한 정규화 유틸.

창업 시장 분석(startup.py, startup_report.py)의 3개 엔드포인트가 전부
region을 완전일치(eq)로 비교하던 중, 등록 사업장의 region 값과 사용자
입력값이 자유 텍스트라 행정단위 표기가 다르면 실제 경쟁사가 있어도
매칭에 실패하는 문제가 있었음(2026-07-15 점검) — 단일 소스로 3곳 모두
이 헬퍼를 사용하도록 통일.
"""
import re

_ADMIN_SUFFIX_RE = re.compile(r"(특별자치시|특별자치도|특별시|광역시|자치시|자치도|시|도|구|군|읍|면|동)$")


def _strip_admin_suffix(token: str) -> str:
    prev = None
    t = token
    while prev != t:
        prev = t
        t = _ADMIN_SUFFIX_RE.sub("", t)
    return t


def normalize_region(region: str) -> str:
    """공백 제거 + 행정단위 접미어(시/도/구/군 등) 제거."""
    tokens = (region or "").strip().split()
    return "".join(_strip_admin_suffix(t) for t in tokens if t)


def region_matches(a: str, b: str) -> bool:
    """정규화 후 한쪽이 다른 쪽을 포함하면 동일 지역으로 간주 (양방향)."""
    na, nb = normalize_region(a), normalize_region(b)
    if not na or not nb:
        return False
    return na in nb or nb in na
