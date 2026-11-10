"""자동 측정 요일·횟수 안내가 실제 스케줄(scan_scheduling)과 모순되지 않는지 실제 렌더로 확인 (2026-11-10).

서버는 NAVER_SCAN_SLOT_SPREAD=true — 풀스캔 요일은 사업장마다 정해진 슬롯 요일이다(Basic 주 2회·창업 주 1회·Pro 주 3회).
수정 전: 창업패키지를 "월요일"로, Basic 업그레이드 카드는 "월요일만 전체 측정·나머지 날 경량 분석"으로 안내했다
(Basic 비풀스캔일은 경량이 아니라 건너뜀, 경량은 Pro의 비풀스캔일). 다음 측정 안내는 플랜과 무관하게 "내일"로만 나왔다.
Node·frontend/node_modules가 없는 환경에서는 건너뛴다(test_ui_render_hero_stale_claims.py와 같은 방식).
"""
import json
import os
import re
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
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const Preview = require(path.join(fe, 'components', 'dashboard', 'ProUpgradePreview.tsx')).default;
const helpers = require(path.join(fe, 'app', '(dashboard)', 'dashboard', 'sections', 'pageHelpers.ts'));
const out = {};
out.preview = text(renderToStaticMarkup(React.createElement(Preview, { businessName: 'x', category: 'restaurant', plan: 'basic' })));
out.labels = {};
for (const p of ['free', 'basic', 'startup', 'pro', 'biz']) out.labels[p] = helpers.nextScanLabel(p);
let nextScan = null;
try { nextScan = require(path.join(fe, 'lib', 'nextScan.ts')); } catch (e) { nextScan = null; }
out.hasNextScanModule = !!nextScan;
if (nextScan) {
  const now = new Date('2026-11-10T10:00:00+09:00');   // 화요일 낮
  const f = (iso) => nextScan.formatNextScan(iso, now);
  out.next = {
    nullInput: f(null),
    invalid: f('not-a-date'),
    soon: f('2026-11-10T10:30:00+09:00'),
    today: f('2026-11-10T22:00:00+09:00'),
    tomorrow: f('2026-11-11T02:00:00+09:00'),
    thursday: f('2026-11-12T02:00:00+09:00'),
    nextMonday: f('2026-11-16T02:00:00+09:00'),
  };
}
process.stdout.write(JSON.stringify(out));
"""


@pytest.fixture(scope="module")
def rendered():
    p = subprocess.run(["node", "-e", NODE_SCRIPT, FE], capture_output=True, text=True, encoding="utf-8", timeout=120, cwd=FE,
                       env={**os.environ, "TZ": "Asia/Seoul"})   # 날짜 표기는 KST 기준(실행 환경 시간대와 무관하게)
    assert p.returncode == 0, p.stderr[-800:]
    return json.loads(p.stdout)


def _src(rel):
    with open(os.path.join(FE, rel), encoding="utf-8") as f:
        return f.read()


def test_basic_card_does_not_claim_monday_only(rendered):
    t = rendered["preview"]
    assert "월요일만" not in t
    assert "주 2회 전체 측정" in t


def test_light_scan_line_belongs_to_pro_not_basic(rendered):
    t = rendered["preview"]
    assert "경량 분석" in t
    assert t.index("Pro (업그레이드 후)") < t.index("경량 분석"), "경량 분석은 Pro의 비풀스캔일 설명이다(Basic은 건너뜀)"


def test_example_weekdays_are_labeled_as_examples(rendered):
    assert "예시" in rendered["preview"] and "가게마다" in rendered["preview"]


def test_startup_label_does_not_name_monday(rendered):
    lab = rendered["labels"]["startup"]
    assert "월요일" not in lab["label"] and "월요일" not in lab["desc"]
    assert "주 1회" in lab["label"]


def test_other_plan_labels_unchanged(rendered):
    assert rendered["labels"]["basic"]["label"] == "주 2회 자동 측정"
    assert rendered["labels"]["pro"]["label"] == "주 3회 자동 측정"
    assert rendered["labels"]["biz"]["label"] == "매일 새벽 자동 측정"


def test_settings_page_startup_autoscan_has_no_weekday():
    src = _src("app/(dashboard)/settings/page.tsx")
    m = re.search(r"startup:\s*\{[^}]*autoScan:\s*\"([^\"]*)\"", src)
    assert m, "startup 행을 찾지 못했다"
    assert "월요일" not in m.group(1) and m.group(1).startswith("주 1회")


def test_next_scan_formatter_exists_and_handles_multi_day(rendered):
    assert rendered["hasNextScanModule"], "frontend/lib/nextScan.ts 없음"
    n = rendered["next"]
    assert n["nullInput"] is None and n["invalid"] is None   # 모르면 말하지 않는다
    assert n["soon"] == "곧"
    assert n["today"].startswith("오늘")
    assert n["tomorrow"].startswith("내일")
    # 이틀 이상 뒤는 '내일'이 아니라 날짜·요일
    assert n["thursday"].startswith("11/12") and "목" in n["thursday"]
    assert n["nextMonday"].startswith("11/16") and "월" in n["nextMonday"]
