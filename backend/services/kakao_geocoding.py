"""
Google Geocoding API — 주소 → 위도/경도 변환
기존 카카오 Geocoding 대체 (카카오 로컬 API 심사 승인 후 전환 가능)
"""
import os
import asyncio
import logging
import aiohttp

_logger = logging.getLogger(__name__)
_GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
_GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")


async def get_coordinates(address: str) -> tuple[float | None, float | None]:
    """주소 문자열 → (lat, lng) 반환. 실패 시 (None, None)."""
    if not address or not _GOOGLE_API_KEY:
        return None, None
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.get(
                _GOOGLE_GEOCODE_URL,
                params={"address": address, "key": _GOOGLE_API_KEY, "language": "ko", "region": "KR"},
            ) as resp:
                if resp.status != 200:
                    _logger.warning("Google Geocoding HTTP %s for address=%s", resp.status, address)
                    return None, None
                data = await resp.json()
                if data.get("status") != "OK" or not data.get("results"):
                    _logger.warning("Google Geocoding status=%s for address=%s", data.get("status"), address)
                    return None, None
                loc = data["results"][0]["geometry"]["location"]
                return float(loc["lat"]), float(loc["lng"])
    except asyncio.TimeoutError:
        _logger.warning("Google Geocoding timeout for address=%s", address)
        return None, None
    except Exception as e:
        _logger.warning("Google Geocoding error: %s", e)
        return None, None
