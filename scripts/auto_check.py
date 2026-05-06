#!/usr/bin/env python3
"""
AEOlab 자동 코드 점검 스크립트
Claude Code PostToolUse 훅에서 Edit/Write 후 자동 실행됨

stdin: Claude Code hook JSON {"tool_name": ..., "tool_input": {"file_path": ...}}
stdout: JSON {"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": ...}}
"""

import io
import json
import re
import sys
from pathlib import Path

# Windows CP949 환경에서 이모지 출력 가능하도록 stdout UTF-8 강제
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── 점검 규칙 정의 ────────────────────────────────────────────────────────────

PY_RULES = [
    # (레벨, 설명, 정규식 패턴)
    ("🔴", "except: pass 또는 except Exception: pass — 예외 묵살 금지",
     r"except\s*(Exception|BaseException)?\s*:\s*(pass|\.\.\.)\s*$"),

    ("🟡", "SELECT * 사용 — 필요 컬럼만 명시 권장",
     r'\.select\(\s*["\']?\*["\']?\s*\)'),

    ("🟡", "except 블록이 pass로 끝남 (일반 except 포함)",
     r"except\s+\w.*:\s*\n\s+pass\s*$"),

    # 파일 레벨 체크는 None으로 표시 (check_py_file_level에서 처리)
    ("🔴", "aiohttp 사용하지만 timeout 미설정 — 무한 대기 위험", None),
    ("🔴", "Claude Sonnet을 허용되지 않은 파일에서 호출 — 비용 정책 위반", None),
    ("🟡", "router 파일에 인증 없음 — get_current_user 또는 JWT 검증 필요", None),

    ("🟢", "print() 사용 — logger 사용 권장",
     r"^\s*print\s*\("),
]

TS_RULES = [
    ("🔴", "NEXT_PUBLIC_ 없는 환경변수를 클라이언트 코드에서 직접 참조",
     r"process\.env\.(?!NEXT_PUBLIC_)\w+"),

    ("🟡", ": any 타입 사용 — 구체적 타입 또는 unknown 권장",
     r":\s*any[\s,\)\[]"),

    ("🟡", "as any 캐스팅 사용",
     r"\bas\s+any\b"),

    ("🟡", "fetch() 호출에 에러 처리 없음 (try/catch 또는 .catch 미확인)",
     None),  # 파일 레벨 체크

    ("🟢", "console.log 사용 — 운영 빌드에서 제거 필요",
     r"console\.log\s*\("),
]

# ── 파일 레벨 특수 체크 ────────────────────────────────────────────────────────

def check_py_file_level(content: str, filepath: Path) -> list[tuple[str, str]]:
    """패턴이 아닌 파일 전체 맥락을 보는 추가 체크"""
    issues = []

    # ── aiohttp timeout 체크 (멀티라인 코드 대응) ─────────────────────────────
    # aiohttp를 사용하는데 파일 어디에도 timeout 설정이 없는 경우만 경고
    if "aiohttp" in content:
        has_timeout = (
            "ClientTimeout" in content
            or "_TIMEOUT" in content
            or "timeout=" in content
        )
        if not has_timeout:
            issues.append(("🔴", "aiohttp 사용하지만 timeout 미설정 — 무한 대기 위험 (ClientTimeout 또는 _TIMEOUT 추가 필요)"))

    # ── Claude Sonnet 호출 위치 검증 ─────────────────────────────────────────
    if "claude-sonnet" in content or "claude_sonnet" in content:
        # 허용된 파일: 가이드 생성, 광고 대응, 창업 리포트 (모두 의도적 고품질 출력 필요)
        allowed_files = {"guide_generator.py", "ad_defense_guide.py", "startup_report.py"}
        if filepath.name not in allowed_files:
            issues.append(("🔴", f"Claude Sonnet을 허용되지 않은 파일({filepath.name})에서 호출 — 비용 정책 위반"))

    # ── router 파일 인증 체크 ─────────────────────────────────────────────────
    if filepath.parent.name == "routers":
        # 의도적 공개 파일 제외 (Toss 웹훅은 자체 HMAC 검증, __init__은 빈 파일)
        public_routers = {"webhook.py", "__init__.py"}
        if filepath.name not in public_routers:
            has_jwt_auth = "get_current_user" in content
            has_header_auth = 'x_user_id: str = Header' in content  # 약한 인증 (헤더 위조 가능)
            has_admin_auth = "verify_admin" in content
            has_any_auth = has_jwt_auth or has_admin_auth

            if not has_any_auth and has_header_auth:
                issues.append(("🔴", f"{filepath.name}: x_user_id 헤더 인증 사용 중 — JWT 위조 가능, get_current_user로 교체 필요"))
            elif not has_any_auth and not has_header_auth:
                # schema_gen, startup /market 같은 공개 엔드포인트는 의도적일 수 있음
                if filepath.name not in {"schema_gen.py"}:
                    issues.append(("🟡", f"{filepath.name}: 인증 없는 엔드포인트 존재 가능 — 의도적 공개라면 # public 주석 추가"))

    # ── AI scanner 파일 try/except 체크 ──────────────────────────────────────
    if "ai_scanner" in str(filepath) and filepath.name != "__init__.py":
        if "try:" not in content:
            issues.append(("🟡", "AI 스캐너에 try/except 없음 — API 실패 시 전체 스캔 중단 위험"))

    return issues


def check_ts_file_level(content: str, filepath: Path) -> list[tuple[str, str]]:
    issues = []

    # fetch 사용하는데 try/catch 없음
    if "fetch(" in content and "try {" not in content and ".catch(" not in content:
        issues.append(("🟡", "fetch() 사용하지만 try/catch 또는 .catch() 없음 — 네트워크 에러 미처리"))

    # 대시보드 컴포넌트인데 로딩 상태 없음 (saving/pending 등 다른 표현도 허용)
    if filepath.parent.name == "dashboard" and "useState" in content:
        has_loading = any(kw in content.lower() for kw in ("loading", "issaving", "saving", "pending", "submitting"))
        if not has_loading:
            issues.append(("🟢", "로딩 상태(isLoading/saving 등) 없음 — UX 개선 고려"))

    return issues


# ── 메인 점검 로직 ────────────────────────────────────────────────────────────

def scan_file(filepath: Path) -> list[tuple[str, str, int | None]]:
    """파일을 읽어 이슈 목록 반환: [(레벨, 설명, 라인번호 or None)]"""
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []

    issues = []
    ext = filepath.suffix.lower()

    if ext == ".py":
        rules = [(lvl, desc, pat) for lvl, desc, pat in PY_RULES if pat]
        lines = content.splitlines()

        for lvl, desc, pattern in rules:
            for i, line in enumerate(lines, 1):
                if re.search(pattern, line):
                    issues.append((lvl, desc, i))

        for lvl, desc in check_py_file_level(content, filepath):
            issues.append((lvl, desc, None))

    elif ext in (".ts", ".tsx"):
        rules = [(lvl, desc, pat) for lvl, desc, pat in TS_RULES if pat]
        lines = content.splitlines()

        for lvl, desc, pattern in rules:
            for i, line in enumerate(lines, 1):
                # NEXT_PUBLIC_ 체크: 클라이언트 컴포넌트("use client")에서만 의미있음
                # 서버 컴포넌트(use client 없음)에서는 NEXT_PUBLIC_ 없는 env 사용 허용
                # 패턴이 NEXT_PUBLIC_ 관련이고, 파일이 서버 컴포넌트이면 건너뜀
                if "NEXT_PUBLIC_" in pattern and '"use client"' not in content[:200]:
                    continue
                if re.search(pattern, line):
                    issues.append((lvl, desc, i))

        for lvl, desc in check_ts_file_level(content, filepath):
            issues.append((lvl, desc, None))

    return issues


def format_issues(issues: list, filepath: Path) -> str:
    if not issues:
        return ""

    lines = [f"**자동 점검 결과: `{filepath.name}`**\n"]
    critical = [(l, d, n) for l, d, n in issues if l == "🔴"]
    important = [(l, d, n) for l, d, n in issues if l == "🟡"]
    optional = [(l, d, n) for l, d, n in issues if l == "🟢"]

    for lvl, group in [("🔴 Critical", critical), ("🟡 Important", important), ("🟢 Optional", optional)]:
        if not group:
            continue
        lines.append(f"{lvl}:")
        for _, desc, lineno in group:
            loc = f" (line {lineno})" if lineno else ""
            lines.append(f"  - {desc}{loc}")

    lines.append("\n`docs/code_review_checklist.md` 참조")
    return "\n".join(lines)


# ── 엔트리포인트 ──────────────────────────────────────────────────────────────

def main():
    try:
        hook_input = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    file_path = (
        hook_input.get("tool_input", {}).get("file_path")
        or hook_input.get("tool_response", {}).get("filePath")
    )

    if not file_path:
        sys.exit(0)

    filepath = Path(file_path)

    # backend/ 또는 frontend/ 소속 파일만 점검
    parts = set(filepath.parts)
    if "backend" not in parts and "frontend" not in parts:
        sys.exit(0)

    # 지원 확장자만
    if filepath.suffix.lower() not in (".py", ".ts", ".tsx"):
        sys.exit(0)

    if not filepath.exists():
        sys.exit(0)

    issues = scan_file(filepath)
    message = format_issues(issues, filepath)

    if not message:
        sys.exit(0)

    # Claude Code에 컨텍스트로 주입 (Critical 있으면 강조)
    has_critical = any(lvl == "🔴" for lvl, _, __ in issues)
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": message
        }
    }

    # Critical 이슈는 시스템 메시지로도 표시
    if has_critical:
        output["systemMessage"] = f"⚠️ 점검 이슈 발견: {filepath.name} — Critical {sum(1 for l,_,__ in issues if l=='🔴')}건"

    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    main()
