"""성장 단계 이름 단일 소스 (2026-10-28).

같은 점수 구간(30/55/75)을 "지역 1등/빠른 성장/…", "지배기/성장기/…", "AI 검색 준비도 · 양호/…" 등 세 벌 이상으로
부르던 것을 services/stage_names.py(백엔드)와 frontend/lib/scoreLabels.ts(프론트) 한 쌍으로 통일했다.
이 테스트는 (1) 백엔드 모든 소비처가 같은 이름을 쓰는지, (2) 프론트와 백엔드 표가 같은지, (3) 옛 이름이 코드에 다시 들어오지 않는지 검사한다.
"""
import os
import re
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.stage_names import (  # noqa: E402
    LEGACY_STAGE_LABELS,
    READINESS_PREFIX,
    STAGE_NAME,
    normalize_stage_label,
    stage_code_for_score,
    stage_long_name,
    stage_name,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # backend/
REPO = os.path.dirname(ROOT)                                                   # 저장소 루트
FRONT = os.path.join(REPO, "frontend")


def test_names_are_the_four_agreed_readiness_names_and_distinct():
    assert STAGE_NAME == {"survival": "시작 전", "stability": "보강 단계", "growth": "개선 중", "dominance": "양호"}
    assert len(set(STAGE_NAME.values())) == 4
    assert READINESS_PREFIX == "AI 검색 준비도 · "
    assert stage_long_name("stability") == "AI 검색 준비도 · 보강 단계"
    assert stage_name("nope") == "" and stage_long_name(None) == ""


def test_score_bands_match_score_engine_for_every_half_point():
    from services.score_engine import determine_growth_stage, determine_growth_stage_label

    for i in range(0, 201):                         # 0.0 ~ 100.0, 0.5 간격 + 경계
        s = i / 2
        code = stage_code_for_score(s)
        assert determine_growth_stage(s) == code, s
        assert determine_growth_stage_label(s) == STAGE_NAME[code], s
    for edge, expected in ((29.99, "survival"), (30, "stability"), (54.99, "stability"), (55, "growth"), (74.99, "growth"), (75, "dominance")):
        assert stage_code_for_score(edge) == expected


def test_gap_analyzer_uses_the_same_names():
    from services import gap_analyzer as ga

    assert [c["stage_label"] for c in ga._GROWTH_STAGES] == [STAGE_NAME[k] for k in ("survival", "stability", "growth", "dominance")]
    for score, code in ((10, "survival"), (40, "stability"), (60, "growth"), (90, "dominance")):
        st = ga._build_growth_stage(score)
        assert st.stage == code and st.stage_label == STAGE_NAME[code]
    # 스마트플레이스 미등록은 점수와 무관하게 survival — 이름도 새 이름
    st = ga._build_growth_stage(90, biz_data={"is_smart_place": False})
    assert st.stage == "survival" and st.stage_label == "시작 전"


def test_no_overclaiming_rank_wording_in_top_stage_message():
    from services import gap_analyzer as ga

    top = [c for c in ga._GROWTH_STAGES if c["stage"] == "dominance"][0]
    assert "상위권" not in top["focus_message"] and "1등" not in top["focus_message"]


def test_gap_card_and_share_card_use_the_same_names():
    from services.gap_card import _stage_label

    for score, code in ((0, "survival"), (30, "stability"), (55, "growth"), (80, "dominance")):
        assert _stage_label(score) == STAGE_NAME[code]
    # 다른 테스트가 services.share_card 를 가짜 모듈로 등록해 두므로 진짜 모듈로 바꿔 가져온다
    import importlib
    with patch.dict(sys.modules):
        m = sys.modules.get("services.share_card")
        if m is not None and getattr(m, "__file__", None) is None:
            sys.modules.pop("services.share_card")
        real = importlib.import_module("services.share_card")
        for score, code in ((0, "survival"), (30, "stability"), (55, "growth"), (80, "dominance")):
            assert real._score_stage_label(score) == stage_long_name(code)


def test_email_sender_uses_the_same_names():
    from services import email_sender as es

    assert es._GROWTH_STAGE_KO == STAGE_NAME


def test_normalize_prefers_code_then_maps_legacy_then_passes_through():
    assert normalize_stage_label("생존기", "stability") == "보강 단계"            # 코드가 우선
    assert normalize_stage_label("지역 1등") == "양호"
    assert normalize_stage_label("성장 중") == "보강 단계"                          # 옛 score_engine 라벨은 stability
    assert normalize_stage_label("안정기") == "보강 단계"
    assert normalize_stage_label("지배기") == "양호" and normalize_stage_label("선도기") == "양호"
    assert normalize_stage_label("양호") == "양호"
    assert normalize_stage_label("전혀 다른 문구") == "전혀 다른 문구"
    assert normalize_stage_label(None) == "" and normalize_stage_label("", None) == ""
    assert all(v in STAGE_NAME for v in LEGACY_STAGE_LABELS.values())


# ── 프론트 일치·재유입 방지 ───────────────────────────────────────────────────
_needs_front = pytest.mark.skipif(not os.path.isdir(FRONT), reason="frontend 폴더 없음")


def _read(rel):
    return open(os.path.join(FRONT, rel), encoding="utf-8").read()


@_needs_front
def test_frontend_table_equals_backend_table():
    src = _read("lib/scoreLabels.ts")
    block = re.search(r"export const STAGE_NAME = \{(.*?)\} as const;", src, re.S).group(1)
    pairs = dict(re.findall(r'(\w+):\s*"([^"]+)"', block))
    assert pairs == STAGE_NAME
    assert re.search(r'READINESS_PREFIX = "([^"]+)"', src).group(1) == READINESS_PREFIX
    # 구간 경계도 같아야 한다
    fn = re.search(r"export function stageCodeForScore.*?\n\}", src, re.S).group(0)
    assert re.findall(r"score >= (\d+)\) return \"(\w+)\"", fn) == [("75", "dominance"), ("55", "growth"), ("30", "stability")]


@_needs_front
def test_frontend_legacy_map_matches_backend_legacy_map():
    src = _read("lib/scoreLabels.ts")
    block = re.search(r"const LEGACY_STAGE_LABELS[^{]*\{(.*?)\};", src, re.S).group(1)
    pairs = dict(re.findall(r'"([^"]+)":\s*"(\w+)"', block))
    assert pairs == LEGACY_STAGE_LABELS


_OLD_WORDS = ("생존기", "안정기", "성장기", "지배기", "선도기", "지역 1등", "빠른 성장", "안정 궤도", "성장 진행 중", "성장 준비 중")
# 옛 라벨을 새 이름으로 바꿔 주는 변환표만 옛 단어를 가질 수 있다(DB·AI 텍스트에 이미 저장된 문구 대응)
_LEGACY_ALLOWED = {
    os.path.join("backend", "services", "stage_names.py"),
    os.path.join("frontend", "lib", "scoreLabels.ts"),
    os.path.join("frontend", "app", "(dashboard)", "guide", "GuideClient.tsx"),
}


def _walk(base, exts, skip_dirs=("node_modules", ".next", "tests", "__pycache__", "venv")):
    for dp, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not re.search(r"(_tmp|\.bak|backup)", d, re.I)]
        for f in files:
            if f.endswith(exts) and not f.endswith(".bak"):
                yield os.path.join(dp, f)


def test_old_stage_names_do_not_reappear_in_source():
    offenders = []
    targets = [(os.path.join(ROOT, d), (".py",)) for d in ("services", "routers", "models", "scheduler")]
    if os.path.isdir(FRONT):
        targets += [(os.path.join(FRONT, d), (".ts", ".tsx")) for d in ("app", "components", "lib")]
    for base, exts in targets:
        if not os.path.isdir(base):
            continue
        for path in _walk(base, exts):
            rel = os.path.relpath(path, REPO)
            if rel in _LEGACY_ALLOWED:
                continue
            text = open(path, encoding="utf-8", errors="ignore").read()
            for w in _OLD_WORDS:
                if w in text:
                    offenders.append(f"{rel}: {w}")
    assert not offenders, offenders
