"""계정 탈퇴 시 Storage(before-after 버킷)에 남는 사업장 파일 삭제 (2026-11-04).

사고: DELETE /api/settings/account는 DB 행만 지우고 Storage 파일은 지우지 않아, 탈퇴한 사용자의 스크린샷 등이 버킷에 남았다
(가입 후 체험 검증 계정을 삭제해 보다가 발견 — 체험 한 번에 네이버 화면 스크린샷 2장이 남았다).
경로는 업로드 지점(screenshot.py·ai_search_screenshot.py·gap_card.py·jobs.py)과 같아야 한다.
삭제는 best-effort다: 실패해도 탈퇴(DB·Auth 삭제)를 막지 않고 경고만 남긴다.
"""
from __future__ import annotations

import logging

logger = logging.getLogger("aeolab")

BUCKET = "before-after"
# <prefix>/<business_id>/... 형태로 올라가는 모든 경로 (blog는 keyword_hash 하위 폴더가 있다)
BIZ_PREFIXES = ("screenshots", "blog", "ai-search", "gap_cards", "cards", "growth")
_PAGE = 100
_MAX_DEPTH = 3


def _list_files(bucket, prefix: str, depth: int = 0) -> list[str]:
    """prefix 아래 모든 파일 경로(하위 폴더 포함). 폴더 항목은 id가 없다."""
    files: list[str] = []
    offset = 0
    while True:
        items = bucket.list(prefix, {"limit": _PAGE, "offset": offset}) or []
        for it in items:
            name = it.get("name")
            if not name:
                continue
            full = f"{prefix}/{name}"
            if it.get("id") is None and depth < _MAX_DEPTH:
                files.extend(_list_files(bucket, full, depth + 1))
            else:
                files.append(full)
        if len(items) < _PAGE:
            break
        offset += _PAGE
    return files


def purge_business_files(supabase, biz_ids: list[str]) -> int:
    """사업장 ID별 Storage 파일을 모두 지우고 지운 개수를 돌려준다(동기 함수 — 비동기 코드에서는 to_thread로 부른다)."""
    removed = 0
    try:
        bucket = supabase.storage.from_(BUCKET)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"storage_cleanup: 버킷 접근 실패 — {e}")
        return 0
    for biz_id in biz_ids or []:
        for prefix in BIZ_PREFIXES:
            try:
                paths = _list_files(bucket, f"{prefix}/{biz_id}")
                for i in range(0, len(paths), _PAGE):
                    bucket.remove(paths[i:i + _PAGE])
                removed += len(paths)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"storage_cleanup: {prefix}/{biz_id} 삭제 실패 — {e}")
    return removed
