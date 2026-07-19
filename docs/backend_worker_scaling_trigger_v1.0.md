# 백엔드 `--workers 1` 확장 — 트리거 조건 (v1.0)

> 2026-07-19 논의 결론 문서화. Redis/DB 락 마이그레이션은 **지금 설계·구현하지 않는다** — 아래 트리거 조건이 실측되기 전까지 보류.

## 왜 보류하는가

- `ecosystem.config.js`가 `uvicorn --workers 1`을 의도적으로 고정 중 — 워커를 늘리면 아래 in-memory 객체가 프로세스별로 쪼개져 공유가 끊긴다.
- 락 코드는 과거 실제 데드락 사고(2026-06-02, `check_mention()` 세마포어 중첩 획득)가 났던 민감한 영역 — 실측 근거 없이 미리 손대는 건 "확실한 리스크 vs 불확실한 이득" 구도라 Phase 0~1 원칙("완벽한 코드보다 작동하는 제품")에 안 맞음.
- 현재 구독자 수는 BEP(20명) 미달 — CPU 코어 1개가 실제 병목이 됐다는 증거가 없음.

## 현재 워커 1개에 묶여 있는 것 (실측, 2026-07-19)

**in-memory 락 9개, 6개 파일** (CLAUDE.md에 "6개"로 기재돼 있던 것은 파일 수였고 락 객체 수는 9개 — 이번에 재확인):

| 파일 | 락 변수 | 보호 대상 |
|------|---------|-----------|
| `routers/guide.py:23` | `_guide_generation_locks` | 가이드 생성 월 한도 TOCTOU |
| `routers/guide.py:27` | `_review_reply_locks` | 리뷰 답변 생성 월 한도 TOCTOU |
| `routers/guide.py:28` | `_crisis_reply_locks` | 위기 대응 답변 생성 월 한도 TOCTOU |
| `routers/guide.py:35` | `_ad_defense_locks` | AI 광고 대비 가이드 생성 락 |
| `routers/startup.py:22` | `_startup_report_locks` | 창업 리포트 생성 락 |
| `routers/assistant.py:36` | `_assistant_chat_locks` | AI 어시스턴트 채팅 락 |
| `routers/business.py:22` | `_intro_faq_generation_locks` | 소개글·FAQ 생성 락 |
| `routers/blog.py:35` | `_blog_analysis_locks` | 블로그 진단 분석 락 |
| `routers/schema_gen.py:18` | `_schema_generation_locks` | JSON-LD 생성 락 |

**세마포어 1개**: `multi_scanner.py:40` `PLAYWRIGHT_SEMAPHORE` — Playwright(네이버 스캔) 동시 실행 수 전역 제한.

워커를 늘리면 이 9개 락 + 1개 세마포어가 워커마다 별도 메모리를 써서, 같은 사용자가 다른 워커로 라우팅되면 락이 안 걸려 월 한도 우회·중복 생성이 재발한다.

## 트리거 조건 — 아래 중 하나라도 충족되면 마이그레이션 착수

기존 인프라만으로 확인 가능(신규 계측 불필요):

1. **Playwright 세마포어 대기열 초과가 반복 관측** — `multi_scanner.py:88`의 경고 로그(`"[multi_scanner] Playwright 세마포어 대기열 초과(%.0fs) — 동시 요청 과다"`)가 **하루 10회 이상, 3일 연속** 발생.
   - 확인: `pm2 logs aeolab-backend --err --lines 2000 --nostream | grep -c "세마포어 대기열 초과"`
2. **락 경합으로 인한 409(진행 중) 응답이 반복 관측** — `GUIDE_GENERATION_IN_PROGRESS` 등 9개 락의 409 응답이 **하루 20회 이상, 3일 연속**. 정상적인 "같은 사용자가 실수로 두 번 클릭"보다 훨씬 잦다면 워커 부족이 아니라 실제 동시 사용자 증가 신호.
   - 확인: nginx access log에서 `status=409` 카운트, 또는 `system_alerts`에 관련 알림 누적 여부.
3. **구독자 수 50명 도달** — `smart_place_completeness` 자동화 등 다른 항목도 "50명"을 임계값으로 쓰는 이 프로젝트의 기존 관례와 통일. 50명 도달 자체가 트리거는 아니지만, 이 시점부터 위 1·2번 신호를 **적극적으로 관찰 시작**.
4. **`ai_daily_usage_alert_job`(2026-07-19 신설) 경보가 빈번히 발생** — 프로바이더 호출량 경보가 뜨는 빈도가 늘면 전체 트래픽 증가의 방증이므로 함께 참고.

## 트리거 충족 시 권장 마이그레이션 방향

- **Redis 신설보다 Postgres 어드바이저리 락(`pg_advisory_lock`) 우선 검토** — 이미 쓰는 Supabase로 처리 가능해 1인 운영 체제에 새 서비스를 안 늘림.
- 단, Supabase 커넥션 한도(direct 60 / pooler 200, 프리티어 하드 리밋) 잠식 여부를 먼저 계산할 것.
- PLAYWRIGHT_SEMAPHORE는 락과 별개로 RAM 제약이 진짜 병목이므로, 서버 RAM 업그레이드 시 `PLAYWRIGHT_MAX_CONCURRENCY` 값만 올리는 것으로 상당 부분 해결 가능(워커 수와 무관, 기존 결론 유지).

## 트리거 조건 자동 점검 (미구현, 향후 옵션)

`_check_data_wiring_readiness_job`(매일 09:20 KST, `[DATA-WIRING-READY-50]` 패턴)과 같은 방식으로 위 신호를 자동 집계해 WARNING 로그를 남기는 잡을 추가할 수 있음 — 지금은 미구현. 필요 시 별도 작업으로 진행.
