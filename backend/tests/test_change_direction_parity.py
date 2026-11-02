"""프런트 `lib/changeDirection.ts`와 백엔드 `stage_names.headline_direction`이 같은 결과를 내는지 격자로 대조 (2026-11-02).

두 구현이 어긋나면 성장 화면 헤드라인(백엔드)과 대시보드·행동 효과 표시(프런트)가 서로 다른 말을 한다 — 규칙을 한쪽만 고쳤을 때 잡기 위한 시험이다.
실제 TypeScript 파일을 변환해 Node에서 실행한다. Node나 frontend/node_modules/typescript가 없는 환경(CI 등)에서는 건너뛴다.
구간은 프런트가 통합 점수로 계산하고 백엔드는 저장된 단계 코드로 계산하지만, 같은 점수에서 같은 구간 경계(30/55/75)를 쓰므로 점수 격자에서는 같아야 한다.
"""
import json
import os
import shutil
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND = os.path.join(ROOT, "frontend")
TS_MODULE = os.path.join(FRONTEND, "node_modules", "typescript")

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None or not os.path.isdir(TS_MODULE) or not os.path.exists(os.path.join(FRONTEND, "lib", "changeDirection.ts")),
    reason="node 또는 frontend/node_modules/typescript 없음 — 프런트 규칙 대조 건너뜀",
)

NODE_SCRIPT = r"""
const fs = require('fs'), path = require('path');
const fe = process.argv[1];   // node -e 에서는 추가 인자가 argv[1]부터다
const ts = require(path.join(fe, 'node_modules', 'typescript'));
const src = fs.readFileSync(path.join(fe, 'lib', 'changeDirection.ts'), 'utf8');
const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', out)(m, m.exports);
const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
const res = cases.map(([b, a]) => m.exports.changeDirection(b, a));
const extra = {
  nullBefore: m.exports.changeDirection(null, 50), nullAfter: m.exports.changeDirection(50, undefined), nan: m.exports.changeDirection(NaN, 50),
  deltaNull: m.exports.deltaDirection(null), deltaSmall: m.exports.deltaDirection(9.99), deltaBig: m.exports.deltaDirection(-10),
  consts: [m.exports.CHANGE_DISPLAY_MIN, m.exports.STAGE_BAND_MIN_DELTA],
  texts: [m.exports.effectText(null), m.exports.effectText('flat'), m.exports.effectText('up'), m.exports.effectText('down')],
};
process.stdout.write(JSON.stringify({ res, extra }));
"""


def _run_node(cases):
    p = subprocess.run(["node", "-e", NODE_SCRIPT, FRONTEND], input=json.dumps(cases), capture_output=True, text=True, timeout=60, encoding="utf-8")
    assert p.returncode == 0, p.stderr[:500]
    return json.loads(p.stdout)


def _grid():
    pts = [i * 2.5 for i in range(41)] + [29.9, 30.0, 30.1, 54.9, 55.0, 55.1, 74.9, 75.0, 75.1, 0.0, 100.0]
    return [[b, a] for b in pts for a in pts]


def test_frontend_and_backend_agree_on_every_point_of_the_grid():
    from services.stage_names import headline_direction, stage_code_for_score
    cases = _grid()
    out = _run_node(cases)["res"]
    mismatches = []
    for (b, a), got in zip(cases, out):
        want = headline_direction(stage_code_for_score(b), stage_code_for_score(a), a - b)
        if want != got:
            mismatches.append((b, a, want, got))
    assert len(cases) > 1500 and mismatches == [], mismatches[:10]


def test_missing_values_are_not_a_direction_and_constants_match_the_backend():
    from services.stage_names import HEADLINE_BIG_DELTA, HEADLINE_BAND_MIN_DELTA
    extra = _run_node([[50, 50]])["extra"]
    assert extra["nullBefore"] is None and extra["nullAfter"] is None and extra["nan"] is None     # 한쪽이 없으면 '측정 중' — 방향을 말하지 않는다
    assert extra["deltaNull"] is None and extra["deltaSmall"] == "flat" and extra["deltaBig"] == "down"
    assert extra["consts"] == [HEADLINE_BIG_DELTA, HEADLINE_BAND_MIN_DELTA]


def test_effect_texts_are_neutral_and_never_claim_causation():
    texts = _run_node([[50, 50]])["extra"]["texts"]
    assert texts == ["측정 중", "변화 없음(오차 범위)", "상승 확인", "하락 확인"]
    assert not any("↑" in t or "↓" in t or "개선" in t or "때문" in t for t in texts)
