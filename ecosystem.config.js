// PM2 설정 — iwinv 서버 배포용
module.exports = {
  apps: [
    {
      name: "aeolab-frontend",
      cwd: "/var/www/aeolab/frontend",
      script: "npm",
      args: "start",
      env: {
        PORT: 3000,
        NODE_ENV: "production",
      },
      max_memory_restart: "800M",
      error_file: "/var/log/pm2/frontend-error.log",
      out_file: "/var/log/pm2/frontend-out.log",
    },
    {
      name: "aeolab-backend",
      cwd: "/var/www/aeolab/backend",
      script: "/var/www/aeolab/venv/bin/uvicorn",
      // ⚠️ --workers 1 을 절대 임의로 늘리지 말 것 (서버 업그레이드 후에도 유지).
      // guide.py/startup.py/assistant.py의 _*_locks(set) 및 multi_scanner.py의
      // PLAYWRIGHT_SEMAPHORE가 전부 프로세스 메모리 안의 순수 Python 객체라 워커를
      // 늘리면 워커마다 별도 메모리를 써서 락·세마포어가 서로 다른 프로세스 간에
      // 공유되지 않는다 — 월 한도 TOCTOU 재발·Playwright 동시실행 제한 무력화로
      // 이어짐(2026-07-16 발견). 늘리려면 락을 Redis/DB 기반으로 먼저 교체할 것.
      args: "main:app --host 127.0.0.1 --port 8000 --workers 1",
      interpreter: "none",
      max_memory_restart: "1G",
      error_file: "/var/log/pm2/backend-error.log",
      out_file: "/var/log/pm2/backend-out.log",
    },
  ],
};
