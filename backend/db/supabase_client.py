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


async def execute(query) -> any:
    """동기 supabase-py .execute()를 스레드풀에서 실행해 async 이벤트 루프 차단 방지"""
    return await asyncio.to_thread(query.execute)
