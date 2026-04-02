#!/usr/bin/env python3
"""pg_dump 없을 때 fallback — Supabase REST API로 테이블별 JSON 백업"""
import sys, os, json, gzip, urllib.request
from datetime import datetime

BACKUP_DIR = sys.argv[1] if len(sys.argv) > 1 else '/var/www/aeolab/backups'
DATE = sys.argv[2] if len(sys.argv) > 2 else datetime.now().strftime('%Y%m%d_%H%M')

SUPABASE_URL = os.getenv('SUPABASE_URL', '')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
HEADERS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}

TABLES = [
    'businesses','competitors','scan_results','ai_citations','score_history',
    'before_after','guides','subscriptions','notifications','profiles',
    'team_members','api_keys','waitlist','trial_scans'
]

os.makedirs(BACKUP_DIR, exist_ok=True)
total = 0

for table in TABLES:
    rows, offset = [], 0
    while True:
        req = urllib.request.Request(
            f'{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1000&offset={offset}',
            headers=HEADERS
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                batch = json.loads(r.read())
                if not batch: break
                rows.extend(batch)
                offset += len(batch)
                if len(batch) < 1000: break
        except Exception as e:
            print(f'  {table}: {e}')
            break

    out = os.path.join(BACKUP_DIR, f'{table}_{DATE}.json.gz')
    with gzip.open(out, 'wt', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, default=str)
    print(f'  {table}: {len(rows)}행 → {os.path.basename(out)}')
    total += len(rows)

print(f'총 {total}행 백업 완료')
