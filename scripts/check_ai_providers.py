"""AI 프로바이더 3종 연결 점검 — 충전·결제 연결 직후 한 번 실행해 실제 호출이 되는지 확인한다.

사용: ssh root@115.68.231.57 "cd /var/www/aeolab/backend && /var/www/aeolab/venv/bin/python ../scripts/check_ai_providers.py"
각 프로바이더에 아주 작은 호출 1건씩만 보낸다(비용 거의 없음). 키 값은 출력하지 않는다.
Gemini는 스캐너와 같은 경로(Google Search 그라운딩)로 10회를 보내 성공 표본 수까지 확인한다.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", ".env"))


async def check_claude() -> str:
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        return "FAIL — ANTHROPIC_API_KEY 없음"
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=key)
        r = await client.messages.create(model="claude-haiku-4-5", max_tokens=8, messages=[{"role": "user", "content": "ok"}])
        return f"OK — 응답 {len(r.content)}블록"
    except Exception as e:
        return f"FAIL — {type(e).__name__}: {str(e)[:140]}"


async def check_openai() -> str:
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        return "FAIL — OPENAI_API_KEY 없음"
    try:
        from openai import AsyncOpenAI
        r = await AsyncOpenAI(api_key=key).chat.completions.create(
            model="gpt-4.1-mini", max_tokens=5, messages=[{"role": "user", "content": "ok"}]
        )
        return f"OK — {r.model}"
    except Exception as e:
        return f"FAIL — {type(e).__name__}: {str(e)[:140]}"


async def check_gemini() -> str:
    if not os.getenv("GEMINI_API_KEY"):
        return "FAIL — GEMINI_API_KEY 없음"
    try:
        from services.ai_scanner.gemini_scanner import GeminiScanner
        res = await GeminiScanner().sample_recommend(["서울 성동구 카페 추천"], "어니언 성수", 10)
        ok, failed = res.get("sample_size"), res.get("failed_count")
        verdict = "OK" if isinstance(ok, int) and ok >= 9 else "FAIL(대부분 실패 — 결제/한도 확인)"
        return f"{verdict} — 10회 중 성공 {ok}회, 실패 {failed}회"
    except Exception as e:
        return f"FAIL — {type(e).__name__}: {str(e)[:140]}"


async def main():
    print("Claude  :", await check_claude())
    print("OpenAI  :", await check_openai())
    print("Gemini  :", await check_gemini())


asyncio.run(main())
