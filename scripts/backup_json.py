#!/usr/bin/env python3
"""Supabase REST API 기반 전체 테이블 JSON 백업 (2026-07-12: pg_dump 직접연결 경로가
서버→Supabase Postgres 포트(5432/6543) 아웃바운드 차단으로 확인되어 REST API(443, 정상 동작
확인됨) 방식을 유일 백업 경로로 전환. 테이블 목록도 v1.0 시절 14개에서 현재 스키마 전체로 확장.

2026-07-16: 백업이 서버 로컬 디스크에만 저장돼 서버 자체 손실 시 백업도 함께 사라지는
단일 장애점이었음 — 백업 직후 Supabase Storage(iwinv와 별개 인프라)에 오프사이트 사본을
추가로 업로드. 로컬 백업 성공 여부(주 신호, Healthchecks.io 하트비트 대상)와는 분리된
best-effort 부가 작업 — 오프사이트 업로드가 실패해도 로컬 백업이 성공했으면 스크립트는
정상 종료(exit 0)하되 별도 이메일로만 알림.
"""
import sys, os, json, gzip, tarfile, glob, urllib.request, urllib.error
from datetime import datetime, timedelta

BACKUP_DIR = sys.argv[1] if len(sys.argv) > 1 else '/var/www/aeolab/backups'
DATE = sys.argv[2] if len(sys.argv) > 2 else datetime.now().strftime('%Y%m%d_%H%M')

SUPABASE_URL = os.getenv('SUPABASE_URL', '')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
HEADERS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}

RESEND_API_KEY = os.getenv('RESEND_API_KEY', '')
OPERATOR_EMAIL = os.getenv('OPERATOR_EMAIL', 'contact@aeolab.co.kr')
FROM_EMAIL = os.getenv('FROM_EMAIL', 'noreply@aeolab.co.kr')
SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL', '')

OFFSITE_BUCKET = 'db-backups-offsite'
OFFSITE_RETENTION_DAYS = 30

TABLES = [
    'businesses', 'competitors', 'scan_results', 'ai_citations', 'score_history',
    'before_after', 'guides', 'subscriptions', 'notifications', 'profiles',
    'team_members', 'api_keys', 'waitlist', 'trial_scans',
    'gap_cards', 'review_replies', 'notices', 'faqs', 'inquiries',
    'index_snapshots', 'scan_analytics', 'competitor_snapshots', 'review_snapshots',
    'industry_trends', 'keyword_volumes', 'action_completions',
    'business_action_log', 'blog_analysis', 'competitor_faqs', 'delivery_orders',
    'delivery_messages', 'support_tickets', 'support_replies', 'success_stories',
    'system_status', 'assistant_logs', 'naver_prescan', 'blog_score_history',
    'admin_audit_log', 'system_alerts', 'payment_events', 'admin_users',
    'startup_report_log',
]


def send_alert_email(subject: str, message: str) -> None:
    if not RESEND_API_KEY:
        print(f'  RESEND_API_KEY 미설정 — 알림 이메일 건너뜀: {subject}')
        return
    html = (
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">'
        f'<h1 style="font-size:16px;">{subject}</h1>'
        f'<p style="font-size:13px;white-space:pre-wrap;">{message}</p>'
        '</div>'
    )
    body = json.dumps({
        'from': f'AEOlab <{FROM_EMAIL}>',
        'to': [OPERATOR_EMAIL],
        'subject': f'[AEOlab 운영] {subject}',
        'html': html,
    }).encode('utf-8')
    req = urllib.request.Request(
        'https://api.resend.com/emails',
        data=body,
        headers={
            'Authorization': f'Bearer {RESEND_API_KEY}',
            'Content-Type': 'application/json',
            'User-Agent': 'AEOlab-Backup-Script/1.0',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            r.read()
    except Exception as e:
        print(f'  알림 이메일 발송 실패: {e}')


def send_slack_alert(subject: str, message: str) -> None:
    """backend/utils/alert.py send_slack_alert()와 동일한 웹훅·페이로드 스타일 —
    2026-08-01 백업 13일 무중단 사고에서 이메일 단일 채널이 13일간 미확인 상태로
    방치된 걸 계기로 이중화. 웹훅 미설정 시 조용히 스킵(이메일 알림은 그대로 유지)."""
    if not SLACK_WEBHOOK_URL:
        print(f'  SLACK_WEBHOOK_URL 미설정 — Slack 알림 건너뜀: {subject}')
        return
    payload = json.dumps({
        'attachments': [{
            'color': '#FF0000',
            'title': f'[AEOlab] {subject}',
            'text': message,
            'footer': 'AEOlab Backup Script',
        }]
    }).encode('utf-8')
    req = urllib.request.Request(
        SLACK_WEBHOOK_URL, data=payload,
        headers={'Content-Type': 'application/json'}, method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            r.read()
    except Exception as e:
        print(f'  Slack 알림 발송 실패: {e}')


def notify(subject: str, message: str) -> None:
    """이메일+Slack 이중 채널 알림 — 한쪽이 미확인 상태로 방치돼도 다른 쪽이 잡도록."""
    send_alert_email(subject, message)
    send_slack_alert(subject, message)


def _storage_request(method: str, path: str, data: bytes | None = None, content_type: str = 'application/json') -> tuple[int, bytes]:
    req = urllib.request.Request(
        f'{SUPABASE_URL}/storage/v1{path}',
        data=data,
        headers={**HEADERS, 'Content-Type': content_type},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def ensure_offsite_bucket() -> bool:
    """db-backups-offsite 버킷이 없으면 생성(Private). 이미 있으면(409) 그대로 통과."""
    status, body = _storage_request(
        'POST', '/bucket',
        data=json.dumps({'id': OFFSITE_BUCKET, 'name': OFFSITE_BUCKET, 'public': False}).encode('utf-8'),
    )
    if status in (200, 201):
        print(f'  오프사이트 버킷 신규 생성: {OFFSITE_BUCKET}')
        return True
    if status == 409 or b'already exists' in body or b'Duplicate' in body:
        return True
    print(f'  오프사이트 버킷 확인 실패({status}): {body[:200]}')
    return False


def upload_offsite(bundle_path: str) -> bool:
    """당일 백업 전체(tar 번들)를 Supabase Storage에 업로드 — 서버 손실 시에도 살아남는 사본."""
    if not ensure_offsite_bucket():
        return False
    object_name = os.path.basename(bundle_path)
    with open(bundle_path, 'rb') as f:
        data = f.read()
    status, body = _storage_request(
        'POST', f'/object/{OFFSITE_BUCKET}/{object_name}',
        data=data, content_type='application/x-tar',
    )
    if status in (200, 201):
        print(f'  오프사이트 업로드 완료: {object_name} ({len(data)/1024/1024:.1f}MB)')
        return True
    print(f'  오프사이트 업로드 실패({status}): {body[:200]}')
    return False


def cleanup_offsite_old() -> None:
    """OFFSITE_RETENTION_DAYS(30일)보다 오래된 오프사이트 백업 삭제."""
    status, body = _storage_request('POST', f'/object/list/{OFFSITE_BUCKET}', data=json.dumps({'prefix': '', 'limit': 1000}).encode('utf-8'))
    if status != 200:
        return
    try:
        items = json.loads(body)
    except Exception:
        return
    cutoff = datetime.now() - timedelta(days=OFFSITE_RETENTION_DAYS)
    stale = []
    for item in items:
        name = item.get('name', '')
        # full_backup_YYYYMMDD_HHMM.tar 형식에서 날짜 파싱
        try:
            date_part = name.replace('full_backup_', '').replace('.tar', '')
            file_date = datetime.strptime(date_part[:13], '%Y%m%d_%H%M')
            if file_date < cutoff:
                stale.append(name)
        except Exception:
            continue
    if stale:
        _storage_request('DELETE', f'/object/{OFFSITE_BUCKET}', data=json.dumps({'prefixes': stale}).encode('utf-8'))
        print(f'  오프사이트 {len(stale)}건 만료 삭제(30일 초과)')


def main() -> int:
    if not SUPABASE_URL or not KEY:
        msg = 'SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정 — 백업 중단'
        print(msg)
        notify('DB 백업 실패 — 환경변수 누락', msg)
        return 1

    os.makedirs(BACKUP_DIR, exist_ok=True)
    total = 0
    failed_tables = []

    for table in TABLES:
        rows, offset = [], 0
        while True:
            req = urllib.request.Request(
                f'{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1000&offset={offset}',
                headers=HEADERS,
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    batch = json.loads(r.read())
                    if not batch:
                        break
                    rows.extend(batch)
                    offset += len(batch)
                    if len(batch) < 1000:
                        break
            except Exception as e:
                print(f'  {table}: {e}')
                failed_tables.append(table)
                break

        out = os.path.join(BACKUP_DIR, f'{table}_{DATE}.json.gz')
        with gzip.open(out, 'wt', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, default=str)
        print(f'  {table}: {len(rows)}행 → {os.path.basename(out)}')
        total += len(rows)

    print(f'총 {total}행 백업 완료 (테이블 {len(TABLES)}개 중 실패 {len(failed_tables)}개)')

    # 오프사이트 사본 — 로컬 백업 성공 여부와 무관하게 best-effort로 시도(부분 실패라도
    # 백업된 테이블만큼은 서버 손실 시에도 남기는 게 아예 없는 것보다 나음)
    try:
        bundle_path = os.path.join(BACKUP_DIR, f'full_backup_{DATE}.tar')
        table_files = glob.glob(os.path.join(BACKUP_DIR, f'*_{DATE}.json.gz'))
        with tarfile.open(bundle_path, 'w') as tar:
            for fp in table_files:
                tar.add(fp, arcname=os.path.basename(fp))
        offsite_ok = upload_offsite(bundle_path)
        os.remove(bundle_path)  # 로컬엔 번들 불필요 — 개별 테이블 파일만 유지
        if offsite_ok:
            cleanup_offsite_old()
        else:
            notify(
                'DB 오프사이트 백업 실패',
                f'{DATE} 로컬 백업은 성공했으나 Supabase Storage 오프사이트 사본 업로드가 실패했습니다. '
                f'서버 자체 손실 시 이 날짜 백업은 복구 불가할 수 있습니다.',
            )
    except Exception as e:
        print(f'  오프사이트 백업 예외: {e}')
        notify('DB 오프사이트 백업 예외', f'{DATE} 오프사이트 백업 중 예외 발생: {e}')

    if failed_tables:
        notify(
            'DB 백업 일부 실패',
            f'{DATE} 백업에서 {len(failed_tables)}개 테이블 실패: {", ".join(failed_tables)}',
        )
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
