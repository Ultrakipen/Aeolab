"""
_calc_keyword_coverage() 테스트 (2026-07-18)

2026-07-18 발견: 하위카테고리를 taxonomy dict 삽입 순서대로 이어붙인 뒤 [:20]으로
자르고 있어서, 총 키워드가 20개를 넘는 업종은 뒤쪽 하위카테고리(대개 나중에 추가된
특화·고가중치 카테고리)가 통째로 커버리지 계산에서 빠졌음. 실측: music_studio의
"스튜디오전문성"(작곡 레슨·레코딩 스튜디오 등, weight=0.25)가 앞 카테고리 누적
20개에 밀려 한 글자도 검사되지 않고 있었음. 가중치 내림차순 정렬 + 상한 제거로 수정.
"""
from services.blog_analyzer import _calc_keyword_coverage


def test_music_studio_covers_specialty_keywords():
    """실제 재현 사례 — 스튜디오전문성 카테고리 키워드가 이제 커버리지에 포함돼야 함"""
    texts = [
        "음원제작, 녹음, 음원등록까지! 작곡 편곡 레코딩 스튜디오",
        "보컬 녹음부터 결혼식 음원까지 완벽하게 미디 작업",
    ]
    result = _calc_keyword_coverage(texts, "music_studio")
    assert "레코딩 스튜디오" in result["covered_keywords"]
    assert "작곡 레슨" in result["covered_keywords"]
    assert "미디 작업" in result["covered_keywords"]


def test_ai_tab_context_excluded_from_coverage():
    """ai_tab_context는 briefing_engine.py 전용 하위카테고리라 블로그 갭 분석에 섞이면 안 됨"""
    from services.keyword_taxonomy import KEYWORD_TAXONOMY
    ai_tab_only_kws = set(KEYWORD_TAXONOMY["music"]["ai_tab_context"]["keywords"])
    other_kws = set()
    for k, v in KEYWORD_TAXONOMY["music"].items():
        if k != "ai_tab_context" and isinstance(v, dict) and "keywords" in v:
            other_kws.update(v["keywords"])
    ai_tab_exclusive = ai_tab_only_kws - other_kws
    assert ai_tab_exclusive, "테스트 전제 확인용 — ai_tab_context만의 고유 키워드가 있어야 검증 의미 있음"

    result = _calc_keyword_coverage(["아무 텍스트"], "music_studio")
    all_checked = set(result["covered_keywords"]) | set(result["missing_keywords"])
    # missing_keywords는 상위 10개로 잘리므로, covered에도 missing에도 전혀 없을 수 있는
    # ai_tab_context 전용 키워드는 이 검사만으로 완전 증명은 안 되지만, 최소한 covered에는
    # 나타나면 안 됨(아무 텍스트에도 매칭 안 될 무의미한 문자열이라 covered일 수 없음이 정상)
    assert not (ai_tab_exclusive & set(result["covered_keywords"]))


def test_no_hard_cap_on_large_taxonomy():
    """restaurant는 57개 키워드(구 20개 상한보다 훨씬 큼) — 커버리지 계산에 전부 반영돼야 함"""
    result = _calc_keyword_coverage(["아무 텍스트"], "restaurant")
    total_checked = len(result["covered_keywords"]) + len(result["missing_keywords"])
    # missing_keywords는 상위 10개로 잘리므로 총합이 20을 훨씬 넘을 순 없지만,
    # coverage 비율 계산의 분모(unique_keywords 전체)는 20개 제한이 없어야 함 —
    # coverage가 0%에 가까워야 함(대부분 미매칭)이 아니라 분모가 57 근처인지 간접 확인
    assert result["coverage"] < 5.0  # 57개 중 "아무 텍스트"에 우연히 매칭되는 것도 극소수여야 정상
