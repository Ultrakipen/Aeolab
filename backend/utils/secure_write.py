"""시크릿 파일(.env)을 안전하게 다시 쓴다 — 임시 파일을 처음부터 600으로 만들고 원자적으로 교체 (2026-11-10).

이전 코드는 `open(tmp, "w")`로 임시 파일을 기본 권한(umask 022 → 644)으로 만들고 `os.replace`로 덮어써, .env를 다시 쓰는 순간
(쿠키 점검 잡의 자동 재로그인 갱신) 서버에서 600으로 강화한 권한이 644로 되돌아가 일반 사용자가 API 키를 읽을 수 있게 된다.
쓰기 도중 프로세스가 죽어도 원본이 반쪽 상태로 남지 않는다(임시 파일에 쓴 뒤 교체) — 실패하면 임시 파일을 지우고 예외를 다시 올린다.
"""
from __future__ import annotations

import os


def atomic_write_secret_file(path: str, text: str) -> None:
    tmp = path + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)   # 만들 때부터 소유자만 읽기·쓰기
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, path)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise
