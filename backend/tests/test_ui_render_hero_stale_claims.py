"""오래된 측정의 긍정 문구에 측정일을 붙이는 규칙이 '정보형 노출' 분기에도 적용되는지 실제 렌더로 확인 (2026-11-07).

로그인 화면 실측에서 마지막 측정이 38일 전인데 대시보드 맨 위 문구와 카드가 "정보형 AI 브리핑에도 노출 중입니다"를 현재형으로 단정했다.
같은 파일의 다른 분기는 positiveDetail 규칙(7일 이상 → 측정일 표기)을 따랐지만 이 두 분기만 빠져 있었다.
Node·frontend/node_modules가 없는 환경에서는 건너뛴다(test_ui_render_change_badges.py와 같은 방식).
"""
import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timedelta, timezone

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
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
const out = {};
for (const c of cases) {
  const html = renderToStaticMarkup(React.createElement(Hero, c.props));
  out[c.name] = { text: text(html), html };
}
process.stdout.write(JSON.stringify(out));
"""


def _iso(days_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


def _case(name, eligibility, days_ago, in_briefing=True):
    return {"name": name, "props": {
        "unifiedScore": 50, "track1Score": 50, "briefingEligibility": eligibility,
        "naverInBriefing": in_briefing, "scannedAt": _iso(days_ago), "lastScannedLabel": f"{days_ago}일 전",
    }}


@pytest.fixture(scope="module")
def rendered():
    cases = [
        _case("inactive_fresh", "inactive", 1), _case("inactive_old", "inactive", 38),
        _case("likely_fresh", "likely", 1), _case("likely_old", "likely", 38),
        _case("active_old", "active", 38),
    ]
    p = subprocess.run(["node", "-e", NODE_SCRIPT, FE], input=json.dumps(cases), capture_output=True, text=True, encoding="utf-8", timeout=120, cwd=FE)
    assert p.returncode == 0, p.stderr[-800:]
    return json.loads(p.stdout)


def test_fresh_measurement_keeps_present_tense_claim(rendered):
    t = rendered["inactive_fresh"]["text"]
    assert "노출 중입니다" in t and "콘텐츠 기반 AI 브리핑 노출" in t


def test_old_measurement_does_not_assert_current_exposure_in_headline(rendered):
    t = rendered["inactive_old"]["text"]
    assert "노출 중입니다" not in t
    assert re.search(r"\d{1,2}월 \d{1,2}일 측정에서는 .*노출이 확인됐습니다", t)


def test_old_measurement_card_shows_date_instead_of_fixed_claim(rendered):
    for k in ("inactive_old", "likely_old"):
        t = rendered[k]["text"]
        assert "콘텐츠 기반 AI 브리핑 노출" not in t, k
        assert re.search(r"정보형 노출 중 \d{1,2}월 \d{1,2}일 측정", t), k


def test_likely_fresh_card_keeps_original_detail(rendered):
    assert "정보형 노출 중 콘텐츠 기반 AI 브리핑 노출" in rendered["likely_fresh"]["text"]


def test_other_branch_already_dated_when_old(rendered):
    assert re.search(r"노출 중 \d{1,2}월 \d{1,2}일 측정", rendered["active_old"]["text"])


def test_mobile_cards_stack_and_detail_is_not_12px(rendered):
    html = rendered["inactive_fresh"]["html"]
    assert "grid-cols-1 sm:grid-cols-3" in html
    card = html.split("grid-cols-1 sm:grid-cols-3", 1)[1]
    assert "text-xs" not in card.split("</a>", 1)[0]          # 카드 설명이 12px(text-xs)로 돌아가지 않는다
