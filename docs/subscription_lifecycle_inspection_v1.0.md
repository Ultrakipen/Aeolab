# 구독 생애주기 점검 (갱신·카드변경·해지) v1.0

> 2026-07-06~07 점검. `docs/five_pages_and_action_history_handoff_v1.0.md`(9개 페이지 실측 점검) 완료 후 사용자 요청으로 결제/구독 영역 신규 점검. 배포·검증 완료 4건 + 미해결 1건(사용자 결정 대기).

## 완료 내역 (배포·검증 완료)

### 1. 구독 갱신(자동결제) — 유예기간 재시도 없음 (git `df4f55f`)
- **발견**: `jobs.py subscription_lifecycle_job`이 결제 실패 시 `grace_period`+`grace_until=+3일`만 세팅하고, 3일 뒤 무조건 `suspended`. 그 사이 재시도 코드 전무 — "유예기간"이 실질은 "3일 카운트다운 정지 타이머"였음.
- **결정**: 그레이스 기간 중 매일 1회 `retry_billing()` 재시도. 성공 시 `active` 복귀+`grace_until=None`+신규 알림(`send_payment_recovered`, `kakao_notify.py` `AEOLAB_NOTICE_01` 재사용).
- **부수 발견**: 죽은 `/toss/confirm` 엔드포인트 삭제(`webhook.py` `confirm_payment`+`_verify_toss_auth`+`_extract_user_id`+`schemas.py PaymentConfirm`). 전수 grep 확인 결과 프론트 어디서도 미호출 — 구독 결제는 `/toss/billing/issue`만 사용. 죽은 코드가 `billing_key`에 일회성 paymentKey를 저장하는 설계라 되살리면 매달 자동결제 100% 실패하는 지뢰였음.
- **실 서버 확인**: `subscriptions` 5건 전수 조회 — 전부 `test_billing_`/`dev_bypass` 테스트 데이터, 실결제 전환 전이라 현재 피해 고객 0명.

### 2. 카드 변경 플로우 — 해지 즉시 유료 기능 강등 (git `c9112c2`)
- **발견 (최다 심각)**: `settings.py cancel_subscription()` docstring과 프론트 안내 문구 모두 "end_at까지 서비스 유지"라고 명시하는데, 실제 `plan_gate.py get_user_plan()`(전 기능 플랜 게이팅 단일 소스)은 `status IN (active, grace_period)`만 유료 취급 — `cancelled`는 즉시 `free` 강등. **해지 버튼 누르는 순간 결제 잔여기간이 남아도 즉시 유료 기능 차단.**
- **수정**: `get_user_plan()`에 `_end_at_in_future()` 헬퍼 추가. `cancelled`+`end_at` 미래면 기존 플랜 유지. `competitor.py add_competitor()`의 중복 인라인 쿼리도 `get_user_plan()` 호출로 교체(DRY).
- **의도적으로 안 건드림**: 트라이얼 자격 체크 3곳은 "해지 후 잔여기간에도 트라이얼 재사용 방지"라는 반대 방향 로직 — 무관.
- **검증**: 실 서버 테스트 구독 행을 `cancelled`+미래/과거 `end_at` 양쪽으로 임시 변경해 `get_user_plan()` 실제 호출로 확인 후 원상복구.

### 3. 고아 파일 삭제 (git `87fd5ad`)
- `frontend/app/(dashboard)/dashboard/SettingsClient.tsx` — 실제 설정 페이지와 별개로 카드변경 로직을 복제한 채 어디서도 import 안 되는 고아 파일. 삭제 전 전수 grep으로 0 importer 확인.

### 4. 해지 플로우 — 정지상태 버튼 노출 + 거짓 안내 문구 (git `3ee38fb`)
- **발견 A**: "구독 해지" 섹션이 `status==suspended`에서도 무조건 노출됐음(카드변경 섹션은 이미 `isActiveSubscription` 게이트 있었는데 해지 섹션만 누락) — 정지 상태 사용자가 눌러도 기능 안 하는 버튼을 보게 됨.
- **발견 B**: 해지 모달에 "데이터는 30일간 보관 후 삭제됩니다"라는 문구가 있었는데, `privacy/page.tsx` 확인 결과 실제 삭제는 "회원 탈퇴"(계정 삭제) 시에만 발생 — 구독 "해지"(cancel)는 데이터를 전혀 삭제하지 않음. 사실과 다른 안내였음.
- **수정**: 해지 섹션을 `{isActiveSubscription && (...)}`로 게이트. 모달 문구를 "데이터 자체는 삭제되지 않고 보관되며, 재가입 시 그대로 이어서 이용할 수 있습니다"로 정정.
- **검증**: 실 서버에서 `cancel_subscription()` 함수를 테스트 구독 행에 직접 호출 — 토스 API 실패(테스트 빌링키라 정상, best-effort 처리 확인)·`status→cancelled` 전환·`get_user_plan()`이 `end_at`까지 플랜 유지 확인 후 원상복구.

## 미해결 — 사용자 결정 대기 ⚠️

### 5. 7일 청약철회 전액환불 — 백엔드 구현 전무
- **근거**: `terms/page.tsx` 제5조가 "구독 시작일로부터 7일 이내 청약철회 가능, 이메일 또는 **서비스 내 해지 신청**으로 가능, 전자상거래법 제17조에 따라"라고 명시. `pricing/page.tsx` FAQ도 "결제일로부터 7일 이내 + 서비스 미이용 상태면 전액 환불"이라고 명시.
- **문제**: 백엔드 전체 grep 결과 환불(토스 결제취소 API 호출) 로직이 어디에도 없음. 지금 "구독 해지" 버튼은 빌링키 삭제+`status→cancelled`뿐, 7일 이내/미이용 여부 판단 후 환불 처리하는 코드가 전혀 없음. 약관은 "서비스 내 해지 신청만으로 청약철회된다"고 읽히는데 실제로는 돈이 안 돌아옴.
- **성격**: 지금까지 발견한 버그와 달리 "잘못 짜인 코드"가 아니라 "자동화가 아예 없는 상태" — 1인 개발 초기엔 이메일 수동 요청 받아 토스 콘솔에서 수동 환불도 정상적인 운영 방식일 수 있음. 다만 현재는 **7일 이내 해지 버튼을 누른 사용자가 자신이 환불 대상인지 전혀 안내받지 못하는 구조**라 최소 안내는 필요해 보임.
- **선택지 (다음 세션에서 결정)**:
  1. 지금은 수동 처리 유지 + 해지 모달에 "7일 이내면 환불 문의" 안내만 추가 (최소 조치)
  2. 실제 자동 환불 로직 구현 — 7일 이내+미이용 여부 판단 후 토스 결제취소 API 자동 호출
  3. 그 외 (현행 유지 등)

## §6. 재점검 (2026-07-07) — 갱신·과금 정확성 재점검

배경: 사용자가 "구독,환불,해지 다시 점검"을 요청 → code-review 에이전트 파견 → 메인 세션이 file:line 직접 재검증(agentId `abbac4f18e8c3064b`).

### 오판·누락 검증 결과

에이전트 최초 보고는 P1-1(최초 갱신 미감지)/P1-2(연간 구독 오청구)/P1-3(중복실행 위험) 3건 모두 P1. 메인 세션 재검증 결과:

- **P1-1 → P0 상향(확정)**: `webhook.py:156`(최초 결제 시 `end_at = datetime.now()+timedelta(...).isoformat()` — 시각 포함 문자열) vs `jobs.py:1226`(`.eq("end_at", str(today))` — 날짜만 문자열) vs `schema.sql:233`(`end_at TIMESTAMPTZ`)를 전부 직접 Read/Grep으로 대조 확인. PostgREST가 날짜 문자열을 자정으로 캐스트해 비교하므로 시각이 섞인 실제 값과 **절대 일치 안 함이 100% 확정**. 최초 구독은 만료일이 와도 이 잡이 영구히 그 행을 못 찾아 재결제·유예전환·정지 중 무엇도 발동 안 함 → 사용자는 결제 없이 서비스 무기한 이용(회사는 매출 누락). CLAUDE.md 과금오류 기준 P0.
- **P1-2 → P1 확정, P1-1과 배포 순서 종속**: `prices.py:21`(`PLAN_PRICE_MAP`은 월정액 전용) + `toss_billing.py:32`(`retry_billing()`이 `billing_cycle` 무시)를 직접 확인. **P1-1만 먼저 고치면 이 잡이 실제로 작동을 시작하므로, P1-2를 같이 안 고치면 연간 구독자가 다음 갱신 때 월정액으로 오청구되는 새 사고가 열림** — 반드시 한 배포로 묶을 것.
- **P1-3 → P2로 하향(근거 격상)**: 최초엔 기억(트레이닝 지식)으로 "APScheduler `max_instances` 기본값=1이라 이미 안전"이라 반박했으나, 재검증 단계에서 실제 설치된 `apscheduler==3.10.4`의 1차 소스(`backend_venv/Lib/site-packages/apscheduler/schedulers/base.py:716-719`)를 직접 Grep해 `max_instances` 기본값=1·`misfire_grace_time` 기본값=1초·`coalesce` 기본값=True를 확정. 동시 중복실행은 이미 방지됨 — "위험"은 근거 부족한 과대평가였음. 남은 위험은 방향이 반대(1초 내 미기동 시 "그날 잡 자체가 조용히 스킵"됨, 중복이 아니라 누락) → P2 재분류.
- **⚠️ 새로 발견한 누락(에이전트도, 1차 검증도 놓침) — 구조적 결함**: `subscription_lifecycle_job` 전체가 단일 `try/except`(jobs.py:1203~1288)로만 감싸여 있고 구독자별 개별 예외처리가 없음. `retry_billing()` 성공(실제 결제 완료) 직후 `_db(update)`가 어떤 이유로든 예외를 던지면(네트워크 순간 오류가 `execute()`의 1회 자동재시도까지 뚫는 경우 등):
  1. 그 시점까지 처리 못한 나머지 구독자 전원이 그날 처리 안 되고 방치(루프 전체 중단)
  2. 결제는 성사됐는데 DB 갱신이 안 된 구독자는 **영구 미아 상태**가 됨 — 모든 조회가 `.eq("end_at", str(today))`식 "정확히 오늘"만 매칭하므로, 하루라도 놓치면 그 행은 과거 날짜에 갇혀 이후 어떤 쿼리도 다시 찾지 못함(P1-1과 근본 원인은 같으나 트리거가 다른 별개 사례)
  - **의미**: P1-1 수정안의 "`.gte()/.lt()` 범위 쿼리 전환"을 "선택적 방어"가 아니라 **필수 수정**으로 격상. 여기에 구독자별 개별 try/except(한 명 실패해도 나머지는 계속 처리)도 함께 추가해야 함.

### 최종 수정 계획 (구현은 다음 세션)

**1차 배포 묶음 (P0+P1, 반드시 함께 배포)**
1. `end_at` 저장을 전부 날짜 단위로 통일(`.date().isoformat()`) — `webhook.py` 최초발급 2곳(월/연) + `jobs.py` 갱신·유예복구 2곳
2. §1/§2 조회를 정확일치(`.eq`) 대신 범위 매칭(예: `.lte("end_at", str(today))`)으로 전환 — 위 신규 발견 근거로 필수
3. 구독자별 루프에 개별 try/except 추가 — 한 명의 예외가 나머지 배치를 막지 않도록
4. `retry_billing()`에 `billing_cycle` 반영 — yearly면 `YEARLY_AMOUNTS` 역매핑 금액 + 365일 연장
5. **배포 전 서버 실 데이터 확인 필수** — SSH로 `SELECT id, end_at, billing_cycle FROM subscriptions` 조회해 시각 포함된 레거시 `end_at` 행 존재 여부 확인, 있으면 배포와 함께 1회성 정규화 UPDATE 병행

**2차 (P2 4건)**
- `misfire_grace_time=3600` 추가(형제 잡과 일관성 — 중복방지 목적 아님, 스킵방지 목적)
- `daily_scan_all`(jobs.py:338) 대상에 `grace_period` 포함
- 해지 후(`cancelled`+`end_at` 미래) 재활성화 UI+엔드포인트 신설
- 정지(`suspended`) 상태에서 카드변경 허용 후 즉시 재시도하는 엔드포인트 신설

**3차 (P3)** — `cancelled_at` 타임스탬프 컬럼 추가(감사·churn 분석용, 선택)

**미해결 (사용자 결정 대기, §5와 동일)** — 7일 청약철회 전액환불 자동화 여부

### 방법론 노트
- 에이전트 보고를 기억(트레이닝 지식)만으로 반박하지 말고 실제 설치된 서드파티 라이브러리 소스(`backend_venv/Lib/site-packages/`)를 직접 열어 1차 소스로 확정할 것 — 이번 세션에서 P1-3 재분류의 신뢰도를 크게 높인 결정적 차이.
- "위험 없음"이라는 반증에 안주하지 말고 "그 안전장치가 깨지면 어떻게 되는가"를 한 겹 더 파고들 것 — 표면적 반증 성공(APScheduler 기본값 확인)에서 멈췄다면 이번 세션 최대 수확(구조적 정확일치 매칭 취약점)을 놓쳤을 것.

## 새 대화창 트리거

> **구독 갱신·과금 정확성 수정 진행**: `docs/subscription_lifecycle_inspection_v1.0.md 기준으로 §6의 1차 배포 묶음(P0+P1)부터 진행`
> **7일 환불 결정** (별도 트랙): `docs/subscription_lifecycle_inspection_v1.0.md 기준으로 §5(7일 환불) 결정하고 이어서 진행`
