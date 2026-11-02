"""변화 배지가 실제 컴포넌트 코드에서 어떻게 그려지는지 서버 렌더링으로 확인 (2026-11-02).

계정 데이터에 기대지 않는다 — 이 세션의 사업장들은 최근 30일 측정이 없어 대시보드 상단 배지·행동 효과 문구가 화면에 안 그려져 라이브로 확인할 수 없었다.
그래서 실제 `.tsx` 파일을 TypeScript로 변환해 Node에서 `react-dom/server`로 그려 입력 표마다 결과를 대조한다(문자열 검색이 아니라 실제 렌더 결과).
Node·frontend/node_modules(typescript·react·react-dom)가 없는 환경(CI 등)에서는 건너뛴다.
"""
import json
import os
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FE = os.path.join(ROOT, "frontend")

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None or not all(os.path.isdir(os.path.join(FE, "node_modules", m)) for m in ("typescript", "react", "react-dom", "lucide-react")),
    reason="node 또는 frontend/node_modules 없음 — 렌더 확인 건너뜀",
)

NODE_SCRIPT = r"""
const fs = require('fs'), path = require('path'), Module = require('module');
const fe = process.argv[1];
const ts = require(path.join(fe, 'node_modules', 'typescript'));
const load = (module, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  module._compile(out, filename);
};
require.extensions['.ts'] = load; require.extensions['.tsx'] = load;
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(fe, request.slice(2));
  return origResolve.call(this, request, parent, ...rest);
};
process.chdir(fe);
const React = require(path.join(fe, 'node_modules', 'react'));
const { renderToStaticMarkup } = require(path.join(fe, 'node_modules', 'react-dom', 'server'));
const Hero = require(path.join(fe, 'components', 'dashboard', 'DashboardHeroCard.tsx')).default;
const ActionResultCard = require(path.join(fe, 'components', 'dashboard', 'ActionResultCard.tsx')).default;
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
const out = { hero: {}, result: {} };
for (const d of cases.heroDiffs) {
  const html = renderToStaticMarkup(React.createElement(Hero, { unifiedScore: 50, track1Score: 50, scoreChangeDiff: d, lastScannedLabel: '오늘' }));
  out.hero[String(d)] = { up: html.includes('직전보다 높음'), down: html.includes('직전보다 낮음'), oldUp: html.includes('↑ 개선됨'), oldDown: html.includes('↓ 하락') };
}
for (const [b, a] of cases.resultPairs) {
  const html = renderToStaticMarkup(React.createElement(ActionResultCard, { actions: [{ id: 'x', action_type: 'faq_keyword', keyword: '창원 맛집', completed_at: '2026-10-20T00:00:00Z', rescan_done: true, before_mentioned: false, after_mentioned: false, before_score: b, after_score: a, result_summary: null }] }));
  const t = text(html);
  out.result[b + '>' + a] = { up: t.includes('상승 확인'), down: t.includes('하락 확인'), flat: t.includes('변화 없음(오차 범위)'), note: t.includes('그 행동의 효과라고 단정할 수 없습니다'), arrows: /[↑↓]/.test(t), oldWords: t.includes('개선됨') || t.includes('하락 ↓') };
}
process.stdout.write(JSON.stringify(out));
"""

HERO_DIFFS = [None, 0, 1, -1, 6, -7, 9, -9, 10, -10, 25, -25]
RESULT_PAIRS = [[50, 50], [50, 50.4], [50, 54], [50, 46], [56, 65.9], [56, 66], [50, 59.9], [50, 40], [50.0, None], [None, 50.0], [54.9, 55.1], [30, 28], [20, 31]]


@pytest.fixture(scope="module")
def rendered():
    p = subprocess.run(["node", "-e", NODE_SCRIPT, FE], input=json.dumps({"heroDiffs": HERO_DIFFS, "resultPairs": RESULT_PAIRS}), capture_output=True, text=True, timeout=120, encoding="utf-8")
    assert p.returncode == 0, p.stderr[:800]
    return json.loads(p.stdout)


def test_dashboard_top_badge_is_shown_only_for_big_changes(rendered):
    hero = rendered["hero"]
    for d in ("null", "0", "1", "-1", "6", "-7", "9", "-9"):                         # 작은 차이(옛 기준이면 대부분 "↑ 개선됨/↓ 하락")
        assert not hero[d]["up"] and not hero[d]["down"], d
    assert hero["10"]["up"] and hero["25"]["up"]
    assert hero["-10"]["down"] and hero["-25"]["down"]
    assert not any(v["oldUp"] or v["oldDown"] for v in hero.values())               # 옛 문구는 어떤 입력에서도 나오지 않는다


def test_action_result_card_uses_neutral_wording_and_the_shared_rule(rendered):
    r = rendered["result"]
    assert r["50>50"]["flat"] and r["50>50.4"]["flat"]                              # 변화 없음·0.4점 차이는 오차 범위
    assert r["50>54"]["flat"] and r["50>46"]["flat"]                                # 같은 구간(보강 단계) 안 ±4점 — 이전에는 "개선됨 ↑/하락 ↓"
    assert r["56>65.9"]["flat"] and r["56>66"]["up"]                                # 같은 구간(개선 중) 안에서 10점 경계: 9.9점은 말하지 않고 10점은 말한다
    assert r["50>59.9"]["up"]                                                       # 55점 경계를 넘는 9.9점 상승 — 구간이 바뀌고 3점 이상이라 말한다(10점 미만이어도)
    assert r["50>40"]["down"]
    assert r["54.9>55.1"]["flat"]                                                   # 구간 경계 근처 흔들림은 0.2점이라 제외
    assert r["30>28"]["flat"] and r["20>31"]["up"]                                  # 11점 상승
    # JS가 JSON null을 문자열로 바꿔 만든 키(50>null)다 — 한쪽 점수가 없으면(아직 측정 중) 아무것도 말하지 않는다
    assert r["50>null"] == {"up": False, "down": False, "flat": False, "note": False, "arrows": False, "oldWords": False}
    assert r["null>50"] == {"up": False, "down": False, "flat": False, "note": False, "arrows": False, "oldWords": False}


def test_action_result_card_has_no_arrows_or_old_words_and_always_carries_the_non_causal_note(rendered):
    for key, v in rendered["result"].items():
        if v["up"] or v["down"] or v["flat"]:
            assert v["note"], key                                                   # 효과를 말하는 모든 경우에 "단정할 수 없습니다" 안내가 함께 나온다
        assert not v["arrows"] and not v["oldWords"], key                           # ↑/↓·"개선됨"·"하락 ↓"는 나오지 않는다
