"""업종별 듀얼트랙 비율의 세 사본(백엔드 표·dualTrack.ts·channelGuideData.ts)이 같고, 선택 가능한 업종이 비율을 갖는다 (2026-11-06).

수정 전 결함: score_engine.py:148 주석이 "bakery·nail은 cafe/beauty로 합쳐지므로 별도 키 불필요"라고 했지만 _CATEGORY_ALIASES는 2026-05-18에
nail→nail, bakery→bakery로 분리돼 있었다 → 두 업종이 비율표에 없어 기본값 60/40(글로벌 AI 비중 과대)이 적용됐고, 프론트 두 파일에도 같은 값이
복사돼 있었다. 대상 사업장은 0곳이었다(서버 DB 확인). 사본이 어긋나도 알려 주는 장치가 없었다.
"""
import pathlib
import re

import pytest

from services.score_engine import DEFAULT_DUAL_TRACK_RATIO, DUAL_TRACK_RATIO, get_dual_track_ratio, normalize_category

ROOT = pathlib.Path(__file__).resolve().parents[2]
FRONT = ROOT / "frontend"


def _leaf_categories():
    src = (FRONT / "lib" / "categories.ts").read_text(encoding="utf-8")
    body = src[src.index("export const FLAT_CATEGORY_GROUPS"):src.index("export const FLAT_CATEGORIES")]
    return list(dict.fromkeys(re.findall(r'value:\s*"([a-z_]+)"', body)))


# 비율표에 없어도 되는 선택 가능 업종(기본 60/40을 의도적으로 쓴다) — 사유가 있어야 한다
_DEFAULT_RATIO_OK = {
    "cleaning": "BRIEFING_INACTIVE이고 전략적 중요도 낮음 — score_engine.py 주석에 명시된 의도적 폴백",
    "fashion": "BRIEFING_INACTIVE이고 전략적 중요도 낮음 — score_engine.py 주석에 명시된 의도적 폴백",
    "other": "'기타'는 업종을 모르므로 중립 기본값(get_dual_track_ratio가 따로 막는다)",
}


def test_every_selectable_category_has_a_ratio_or_a_documented_reason():
    leaves = _leaf_categories()
    assert len(leaves) >= 55
    missing = [c for c in leaves if normalize_category(c) not in DUAL_TRACK_RATIO and c not in _DEFAULT_RATIO_OK]
    assert missing == [], f"비율표에 없는 선택 가능 업종(낡은 alias 주석 의심): {missing}"


def test_documented_default_categories_really_use_the_default():
    for c in _DEFAULT_RATIO_OK:
        assert get_dual_track_ratio(c) == DEFAULT_DUAL_TRACK_RATIO


def test_bakery_and_nail_follow_their_sibling_categories():
    assert get_dual_track_ratio("bakery") == DUAL_TRACK_RATIO["cafe"] == {"naver": 0.75, "global": 0.25}
    assert get_dual_track_ratio("nail") == DUAL_TRACK_RATIO["beauty"] == {"naver": 0.70, "global": 0.30}
    assert get_dual_track_ratio("bar") == DUAL_TRACK_RATIO["restaurant"]          # bar는 alias로 합쳐지는 것이 맞다


@pytest.mark.parametrize("cat", ["bakery", "nail", "cafe", "beauty", "restaurant", "legal", "other"])
def test_ratios_sum_to_one(cat):
    r = get_dual_track_ratio(cat)
    assert abs(r["naver"] + r["global"] - 1.0) < 1e-9


def _frontend_global_weights():
    src = (FRONT / "lib" / "dualTrack.ts").read_text(encoding="utf-8")
    body = src[src.index("const GLOBAL_WEIGHTS"):]
    body = body[:body.index("};")]
    return {k: float(v) for k, v in re.findall(r"^\s*([a-z_]+):\s*([0-9.]+),", body, re.M)}


def test_frontend_dualtrack_weights_equal_backend_for_every_selectable_category():
    fw = _frontend_global_weights()
    assert len(fw) >= 55                       # 파싱이 깨지면 검증이 비어 버린다
    bad = []
    for c in _leaf_categories():
        expected = get_dual_track_ratio(c)["global"]
        actual = fw.get(c, DEFAULT_DUAL_TRACK_RATIO["global"])
        if abs(expected - actual) > 1e-9:
            bad.append((c, expected, actual))
    assert bad == [], f"dualTrack.ts가 백엔드와 다름: {bad}"


def test_frontend_dualtrack_has_no_keys_the_backend_does_not_know():
    fw = _frontend_global_weights()
    unknown = [k for k in fw if k not in _leaf_categories() and k not in DUAL_TRACK_RATIO]
    assert unknown == [], f"백엔드에 없는 업종 키: {unknown}"


def test_channel_guide_ratios_equal_backend():
    src = (FRONT / "lib" / "channelGuideData.ts").read_text(encoding="utf-8")
    entries = re.findall(r'value:\s*"([a-z_]+)"[^}]*?naverRatio:\s*(\d+),\s*globalRatio:\s*(\d+)', src, re.S)
    assert len(entries) >= 40                  # 파싱이 깨지면 검증이 비어 버린다
    bad = []
    for value, n, g in entries:
        r = get_dual_track_ratio(value)
        if (round(r["naver"] * 100), round(r["global"] * 100)) != (int(n), int(g)):
            bad.append((value, (int(n), int(g)), (round(r["naver"] * 100), round(r["global"] * 100))))
    assert bad == [], f"channelGuideData.ts가 백엔드와 다름(프론트, 백엔드): {bad}"
