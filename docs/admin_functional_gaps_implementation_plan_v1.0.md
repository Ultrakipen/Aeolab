# 관리자 화면 기능 공백 4건 구현 계획 v1.0

> 2026-07-10 작성. `docs/admin_screens_inspection_plan_v1.0.md` §10.2에서 "버그는 아니지만 아직 구현 안 된 기능"으로 처음 식별한 4건을, 오판·누락 방지를 위해 코드베이스 전체를 다시 훑어 근거(file:line)와 정확한 구현 범위를 확정한 문서. **이 4건은 전부 버그가 아니라 신규 기능이므로, 구현 여부와 순서는 사용자 결정 사항이다.**

---

## 0. 이 문서를 쓰는 이유 — 재조사에서 뒤집힌 전제 1건

1차 보고(구두)에서 "CLAUDE.md의 7일 자동환불 인프라(Toss 결제취소 API)를 재사용하면 될 것"이라고 가정했으나, 코드를 다시 훑어보니 **이 전제는 틀렸다**:

- CLAUDE.md의 "7일 자동환불"은 **구독(subscriptions)이 아니라 대행서비스(delivery_orders) 환불**을 가리킨다. `backend/scheduler/jobs.py`의 `delivery_auto_refund_job`이 Toss 결제취소 API를 인라인 httpx 호출로 직접 처리하며, 공용 함수로 뽑혀있지 않다.
- **구독 환불에 실제로 재사용 가능한 로직은 `backend/routers/settings.py`의 `cancel_subscription`**(사용자 본인 인증 기반, `POST /settings/cancel`)이다. 7일 청약철회 판정 → Toss 환불 → 실패 시 운영자 알림 → 빌링키 삭제 → DB 갱신 → 카카오 알림까지 전체 플로우가 이미 여기 있다.

이 정정 자체가 "오판/누락 철저 조사" 요청의 핵심 산출물이다 — 잘못된 전제로 작업을 시작했다면 3번 항목에서 처음부터 새로 설계했을 것이다.

---

## 1. 우선순위 및 난이도 요약

| # | 항목 | 실재 여부 | 난이도 | 사유 |
|---|------|----------|--------|------|
| 4 | 성공사례(stories) 수정(PATCH) | 공백 확정 | **간단** | 같은 세션에 이미 검증된 FAQ PATCH 패턴 그대로 이식 가능. 금전 무관 |
| 1 | 구독자 목록 검색/필터 UI | 공백 확정 | **보통** | 백엔드 embedded join 함정 회피 필요, 프론트는 간단 |
| 2 | 고객지원용 사업장 조회 화면 | 공백 확정 | **보통** | 조회 전용이라 쓰기 리스크 없음, 신규 화면/엔드포인트 설계 필요 |
| 3 | 관리자 구독 취소/환불 UI | 공백 확정 (전제는 정정됨) | **복잡** | 금전 이동 기능 — 경쟁조건·실패 알림까지 정확히 이식해야 함 |

**권장 착수 순서**: 4 → 1 → 2 → 3 (간단한 것부터, 금전 관련은 마지막·가장 신중하게)

---

## 2. 항목 4 — 성공사례(stories) 수정(PATCH) 추가

### 실재 확인
- `backend/routers/stories.py` 전체 확인 — `GET`(목록/상세) 2개, `POST /admin/stories` 1개뿐. PATCH/DELETE 정의 없음.
- 삭제(DELETE) 미구현은 **의도된 설계**로 이미 확정됨(`frontend/app/admin/stories/page.tsx:432-433` "삭제 기능은 Supabase에서 직접 처리" 안내, `docs/admin_screens_inspection_plan_v1.0.md:227`에 기록) — 이번 작업 범위 아님. **수정(PATCH)만 신규 공백.**
- `success_stories` 테이블(`scripts/supabase_schema.sql`): `id, business_id, delivery_order_id, category, region, title, body, score_before, score_after, score_delta(GENERATED STORED), is_anonymous, display_name, consent_at, published_at, view_count`. `score_delta`는 GENERATED 컬럼이라 직접 업데이트 불가(자동 재계산됨).

### 구현 범위
**백엔드** (`backend/routers/stories.py`):
- `StoryUpdate` Pydantic 모델 신설 (`StoryCreate`의 모든 필드를 Optional로)
- `PATCH /admin/{story_id}` 엔드포인트 추가, `admin_router` + `verify_admin` 재사용
- `faq.py`의 PATCH 패턴("update 후 별도 재조회") 그대로 사용 — `.update(...).eq(...).select(...)` 체이닝 절대 금지(CLAUDE.md 필수 패턴)

**프론트** (`frontend/app/admin/stories/page.tsx`):
- `AdminDashboard.tsx`의 `FAQTab` 인라인 수정 폼 패턴(`editingId`/`editForm` state + `handleEditStart`/`handleEditSave`/`handleEditCancel`)을 그대로 이식
- 폼 필드는 이미 작성 폼(`DEFAULT_FORM`)에 다 있음 — 카테고리·지역·시작전/후 점수·본문·익명여부·표시이름
- 테이블 행(`:333-390`)에 "보기" 옆 "수정" 버튼 추가

**DB 스키마 변경 불필요**

---

## 3. 항목 1 — 구독자 목록 검색/필터 UI 추가

### 실재 확인
- `backend/routers/admin.py:100-112` `list_subscriptions`는 `plan`/`status` 쿼리 파라미터를 이미 받지만, `status` 기본값이 `"active"`라서 **파라미터 없이 호출하면 cancelled/expired/grace_period 구독자는 아예 안 보인다.**
- `frontend/app/admin/AdminDashboard.tsx`는 파라미터 없이 호출 중, 검색창·필터 드롭다운 자체가 없음.
- 이메일 미표시는 `admin.py:111` 주석("이메일은 auth.users 조인이 서비스 롤로만 가능") 때문인데, **이 전제는 낡았다** — `profiles.email` 컬럼이 실제로 존재하고 `kakao_notify.py`·`support.py`에서 이미 조회해 쓰고 있다. 단, `scripts/supabase_schema.sql`에 이 컬럼의 마이그레이션 기록이 없어 **서버 실 DB에 확실히 존재하는지 재검증 필요**(구현 착수 시 1단계).
- ⚠️ **embedded join 함정 주의**: `subscriptions↔profiles` FK가 미등록 상태(2026-07-07 발견된 과거 P0 버그, `jobs.py` 주석 참조)라서 `.select("user_id, profiles(email)")` 같은 embedded join을 쓰면 PGRST200 에러로 API 전체가 죽는다. **반드시 분리 조회 후 dict merge 패턴**(`subscription_lifecycle_job`이 쓰는 패턴) 사용할 것.
- 부수 발견: `admin.py:207` `broadcast_kakao`가 `.select("user_id, profiles(phone)")` embedded join을 그대로 쓰고 있어 **같은 버그를 안고 있을 가능성** — 이번 작업 범위 밖이지만, 항목 1 작업 시 함께 점검 권장(§1.3에서 이미 "curl로 직접 호출 금지"로 제외된 엔드포인트이므로 실사용 전 반드시 확인).

### 구현 범위
**백엔드** (`backend/routers/admin.py`):
1. 서버 DB에서 `profiles.email` 컬럼 실존 여부 확인 (`ssh` + `curl` REST API)
2. `list_subscriptions`의 `status` 파라미터를 옵션(기본값 제거 또는 프론트에서 `all` 명시)으로 변경
3. `user_id` 목록으로 `profiles.select("user_id, email").in_(...)` 분리 조회 후 파이썬에서 merge (embedded join 금지)

**프론트** (`AdminDashboard.tsx`):
- 구독자 목록 테이블 위에 검색 input(이메일) + 플랜·상태 필터 드롭다운 추가
- fetch 시 쿼리스트링 부착

**DB 스키마 변경 불필요** (단, `profiles.email` 실존 여부는 사전 확인 필수)

---

## 4. 항목 2 — 고객지원용 사업장/사용자 조회 화면 추가

### 실재 확인
- `frontend/app/admin/support/[id]/page.tsx`·`AdminSupportClient.tsx` 전체 확인 — 티켓 상세에 `business_id`·사업장명·스캔 결과 등이 전혀 없음. `support_tickets` 테이블 자체가 `user_id`만 갖고 사업장과 직접 연결 안 됨.
- `backend/routers/business.py` 전수 확인 — 모든 사용자 대면 엔드포인트가 `.eq("user_id", x_user_id)`로 소유자만 조회하도록 강제. `_ADMIN_USER_IDS`는 존재하나 쿨다운 스킵 용도로만 쓰이고, 그 안에서도 소유권 검증(`if biz["user_id"] != x_user_id: raise 403`)이 그대로 걸려있어 **admin이 남의 사업장을 볼 수 있는 우회로가 실제로 없다.**
- **신규 발견 — 죽은 엔드포인트**: `admin.py:184-194` `GET /scan-logs`(business명 join 포함)는 **프론트 어디서도 호출되지 않는다**(grep 결과 0건). `docs/admin_screens_inspection_plan_v1.0.md`에도 기록되지 않았던 항목 — 이 엔드포인트를 확장해 재활용하는 것이 가장 저비용 경로.

### 구현 범위
**백엔드**:
- `support.py`의 `admin_get_ticket`에서 `ticket["user_id"]`로 `businesses.select(...).eq("user_id", ...)` 추가 조회 + 최근 `scan_results` 1~2건 join
- 또는 `admin.py`의 `GET /scan-logs`에 `business_id`/`user_id` 필터 파라미터 추가해 재사용 (`verify_admin` 그대로)

**프론트**:
- `AdminSupportDetailPage`에 사업장 정보 카드 섹션 추가, 또는 별도 `/admin/business/[id]` 페이지 신설

**DB 스키마 변경 불필요** (businesses.user_id FK 등록 여부는 재확인 권장 — subscriptions와 달리 정상 등록됐을 가능성 높음)

---

## 5. 항목 3 — 관리자 구독 취소/환불 UI 추가 (금전 이동 — 최우선 신중)

### 실재 확인 (§0의 정정 반영)
- `backend/services/toss_billing.py`에는 `issue_billing_key`/`retry_billing`만 있고 **환불 함수 없음.**
- **진짜 재사용 대상은 `backend/routers/settings.py`의 `cancel_subscription`**(`POST /settings/cancel`): 7일 청약철회 자격 판정(`_check_refund_eligibility`) → Toss 결제취소 API 호출(`first_payment_key` 기준) → 실패 시 `send_operator_alert`+`send_slack_alert` → 빌링키 삭제 → `status="cancelled"` DB 갱신 → 카카오 알림까지 전체 로직 보유.
- `admin.py`/`settings.py`/`webhook.py` 전체 grep — 관리자가 임의 사용자의 구독을 강제 취소/환불하는 엔드포인트는 존재하지 않음.

### 구현 범위 — ⚠️ 단순 이식이 아니라 안전장치까지 통째로 재현해야 함
**백엔드**:
1. `settings.py`의 `cancel_subscription` 로직을 함수로 추출, `Depends(get_current_user)` 고정 대신 `user_id: str` 파라미터를 받도록 리팩터링
2. `admin.py`에 `POST /admin/subscriptions/{user_id}/cancel` 신설 (`verify_admin` 재사용), 위 함수 호출
3. **반드시 이식해야 할 안전장치** — 이걸 빠뜨리면 §"에이전트 수정 권장 → 구현 전 필수 절차"의 재발 사례가 됨:
   - 경쟁조건 방어 로직 (settings.py 원본 참조)
   - DB 갱신 실패 시 운영자 알림(`send_operator_alert`+`send_slack_alert`)
   - 7일 이내/이후 분기 (7일 밖이면 환불 없이 상태만 변경, 안이면 Toss 환불까지)

**프론트**:
- 구독자 목록(항목 1과 연계)에 "구독 취소" 버튼 + 확인 모달(되돌릴 수 없는 금전 이동이므로 실수 클릭 방지용 2단계 확인 권장)

**DB 스키마 변경 불필요** (`first_payment_key`, `first_payment_amount`, `billing_key` 모두 이미 존재)

**착수 전 필수**: CLAUDE.md "코드 수정 요청 시 필수 절차" Step 1(md5 확인) + "P0/P1 수정 구현 전 필수 3단계"(호출처 전체 확인·반증 케이스 확인) 그대로 적용. 실제 결제가 걸린 기능이므로 구현 후 반드시 실제 테스트 결제(소액)로 라이브 재현 검증할 것 — 코드 리뷰만으로 끝내지 말 것(§0 교훈).

---

## 6. 부수 발견 — 이번 조사에서 새로 나온 것 (4건 범위 밖, 참고용)

1. **`GET /admin/scan-logs`가 완전히 죽은 엔드포인트**임을 신규 확인(프론트 호출처 0건). 항목 2 구현 시 재활용 권장, 그렇지 않으면 존재 자체가 혼란 요소.
2. **`admin.py`의 `broadcast_kakao`가 embedded join(`profiles(phone)`) 패턴을 쓰고 있어, 항목 1에서 발견한 것과 동일 클래스의 PGRST200 버그를 안고 있을 가능성.** `/broadcast`는 §1.3에서 "curl로 직접 호출해 점검하지 말 것"으로 이미 제외된 엔드포인트이지만, 실사용(진짜 전체 발송) 전에는 반드시 이 embedded join부터 분리 조회로 고쳐야 함 — 그렇지 않으면 발송 시도 자체가 500으로 실패할 수 있음.

---

## 7. 새 대화창 트리거

> `docs/admin_functional_gaps_implementation_plan_v1.0.md 기준으로 항목 4(성공사례 수정 기능)부터 구현 시작`

부분 트리거:
- 전체 순서대로: `...기준으로 §1 우선순위대로 4→1→2→3 순서로 구현 진행`
- 특정 항목만: `...기준으로 항목 3(구독 환불)만 구현` (단, §5의 안전장치 이식 경고 반드시 준수)
