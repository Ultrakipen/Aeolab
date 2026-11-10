"""순위 측정 실패 안내가 내부 오류 코드를 노출하지 않고 쉬운 말로 원인을 알리는지 (2026-11-10).

수정 전: KeywordRankCard가 서버의 `_context.errors` 앞 2개를 `일부 키워드 측정 실패: 키워드: search_blocked`처럼 그대로 화면에 찍었다.
Node·frontend/node_modules가 없는 환경에서는 건너뛴다(다른 렌더 시험과 같은 방식).
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
    shutil.which("node") is None or not os.path.isdir(os.path.join(FE, "node_modules", "typescript")),
    reason="node 또는 frontend/node_modules 없음 — 건너뜀",
)

NODE_SCRIPT = r"""
const fs = require('fs'), path = require('path');
const fe = process.argv[1];
const ts = require(path.join(fe, 'node_modules', 'typescript'));
const src = fs.readFileSync(path.join(fe, 'lib', 'rankErrorMessage.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', js)(m, m.exports);
const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(cases.map((c) => m.exports.describeRankErrors(c))));
"""

CASES = [
    ["성수 카페: search_blocked"],
    ["성수 카페: search_blocked", "playwright_queue_timeout"],
    ["playwright_queue_timeout"],
    ["카페: list_unread"],
    ["playwright: TimeoutError: page.goto"],
    ["카페: ValueError"],
    [],
    None,
    [{"code": "naver_search_cooldown"}],
]


@pytest.fixture(scope="module")
def out():
    p = subprocess.run(["node", "-e", NODE_SCRIPT, FE], input=json.dumps(CASES), capture_output=True, text=True, encoding="utf-8", timeout=60, cwd=FE)
    assert p.returncode == 0, p.stderr[-600:]
    return json.loads(p.stdout)


def test_blocked_wins_over_other_causes_and_says_unmeasured_is_not_outside_the_first_screen(out):
    for i in (0, 1, 8):
        assert "제한" in out[i] and "첫 화면 밖" in out[i]


def test_queue_timeout_is_explained_as_another_measurement_running(out):
    assert "다른 측정이 진행 중" in out[2]


def test_unread_and_generic_failures_have_their_own_plain_messages(out):
    assert "읽지 못해" in out[3]
    assert "측정하지 못했습니다" in out[4] and "측정하지 못했습니다" in out[5] and "측정하지 못했습니다" in out[6] and "측정하지 못했습니다" in out[7]


def test_no_internal_code_is_ever_shown_to_the_user(out):
    for msg in out:
        assert not re.search(r"[A-Za-z]{4,}", msg), msg              # 영문 내부 코드·예외 이름이 없다
        assert "undefined" not in msg and "null" not in msg


def test_card_uses_the_helper_instead_of_printing_raw_errors():
    src = open(os.path.join(FE, "components", "dashboard", "KeywordRankCard.tsx"), encoding="utf-8").read()
    assert "describeRankErrors(data.errors)" in src
    assert "일부 키워드 측정 실패:" not in src
    assert 'JSON.stringify(e)' not in src.split("describeRankErrors(data.errors)")[0][-400:]
