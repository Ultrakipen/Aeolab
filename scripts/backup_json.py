#!/usr/bin/env python3
"""Supabase REST API 기반 전체 테이블 JSON 백업 (2026-07-12: pg_dump 직접연결 경로가
서버→Supabase Postgres 포트(5432/6543) 아웃바운드 차단으로 확인되어 REST API(443, 정상 동작
확인됨) 방식을 유일 백업 경로로 전환. 테이블 목록도 v1.0 시절 14개에서 현재 스키마 전체로 확장.
"""
import sys, os, json, gzip, urllib.request, urllib.error
from datetime import datetime

BACKUP_DIR = sys.argv[1] if len(sys.argv) > 1 else '/var/www/aeolab/backups'
DATE = sys.argv[2] if len(sys.argv) > 2 else datetime.now().strftime('%Y%m%d_%H%M')

SUPABASE_URL = os.getenv('SUPABASE_URL', '')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
HEADERS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}

RESEND_API_KEY = os.getenv('RESEND_API_KEY', '')
OPERATOR_EMAIL = os.getenv('OPERATOR_EMAIL', 'contact@aeolab.co.kr')
FROM_EMAIL = os.getenv('FROM_EMAIL', 'noreply@aeolab.co.kr')

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
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            r.read()
    except Exception as e:
        print(f'  알림 이메일 발송 실패: {e}')


def main() -> int:
    if not SUPABASE_URL or not KEY:
        msg = 'SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정 — 백업 중단'
        print(msg)
        send_alert_email('DB 백업 실패 — 환경변수 누락', msg)
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

    if failed_tables:
        send_alert_email(
            'DB 백업 일부 실패',
            f'{DATE} 백업에서 {len(failed_tables)}개 테이블 실패: {", ".join(failed_tables)}',
        )
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
