"""체험 결과·가이드 화면의 신뢰 규칙 (2026-11-04, 어니언 성수 라이브 대조에서 발견한 5건).

- 소개글·소식을 AEOlab이 못 읽고 사장님도 답하지 않았으면 "없음"이 아니라 "확인 전"이다 (처방·체크리스트·원인 문구 모두).
- 블로그 글 수는 검색 상위 100건의 제목·요약 집계라 유명 가게가 실제보다 적게 잡힌다 → "글이 적은 편" 같은 부정 결론 금지.
- 구글 지도 평점은 리뷰 수 없이 가게끼리 나란히 두지 않는다(리뷰 몇 개뿐인 5.0이 수천 건의 4.2보다 강해 보임).
- 가이드의 Q&A 복사 문구는 확인 안 된 키워드를 "제공하고 있습니다"로 단정하지 않는다(지침 7번).
- 체험 가이드가 실제로 있을 때만 "볼 수 있다", 없으면 "준비됐다"고 말하지 않는다.
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 백엔드 테스트를 배포한다.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _read(*parts: str) -> str:
    with open(os.path.join(ROOT, "frontend", *parts), encoding="utf-8") as f:
        return f.read()


RESULT_STEP = ("app", "(public)", "trial", "components", "TrialResultStep.tsx")
WAYS = ("components", "trial", "TrialWaysCard.tsx")
STATUS = ("components", "trial", "NaverStatusSection.tsx")
GUIDE = ("app", "(dashboard)", "guide", "GuideClient.tsx")
ACTION_ZONE = ("app", "(dashboard)", "dashboard", "sections", "DashboardActionZone.tsx")
TRIAL_PAGE = ("app", "(public)", "trial", "page.tsx")


def test_intro_and_post_default_false_is_never_used_as_a_fact():
    src = _read(*RESULT_STEP)
    # 옛 방식: 측정도 답도 없을 때 기본값 false("없음")로 떨어지던 식
    assert "(introAnswer ?? hasIntro)" not in src
    assert "(postAnswer ?? hasRecentPost)" not in src
    assert "result.smart_place_check?.has_intro ?? hasIntro" not in src
    assert "result.smart_place_check?.has_recent_post ?? hasRecentPost" not in src
    # 새 방식: 읽음 → 사장님 답 → 모름(undefined)
    assert "introAnswered ? hasIntro : undefined" in src
    assert "postAnswered ? hasRecentPost : undefined" in src
    # 차단으로 못 읽은 값(*_measured=false)은 사실로 쓰지 않는다
    assert "intro_measured !== false" in src and "recent_post_measured !== false" in src


def test_priority_items_do_not_prescribe_unknown_intro_or_post_as_missing():
    src = _read(*RESULT_STEP)
    m = re.search(r"const priorityItems[\s\S]*?return items\.slice\(0, 3\);\n  \}\)\(\);", src)
    assert m, "priorityItems 블록을 찾지 못했다"
    block = m.group(0)
    assert "!introKnown" not in block and "!postKnown" not in block
    assert "introFact === false" in block and "introFact === undefined" in block
    assert "postFact === false" in block and "postFact === undefined" in block
    # 모를 때의 문구는 "작성하기"가 아니라 "확인하기"
    assert "소개글을 열어" in block and "소식이 있는지 확인" in block


def test_trial_page_remembers_whether_owner_answered_intro_and_post():
    page = _read(*TRIAL_PAGE)
    assert "introAnswered: hasIntro !== undefined" in page
    assert "postAnswered: hasRecentPost !== undefined" in page
    assert "introAnswered={hasIntro !== undefined}" in page
    # 복원할 때 "답 안 함"이 false("없음")로 바뀌지 않는다
    assert page.count("cached.introAnswered ? cached.hasIntro : undefined") == 2
    assert page.count("cached.postAnswered ? cached.hasRecentPost : undefined") == 2


def test_naver_status_checklist_has_unknown_state():
    src = _read(*STATUS)
    assert "ok: boolean | undefined" in src and "확인 전" in src
    assert "hasIntro?: boolean" in src and "hasRecentPost?: boolean" in src
    assert "{!hasIntro ?" not in src                      # 모를 때 "소개글을 작성하세요"로 가지 않는다
    assert "hasIntro === false" in src
    # 사장님이 답한 값은 측정값처럼 보이는 초록 체크로만 두지 않고 "입력하신 값"으로 따로 표시한다
    assert 'value={introFromOwner ? "입력하신 값" : undefined}' in src
    assert 'value={postFromOwner ? "입력하신 값" : undefined}' in src
    step = _read(*RESULT_STEP)
    assert "introFromOwner={introFromOwner}" in step and "postFromOwner={postFromOwner}" in step
    assert "const introFromOwner = !introRead && introFact !== undefined" in step


def test_blog_verdict_has_no_negative_conclusion():
    ways = _read(*WAYS)
    result = _read(*RESULT_STEP)
    assert "글이 적은 편" not in ways
    assert "건 적습니다" not in result
    assert "부족한 쪽은 네이버 지역 검색" not in ways
    # 긍정 결론("가장 많아요")은 그대로 — 적게 잡히는 쪽으로만 틀리므로 안전
    assert "주변 ${total}곳 중 가장 많아요" in ways


def test_google_map_list_does_not_compare_ratings_without_review_counts():
    src = _read(*WAYS)
    m = re.search(r"export function GoogleMapCard[\s\S]*", src)
    assert m
    card = m.group(0)
    assert "rate(p.rating" not in card                      # 다른 가게 평점을 나란히 보이지 않는다
    assert "rate(mine.rating" in card                       # 내 가게 평점은 그대로
    assert "리뷰 수를 정확하게 가져오지 못해" in card


def test_guide_faq_copy_text_does_not_assert_unconfirmed_service():
    src = _read(*GUIDE)
    assert "관련 서비스를 제공하고 있습니다" not in src
    assert "실제로 제공하는 내용을 여기에 적어 주세요" in src
    assert "[ ] 안은 사장님이 직접 채워야 합니다" in src


def test_trial_guide_lock_card_depends_on_real_guide():
    zone = _read(*ACTION_ZONE)
    assert "hasGuide" in zone
    assert "3가지 우선 개선 항목이 생성됐습니다" not in zone     # 가이드가 없어도 "생성됐다"고 하던 문구
    assert 'href="/guide"' in zone
    dash = _read("app", "(dashboard)", "dashboard", "page.tsx")
    assert "hasGuide={!!latestGuide}" in dash
