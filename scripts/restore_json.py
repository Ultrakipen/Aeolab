#!/usr/bin/env python3
"""backup_json.py가 만든 <table>_<DATE>.json.gz 백업 파일을 Supabase REST API로 복구한다.

기본적으로 원본 테이블이 아닌 --target 테이블(드릴/검증용 별도 테이블)에 적재한다.
운영 테이블에 직접 복구하려면 --target을 원본과 동일하게 명시적으로 지정해야 하며,
그 경우 기존 행과의 충돌(PK 중복)을 --upsert 여부로 제어한다.

사용 예:
  python3 restore_json.py businesses_20260801_1741.json.gz --target restore_drill_businesses
"""
import sys, os, json, gzip, argparse, urllib.request, urllib.error

SUPABASE_URL = os.getenv('SUPABASE_URL', '')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')


def restore(backup_path: str, target_table: str, batch_size: int, upsert: bool) -> int:
    if not SUPABASE_URL or not KEY:
        print('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정')
        return 1

    with gzip.open(backup_path, 'rt', encoding='utf-8') as f:
        rows = json.load(f)

    if not rows:
        print(f'{backup_path}: 복구할 행 없음 (0건)')
        return 0

    headers = {
        'apikey': KEY,
        'Authorization': f'Bearer {KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal' if upsert else 'return=minimal',
    }

    restored = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        req = urllib.request.Request(
            f'{SUPABASE_URL}/rest/v1/{target_table}',
            data=json.dumps(batch, ensure_ascii=False).encode('utf-8'),
            headers=headers,
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                r.read()
            restored += len(batch)
            print(f'  {i}~{i + len(batch)}행 적재 완료')
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')
            print(f'  배치 {i}~{i + len(batch)} 실패 ({e.code}): {body[:500]}')
            return 1

    print(f'{backup_path} -> {target_table}: 총 {restored}/{len(rows)}행 복구 완료')
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('backup_file', help='<table>_<DATE>.json.gz 경로')
    ap.add_argument('--target', required=True, help='복구 대상 테이블명 (원본과 다른 이름 권장)')
    ap.add_argument('--batch-size', type=int, default=500)
    ap.add_argument('--upsert', action='store_true', help='PK 충돌 시 덮어쓰기 (미지정 시 충돌하면 실패)')
    args = ap.parse_args()
    sys.exit(restore(args.backup_file, args.target, args.batch_size, args.upsert))
