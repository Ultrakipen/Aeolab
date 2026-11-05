"""소스 파일에 NUL 같은 제어 바이트가 섞이지 않는다 (2026-11-05).

사고 직전 사례: 파이썬 스크립트로 TSX를 고치다 정규식의 `\x00`이 이스케이프로 해석돼 GuideClient.tsx에 실제 NUL·DEL 바이트가 들어갔다.
타입 검사는 통과했고 grep만 "Binary file matches"로 알려 줬다 — 배포 전에 걸러지도록 고정한다.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKIP = {"node_modules", ".next", ".git", "__pycache__", "backend_venv", "venv", ".playwright-mcp"}
FORBIDDEN = [bytes([i]) for i in range(0, 32) if i not in (9, 10, 13)] + [bytes([127])]


def _sources():
    for base, exts in ((os.path.join(ROOT, "frontend"), (".ts", ".tsx")), (os.path.join(ROOT, "backend"), (".py",))):
        for d, dirs, files in os.walk(base):
            dirs[:] = [x for x in dirs if x not in SKIP]
            for f in files:
                if f.endswith(exts):
                    yield os.path.join(d, f)


def test_no_control_bytes_in_frontend_and_backend_sources():
    bad = []
    for p in _sources():
        with open(p, "rb") as fh:
            data = fh.read()
        hit = [b for b in FORBIDDEN if b in data]
        if hit:
            bad.append((os.path.relpath(p, ROOT), [h.hex() for h in hit]))
    assert not bad, bad[:10]
