"""
인메모리 TTL 캐시 (Redis 미도입 구간 대안)
- 사용자 100명 이상 또는 다중 프로세스 운영 시 Redis로 전환 권장
- 스케줄러에서 clear_expired()를 주기적으로 호출해야 메모리 정리됨
"""
import time
import hashlib
import json
from typing import Any, Optional

_store: dict[str, tuple[Any, float]] = {}


def _make_key(*args) -> str:
    """가변 인자를 조합해 고정 길이 캐시 키 생성"""
    raw = json.dumps(args, ensure_ascii=False, default=str)
    return hashlib.md5(raw.encode()).hexdigest()


def get(key: str) -> Optional[Any]:
    """캐시 조회. 없거나 만료됐으면 None 반환"""
    entry = _store.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.monotonic() > expires_at:
        _store.pop(key, None)
        return None
    return value


def set(key: str, value: Any, ttl: int) -> None:
    """캐시 저장. ttl 단위는 초"""
    _store[key] = (value, time.monotonic() + ttl)


def delete(key: str) -> None:
    _store.pop(key, None)


def clear_expired() -> int:
    """만료된 항목 전체 삭제. 삭제된 수 반환 (스케줄러에서 주기 호출)"""
    now = time.monotonic()
    expired = [k for k, (_, exp) in list(_store.items()) if now > exp]
    for k in expired:
        _store.pop(k, None)
    return len(expired)


def size() -> int:
    return len(_store)
