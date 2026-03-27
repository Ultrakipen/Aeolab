import asyncio
import logging
from functools import wraps

logger = logging.getLogger("aeolab")


def with_retry(max_retries=3, base_delay=1.0, exceptions=(Exception,)):
    """지수 백오프 재시도 데코레이터"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_retries - 1:
                        logger.error(f"{func.__name__} failed after {max_retries} retries: {e}")
                        raise
                    delay = base_delay * (2 ** attempt)  # 1s, 2s, 4s
                    logger.warning(f"{func.__name__} retry {attempt+1}/{max_retries} in {delay}s: {e}")
                    await asyncio.sleep(delay)
        return wrapper
    return decorator


def with_timeout(seconds=30):
    """API 호출 타임아웃 데코레이터"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await asyncio.wait_for(func(*args, **kwargs), timeout=seconds)
            except asyncio.TimeoutError:
                logger.warning(f"{func.__name__} timed out after {seconds}s")
                return {"error": "timeout", "mentioned": False}
        return wrapper
    return decorator
