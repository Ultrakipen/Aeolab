"""네이버 플레이스 화면 텍스트에서 메뉴·사진 신호를 읽는 공용 판정 (2026-10-27).

docs/improvement_item_catalog_v1.0.md D2(사진)·D3(메뉴) 수정.

메뉴(D3)
  기존: 홈 본문 **어디든** "메뉴"가 있으면 통과(`re.search("메뉴|서비스\\s*가격|…", body)`) → 탭 이름·리뷰 문구에도 걸려
  메뉴 탭이 없는 사진관도 "메뉴 등록됨"이 됐다.
  변경: 단독 줄 근거만 쓴다 — 메뉴 탭 줄 `메뉴`, 섹션 줄 `메뉴16`, 가격표 줄 `가격표`/`가격표 이미지로 보기`.
  (2026-10-27 로컬 브라우저 실측: 어니언 `메뉴`·`메뉴16`, 홍스튜디오·힐링하우스 `가격표`, 작곡교습소 신호 없음)
  **근거를 못 찾았다고 "메뉴 없음"으로 단정하지 않는다** — 업종마다 라벨이 달라(수업·시술 등) 못 본 것일 수 있으므로
  찾으면 True, 못 찾으면 None(확인 안 됨). 명시적 "등록된 메뉴가 없습니다" 단독 줄만 False.

사진(D2)
  기존 정규식 `전체\\s*([\\d,]+)`은 쉼표만 있어도 매칭되어 `int('')` 오류로 사진 측정이 통째로 건너뛰어졌다.
  → 첫 글자가 숫자인 경우만 매칭(`\\d[\\d,]*`)하고 변환 실패는 None으로 둔다.
"""
from __future__ import annotations

import re
from typing import Optional

_MENU_EVIDENCE_LINE = re.compile(
    r"^(메뉴|가격표|가격표\s*이미지로\s*보기|시술\s*메뉴|서비스\s*메뉴)(\s*\d[\d,]*)?$"
)
_NO_MENU_LINE = re.compile(r"^(등록된\s*(메뉴|서비스)(가|이)?\s*없습니다|(메뉴|서비스)(가|이)\s*없습니다)\.?$")
_PRICE_LINE = re.compile(r"\d{1,3}(,\d{3})+\s*원|\d{4,}\s*원")

_PHOTO_TOTAL_RE = re.compile(r"전체\s*(\d[\d,]*)")
_PHOTO_WORD_RE = re.compile(r"사진\s*(\d[\d,]*)")


def _lines(text: Optional[str]) -> list[str]:
    return [ln.strip() for ln in (text or "").splitlines() if ln.strip()]


def detect_menu_evidence(home_text: Optional[str]) -> bool:
    """홈 화면에서 메뉴/가격표 근거(단독 줄)가 있는가. 본문 문장 속 "메뉴"는 보지 않는다."""
    return any(_MENU_EVIDENCE_LINE.match(ln) for ln in _lines(home_text))


def detect_menu_tab_content(menu_body: Optional[str]) -> Optional[bool]:
    """/menu 탭 본문 판정. True=가격이 적힌 메뉴가 있음, False=명시적 '없음' 안내, None=확인 안 됨."""
    lines = _lines(menu_body)
    if any(_NO_MENU_LINE.match(ln) for ln in lines):
        return False
    if any(_PRICE_LINE.search(ln) for ln in lines):
        return True
    return None


def parse_count(match: Optional["re.Match[str]"]) -> Optional[int]:
    """정규식 매치의 숫자 그룹을 정수로. 쉼표 제거, 변환 실패·0 이하는 None."""
    if not match:
        return None
    try:
        val = int(match.group(1).replace(",", ""))
    except (ValueError, IndexError):
        return None
    return val if val > 0 else None


def parse_photo_total(text: Optional[str]) -> Optional[int]:
    """사진 탭 본문에서 전체 사진 수. "전체 N" 우선, 없으면 "사진 N". 못 읽으면 None."""
    return parse_count(_PHOTO_TOTAL_RE.search(text or "")) or parse_count(_PHOTO_WORD_RE.search(text or ""))
