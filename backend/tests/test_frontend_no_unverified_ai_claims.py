"""프론트 화면에 'AI 노출이 낮은 것은 정상/일반적' 같은 단정 문구가 다시 들어오지 않게 막는다 (2026-11-01).

V1 수기 검증(ChatGPT 웹 검색을 켠 화면 vs 우리 기억 모드)에서 기억 모드 0인 가게가 검색을 켠 화면에서는 상위에 추천되는 사례가 있었다.
'낮은 것이 정상/일반적', '자료에 포함되지 않았다' 같은 단정은 사실이 아닐 수 있다 — 화면에는 "이번 측정에서는 확인되지 않았고 검색을 켠 화면에서는
다를 수 있다"로 쓴다. 10-31에 7곳을 고쳤지만 grep만으로는 4곳이 남아 로그인 화면을 직접 보고서야 발견했다 → 금지 문구를 테스트로 고정한다.

문구를 새로 쓸 때: 측정 결과를 '정상'·'일반적'이라 하지 말고, 근거 없는 평균 수치(예: '평균 언급률 1~3%')도 넣지 않는다.
"""
import pathlib

import pytest

FRONTEND = pathlib.Path(__file__).resolve().parent.parent.parent / "frontend"
SCAN_DIRS = ("app", "components", "lib")
SKIP_PARTS = ("node_modules", ".next", "__tests__")

# (금지 문구, 이유)
FORBIDDEN = [
    ("언급하지 않고 있습니다", "측정 한계를 결과처럼 단정"),
    ("지금 노출 안 되는 건 정상", "낮은 노출을 정상이라 단정"),
    ("낮아도 정상", "낮은 노출을 정상이라 단정"),
    ("일반적인 현재 상태", "낮은 노출을 일반적이라 단정"),
    ("ChatGPT에 없는 건 정상", "낮은 노출을 정상이라 단정"),
    ("낮은 점수가 일반적", "낮은 노출을 일반적이라 단정(2026-11-01: '일반적이며' 변형이 3곳에서 라이브로 나가고 있었다 — 어미가 달라 옛 금지어를 피했다)"),
    ("단기 변동이 없습니다", "ChatGPT 결과가 바뀌지 않는다고 보장하는 표현"),
    ("현재 수준이 일반적입니다", "낮은 노출을 일반적이라 단정"),
    ("미리 공부한 자료에 아직 포함되지 않았습니다", "측정(기억 모드)을 사실처럼 단정"),
    ("평균 언급률 약 1~3%", "근거 없는 평균 수치"),
    ("수개월 내 개선됩니다", "개선 보장 표현"),
]


def find_violations(root: pathlib.Path):
    found = []
    for d in SCAN_DIRS:
        base = root / d
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if p.suffix not in (".ts", ".tsx") or any(part in p.parts for part in SKIP_PARTS):
                continue
            text = p.read_text(encoding="utf-8", errors="ignore")
            for phrase, reason in FORBIDDEN:
                if phrase in text:
                    line = next(i for i, ln in enumerate(text.splitlines(), 1) if phrase in ln)
                    found.append(f"{p.relative_to(root).as_posix()}:{line} '{phrase}' ({reason})")
    return found


def test_checker_catches_a_forbidden_phrase(tmp_path):
    """검사기 자체의 변이 확인 — 금지 문구가 있는 파일이 있으면 실제로 잡아야 한다."""
    comp = tmp_path / "components"
    comp.mkdir()
    (comp / "Bad.tsx").write_text("<p>지금 노출 안 되는 건 정상입니다.</p>\n<p>OK 문장</p>", encoding="utf-8")
    (comp / "Good.tsx").write_text("<p>이번 측정에서는 확인되지 않았습니다.</p>", encoding="utf-8")
    got = find_violations(tmp_path)
    assert len(got) == 1 and "Bad.tsx:1" in got[0]


def test_frontend_has_no_unverified_ai_claims():
    if not FRONTEND.exists():
        pytest.skip("frontend 폴더가 없는 환경")
    bad = find_violations(FRONTEND)
    assert not bad, "단정 문구가 화면 코드에 있다(문구를 '이번 측정에서는 확인되지 않았고 검색을 켠 화면에서는 다를 수 있다'로):\n" + "\n".join(bad)
