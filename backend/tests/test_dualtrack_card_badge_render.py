"""DualTrackCard 상태 배지가 실제 컴포넌트 코드에서 어떻게 그려지는지 서버 렌더링으로 확인 (2026-11-06).

수정 전 결함: 통합 점수의 절대 문턱(70/50)으로 "업종 상위권/중위권/AI 노출 개선 여지 큼" 배지를 그렸다. 서버 DB 확인 결과 활성 사업장 8곳의 최신 풀 스캔과
체험 252건이 전부 통합 50 미만(음식점 49.0·카페 45.4·마사지 37.4·법률 10.5 …)이라 모든 사업장에 똑같은 "개선 여지 큼"이 나와 구별력이 없었고,
같은 카드의 성장 단계 배지(트랙1 기준)와 충돌했으며 순위 근거 없이 "업종 상위권"이라고 말할 수 있었다.
문자열 검색이 아니라 실제 `.tsx`를 TypeScript로 변환해 Node에서 react-dom/server로 그려 입력 표마다 결과를 대조한다
(test_ui_render_change_badges.py와 같은 방식). Node·frontend/node_modules가 없는 환경에서는 건너뛴다.
"""
import json
import os
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FE = os.path.join(ROOT, "frontend")

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None or not all(os.path.isdir(os.path.join(FE, "node_modules", m)) for m in ("typescript", "react", "react-dom", "lucide-react", "next")),
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
const Card = require(path.join(fe, 'components', 'dashboard', 'DualTrackCard.tsx')).default;
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
const out = {};
for (const c of cases) {
  const base = { track1Score: 47.9, track2Score: 1.2, naverWeight: 0.2, globalWeight: 0.8, unifiedScore: 10.5, category: 'legal', growthStage: 'stability', growthStageLabel: '보강 단계', eligibility: 'inactive' };
  const html = renderToStaticMarkup(React.createElement(Card, Object.assign({}, base, c.props)));
  out[c.id] = text(html);
}
process.stdout.write(JSON.stringify(out));
"""

# 수정 전에 그려지던 문구 4종 — 이제 어떤 입력에서도 나오면 안 된다
OLD_BADGES = ["업종 상위권", "업종 중위권", "AI 노출 개선 여지 큼", "평균 이상 — 추가 개선 가능"]

CASES = [
    {"id": "legal_low", "props": {}},                                                                    # 통합 10.5
    {"id": "restaurant_49", "props": {"category": "restaurant", "track1Score": 52.9, "track2Score": 33.5, "naverWeight": 0.8, "globalWeight": 0.2, "unifiedScore": 49.0, "eligibility": "active"}},
    {"id": "high_55", "props": {"unifiedScore": 55}},
    {"id": "top_75", "props": {"unifiedScore": 75, "growthStage": "dominance", "growthStageLabel": "양호", "track1Score": 80}},
    {"id": "bench_below", "props": {"benchmarkAvg": 20, "isEstimatedBenchmark": False}},                 # 10.5 < 20
    {"id": "bench_above", "props": {"benchmarkAvg": 20, "isEstimatedBenchmark": False, "unifiedScore": 30}},
    {"id": "bench_estimated", "props": {"benchmarkAvg": 20, "isEstimatedBenchmark": True}},
    {"id": "bench_zero", "props": {"benchmarkAvg": 0, "isEstimatedBenchmark": False}},
    {"id": "naver_unmeasured", "props": {"naverUnmeasured": True, "eligibility": "active", "benchmarkAvg": 20, "isEstimatedBenchmark": False}},
]


@pytest.fixture(scope="module")
def rendered():
    p = subprocess.run(["node", "-e", NODE_SCRIPT, FE], input=json.dumps(CASES), capture_output=True, text=True, encoding="utf-8", timeout=180)
    assert p.returncode == 0, p.stderr[-1500:]
    return json.loads(p.stdout)


@pytest.mark.parametrize("cid", [c["id"] for c in CASES])
def test_threshold_badges_are_never_rendered(rendered, cid):
    t = rendered[cid]
    for w in OLD_BADGES:
        assert w not in t, f"{cid}: 절대 문턱 배지 '{w}'가 다시 그려짐"


def test_growth_stage_badge_is_the_status_and_still_rendered(rendered):
    assert "보강 단계" in rendered["legal_low"]            # 트랙1 기준 성장 단계 배지는 그대로
    assert "양호" in rendered["top_75"]


def test_benchmark_badge_only_for_a_real_benchmark(rendered):
    assert "▼ 업종 평균 미만" in rendered["bench_below"] and "▲" not in rendered["bench_below"]
    assert "▲ 업종 평균 이상" in rendered["bench_above"]
    for cid in ("legal_low", "restaurant_49", "bench_estimated", "bench_zero"):      # 추정 벤치마크·없음·0은 비교 배지를 만들지 않는다
        assert "▲ 업종 평균" not in rendered[cid] and "▼ 업종 평균" not in rendered[cid], cid


def test_naver_unmeasured_shows_only_the_unchecked_notice(rendered):
    t = rendered["naver_unmeasured"]
    assert "일부 항목 확인 전" in t
    assert "▲ 업종 평균" not in t and "▼ 업종 평균" not in t       # 확인 전이면 어떤 수준·비교 배지도 붙이지 않는다(기존 동작 유지)
