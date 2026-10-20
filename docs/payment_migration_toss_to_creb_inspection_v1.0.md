# 결제 시스템 토스페이먼츠 → 크렙(Krep, payapi.creb.co.kr) 전환 점검 v1.0

> 작성 2026-10-20 | 근거: https://docs.creb.co.kr/ (web-payment, api-payment, cash-receipt, vendor-api) + 코드 직접 확인
> 상태: **점검만 완료, 코드 변경 없음.** 아래 §5 사전 확인 사항이 크렙 답변 전엔 구현 착수 금지.

## 1. 크렙 API 요약 (문서 기준)

| 항목 | 내용 |
|------|------|
| 베이스 URL | `https://payapi.creb.co.kr` (테스트 전용 URL 없음 — **테스트 결제도 실결제**, 매일 23:00 KST 일괄 취소) |
| 인증 | 모든 요청 body에 `sid`(상점ID)+`secret_key`. Basic Auth 아님 |
| 서명 | `signature` = SHA-256 hex(소문자 64자) of `key=value&...` 문자열 + `timestamp`(ms). 엔드포인트별 서명 필드가 다름 |
| 암호화 | 카드번호·생년월일/사업자번호·비번 앞2자리는 AES-256-CBC/PKCS5 (api key + IV) |
| 빌링키 발급(SDK) | `pay.js`의 `Hansolpay(clientKey).requestBillingAuth({successUrl, failUrl})` → successUrl에 `auth_key` → 서버 `POST /v1/billing/billkey/authkey` |
| 빌링키 발급(직접) | `POST /v1/billing/billkey/card` — 카드번호를 우리 서버가 받아야 함 → **PCI 범위 확대, 비채택 권장** |
| 정기 청구 | `POST /v1/billing/billpay` (`billkey`,`order_id`,`amount`,`buyer_*`,`goods_name`,`card_quota`) |
| 빌키 삭제 | `POST /v1/billing/billkey/delete` |
| 단건 웹결제 | `requestPayment({...successUrl,failUrl})` → successUrl에 `paymentId` → 서버 `POST /v1/pay/confirm` 필수(미호출 시 10분 내 자동취소) |
| 취소 | 전액 `POST /v1/cancel/cancel`(tid=transactionNumber), 부분 `POST /v1/cancel/partial`(`cancel_request_id` 멱등키) |
| 현금영수증 | `/v1/cash_receipt/*` (가상계좌·계좌이체 건용) |
| 웹훅 | **문서에 없음** |
| 벤더 API | 다수 가맹점을 관리하는 파트너용. 단일 가맹점인 AEOlab에는 해당 없어 보임 |

## 2. 토스 ↔ 크렙 매핑표

| 기능 | 토스(현재) | 크렙 | 영향 |
|------|-----------|------|------|
| 클라이언트 SDK | `@tosspayments/payment-sdk` `loadTossPayments` | `<script src=payapi.creb.co.kr/assets/js/pay.js>` + `Hansolpay()` (npm 패키지 아님) | 프론트 4곳 |
| 빌링 인증 후 리다이렉트 | `authKey`, `customerKey` | `auth_key` (customerKey 없음) | success/card-update 페이지 |
| 빌링키 교환 | `POST /v1/billing/authorizations/issue` Basic Auth | `POST /v1/billing/billkey/authkey` sid+secret+signature | webhook.py:119, settings.py:376, toss_billing.py:15 |
| 빌링 청구 | `POST /v1/billing/{key}` | `POST /v1/billing/billpay` | webhook.py:188, toss_billing.py:46 |
| 응답 키 | `billingKey`, `card.issuerCode`, `card.number`, `paymentKey`, `approvedAt` | `billKey`, `cardResultCode/Name`, `cardNumber`, `transactionNumber`, `transactionDatetime` | DB 컬럼 의미 변경 |
| 빌링키 삭제 | `DELETE /v1/billing/{key}` | `POST /v1/billing/billkey/delete` | settings.py:248,398,538 |
| 결제 취소 | `POST /v1/payments/{paymentKey}/cancel` | `POST /v1/cancel/cancel` (tid) | settings.py:200, jobs.py:5696, delivery.py:288 |
| 단건 승인 | `POST /v1/payments/confirm` | `POST /v1/pay/confirm` (`paymentId`) | delivery.py:786 |
| 카드사 코드 | `card_issuers.py`/`cardIssuers.ts` (토스 issuerCode) | `cardResultName`이 이미 한글 이름으로 옴 | 매핑표 불필요해질 수 있음(코드 체계 확인 필요) |
| CSP | `js.tosspayments.com`, `*.tosspayments.com` (script/connect/frame) | `payapi.creb.co.kr` 추가 필요 | next.config.ts:50,56,57 |

## 3. 변경 대상 파일 (코드 확인 완료)

**백엔드 (9)**: `services/toss_billing.py`, `routers/webhook.py`(issue_billing), `routers/settings.py`(해지·환불·카드변경·삭제 4군데), `routers/delivery.py`(단건 confirm/취소 2군데), `scheduler/jobs.py`(자동환불 5620~5700, 갱신 1526), `utils/payment_event_log.py`(주석/이벤트명), `config/card_issuers.py`, `main.py:65`(_OPTIONAL_ENVS), `routers/admin.py`, `models/schemas.py:160`(BillingIssueRequest)
**프론트 (8)**: `PayButton.tsx`, `SettingsClient.tsx`, `payment/success/page.tsx`, `payment/card-update/page.tsx`, `delivery/new/page.tsx`, `DeliveryPaymentRetryButton.tsx`, `delivery/payment-confirm/page.tsx`, `lib/api.ts`(190,799), `lib/cardIssuers.ts`, `next.config.ts` CSP
**환경변수**: `TOSS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY` → `CREB_SID`, `CREB_SECRET_KEY`, `NEXT_PUBLIC_CREB_CLIENT_KEY`(웹결제 클라이언트 키)
**DB**: `subscriptions.first_payment_key`는 토스 paymentKey를 담고 있음 → 크렙은 취소에 `transactionNumber`(tid)가 필요. 컬럼 의미 변경 또는 `first_payment_tid` 추가. `delivery_orders.payment_key`도 동일.

## 4. 구조적 위험 (단순 URL 치환으로 끝나지 않는 부분)

1. **customerKey 개념이 없음** — 토스는 `customer_{user_id}`로 빌링키를 사용자와 묶었고 `webhook.py:113`이 이 형식을 검증하며 `user_id`를 복원함(139행). 크렙 `successUrl`은 `auth_key`만 돌려줌 → **어느 사용자의 카드 등록인지** 서버가 알 방법을 바꿔야 함(서버 세션/Bearer 토큰으로 user_id 확정, 또는 successUrl 쿼리에 서명된 state 포함). 현재 이 엔드포인트는 무인증 + customerKey 신뢰 구조라 **보안 모델 재설계 지점**.
2. **서명·암호화 없는 Basic Auth → 요청마다 SHA-256 서명 + timestamp** — 공통 헬퍼 1개로 묶고 단위테스트 필수(문서에 키 이름과 `&` 포함 규칙 강조).
3. **구매자 정보 필수** — `billpay`는 `buyer_name`,`buyer_phone` 필수. 갱신 잡(jobs.py:1526)이 `profiles`/구독에서 이름·전화를 조회해야 함. 현재 `phone`은 NULL인 구독이 있었던 이력(PayButton 주석) → NULL이면 청구 실패 가능, 대체값 정책 필요.
4. **빌링 청구 응답 본문에 상태 중복** — `status:true/false`를 body로 판정(HTTP 200이라도 실패 가능성). 현재 코드는 `r.status_code == 200`만 보므로 **그대로 옮기면 실패를 성공으로 오기록**(토스 때와 동일한 "HTTP200=성공" 오판 위험). 반드시 `json()["status"] is True` 확인.
5. **전액취소 문서 모순** — `amount` 파라미터가 표에는 있으나 설명은 "전액 고정". 부분취소(첫 달 50% 할인 환불 등)와 혼용 시 `CANCEL_AMOUNT_EXCEEDED` 가능. 7일 자동환불(jobs.py:5620)·구독 해지 환불(settings.py:200) 로직 전부 이 규칙에 맞춰 재검증.
6. **웹훅 없음** — 현재 코드도 토스 웹훅 수신은 없고(구독 불일치 감지 잡으로 대체) 동일하게 동작 가능하나, 결제 상태 사후 확인 수단은 `vendor-api`(파트너용)뿐 → **취소 결과 미확정(CANCEL_NEEDS_REVIEW)** 상태를 DB에 기록·관리자 알림하는 처리 추가 필요.
7. **테스트가 실결제** — 샌드박스 부재. QA는 소액(100~1,000원) 실결제 후 즉시 취소 방식. 기존 `toss-review@` 심사 계정 메모리·카드사 심사용 결제경로(동의 체크박스 ac6ba40)도 크렙 기준으로 재확인 필요.
8. **정기결제 서비스 승인** — 크렙에서 빌링키(정기결제) 상품이 계약에 포함돼 있는지, 수수료율(현재 영세 0.40%+VAT 가정으로 마진 계산됨)이 어떻게 바뀌는지 확인. 마진표(`docs/plan_limits_v1.0.md`, `business_viability_audit_v1.0.md`) 재계산 대상.
9. **카드사 심사/약관** — 결제대행사(PG) 변경이므로 이용약관·개인정보처리방침의 PG 명칭(토스페이먼츠 표기)·제3자 제공 고지, 결제 확인 모달 문구 갱신. `/terms`, `/privacy`에서 "토스" 문자열 grep 필요. (법적 문구라 사용자 확인 후 수정)
10. **기존 구독자 이관** — 현재 `subscriptions.billing_key`는 **토스 빌링키라 크렙에서 사용 불가**. 활성 구독자가 있다면 전원 카드 재등록 필요(안내 알림톡/이메일 + 유예 기간 + 갱신 잡이 토스/크렙 빌키를 구분하도록 `pg_provider` 컬럼). 실구독자 수는 코드로 알 수 없음 → **DB 실측 필요**(과거 메모리 수치 재인용 금지).

## 5. 크렙에 확인할 질문 (구현 착수 전 필수)

1. 정기결제(빌링키) 상품이 계약 범위에 포함인지, 수수료율·정산주기
2. 테스트 환경: 별도 URL/테스트 카드 유무, 테스트키 `test_api` 사용 시 실제 카드로 소액 결제해도 되는지
3. API 결제 AES key/IV 포맷(Base64? raw 32/16바이트?) — 문서 표는 placeholder, 문서 스스로 불일치 가능성 명시
4. 전액취소 `amount` 동작, 부분취소 후 전액취소 불가 규칙이 7일 환불에 미치는 영향
5. 웹훅/노티 제공 여부(승인 지연·취소 결과 확인용)
6. 빌링 SDK 흐름에서 `auth_key` 리다이렉트에 사용자 식별용 `customData`/state를 실을 수 있는지(웹결제는 `customData` 있음, 빌링은 문서 미기재)
7. 프랜차이즈 수준 한도(월 승인한도), 카드사별 빌링 가능 범위(체크카드 등)
8. 단건결제(대행서비스 `delivery`)와 정기결제를 같은 sid로 쓰는지

## 6. 권장 구현 순서 (확인 후)

1. `services/creb_client.py` 신설: 서명 생성·AES 암호화(필요 시)·공통 POST·`status` 판정·에러 정규화. 단위테스트(문서 예시 서명 문자열로 고정 벡터 검증).
2. DB: `subscriptions.pg_provider`('toss'|'creb') + `first_payment_tid`, `delivery_orders` 동일. 기존 값 보존(마이그레이션 SQL은 Supabase 수동 실행).
3. 백엔드: 신규 구독(issue_billing)·갱신(retry_billing)·카드변경·해지·환불을 `pg_provider`로 분기 — 토스 구독자는 기존 경로 유지(이중 운영 기간), 신규만 크렙.
4. 프론트: 결제 모달 → `pay.js` 로드 + `requestBillingAuth`, success/card-update 페이지 `auth_key` 처리, CSP 갱신.
5. 대행서비스 단건결제 `requestPayment` + `/v1/pay/confirm` 전환.
6. 토스 구독자 이관 캠페인 → 0명 확인 후 토스 코드 제거.
7. 소액 실결제 QA(결제→갱신→카드변경→해지환불→7일환불) 후 배포. 배포는 CLAUDE.md 절차(md5 선확인, 빌드, pm2, 서버 grep 검증, 커밋).

## 7. 결론

- **기술적으로 가능**: 크렙은 빌링키 발급·정기청구·단건·취소를 모두 제공.
- **단순 치환 불가**: customerKey 부재, 서명 체계, 취소 키(tid), 구매자 정보 필수, 웹훅 부재, 테스트=실결제 때문에 설계 변경 필요. 특히 §4-1(사용자 식별)과 §4-10(기존 구독자 빌링키 이관)이 최대 위험.
- **우선순위**: §5 질문 → 구독자 실측 → 설계 확정(이중 운영 `pg_provider`) → 구현.
