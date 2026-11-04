"""계정 탈퇴 시 Storage 파일 삭제 (services/storage_cleanup.py, 2026-11-04).

탈퇴(DELETE /api/settings/account)가 DB 행만 지우고 before-after 버킷의 스크린샷·카드 이미지를 남겼다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import storage_cleanup as sc  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class FakeBucket:
    """supabase storage.from_().list/remove의 동작(바로 아래 항목만 반환, 폴더는 id=None, limit/offset)을 흉내 낸다."""

    def __init__(self, files, fail_prefixes=()):
        self.files = set(files)
        self.fail = tuple(fail_prefixes)
        self.remove_calls = []

    def list(self, prefix, opts=None):
        if any(prefix.startswith(f) for f in self.fail):
            raise RuntimeError("list failed")
        opts = opts or {}
        pre = prefix.rstrip("/") + "/"
        children = {}
        for f in sorted(self.files):
            if f.startswith(pre):
                rest = f[len(pre):]
                seg = rest.split("/", 1)[0]
                children[seg] = children.get(seg, False) or ("/" in rest)
        entries = [{"name": s, "id": None if is_dir else "id-" + s} for s, is_dir in sorted(children.items())]
        off, lim = opts.get("offset", 0), opts.get("limit", 100)
        return entries[off:off + lim]

    def remove(self, paths):
        self.remove_calls.append(list(paths))
        for p in paths:
            self.files.discard(p)


class FakeSupabase:
    def __init__(self, bucket):
        self._b = bucket
        self.storage = self

    def from_(self, name):
        assert name == "before-after"
        return self._b


BIZ, OTHER = "biz-1", "biz-2"


def _all_prefix_files(biz):
    return {
        f"screenshots/{biz}/a.png", f"blog/{biz}/hash1/b.png", f"blog/{biz}/hash2/deeper/c.png",
        f"ai-search/{biz}/20261104_naver_ai.png", f"gap_cards/{biz}/20261104.png",
        f"cards/{biz}/7d.png", f"growth/{biz}/2026-11-04.png",
    }


def test_removes_files_under_every_prefix_including_nested_folders_and_leaves_other_businesses():
    b = FakeBucket(_all_prefix_files(BIZ) | _all_prefix_files(OTHER))
    n = sc.purge_business_files(FakeSupabase(b), [BIZ])
    assert n == 7
    assert not any(BIZ in f for f in b.files)
    assert b.files == _all_prefix_files(OTHER)               # 다른 사업장 파일은 그대로


def test_more_than_one_page_of_files_is_fully_removed_in_chunks():
    files = {f"screenshots/{BIZ}/f{i:03d}.png" for i in range(230)}
    b = FakeBucket(files)
    assert sc.purge_business_files(FakeSupabase(b), [BIZ]) == 230
    assert not b.files
    assert max(len(c) for c in b.remove_calls) <= 100


def test_failure_on_one_prefix_does_not_raise_and_other_prefixes_are_still_cleaned():
    b = FakeBucket(_all_prefix_files(BIZ), fail_prefixes=(f"screenshots/{BIZ}",))
    n = sc.purge_business_files(FakeSupabase(b), [BIZ])        # 예외 없이 끝나야 한다(탈퇴를 막지 않는다)
    assert n == 6 and f"screenshots/{BIZ}/a.png" in b.files and not any(f.startswith(("blog", "growth")) for f in b.files)


def test_no_businesses_or_missing_bucket_is_a_noop():
    assert sc.purge_business_files(FakeSupabase(FakeBucket([])), []) == 0

    class Broken:
        @property
        def storage(self):
            raise RuntimeError("no storage")

    assert sc.purge_business_files(Broken(), [BIZ]) == 0


def _read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


def test_prefixes_match_the_paths_the_uploaders_actually_write():
    """업로드 경로가 바뀌면 탈퇴 때 지우는 경로도 같이 바뀌어야 한다."""
    checks = {
        "screenshots": ("services", "screenshot.py", 'f"screenshots/{biz_id}/'),
        "blog": ("services", "screenshot.py", 'f"blog/{biz_id}/'),
        "ai-search": ("services", "ai_search_screenshot.py", 'f"ai-search/{biz_id}/'),
        "gap_cards": ("services", "gap_card.py", 'f"gap_cards/{business_id}/'),
        "cards": ("scheduler", "jobs.py", 'f"cards/{biz[\'id\']}/'),
        "growth": ("scheduler", "jobs.py", 'f"growth/{biz_id}/'),
    }
    assert set(checks) == set(sc.BIZ_PREFIXES)
    for prefix, (d, fname, needle) in checks.items():
        assert needle in _read(d, fname), f"{prefix}: {fname}에서 {needle} 업로드 경로를 찾지 못했다"


def test_delete_account_purges_storage_before_deleting_businesses():
    src = _read("routers", "settings.py")
    i_purge = src.index("purge_business_files")
    i_biz_delete = src.index('supabase.table("businesses").delete().eq("user_id", user_id)')
    assert i_purge < i_biz_delete, "사업장 ID를 잃기 전에(businesses 삭제 전에) Storage를 지워야 한다"
    assert "asyncio.to_thread(purge_business_files" in src        # 동기 Storage 호출이 이벤트 루프를 막지 않게
