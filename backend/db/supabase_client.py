import os
import asyncio
import logging
from supabase import create_client, Client

_client: Client | None = None
_storage = None
_logger = logging.getLogger("aeolab")


def get_client() -> Client:
    global _client
    if _client is None:
        _client = _create_client()
    return _client


def _create_client() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    return create_client(url, key)


def _reset_client() -> Client:
    """HTTP/2 연결 끊김 후 새 클라이언트 인스턴스로 교체."""
    global _client
    _logger.warning("Supabase 클라이언트 재생성 (RemoteProtocolError 복구)")
    _client = _create_client()
    return _client


def get_storage():
    return get_client().storage


class _EmptyResponse:
    """maybe_single()이 204(결과 없음)를 반환할 때 사용하는 빈 응답 객체"""
    data = None


async def _db(query_builder) -> any:
    """동기 Supabase 쿼리 빌더를 스레드풀에서 실행하는 헬퍼.

    사용 예::

        result = await _db(
            supabase.table("businesses").select("id, name").eq("is_active", True)
        )
        rows = result.data or []

    jobs.py 등 AsyncIOScheduler 잡에서 동기 .execute() 직접 호출 대신 사용.
    """
    return await execute(query_builder)


async def execute(query) -> any:
    """동기 supabase-py .execute()를 스레드풀에서 실행해 async 이벤트 루프 차단 방지.

    maybe_single() 사용 시:
    - supabase-py 2.7.x: 결과 없으면 None 반환 (예외 없음)
    - 이전 버전: APIError('204') 또는 'Missing response' 예외 발생
    두 경우 모두 _EmptyResponse(data=None)으로 통일해 호출부 .data 접근 안전하게 보장.

    RemoteProtocolError (HTTP/2 연결 끊김) 발생 시:
    - 클라이언트 재생성 후 1회 자동 재시도.
    - 쿼리 빌더는 이미 생성된 객체이므로 재시도 가능.
    """
    try:
        result = await asyncio.to_thread(query.execute)
        if result is None:
            return _EmptyResponse()
        return result
    except Exception as e:
        err_str = str(e)
        # 이전 버전 maybe_single() 결과 없음
        if "204" in err_str or "Missing response" in err_str:
            return _EmptyResponse()
        # HTTP/2 연결 끊김 — 클라이언트 재생성 후 1회 재시도
        if "RemoteProtocolError" in err_str or "Server disconnected" in err_str:
            _reset_client()
            try:
                result = await asyncio.to_thread(query.execute)
                if result is None:
                    return _EmptyResponse()
                return result
            except Exception as retry_exc:
                _logger.warning(f"Supabase 재시도 실패: {retry_exc}")
                raise retry_exc
        raise
