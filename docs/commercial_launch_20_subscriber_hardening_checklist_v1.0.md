# 구독자 20명 시점 상업 서비스 강화 체크리스트 v1.0 (2026-08-21)

> "Phase 기준을 배제한 일반 상업 서비스 기준" 재평가(`project_general_commercial_standard_reeval_2026_08_21` 메모리)에서 격상 대상으로 분류했으나, 초기 규모(구독자 20명 미만)에서는 출시를 막을 정도는 아니라고 판단해 이 시점까지 보류한 4개 항목. `jobs.py`의 `_check_data_wiring_readiness_job`이 활성 구독 20명 도달 시 `[LAUNCH-READY-20-HARDENING]` 경고를 자동 발생시킨다.

## 1. CSP(Content-Security-Policy) 설계

`frontend/next.config.ts`의 `headers()`에 다른 보안헤더(X-Frame-Options·HSTS 등)는 2026-08-21 추가됐으나 CSP는 제외됨 — Toss 결제위젯(`@tosspayments/payment-sdk`)·Kakao SDK(`t1.kakaocdn.net`)·GA4(`googletagmanager.com`)·Supabase 등 allowlist를 정확히 설계하지 않으면 결제 플로우가 조용히 깨질 위험이 있어 신중한 설계·스테이징 테스트가 필요.

## 2. 제3자 관점 보안점검

지금까지 전부 내부(에이전트+메인세션) 자체 점검. 무료 자동화 도구(Mozilla Observatory 스타일, OWASP ZAP baseline 등) 최소 1회 실행 권장.

## 3. AI스캔 경로 포함 부하테스트

2026-08-21 경량 부하테스트(`/`·`/pricing`·`/login` 등)는 동시 30까지 오류 0% 확인했으나, 실비용(Gemini/ChatGPT API 호출)·네이버 Playwright 일일상한(250건) 소모 우려로 `/api/scan/*` 경로는 의도적으로 범위 밖에 뒀음. 구독자가 늘어 동시 스캔 가능성이 커지면 재검토 필요.

## 4. 단일 서버 가용성 재검토

iwinv VPS 1대, PM2 `--workers 1`, 이중화·failover 전무. 2026-08-21 크래시루프 방지 가드(`min_uptime`/`max_restarts`)는 추가했으나 이건 "빠르게 포기하고 알림"이지 "자동 복구"가 아님 — 서버 자체 장애 시 수동 SSH 복구가 유일한 경로. 규모가 커지면 최소한의 복구 절차 문서화(RTO)나 이중화 검토 필요.

## 5. 결제 웹훅 서명 검증 — 외부기준 대조 결과: 해당 없음(적용 대상 아님, 오판 아님)

> 2026-08-23 "외부 상업 서비스 기준을 직접 대조" 요청으로 OWASP Webhook Security Cheat Sheet(HMAC 서명 + 5분 타임스탬프 + 멱등키 3원칙) 실검색 후 코드 대조.

`backend/routers/webhook.py`의 `/toss/billing/issue`(`webhook.py:106`)는 Toss가 AEOlab으로 비동기 push하는 진짜 웹훅이 아니라, 프론트가 Toss 위젯 리다이렉트 후 받은 `authKey`로 호출하는 **OAuth 코드교환형 엔드포인트**임. 보안모델은 서명검증이 아니라 "Toss 시크릿키로 authKey를 Toss 서버에 직접 재검증"(`webhook.py:118-123`)이며, `authKey`는 1회성이라 재전송(replay)에 자연 면역. 이중청구는 `find_recent_success_event` 10분 윈도우로 이미 처리 중(`webhook.py:174-183`). 정기결제도 Toss가 push하는 게 아니라 AEOlab 스케줄러가 pull하는 구조(`toss_billing.py:retry_billing`)라, **진짜 Toss발신 비동기 웹훅 수신 엔드포인트 자체가 이 코드베이스에 존재하지 않음** — OWASP 웹훅 서명 가이드는 적용 대상이 아니라고 결론. (단, Toss가 AEOlab 개입 없이 단독으로 취소/차지백 처리하는 경우는 웹훅이 아니라 별도 운영 절차 문제 — `docs/chargeback_response_checklist_v1.0.md` 참조, 기존에 이미 다룸)

## 6. 백업 RPO/RTO — 외부기준 대조 결과: RPO는 소형 SaaS 기준 미달, RTO는 미측정(신규 발견)

> 같은 세션 실검색(Veeam/AvePoint 2026 RPO·RTO 가이드): 대부분 SaaS는 RTO 1시간 미만 목표, Tier2(일반 업무용) 기준 RPO 1~4시간·RTO 4시간 미만, "3-2-1-1-0" 룰(오프사이트 사본 + 불변 사본 + 주기적 복구드릴에서 오류 0건) 권장.

AEOlab 실측: 일일 1회(매일 03:00 KST) REST API 백업(`scripts/backup_db.sh` → `backup_json.py`, 43테이블, `project_backup_restore_drill_2026_08_01` 메모리) → **RPO ≈ 24시간, Tier2 기준(1~4h)에 못 미침**. RTO는 2026-08-01 복구드릴 1회 성공했으나 소요시간을 측정·기록하지 않아 **목표(RTO) 자체가 미정의** 상태.

구독자 0명 단계에서 실시간 복제 등 인프라 투자는 과잉이나, "복구드릴 시 소요시간 실측·기록 + RTO 목표시간 문서화"는 비용 없이 가능한 개선이라 별도 항목으로 분리함(기존 항목4 "단일서버 가용성"은 이중화/failover 이슈, 이 항목은 백업 주기·RTO 측정 이슈로 구분).

## 해제 방법

검토 완료(각 항목 착수 또는 의도적 보류 결정) 후 서버 `.env`에 `COMMERCIAL_HARDENING_20_REVIEWED=true` 설정 시 이 경고 해제.
