"""미정의 이름 회귀 테스트 — 2026-10-30.

`except Exception`으로 감싼 잡이나 "건너뜀" 같은 드문 분기에서 NameError가 조용히 실패하던 결함 2건을 정적 검사(pyflakes)로 발견했다:
- scheduler/jobs.py `delivery_stalled_in_progress_alert_job`: `timezone` 미import → 2026-07-21부터 매일 "잡 실패"
- services/kakao_notify.py `send_delivery_*`: `_logger` 미정의 → 템플릿 미설정 건너뜀 경로가 NameError
pyflakes가 없는 환경(서버)에서는 건너뛴다.
"""
import pathlib

import pytest

pyflakes_api = pytest.importorskip("pyflakes.api")
from pyflakes import reporter  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
SKIP_DIRS = {"tests", "venv", "backend_venv", "__pycache__", "node_modules", ".git"}


class _Collect(reporter.Reporter):
    def __init__(self):
        self.messages = []
        super().__init__(None, None)

    def unexpectedError(self, filename, msg):
        self.messages.append(f"{filename}: {msg}")

    def syntaxError(self, filename, msg, lineno, offset, text):
        self.messages.append(f"{filename}:{lineno}: syntax error {msg}")

    def flake(self, message):
        self.messages.append(f"{message.filename}:{message.lineno}: {message.message % message.message_args}")


def test_no_undefined_names_in_backend_source():
    found = []
    for path in ROOT.rglob("*.py"):
        if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts):
            continue
        rep = _Collect()
        pyflakes_api.check(path.read_text(encoding="utf-8"), str(path.relative_to(ROOT)), rep)
        found += [m for m in rep.messages if "undefined name" in m or "syntax error" in m]
    assert not found, "미정의 이름/문법 오류:\n" + "\n".join(found)


def test_delivery_notifications_skip_gracefully_without_templates(monkeypatch):
    """템플릿 변수가 없으면 예외 없이 건너뛴다(서버에는 현재 KAKAO_TEMPLATE_DELIVERY_01~04가 비어 있다)."""
    import asyncio
    from services import kakao_notify
    for k in ("KAKAO_TEMPLATE_DELIVERY_01", "KAKAO_TEMPLATE_DELIVERY_02", "KAKAO_TEMPLATE_DELIVERY_03", "KAKAO_TEMPLATE_DELIVERY_04"):
        monkeypatch.delenv(k, raising=False)
    n = kakao_notify.KakaoNotifier()
    for name in ("send_delivery_received", "send_delivery_in_progress", "send_delivery_completed"):
        fn = getattr(n, name, None)
        if fn is None:
            continue
        import inspect
        params = list(inspect.signature(fn).parameters)
        kwargs = {p: "x" for p in params}
        try:
            asyncio.run(fn(**kwargs))
        except NameError as e:   # 미정의 이름만 실패로 본다(다른 인자 오류는 이 테스트의 관심이 아니다)
            pytest.fail(f"{name}: {e}")
        except Exception:
            pass
