"""
요금제 기능(plan_gate.py PLAN_LIMITS) 실동작 회귀 테스트 (2026-08-06 신설)

2026-08-06 점검에서 다음 두 가지 실동작 버그를 발견했다:
  1. guides.context CHECK 제약에 'talktalk_faq'가 누락돼 insert가 항상 실패(23514) —
     콘텐츠 자체는 저장되지만 사용량 카운트가 전혀 안 늘어 해당 한도가 영구 무제한이었음.
  2. keyword_suggest_monthly가 plan_gate.py PLAN_LIMITS·business.py 하드코딩 dict·
     실사용 엔드포인트(무한도) 3곳에서 서로 다른 값으로 존재 — 실사용 경로는 아예
     한도 체크 코드 자체가 없었음.

두 버그 모두 "코드는 정상 응답하지만 한도만 조용히 안 지켜진다"는 공통점이 있어
겉보기엔 멀쩡해 보이고, 사용량이 적은 서비스 초기엔 로그로도 잘 안 드러난다.
이 테스트는 라이브 DB 접속 없이 소스코드만 정적 분석해 같은 패턴의 재발을 배포 전에 잡는다.
"""
import ast
import os

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN_GATE_PATH = os.path.join(BACKEND_ROOT, "middleware", "plan_gate.py")

# ── ① guides.context CHECK 제약 동기화 ──────────────────────────────────────
# scripts/supabase_schema.sql의 guides_context_check와 반드시 함께 갱신할 것.
# 여기 없는 값을 insert하면 라이브에서 23514(check_violation)로 조용히 실패한다
# (응답은 정상 반환되고 warning 로그만 남음 — 2026-08-06 talktalk_faq 사고 패턴).
ALLOWED_GUIDE_CONTEXTS = {
    "location_based", "non_location", "faq_draft", "crisis_reply",
    "ad_defense", "startup_report", "intro_draft", "talktalk_faq", "post_draft",
}

# ── ② PLAN_LIMITS 숫자형 한도 키 — 강제 집행 증거 패턴 ───────────────────────
# 새 숫자형 한도 키를 PLAN_LIMITS에 추가하면 반드시 여기도 함께 추가할 것.
# 안 하면 이 테스트가 "고아 키"로 실패시킨다 — keyword_suggest_monthly가
# 3곳에서 다른 값으로 존재하다 실사용 경로는 무제한이었던 사고 재발 방지.
# (schema/pdf/csv/startup_report/api_keys/ad_defense(불리언)/auto_scan_mode는
#  PLAN_HIERARCHY 비교 등 다른 방식으로 게이팅돼 이 테스트 대상에서 제외)
ENFORCEMENT_EVIDENCE_PATTERNS = {
    "competitors": ['["competitors"]'],
    "guide_monthly": ["check_guide_limit("],
    "manual_scan_daily": ["check_manual_scan_limit("],
    "history_days": ['["history_days"]'],
    "businesses": ['["businesses"]'],
    "ad_defense_monthly": ["check_ad_defense_limit("],
    "review_reply_monthly": ["check_review_reply_limit("],
    "faq_monthly": ['"faq_monthly"'],
    "blog_monthly": ['["blog_monthly"]'],
    "keyword_suggest_monthly": ['"keyword_suggest_monthly"'],
    "crisis_reply_monthly": ["check_crisis_reply_limit("],
    "startup_report_monthly": ["check_startup_report_limit("],
    "support_ticket_monthly": ["check_support_ticket_limit("],
}


def _iter_backend_py_files(exclude_paths=()):
    for dirpath, dirnames, filenames in os.walk(BACKEND_ROOT):
        dirnames[:] = [d for d in dirnames if d not in ("venv", "__pycache__", ".git", "tests", "node_modules")]
        for fn in filenames:
            if fn.endswith(".py"):
                full = os.path.join(dirpath, fn)
                if full not in exclude_paths:
                    yield full


def _chain_targets_table(node, table_name: str) -> bool:
    """node(예: supabase.table("guides"))의 호출 체인을 거슬러 올라가며
    .table(table_name) 호출이 있는지 확인."""
    cur = node
    while isinstance(cur, ast.Call):
        if (
            isinstance(cur.func, ast.Attribute)
            and cur.func.attr == "table"
            and cur.args
            and isinstance(cur.args[0], ast.Constant)
            and cur.args[0].value == table_name
        ):
            return True
        cur = cur.func.value if isinstance(cur.func, ast.Attribute) else None
    return False


def _find_guides_insert_contexts(tree: ast.AST) -> list:
    """supabase.table("guides").insert({...}) / .upsert({...}) 호출에서
    "context" 키의 문자열 리터럴 값을 전부 추출."""
    found = []

    class Visitor(ast.NodeVisitor):
        def visit_Call(self, node: ast.Call):
            if isinstance(node.func, ast.Attribute) and node.func.attr in ("insert", "upsert"):
                if _chain_targets_table(node.func.value, "guides"):
                    for arg in node.args:
                        if isinstance(arg, ast.Dict):
                            for k, v in zip(arg.keys, arg.values):
                                if (
                                    isinstance(k, ast.Constant) and k.value == "context"
                                    and isinstance(v, ast.Constant) and isinstance(v.value, str)
                                ):
                                    found.append(v.value)
            self.generic_visit(node)

    Visitor().visit(tree)
    return found


def test_guides_context_values_match_check_constraint():
    """guides 테이블에 insert되는 모든 context 문자열이 라이브 CHECK 제약과
    동기화된 ALLOWED_GUIDE_CONTEXTS에 포함되는지 검증."""
    unknown = {}
    for path in _iter_backend_py_files():
        with open(path, encoding="utf-8") as f:
            source = f.read()
        try:
            tree = ast.parse(source, filename=path)
        except SyntaxError:
            continue
        for ctx in _find_guides_insert_contexts(tree):
            if ctx not in ALLOWED_GUIDE_CONTEXTS:
                unknown.setdefault(os.path.relpath(path, BACKEND_ROOT), set()).add(ctx)

    assert not unknown, (
        "guides.insert()에 CHECK 제약 목록(ALLOWED_GUIDE_CONTEXTS)에 없는 context 값이 있습니다. "
        "scripts/supabase_schema.sql의 guides_context_check ALTER 문과 이 테스트의 "
        f"ALLOWED_GUIDE_CONTEXTS를 함께 갱신하세요: {unknown}"
    )


def test_guides_context_detection_sanity():
    """탐지 로직 자체가 깨지지 않았는지 확인 — 0건이면 AST 파서가 조용히
    아무것도 못 찾고 있다는 뜻이라 위 테스트가 무의미해진다."""
    total = 0
    for path in _iter_backend_py_files():
        with open(path, encoding="utf-8") as f:
            source = f.read()
        try:
            tree = ast.parse(source, filename=path)
        except SyntaxError:
            continue
        total += len(_find_guides_insert_contexts(tree))
    assert total >= 5, f"guides context insert 탐지 건수가 너무 적음({total}) — AST 탐지 로직 점검 필요"


def test_plan_limits_numeric_keys_are_enforced_somewhere():
    """PLAN_LIMITS의 숫자형 한도 키가 plan_gate.py 바깥 어딘가에서 실제로
    읽히거나(직접 dict 접근) 강제되는지(check_* 함수 호출) 검증.
    한 곳에서도 못 찾으면 '선언만 되고 아무도 강제하지 않는' 고아 키."""
    other_files = list(_iter_backend_py_files(exclude_paths={PLAN_GATE_PATH}))
    contents = {}
    for path in other_files:
        with open(path, encoding="utf-8") as f:
            contents[path] = f.read()

    orphaned = []
    for key, patterns in ENFORCEMENT_EVIDENCE_PATTERNS.items():
        found_anywhere = any(
            pattern in src for src in contents.values() for pattern in patterns
        )
        if not found_anywhere:
            orphaned.append(key)

    assert not orphaned, (
        "PLAN_LIMITS 키가 plan_gate.py 바깥에서 전혀 강제되지 않습니다(고아 키) — "
        "keyword_suggest_monthly가 3곳에서 다른 값으로 존재하다 실사용 경로는 무제한이었던 "
        f"2026-08-06 사고와 동일 패턴입니다: {orphaned}. "
        "새 키를 추가했다면 ENFORCEMENT_EVIDENCE_PATTERNS에도 강제 증거 패턴을 등록하세요."
    )
