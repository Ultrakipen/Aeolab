"""시크릿 파일 재작성이 권한을 되돌리지 않고 원본을 지키는지 (2026-11-10).

수정 전: 쿠키 점검 잡의 .env 갱신이 임시 파일을 기본 권한(644)으로 만들어 교체해, 서버에서 600으로 강화한 .env 권한이 되돌아갔다.
권한 비트는 Linux(서버)에서만 의미가 있어 그 검사는 Windows에서는 건너뛴다.
"""
import inspect
import os
import stat
import sys

import pytest

from utils.secure_write import atomic_write_secret_file

posix_only = pytest.mark.skipif(sys.platform.startswith("win"), reason="권한 비트는 POSIX에서만 의미가 있다")


def test_replaces_content_and_leaves_no_temp_file(tmp_path):
    p = tmp_path / ".env"
    p.write_text("A=1\n", encoding="utf-8")
    atomic_write_secret_file(str(p), "A=2\nB=3\n")
    assert p.read_text(encoding="utf-8") == "A=2\nB=3\n"
    assert not (tmp_path / ".env.tmp").exists()


@posix_only
def test_result_is_owner_only_even_if_the_original_was_world_readable(tmp_path):
    p = tmp_path / ".env"
    p.write_text("A=1\n", encoding="utf-8")
    os.chmod(p, 0o644)
    atomic_write_secret_file(str(p), "A=2\n")
    assert stat.S_IMODE(os.stat(p).st_mode) == 0o600                   # 수정 전에는 644로 되돌아갔다


@posix_only
def test_temp_file_is_created_owner_only_from_the_start(tmp_path, monkeypatch):
    seen = {}
    real_replace = os.replace

    def spy(src, dst):
        seen["mode"] = stat.S_IMODE(os.stat(src).st_mode)              # 교체 직전 임시 파일의 권한
        return real_replace(src, dst)

    monkeypatch.setattr(os, "replace", spy)
    atomic_write_secret_file(str(tmp_path / ".env"), "A=1\n")
    assert seen["mode"] == 0o600                                       # 잠깐이라도 다른 사용자가 읽을 수 있는 순간이 없다


def test_failure_keeps_the_original_and_removes_the_temp_file(tmp_path, monkeypatch):
    p = tmp_path / ".env"
    p.write_text("A=1\n", encoding="utf-8")

    def boom(src, dst):
        raise OSError("disk full")

    monkeypatch.setattr(os, "replace", boom)
    with pytest.raises(OSError):
        atomic_write_secret_file(str(p), "A=2\n")
    assert p.read_text(encoding="utf-8") == "A=1\n"                    # 원본은 반쪽 상태가 되지 않는다
    assert not (tmp_path / ".env.tmp").exists()


def test_cookie_job_uses_the_secure_writer_not_a_plain_open():
    from scheduler import jobs
    src = inspect.getsource(jobs.check_naver_cookie_health_job)
    assert "atomic_write_secret_file(_env_path, _env_txt)" in src
    assert 'open(_tmp_path, "w")' not in src
