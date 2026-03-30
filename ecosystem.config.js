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
      args: "main:app --host 127.0.0.1 --port 8000 --workers 1",
      interpreter: "none",
      max_memory_restart: "1G",
      error_file: "/var/log/pm2/backend-error.log",
      out_file: "/var/log/pm2/backend-out.log",
    },
  ],
};
