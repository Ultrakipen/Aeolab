"""행동 효과·점수 추이의 방향 표시 (2026-11-02) — 모든 화면이 공용 규칙(lib/changeDirection)을 쓰고, 옛 "0이 아니면 화살표" 패턴이 돌아오지 않는다.

배경(실측): 같은 가게의 일간 점수 변화는 중앙값 3~4점이고 60% 이상이 2점 이상이라 0.1~3점 차이를 "개선됨/하락"으로 말하면 측정 오차를 변화로 말하게 된다.
행동 기록 91건 중 사용자가 직접 한 행동은 1건뿐이고 나머지는 시스템 자동 기록(auto_recommended는 추천 카드를 열어 볼 때 남는 기록, score_up/down은 점수 변화 자체의 로그,
competitor_ahead는 경쟁사 상태)이라 그 옆에 '행동 효과'를 붙이면 같은 말을 되풀이하거나 엇갈리고, 화살표는 "이 행동 때문에 올랐다"는 인과를 암시한다(지침 9: 인과 단정 금지).
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 이 테스트를 배포한다.
"""
import json
import os
import re
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FE = os.path.join(ROOT, "frontend")


def _read(*parts):
    with open(os.path.join(FE, *parts), encoding="utf-8") as f:
        return f.read()


def _code(src: str) -> str:
    """주석을 뺀 코드 — 옛 패턴을 설명하는 주석("0.1점만 달라도 개선됨…")이 금지 패턴 검사에 걸리지 않게 한다. 음성 검사에만 쓴다."""
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"(?<!:)//[^\n]*", "", src)


GROWTH = _read("app", "(dashboard)", "growth", "GrowthClient.tsx")
TREND = _read("components", "dashboard", "TrendLine.tsx")
TIMELINE = _read("components", "guide", "ActionTimelineCard.tsx")
CHART7 = _read("components", "dashboard", "Action7DayChart.tsx")
RESULT = _read("components", "dashboard", "ActionResultCard.tsx")
HISTORY = _read("app", "(dashboard)", "history", "page.tsx")
HERO = _read("components", "dashboard", "DashboardHeroCard.tsx")
DASH = _read("app", "(dashboard)", "dashboard", "page.tsx")

ACTION_EFFECT_FILES = {"GrowthClient": GROWTH, "TrendLine": TREND, "ActionTimelineCard": TIMELINE, "Action7DayChart": CHART7, "ActionResultCard": RESULT}


def test_every_action_effect_surface_uses_the_shared_rule():
    for name, src in ACTION_EFFECT_FILES.items():
        assert "@/lib/changeDirection" in src, name
        assert "changeDirection(" in src, name


def test_old_any_difference_arrow_patterns_are_gone():
    g, t, tl, c7, r, h = (_code(x) for x in (GROWTH, TREND, TIMELINE, CHART7, RESULT, HERO))
    assert "scoreDelta" not in g                                                         # 성장 화면 두 목록: round(after-before)가 0이 아니면 ↑/↓
    assert "점수 상승" not in g and "점수 하락" not in g
    assert "Math.round(log.score_after - log.score_before)" not in t
    assert "Math.abs(delta) < 0.1" not in tl and "개선됨" not in tl                     # 0.1점만 달라도 "개선됨/하락"
    assert "getDeltaLabel" not in c7 and "소폭 향상" not in c7 and "크게 하락" not in c7  # ±0.5·±5점 단계
    assert "개선됨 ↑" not in r and "하락 ↓" not in r and "a.after_score > a.before_score" not in r
    assert "scoreChangeDiff !== 0" not in h and "↑ 개선됨" not in h                    # 대시보드 맨 위 배지(반올림이 0이 아니기만 하면 표시)


def test_system_records_get_no_effect_display_on_every_surface():
    # 효과 표시는 showsScoreDeltaBadge로 걸러진 사용자 행동에만 — 공용 목록을 쓰지 않는 표면이 있으면 시스템 기록에 효과가 붙는다
    assert GROWTH.count("showsScoreDeltaBadge(log.action_type) ? changeDirection(") == 2         # 성장 화면 두 목록: 효과 방향 계산 자체를 거른다
    assert "if (showsScoreDeltaBadge(log.action_type))" in TREND
    assert "showsScoreDeltaBadge(w.action_type) && <DeltaBadge" in TIMELINE                     # 배지를 그리는 지점에서 거른다(안내문 조건과 별개)
    assert "showsScoreDeltaBadge(activeWindow?.action_type)" in CHART7 and "? changeDirection(" in CHART7


def test_neutral_wording_and_the_non_causal_note_are_shown_where_effects_are_shown():
    for name, src in {"GrowthClient": GROWTH, "ActionTimelineCard": TIMELINE, "Action7DayChart": CHART7, "ActionResultCard": RESULT}.items():
        assert "EFFECT_NOTE" in src, name
    assert GROWTH.count("EFFECT_NOTE") >= 3                                              # import + 두 목록
    assert "effectText(" in TREND                                                        # 지도 위 라벨은 문구만


def test_history_page_uses_the_shared_threshold_and_no_longer_guesses_a_cause():
    hc = _code(HISTORY)
    assert "deltaDirection(" in HISTORY and "diffDir" in HISTORY
    assert not re.search(r"diff\s*(?:>|<)=?\s*-?[23]\b", hc)                             # ±2·±3점 기준이 남아 있지 않다
    assert not re.search(r"weekly_change \?\? 0\) (?:>|<) -?2", hc)
    assert "경쟁사가 강화되었거나" not in hc                                              # 측정으로 확인된 적 없는 원인 추측
    assert "개선됐습니다!" not in hc
    assert "직전 측정 대비" in HISTORY and "지난주 대비" not in hc                        # 저장된 weekly_change는 7일 변화가 아니라 직전 기록 대비 값


def test_dashboard_hero_hides_the_change_badge_when_the_latest_scan_was_not_measured():
    assert "latestScanNaverMeasured" in DASH and "isNaverUnmeasured(latestScan?.naver_result" in DASH
    assert re.search(r"scoreChangeDiff = history && history\.length >= 2 && latestScanNaverMeasured", DASH)
    assert 'deltaDirection(scoreChangeDiff) === "up"' in HERO and "deltaDirection(scoreChangeDiff) === \"down\"" in HERO


NODE_SCRIPT = r"""
const fs = require('fs'), path = require('path');
const fe = process.argv[1];
const ts = require(path.join(fe, 'node_modules', 'typescript'));
const src = fs.readFileSync(path.join(fe, 'lib', 'actionLabel.ts'), 'utf8');
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', out)(m, m.exports);
const types = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(types.map(t => m.exports.showsScoreDeltaBadge(t))));
"""


@pytest.mark.skipif(shutil.which("node") is None or not os.path.isdir(os.path.join(FE, "node_modules", "typescript")), reason="node 또는 typescript 없음")
def test_which_record_types_get_an_effect_badge_is_decided_by_the_real_code():
    types = ["smartplace_intro_qa", "faq_keyword", "naver_post", None, "", "score_up", "score_down", "auto_recommended", "competitor_ahead"]
    p = subprocess.run(["node", "-e", NODE_SCRIPT, FE], input=json.dumps(types), capture_output=True, text=True, timeout=60, encoding="utf-8")
    assert p.returncode == 0, p.stderr[:400]
    got = dict(zip(map(str, types), json.loads(p.stdout)))
    assert [got[k] for k in ("smartplace_intro_qa", "faq_keyword", "naver_post", "None", "")] == [True] * 5      # 사용자 행동(과 종류를 모르는 기록)은 표시
    assert [got[k] for k in ("score_up", "score_down", "auto_recommended", "competitor_ahead")] == [False] * 4     # 시스템 자동 기록은 표시하지 않는다


# ── 같은 유형의 나머지 화면 (2026-11-02, 위임 결정으로 추가 적용) ─────────────────────────────────────────────

ATTRIBUTION = _read("components", "dashboard", "ScoreAttributionCard.tsx")
COMPETITORS = _read("app", "(dashboard)", "competitors", "CompetitorsClient.tsx")


def test_attribution_card_uses_the_shared_rule_and_drops_causal_wording():
    a = _code(ATTRIBUTION)
    assert "changeDirection(" in a and "deltaDirection(" in a and "EFFECT_NOTE" in a
    assert "getDeltaLabel" not in a and "소폭 향상" not in a and "크게 하락" not in a    # 예전 ±0.5·±5점 단계
    assert "가장 효과적인 행동" not in a and "total_attributed_gain > 0.5" not in a      # 인과 단정·0.5점 초과 요약
    assert "노출 상태에 변화가 반영됐습니다" not in a                                       # '행동 때문에'로 읽히는 문장


def test_attribution_card_lists_only_user_actions_and_only_names_a_top_action_that_is_listed():
    assert "filter((a) => showsScoreDeltaBadge(a.action_type))" in ATTRIBUTION           # 점수 변화 로그·'추천됨' 같은 시스템 기록은 '내 행동의 효과'에 섞이지 않는다
    assert "attributions.some((a) => a.action_label === top_effective_action)" in ATTRIBUTION


def test_competitor_screen_shows_changes_only_when_they_are_big():
    c = _code(COMPETITORS)
    assert c.count("significantDelta(") >= 4                                              # 비교 표 2곳·스파크라인·화살표 배지(경쟁사 점수는 간이 추정치)
    assert "from '@/lib/changeDirection'" in COMPETITORS


def test_growth_driver_label_uses_the_shared_rule():
    g = _code(GROWTH)
    assert "const dir = deltaDirection(delta);" in g
    assert "delta > 0.5" not in g and "delta < -0.5" not in g                             # 항목별 ±0.5점 기준


def test_my_actions_list_hides_system_records():
    g = _code(GROWTH)
    assert "const userActionLogs = actionLogs.filter((l) => isUserActionRecord(l.action_type))" in g
    assert "userActionLogs.length > 0 ?" in g and "userActionLogs.map((log, i)" in g       # "내가 한 행동 기록" 목록은 사용자 행동만
    assert "{actionLogs.length > 0 ? (" not in g                                          # 옛 목록(시스템 기록 포함)이 남아 있지 않다


def test_competitor_change_tooltip_does_not_interpret_an_estimate_as_a_cause():
    c = _code(COMPETITORS)
    assert "(경쟁사 강화)" not in c and "(내 가게에 유리)" not in c                          # 간이 추정치에서 끌어낸 해석 — "(추정)" 표기 원칙
    assert c.count("경쟁사 점수는 간이 추정치입니다") >= 2
