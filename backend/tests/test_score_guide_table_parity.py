"""공개 페이지 score-guide의 하드코딩 표가 점수 엔진 상수와 같은지 검사한다 (2026-11-06).

배경: score-guide 의 업종 비율표·네이버 항목 비율표·글로벌 항목 비중표는 tsx 에 숫자가 직접 적혀 있고,
이 표를 코드와 대조하는 장치가 없었다(업종 비율 3사본 일치 테스트는 dualTrack.ts·channelGuideData.ts 만 본다).
2026-11-06 bakery·nail 비율 누락처럼 표와 코드가 조용히 어긋나는 사고를 막기 위한 테스트다.

이 테스트는 파일을 읽기만 한다 — 네이버·외부 접속 없음, DB 없음.

검증하지 않는 것(명시): 표 밖의 서술 문구, 점수 모델 버전(SCORE_MODEL_VERSION)이 v3_1 이라는 전제,
업종별 '이유' 문장. 표의 행 수·행 이름이 달라지면 일부러 실패한다(조용히 건너뛰어 통과하는 것을 막는다).
"""
import pathlib
import re

from services.score_engine import (
    DEFAULT_DUAL_TRACK_RATIO,
    DUAL_TRACK_RATIO,
    GLOBAL_TRACK_WEIGHTS,
    NAVER_TRACK_WEIGHTS_V3_1,
)

ROOT = pathlib.Path(__file__).resolve().parents[2]
PAGE = ROOT / "frontend" / "app" / "(public)" / "score-guide" / "page.tsx"

# 표의 한글 업종명 → 그 행이 대표하는 코드 키(모두 같은 비율이어야 한다). None = 미등록 업종 기본값 행
RATIO_ROW_KEYS = {
    "음식점": ["restaurant"],
    "카페": ["cafe"],
    "뷰티·미용·네일": ["beauty", "nail"],
    "약국": ["pharmacy"],
    "헬스·필라테스·요가": ["fitness", "yoga"],
    "반려동물": ["pet"],
    "의원·병원": ["medical", "clinic"],
    "치과": ["dental"],
    "인테리어": ["interior"],
    "부동산": ["realestate"],
    "자동차 정비": ["auto"],
    "사진 스튜디오": ["photo"],
    "교육·학원": ["academy"],
    "법률": ["legal"],
    "세무·회계": ["accounting"],
    "온라인몰·종합쇼핑": ["shopping"],
    "숙박": ["accommodation"],
    "청소·기타": None,
}

# 네이버 항목 표의 행 이름 → 가중치 키. 키워드 순위(keyword_search_rank)는 점수 미포함이라 표에 없다.
NAVER_ROW_KEYS = {
    "리뷰 품질": "review_quality",
    "스마트플레이스 완성도": "smart_place_completeness",
    "지도·카카오맵": "local_map_score",
    "블로그 노출": "blog_crank",
    "AI 브리핑 노출": "ai_briefing_score",
}
NAVER_GROUP_COLUMNS = {"active": "ACTIVE", "likely": "LIKELY", "inactive": "INACTIVE"}

GLOBAL_ROW_KEYS = {
    "AI 노출 빈도": "multi_ai_exposure",
    "웹사이트 정보 등록": "schema_seo",
    "온라인 언급": "online_mentions",
    "Google 검색 노출": "google_presence",
}


def _page() -> str:
    assert PAGE.exists(), f"score-guide 페이지를 찾을 수 없다: {PAGE}"
    return PAGE.read_text(encoding="utf-8")


def _ratio_rows() -> dict:
    rows = re.findall(r'category:\s*"([^"]+)",\s*naver:\s*(\d+),\s*global:\s*(\d+),', _page())
    return {label: (int(n), int(g)) for label, n, g in rows}


def _naver_rows() -> dict:
    rows = re.findall(
        r'item:\s*"([^"]+)",\s*active:\s*"([\d.]+)%",\s*likely:\s*"([\d.]+)%",\s*inactive:\s*"([\d.]+)%"', _page()
    )
    return {label: {"active": a, "likely": l, "inactive": i} for label, a, l, i in rows}


def _global_rows() -> dict:
    rows = re.findall(r'item:\s*"([^"]+)",\s*weight:\s*"(\d+)%"', _page())
    return {label: int(w) for label, w in rows}


def test_ratio_table_covers_exactly_the_mapped_rows():
    # 행이 추가·삭제·이름 변경되면 이 매핑을 갱신하게 만든다(조용한 누락 방지)
    assert set(_ratio_rows()) == set(RATIO_ROW_KEYS), (
        f"score-guide 업종 비율표 행이 매핑과 다르다. 표만 있음: {set(_ratio_rows()) - set(RATIO_ROW_KEYS)}, "
        f"매핑만 있음: {set(RATIO_ROW_KEYS) - set(_ratio_rows())}"
    )


def test_ratio_table_matches_dual_track_ratio():
    bad = []
    for label, (naver, glob) in _ratio_rows().items():
        keys = RATIO_ROW_KEYS[label]
        if keys is None:
            expected = [DEFAULT_DUAL_TRACK_RATIO]
            names = ["DEFAULT_DUAL_TRACK_RATIO"]
        else:
            missing = [k for k in keys if k not in DUAL_TRACK_RATIO]
            assert not missing, f"'{label}' 행이 가리키는 키가 점수 엔진에 없다: {missing}"
            expected = [DUAL_TRACK_RATIO[k] for k in keys]
            names = keys
        for name, ratio in zip(names, expected):
            if (round(ratio["naver"] * 100), round(ratio["global"] * 100)) != (naver, glob):
                bad.append(f"{label}[{name}] 표 {naver}/{glob} ≠ 코드 {ratio['naver']:.2f}/{ratio['global']:.2f}")
        assert naver + glob == 100, f"'{label}' 표 합계가 100이 아니다: {naver}+{glob}"
    assert bad == [], "score-guide 업종 비율표가 코드와 다르다:\n" + "\n".join(bad)


def test_naver_item_table_is_v3_1_weights_without_keyword_rank_renormalized():
    rows = _naver_rows()
    assert set(rows) == set(NAVER_ROW_KEYS), f"네이버 항목 표 행이 매핑과 다르다: {set(rows) ^ set(NAVER_ROW_KEYS)}"
    bad = []
    for col, group in NAVER_GROUP_COLUMNS.items():
        weights = NAVER_TRACK_WEIGHTS_V3_1[group]
        total = 1.0 - weights["keyword_search_rank"]  # 키워드 순위는 점수에서 빼고 나머지를 100%로 맞춘다
        shown_sum = 0.0
        for label, key in NAVER_ROW_KEYS.items():
            expected = weights[key] / total * 100
            shown = float(rows[label][col])  # 화면은 '0%'처럼 소수점이 없을 수 있어 문자열이 아니라 숫자로 비교한다
            shown_sum += shown
            # 화면은 소수 첫째 자리 반올림이므로 오차 0.05 이내여야 한다
            if abs(shown - expected) > 0.05:
                bad.append(f"{group}/{label}: 표 {shown}% ≠ 코드 {expected:.1f}%")
        # 반올림 때문에 100과 ±0.2 안에서 다를 수 있다
        assert abs(shown_sum - 100.0) <= 0.3, f"{group} 열 합계가 100에서 벗어났다: {shown_sum}"
    assert bad == [], "score-guide 네이버 항목 비율표가 코드와 다르다:\n" + "\n".join(bad)


def test_global_item_table_matches_global_track_weights():
    rows = _global_rows()
    assert set(rows) == set(GLOBAL_ROW_KEYS), f"글로벌 항목 표 행이 매핑과 다르다: {set(rows) ^ set(GLOBAL_ROW_KEYS)}"
    bad = [
        f"{label}: 표 {w}% ≠ 코드 {round(GLOBAL_TRACK_WEIGHTS[GLOBAL_ROW_KEYS[label]] * 100)}%"
        for label, w in rows.items()
        if w != round(GLOBAL_TRACK_WEIGHTS[GLOBAL_ROW_KEYS[label]] * 100)
    ]
    assert bad == [], "score-guide 글로벌 항목 비중표가 코드와 다르다:\n" + "\n".join(bad)
    assert sum(rows.values()) == 100
