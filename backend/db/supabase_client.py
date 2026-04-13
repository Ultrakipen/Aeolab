import os
import asyncio
from supabase import create_client, Client

_client: Client | None = None
_storage = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
        _client = create_client(url, key)
    return _client


def get_storage():
    return get_client().storage


class _EmptyResponse:
    """maybe_single()이 204(결과 없음)를 반환할 때 사용하는 빈 응답 객체"""
    data = None


async def execute(query) -> any:
    """동기 supabase-py .execute()를 스레드풀에서 실행해 async 이벤트 루프 차단 방지.

    maybe_single() 사용 시 결과가 없으면 postgrest가 APIError('204')를 던지는데,
    이를 _EmptyResponse(data=None)으로 변환해 호출부에서 안전하게 .data 접근 가능.
    """
    try:
        return await asyncio.to_thread(query.execute)
    except Exception as e:
        # maybe_single() 결과 없음 — 204 코드 or 'Missing response' 메시지
        err_str = str(e)
        if "204" in err_str or "Missing response" in err_str:
            return _EmptyResponse()
        raise
