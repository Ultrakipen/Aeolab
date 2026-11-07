"""F3·F4 (2026-11-07 로그인 후 페이지 점검) 회귀 방지 — 프런트 소스 구조 검사.

F3: 긴 사업장명("홍뮤직스튜디오작곡교습소" 155px)이 사업장 선택 영역에서 112~114px로 잘렸다 → 폭을 넓히고, 더 길면 말줄임 + 툴팁(title).
F4: 모바일 터치 목표가 작은 요소(키워드 삭제 × 16px, 단독 링크·버튼 높이 20px, 체크박스 13px)를 키웠다.
서버 테스트가 frontend 폴더를 읽는다 — 프런트를 먼저 배포한 뒤 백엔드(테스트)를 배포한다.
"""
from pathlib import Path

FE = Path(__file__).resolve().parents[2] / "frontend" / "app" / "(dashboard)"
BM = (FE / "settings" / "BusinessManager.tsx").read_text(encoding="utf-8")
SET = (FE / "settings" / "page.tsx").read_text(encoding="utf-8")
SCH = (FE / "schema" / "SchemaClient.tsx").read_text(encoding="utf-8")
REV = (FE / "review-inbox" / "page.tsx").read_text(encoding="utf-8")


def test_settings_business_tab_shows_longer_names_with_tooltip():
    assert "max-w-[7rem] truncate" not in BM                      # 옛 폭(112px)으로 되돌아가면 실패
    assert "max-w-[10.5rem] sm:max-w-[14rem] truncate" in BM
    assert "title={biz.name}" in BM


def test_settings_active_business_summary_wraps_instead_of_truncating_the_date():
    i = BM.index("{activeBiz.region} · {getCategoryLabel(activeBiz.category)}")
    block = BM[i - 260:i]
    assert 'className="text-sm text-gray-600 break-keep"' in block        # 옛 truncate면 등록일이 잘린다
    assert 'text-gray-600 truncate">' not in block
    assert "title={activeBiz.name}" in BM


def test_review_inbox_business_selector_wider_with_tooltip_and_touch_height():
    i = REV.index("aria-expanded={bizDropdownOpen}")
    block = REV[i:i + 500]
    assert "max-w-[160px]" not in block                           # 옛 폭(160px)
    assert "max-w-[200px] sm:max-w-[260px]" in block and "min-h-[40px]" in block
    assert "title={bizName ?? undefined}" in block


def test_keyword_chip_delete_button_has_large_hit_area_and_label():
    i = BM.index("removeKeyword(kw); }}")
    block = BM[i - 80:i + 400]
    assert "w-8 h-8" in block and "aria-label={`${kw} 삭제`}" in block


def test_standalone_links_and_buttons_meet_touch_height():
    assert "min-h-[44px] text-sm font-medium text-blue-600" in SET and "플랜 변경 · 업그레이드" in SET
    i = REV.index("리뷰 붙여넣고 첫 답변 만들기")
    assert "min-h-[44px] px-3" in REV[i - 300:i]


def test_schema_opening_hours_delete_and_checkbox_touch_targets():
    assert 'className="ml-auto min-h-[36px] text-sm text-gray-600 hover:text-red-700 px-3">삭제</button>' in SCH
    assert "min-h-[36px] pr-2 text-sm text-gray-600 cursor-pointer" in SCH
    assert 'className="accent-red-500 w-5 h-5"' in SCH
