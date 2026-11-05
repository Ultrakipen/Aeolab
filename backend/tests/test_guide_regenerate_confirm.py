"""같은 측정 결과로 가이드를 다시 만들 때 한 번 확인한다 (2026-11-05).

가이드 1건은 Sonnet 호출 1~3회(약 118~355원)이고 월 한도를 차감한다. 새 측정 없이 다시 만들면 입력이 같아 내용이 비슷한데도 한도와 비용만 쓴다.
프런트(GuideClient.generateGuide)가 최신 측정 ID와 현재 가이드의 scan_id가 같을 때만 묻는다 — 새 측정 뒤·첫 생성·옛 가이드(scan_id 없음)는 묻지 않는다.
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 백엔드 테스트를 배포한다.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _read(*parts):
    with open(os.path.join(ROOT, "frontend", *parts), encoding="utf-8") as f:
        return f.read()


GUIDE = ("app", "(dashboard)", "guide", "GuideClient.tsx")
PAGE = ("app", "(dashboard)", "guide", "page.tsx")


def _generate_guide_body(src: str) -> str:
    i = src.index("const generateGuide = async () => {")
    j = src.index("const handleRescan", i)
    return src[i:j]


def test_confirm_only_when_the_existing_guide_was_made_from_the_same_scan():
    body = _generate_guide_body(_read(*GUIDE))
    assert "if (guide && guideScanId && guideScanId === latestScanId) {" in body
    assert "이 측정 결과로 만든 가이드가 이미 있어요." in body
    assert "그래도 다시 만들까요?" in body
    # 확인창이 실제로 막는지: 취소(false)면 곧바로 return 하고, 문장이 조건 없이 실행돼야 한다(앞에 if (false) 같은 우회가 없어야 한다)
    assert "그래도 다시 만들까요?`)) return" in body
    import re
    assert re.search(r"^\s*if \(!window\.confirm\(`이 측정 결과로", body, re.M), "window.confirm 문장이 단독 if(!confirm) return 형태가 아니다"
    # 확인은 로딩을 시작하기 전에 — 취소하면 아무 요청도 보내지 않는다
    assert body.index("window.confirm(") < body.index("setLoading(true)")
    assert body.index("window.confirm(") < body.index("/api/guide/generate")


def test_quota_note_is_shown_only_for_limited_plans():
    body = _generate_guide_body(_read(*GUIDE))
    assert "guideLimit > 0 && guideLimit < 999" in body          # 무제한(999)·체험(0)에는 '횟수 차감' 문구를 쓰지 않는다
    assert "${guideUsed}/${guideLimit}회" in body


def test_scan_id_is_tracked_from_the_server_row_and_updated_after_regeneration():
    src = _read(*GUIDE)
    assert "scan_id?: string | null" in src
    assert "useState<string | null>(initialGuide?.scan_id ?? null)" in src
    i = src.index("setGuide(guideData)")
    assert "setGuideScanId(latestScanId)" in src[i:i + 120]       # 방금 만든 가이드의 측정 ID로 갱신


def test_server_page_selects_scan_id_for_the_guide_row():
    """scan_id를 select에서 빼면 확인창이 조용히 영영 뜨지 않는다."""
    page = _read(*PAGE)
    assert ".select('id, business_id, context, next_month_goal, priority_json, tools_json, scan_id," in page
    assert "guide={guides?.[0] ?? null}" in page                  # 행 전체를 그대로 넘긴다(일부 필드만 골라 넘기면 scan_id가 빠진다)
