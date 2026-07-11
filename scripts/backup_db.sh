#!/bin/bash
# AEOlab DB 자동 백업 — 매일 새벽 3시 실행
# 2026-07-12: pg_dump 직접연결(5432/6543)이 서버 아웃바운드 차단으로 항상 실패해온 것을
# 실측 확인(연결 시도 이력 0건 성공). REST API(443, 정상 동작 확인됨) 방식으로 전환.
BACKUP_DIR="/var/www/aeolab/backups"
DATE=$(date +%Y%m%d_%H%M)
LOG="/var/log/aeolab_backup.log"

set -a
source /var/www/aeolab/backend/.env 2>/dev/null
set +a

mkdir -p "$BACKUP_DIR"

python3 /var/www/aeolab/scripts/backup_json.py "$BACKUP_DIR" "$DATE" >> "$LOG" 2>&1

if [ $? -eq 0 ]; then
    echo "[$DATE] 백업 완료" >> "$LOG"
else
    echo "[$DATE] 백업 실패 (위 로그 참조)" >> "$LOG"
fi

# 7일 이상 된 백업 자동 삭제
find "$BACKUP_DIR" -name '*.json.gz' -mtime +7 -delete
