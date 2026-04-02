#!/bin/bash
# AEOlab DB 자동 백업 — 매일 새벽 3시 실행
BACKUP_DIR="/var/www/aeolab/backups"
DATE=$(date +%Y%m%d_%H%M)
LOG="/var/log/aeolab_backup.log"

# Supabase 접속 정보 (환경변수에서 로드)
source /var/www/aeolab/backend/.env 2>/dev/null

# SUPABASE_URL에서 project ref 추출 (https://REF.supabase.co)
REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | cut -d'.' -f1)
DB_PASS=$(grep '^SUPABASE_DB_PASSWORD=' /var/www/aeolab/backend/.env | cut -d'=' -f2)

if [ -z "$REF" ]; then
    echo "[$DATE] ERROR: SUPABASE_URL 파싱 실패" >> "$LOG"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

# pg_dump으로 전체 백업 (venv의 pg_dump 사용 시도, 없으면 시스템 pg_dump)
PG_DUMP=$(which pg_dump 2>/dev/null)
if [ -z "$PG_DUMP" ]; then
    echo "[$DATE] ERROR: pg_dump 없음" >> "$LOG"
    # fallback: Python supabase-client로 테이블별 JSON 백업
    python3 /var/www/aeolab/scripts/backup_json.py "$BACKUP_DIR" "$DATE" >> "$LOG" 2>&1
    exit 0
fi

OUTFILE="$BACKUP_DIR/aeolab_$DATE.sql"
$PG_DUMP "postgresql://postgres.$REF:$DB_PASS@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"     --schema=public     --no-owner     --no-acl     -f "$OUTFILE" 2>> "$LOG"

if [ $? -eq 0 ]; then
    SIZE=$(du -sh "$OUTFILE" | cut -f1)
    echo "[$DATE] 백업 완료: aeolab_$DATE.sql ($SIZE)" >> "$LOG"
else
    echo "[$DATE] 백업 실패" >> "$LOG"
fi

# 7일 이상 된 백업 자동 삭제
find "$BACKUP_DIR" -name '*.sql' -mtime +7 -delete
find "$BACKUP_DIR" -name '*.json.gz' -mtime +7 -delete
