#!/usr/bin/env python3
"""범용 운영 알림 CLI — 이메일(Resend)+Slack 이중 채널.
backup_json.py의 notify() 패턴을 다른 독립 운영 스크립트(예: SSL 갱신 실패)에서도
재사용하기 위해 분리. FastAPI 앱 의존성 없이 단독 실행 가능(cron/systemd에서 호출).

사용: python3 ops_alert.py "제목" "본문"
"""
import sys, os, json, urllib.request, urllib.error

RESEND_API_KEY = os.getenv('RESEND_API_KEY', '')
OPERATOR_EMAIL = os.getenv('OPERATOR_EMAIL', 'contact@aeolab.co.kr')
FROM_EMAIL = os.getenv('FROM_EMAIL', 'noreply@aeolab.co.kr')
SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL', '')


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
        'https://api.resend.com/emails', data=body,
        headers={
            'Authorization': f'Bearer {RESEND_API_KEY}',
            'Content-Type': 'application/json',
            'User-Agent': 'AEOlab-Ops-Alert/1.0',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            r.read()
    except Exception as e:
        print(f'  알림 이메일 발송 실패: {e}')


def send_slack_alert(subject: str, message: str) -> None:
    if not SLACK_WEBHOOK_URL:
        print(f'  SLACK_WEBHOOK_URL 미설정 — Slack 알림 건너뜀: {subject}')
        return
    payload = json.dumps({
        'attachments': [{
            'color': '#FF0000',
            'title': f'[AEOlab] {subject}',
            'text': message,
            'footer': 'AEOlab Ops Alert',
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
    send_alert_email(subject, message)
    send_slack_alert(subject, message)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('사용법: python3 ops_alert.py "제목" "본문"')
        sys.exit(1)
    notify(sys.argv[1], sys.argv[2])
