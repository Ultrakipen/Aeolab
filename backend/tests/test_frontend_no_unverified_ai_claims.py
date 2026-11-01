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
    ("대신 챙겨드립니다", "우리가 대신 실행하는 것처럼 읽힘(실제는 순서 안내·초안 제공, 대행은 별도 서비스)"),
    ("매달 우상향", "개선 보장으로 읽힘"),
    ("광고 없이도 AI 추천 조건", "개선 보장으로 읽힘"),
    ("전혀 효과 없음", "근거 없는 절대 표현"),
    ("표본이 많을수록", "같은 질문에 거의 같은 답을 하는 모델과 어긋남(신뢰구간 문구와 모순)"),
    ("직접적인 연결 효과가 있습니다", "효과 단정(체험 결과는 기간·효과를 약속하지 않는다고 안내)"),
    ("2~4주 안에 변화가 나타납니다", "기간 단정(체험 결과는 \"어느 길도 기간을 약속할 수 없어요\"라고 안내)"),
    ("50~100회 같은 검색어", "실제는 여러 말투로 묻는다"),
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


# ── 랜딩이 제미나이를 '가입하면 확인'으로 약속할 때는 측정 상태(GEMINI_MEASUREMENT_LIVE)를 따라야 한다 (2026-11-01) ─────────
# 히어로는 제미나이를 "가입하면 확인하는 길"로 적고 있었는데 같은 페이지 구독 기능에는 "Gemini 측정은 준비 중"이라 적혀 모순이었다.
GEMINI_GUARDED_FILES = ("components/landing/HeroSection.tsx", "components/landing/HowAeolabIntegrated.tsx")


def test_landing_mentions_of_gemini_follow_the_live_flag():
    offenders = []
    for rel in GEMINI_GUARDED_FILES:
        text = (FRONTEND / rel).read_text(encoding="utf-8", errors="ignore")
        assert "GEMINI_MEASUREMENT_LIVE" in text, f"{rel}: 측정 상태 플래그를 가져오지 않는다"
        for i, line in enumerate(text.splitlines(), 1):
            if "제미나이" in line and "GEMINI_LIVE" not in line and "준비 중" not in line:
                offenders.append(f"{rel}:{i} {line.strip()[:80]}")
    assert not offenders, offenders


def test_hero_has_a_start_button_above_the_form_on_small_screens():
    """모바일 첫 화면에 진단 입력창이 보이지 않아(11-01 라이브 확인) 시작 버튼과 입력창 앵커가 있어야 한다."""
    text = (FRONTEND / "components/landing/HeroSection.tsx").read_text(encoding="utf-8", errors="ignore")
    assert 'href="#trial-form"' in text and 'id="trial-form"' in text
