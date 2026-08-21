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

## 해제 방법

검토 완료(각 항목 착수 또는 의도적 보류 결정) 후 서버 `.env`에 `COMMERCIAL_HARDENING_20_REVIEWED=true` 설정 시 이 경고 해제.
