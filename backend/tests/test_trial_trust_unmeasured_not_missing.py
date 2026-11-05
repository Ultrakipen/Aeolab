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


def test_naver_top5_miss_does_not_drive_a_negative_headline_or_warning_tone():
    """네이버 지역검색은 공식 API가 5곳까지만 알려 줘서(display 1~5) 거의 모든 가게가 '5곳에 없음'이다 — 정보가 없는 결과로 첫 줄·경고색을 만들지 않는다."""
    step = _read(*RESULT_STEP)
    for old in (
        "이번에 측정한 검색어로는 내 가게가 잘 보이지 않습니다",
        "AI(ChatGPT)에서는 아직 잘 보이지 않습니다",
        "측정한 네이버 검색어의 상위 5곳에서는 찾지 못했습니다",
    ):
        assert old not in step, old
    assert "const naverFound = bestNaverRank !== null || !!_reviewSortRank" in step
    assert 'tone: naverWeak ? "neutral" : "ok"' in step
    # ChatGPT가 확인되고 네이버 순위만 못 찾은 경우의 첫 줄은 확인된 것을 먼저 말한다
    assert "ChatGPT 추천 목록에는 나옵니다" in step
    ways = _read(*WAYS)
    assert 'nowTone: myRank ? "ok" : "calm"' in ways and 'nowTone: myRank ? "ok" : "warn"' not in ways
    status = _read(*STATUS)
    assert "지역 검색 상위 5곳 밖" not in status                 # 빨간 '5곳 밖' 행


def test_unread_items_are_marked_as_needing_direct_check():
    extras = _read("components", "trial", "TrialResultExtras.tsx")
    assert 'kind?: "check"' in extras and "직접 확인 필요" in extras
    step = _read(*RESULT_STEP)
    assert step.count('kind: "check"') == 2                      # 소개글·소식 확인형 처방 2개


def test_place_url_copy_does_not_promise_a_reading_that_can_fail():
    """주소를 붙여도 네이버 화면을 못 읽을 수 있다(체험 기록 1건은 home_load_failed) — '직접 확인해 진단합니다'로 약속하지 않는다."""
    for parts in (("app", "(public)", "trial", "components", "TrialFindStep.tsx"),
                  ("app", "(public)", "trial", "components", "TrialInputStep.tsx")):
        src = _read(*parts)
        assert "직접 확인해 진단합니다" not in src, parts[-1]
        assert "읽지 못" in src, parts[-1]


def test_trial_guide_lock_card_depends_on_real_guide():
    zone = _read(*ACTION_ZONE)
    assert "hasGuide" in zone
    assert "3가지 우선 개선 항목이 생성됐습니다" not in zone     # 가이드가 없어도 "생성됐다"고 하던 문구
    assert 'href="/guide"' in zone
    dash = _read("app", "(dashboard)", "dashboard", "page.tsx")
    assert "hasGuide={!!latestGuide}" in dash


# ── 체험 소요 시간·가이드 안내·FAQ 경고 (2026-11-05) ─────────────────────────────────────
BANNER = ("components", "dashboard", "BasicTrialBanner.tsx")


def test_trial_duration_copy_matches_the_measured_time():
    """가입 후 체험은 2회 실측 296·311초였고 가이드는 그 뒤 3~4분 더 걸렸다 — '보통 1~2분' 안내는 사실이 아니었다."""
    banner = _read(*BANNER)
    assert "1~2분" not in banner
    assert "보통 5분 안팎" in banner and "개선 가이드는 측정이 끝난 뒤 몇 분 더" in banner
    assert "측정에는 5분 안팎 걸립니다" in banner                       # 시작 전에 알린다
    assert "9 * 60_000" in banner and "6 * 60_000" not in banner         # 대기 한도가 실측 소요보다 길어야 한다
    with open(os.path.join(ROOT, "backend", "routers", "scan.py"), encoding="utf-8") as f:
        scan = f.read()
    assert "보통 1~2분 걸리며" not in scan and "보통 5분 안팎 걸리고" in scan


def test_no_guide_card_explains_the_delay_instead_of_saying_nothing_exists():
    zone = _read(*ACTION_ZONE)
    assert "가이드가 만들어지기까지 몇 분 더 걸려요" in zone and "10분이 지나도 보이지 않으면" in zone


def test_copyable_faq_sections_warn_before_copying():
    """FAQSection(소개글 하단 추가용 Q&A·AI 검색 개선 FAQ)은 복사 버튼이 있다 — 옛 가이드의 확인 안 된 문장도 이 경고를 거친다."""
    src = _read(*GUIDE)
    i = src.index("function FAQSection")
    assert "복사하기 전에 사실과 다른 문장은 고치거나 지우세요" in src[i:i + 2500]


def test_guide_deep_links_go_through_the_safe_filter_and_examples_are_labeled_as_ai_drafts():
    """AI가 쓴 deep_link(깨진 주소 관측: smartplace.naver.com/places/업체정보)는 옛 가이드 데이터까지 화면에서 한 번 더 거른다."""
    src = _read(*GUIDE)
    assert "function safeDeepLink" in src
    for raw in ("href={item.deep_link}", "href={data.deep_link}", "href={thisWeekMission.deep_link}"):
        assert raw not in src, raw
    assert src.count("safeDeepLink(") >= 7                       # 정의 1 + 사용 3곳(조건·href 각 1)
    assert "AI가 만든 초안입니다. [ ] 안은 사장님이 직접 채우고" in src
    assert "예시 문장은 AI가 만든 초안입니다. [ ] 안은 직접 채우고" in src
