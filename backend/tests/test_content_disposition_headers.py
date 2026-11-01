"""다운로드 응답의 Content-Disposition 헤더는 한글 사업장명이 들어가도 인코딩 오류 없이 만들어져야 한다 (2026-11-01).

QR 카드 다운로드(/api/guide/{biz}/qr-card)가 `filename="review_qr_{사업장명}.png"`를 헤더에 그대로 넣어, 한글 이름이면 starlette가 latin-1로
인코딩하다 UnicodeEncodeError(500)로 실패했다. import 오류(별도 결함)에 가려져 있다가 서버에서 실제 라우트를 호출해 발견했다.
"""
import pathlib
import re
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _header_lines():
    out = []
    for p in ROOT.rglob("*.py"):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(("tests/", "venv/")) or "_deploy_tmp" in rel or "/venv/" in rel:
            continue
        for i, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if "Content-Disposition" in line:
                out.append((rel, i, line))
    return out


def test_every_content_disposition_is_latin1_safe_by_construction():
    bad = []
    for rel, i, line in _header_lines():
        if "filename*=" in line:
            continue                     # RFC 5987 퍼센트 인코딩(urllib.parse.quote)을 쓰는 경로
        if not re.search(r'filename="[^"]*\{', line):
            continue                     # 파일명에 변수 보간이 없는 고정 ASCII 파일명(`headers={...}`의 딕셔너리 중괄호는 무관)
        if "{biz_id}" in line:
            continue                     # UUID(ASCII)만 들어간다
        bad.append(f"{rel}:{i}: {line.strip()[:120]}")
    assert not bad, "사용자 입력(사업장명 등)이 들어갈 수 있는 파일명을 인코딩 없이 헤더에 넣었다:\n" + "\n".join(bad)


def test_qr_card_header_with_korean_name_encodes_and_decodes():
    src = (ROOT / "routers" / "guide.py").read_text(encoding="utf-8")
    assert "filename*=UTF-8''" in src and "_urlparse.quote(" in src
    # 라우트와 같은 방식으로 만든 헤더가 starlette의 latin-1 인코딩을 통과하고 원래 이름으로 복원되는지
    name = "홍뮤직스튜디오작곡교습소"
    enc = urllib.parse.quote(f"review_qr_{name}.png")
    header = f"attachment; filename=\"review_qr.png\"; filename*=UTF-8''{enc}"
    header.encode("latin-1")             # 예외가 없어야 한다
    m = re.search(r"filename\*=UTF-8''([^;]+)", header)
    assert urllib.parse.unquote(m.group(1)) == f"review_qr_{name}.png"
