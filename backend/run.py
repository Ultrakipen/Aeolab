"""Windows 로컬 개발용 uvicorn 실행 스크립트.
Playwright가 subprocess를 생성하려면 ProactorEventLoop이 필요한데,
uvicorn --reload 모드에서는 SelectorEventLoop이 사용될 수 있어 NotImplementedError가 발생.
이 스크립트는 이벤트 루프 정책을 uvicorn 시작 전에 설정한다."""
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
