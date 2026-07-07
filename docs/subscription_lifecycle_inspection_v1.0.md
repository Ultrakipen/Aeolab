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

## 새 대화창 트리거

> `docs/subscription_lifecycle_inspection_v1.0.md 기준으로 §5(7일 환불) 결정하고 이어서 진행`
