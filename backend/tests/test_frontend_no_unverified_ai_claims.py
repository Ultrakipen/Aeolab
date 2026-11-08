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
    ("소개글·소식·리뷰를 고치면 2~4주 내 반영됩니다", "기간 단정(참고값·보장 아님으로 써야 한다)"),
    ("채팅방 하단 메뉴 6개", "실제 생성은 최대 5개(guide.py raw_menus[:5])"),
    ("카카오톡으로 즉시 알림", "알림은 스캔 뒤 발송되고 설정에서 켜야 한다 — '즉시' 약속 금지"),
    ("경쟁 가게의 변화를 자동으로 감지해 카카오톡으로 알려드립니다", "경쟁사 변화 감지는 대시보드 표시, 카카오 알림은 노출 단계가 크게 바뀔 때만(11-01 알림 규칙)"),
    ("채팅방 메뉴·소개글·최근 소식 누락 자동 확인", "톡톡·FAQ 감지는 Q&A 탭 폐기로 중단됨(naver_place_stats.py has_faq=False)"),
    ("ChatGPT + 네이버 AI 브리핑 확인", "무료 체험은 네이버 AI 브리핑을 측정하지 않는다(가입 후)"),
    ("소개글·FAQ·소식 중 빠진 곳을 찾아드려요", "FAQ는 자동 감지가 아니라 체크리스트"),
    ("Gemini 측정 도구 점수는", "제미나이 측정은 준비 중인 동안 도구가 있는 것처럼 쓰지 않는다"),
    # ── 2026-11-08 랜딩 문구 점검(docs/landing_copy_revision_2026_11_08.md)에서 정정한 유형 ──
    ("노출 지속 유지", "점검 도구가 노출을 유지해 주는 것처럼 읽히는 결과 약속"),
    ("광고 없이 AI 노출 시작", "광고 없이 노출이 시작된다는 결과 약속(AI 브리핑 광고 도입 보도와도 충돌)"),
    ("AI 노출에 필요한 모든 것", "'모든 것' 과장 표현"),
    ("업종 평균보다 높은 노출", "근거 없는 업종 평균 비교"),
    ("대부분의 가게가 아직 준비 중", "근거 없는 평균 주장이자 긴급성 압박"),
    ("광고 없이도 AI 검색 상위에 지속 노출", "광고 없이 지속 노출된다는 결과 약속(11-08, ad-defense 정정)"),
    ("광고 없이도 AI 검색에 지속 노출", "광고 없이 지속 노출된다는 결과 약속(11-08, ad-defense 정정)"),
    ("영구 효과", "효과 지속 단정"),
    ("3분 만에", "체험 소요 시간을 실측 없이 숫자로 단정(11-08: 공개 문구는 '몇 분이면'처럼 상징적으로 안내)"),
    ("낮음 (일반적)", "낮은 노출을 일반적이라 단정(DualTrackCard 글로벌 라벨, 11-08 정정)"),
    ("광고비의 30%를 AI 노출로 대체", "근거 없는 광고비 대체 가정(11-08 계산기 정정)"),
    ("광고 끊으면 사라집니다","AI 브리핑에도 광고가 도입돼 'AI 검색은 광고와 무관'으로 읽히는 전제 문구"),
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


def test_gemini_measurement_mentions_on_faq_page_state_the_status():
    """FAQ 페이지가 'Gemini 측정'을 말할 때는 준비 중 상태를 함께 적어야 한다(랜딩·요금제와 같은 기준)."""
    text = (FRONTEND / "app/(public)/faq/page.tsx").read_text(encoding="utf-8", errors="ignore")
    offenders = [f"{i}: {ln.strip()[:80]}" for i, ln in enumerate(text.splitlines(), 1)
                 if "Gemini 측정" in ln and "준비 중" not in ln and "GEMINI_LIVE" not in ln]
    assert not offenders, offenders


def test_how_it_works_headline_follows_the_gemini_flag():
    text = (FRONTEND / "app/(public)/how-it-works/page.tsx").read_text(encoding="utf-8", errors="ignore")
    assert "GEMINI_LIVE ? \"네이버·Gemini·ChatGPT·Google AI\"" in text


# ── 제미나이 '준비 중' 표기는 항상 측정 상태 플래그에 묶여야 한다 (2026-11-02) ─────────────────────────────
# 유료화 후 GEMINI_MEASUREMENT_LIVE=true로 켜면 사이트 전체가 '정상 작동' 문구로 한 번에 바뀌어야 한다.
# 고정으로 박힌 '준비 중' 문구가 하나라도 있으면 켠 뒤에도 "준비 중"이 남는다.
import re as _re  # noqa: E402

_GEM_WORD = _re.compile(r"Gemini|제미나이")


def _unflagged_preparing_mentions(root: pathlib.Path):
    found = []
    for d in SCAN_DIRS:
        base = root / d
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if p.suffix not in (".ts", ".tsx") or any(part in p.parts for part in SKIP_PARTS) or p.name == "featureFlags.ts":
                continue
            lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
            for i, ln in enumerate(lines):
                # 같은 줄에 플래그가 있어야 한다 — 주변 줄에 플래그가 있다고 통과시키면 바로 옆 고정 문구를 놓친다
                if "준비 중" in ln and _GEM_WORD.search(ln) and "GEMINI_LIVE" not in ln and "GEMINI_MEASUREMENT_LIVE" not in ln:
                    found.append(f"{p.relative_to(root).as_posix()}:{i + 1} {ln.strip()[:90]}")
    return found


def test_gemini_preparing_text_is_always_tied_to_the_flag():
    assert not _unflagged_preparing_mentions(FRONTEND)


def test_the_flag_guard_catches_an_unflagged_preparing_line(tmp_path):
    comp = tmp_path / "components"
    comp.mkdir()
    (comp / "Bad.tsx").write_text("<p>Gemini 측정은 준비 중이에요</p>\n", encoding="utf-8")
    (comp / "Good.tsx").write_text('<p>{GEMINI_LIVE ? "Gemini 측정" : "Gemini 측정은 준비 중이에요"}</p>\n', encoding="utf-8")
    got = _unflagged_preparing_mentions(tmp_path)
    assert len(got) == 1 and "Bad.tsx" in got[0]
