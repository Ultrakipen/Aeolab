# 관리자 화면 전체 점검 계획 v1.0

> 2026-07-10 작성. 사용자 대면 6개 페이지(대행서비스/ai-info-tab/chatgpt-search/how-it-works/support/support-tickets) 실측 재현 점검 세션에서 이어지는 관리자(`/admin/*`) 화면 점검 계획.

---

## 0. 이 문서가 필요한 이유 — 지난 세션의 교훈

직전 세션에서 사용자 대면 6개 페이지를 정적 코드리뷰만으로 "완료"라고 보고했으나, 실제로 로그인해서 버튼을 눌러보니 **대행서비스 신청·1:1 문의 등록 전체가 500 에러로 완전히 다운되어 있었다** (`supabase.table(...).insert(payload).select(...)` 체이닝이 현재 supabase-py 버전에서 `AttributeError`를 던지는 패턴, 6곳). 정적 리뷰·타입체크·문법검사 전부 통과했지만 실제 API 호출 전까지는 드러나지 않았다.

**관리자 화면은 이 세션에서 전혀 검증하지 않은 영역이고, 이미 `admin_answer_inquiry`(문의 답변 등록)에서 동일한 체이닝 버그를 코드 검토만으로 1건 선제 발견·수정했다** — 관리자 화면 전반에 같은 클래스의 버그가 남아있을 가능성을 낮게 볼 근거가 없다. 이 문서는 그 재현 방법론을 관리자 화면에 그대로 적용하기 위한 계획서다.

**원칙**: 코드 읽고 "괜찮아 보인다"로 끝내지 말 것. 관리자 계정으로 실제 로그인해서, 실제 데이터를 만들고, 실제 버튼을 눌러서, 콘솔 에러 0건과 DB 반영을 직접 확인할 것. 테스트 데이터는 검증 후 정리할 것.

---

## 1. 관리자 화면 전체 인벤토리 (실제 코드 기준, 2026-07-10 확인)

> ⚠️ **재검증에서 발견한 구조적 문제 (§1.1 표 작성 후 추가 확인)**: `/admin`(`AdminDashboard.tsx`)은 단순 통계 대시보드가 아니라 **탭 기반 SPA**로, 대시보드 외에 `NoticesTab`(공지사항 CRUD)·`FAQTab`(FAQ CRUD)·`InquiryTab`(구 문의시스템 답변 — `admin_answer_inquiry` 실제 호출부, 이미 수정한 버그의 진짜 진입점)이 **내장**되어 있다. 그런데 `/admin/notices`라는 **독립 라우트도 별도로 존재**해서 같은 공지사항 기능을 중복 구현하고 있는 것으로 보인다(둘 다 `api/notices`를 호출). 어느 쪽이 실제 사용되는 canonical 경로이고 어느 쪽이 레거시 잔재인지 코드만으로는 판단 불가 — §4 점검 시 실제 로그인해서 확인할 것. (2026-05-03 "root flat 잔재 파일" 사고 — 서버에 같은 이름의 파일이 여러 경로에 동시 존재해 어느 쪽이 진짜인지 혼동했던 전례와 동일한 클래스의 위험.)

### 1.1 프론트엔드 페이지 (`frontend/app/admin/`)

| 경로 | 파일 | 추정 기능 |
|---|---|---|
| `/admin` | `page.tsx`, `AdminDashboard.tsx` | 탭형 SPA — **대시보드**(통계·구독·매출) + **공지사항**(NoticesTab, `/admin/notices`와 중복 의심) + **FAQ**(FAQTab, 신규 발견·인벤토리 누락됐던 기능) + **문의**(InquiryTab, 구 inquiries 시스템 답변 등록 — 이미 수정한 체이닝 버그의 실제 진입점) |
| `/admin/delivery` | `page.tsx` | 대행서비스 의뢰 목록 |
| `/admin/delivery/[id]` | `page.tsx`, `AdminDeliveryDetailClient.tsx` | 의뢰 상세 — 상태변경·메시지·완료처리·자료업로드 |
| `/admin/support` | `page.tsx` | 1:1 문의 티켓 목록 |
| `/admin/support/[id]` | `page.tsx`, `AdminSupportClient.tsx` | 티켓 상세 — 답글·공개여부·상태변경 |
| `/admin/notices` | `page.tsx`, `AdminNoticesClient.tsx` | 공지사항 작성·수정·삭제 |
| `/admin/stories` | `page.tsx` | 성공사례(고객 후기) 등록 |
| `/admin/feedback` | `page.tsx`, `AdminFeedbackClient.tsx` | 만족도 피드백 집계 조회 |
| `/admin/comms` | `page.tsx`, `AdminCommsClient.tsx` | **정정**: 브로드캐스트 발송 아님 — "컨텍스트 팁"(`tips.py`) + "인앱 메시지"(`messages.py`) 콘텐츠 CRUD 관리 탭 2개. 카카오 발송과 무관(실제 코드 확인: `proxyGet("api/tips/admin/list")`, `proxyGet("api/messages")`) |
| `/admin/score-comparison` | `page.tsx`, `AdminScoreComparisonClient.tsx` | 점수 모델 비교 도구 |

### 1.2 백엔드 admin 엔드포인트 대응표

| 프론트 페이지 | 백엔드 파일 | 주요 엔드포인트 |
|---|---|---|
| `/admin` | `routers/admin.py` | `GET /stats`, `/subscriptions`, `/revenue`, `/category-distribution`, `/scan-logs`, `/score-comparison`, `/dia-stats`, `GET /email-preview/{type}`, `POST /email-test-send` |
| `/admin/delivery/*` | `routers/delivery.py` `admin_router` | `GET /{order_id}`, `/{order_id}/messages`, `POST /{order_id}/status`, `/{order_id}/messages`, `/{order_id}/complete`, `/{order_id}/materials` |
| `/admin/support/*` | `routers/support.py` `admin_router` | `GET /tickets`, `/{ticket_id}`, `POST /{ticket_id}/reply`, `PATCH /{ticket_id}/visibility`, `/{ticket_id}/status` |
| `/admin/comms` | `routers/tips.py`, `routers/messages.py` | tips: `GET /admin/list`, `POST ""`, `PATCH /{id}`, `DELETE /{id}` · messages: `GET ""`, `POST ""`, `PATCH /{id}`, `DELETE /{id}` |
| `/admin`의 **문의 탭**(`InquiryTab`) | `routers/inquiry.py` | `GET /admin/list`, `PATCH /admin/{id}/answer` — **이미 체이닝 버그 발견·수정 완료(git e1f4c21)**. 재검증에서 실제 진입점(`AdminDashboard.tsx` 내장 탭) 확인함 |
| `/admin`의 **FAQ 탭**(`FAQTab`) | `routers/faq.py` | `GET ""`(공개), `POST ""`, `PATCH /{id}`, `DELETE /{id}`(관리자) — §1.1 재검증에서 신규 발견, 최초 인벤토리에서 누락됐던 기능 |
| `/admin/notices` **및/또는** `/admin`의 **공지사항 탭**(`NoticesTab`, 중복 의심) | `routers/notices.py` | `POST ""`, `PATCH /{id}`, `DELETE /{id}` |
| `/admin/stories` | `routers/stories.py` `admin_router` | `POST ""` |
| `/admin/feedback` | `routers/feedback.py` | `GET /summary` |

### 1.3 프론트 UI가 아예 없는 API 전용 관리 기능 (2026-07-10 재검증에서 신규 발견)

문서 초안 작성 시 §1.1/§1.2만 보고 "관리자 화면 = `/admin/*` 10페이지"로 단정했으나, 실제로 `frontend/app/admin/` 전체를 grep한 결과 아래 두 기능은 **호출하는 프론트 코드가 전혀 없다** — Swagger(`/docs`, production에서는 비활성) 또는 curl로만 호출 가능한 상태:

| 백엔드 | 엔드포인트 | 위험도 | 비고 |
|---|---|---|---|
| `routers/admin.py` | `POST /broadcast` — 전체 활성 구독자에게 카카오 알림톡 즉시 발송 (`profiles.phone` 기준, dry-run 없음) | 🔴 실사용 시 즉시 실비용 발생 + 되돌릴 수 없음 | 프론트 어디에도 연결 안 됨. `/admin/comms`와 이름이 비슷해 혼동하기 쉬우나 완전히 별개(§1.1 정정 참조) |
| `routers/system_status.py` | `POST /status/{key}` — 유지보수 모드 등 시스템 상태 토글 | 🟡 `admin_auth.py` 주석에 과거 P0 사고 이력 명시("2026-05-20 인증 미적용으로 누구나 토글 가능했던 사고") — 현재는 `verify_admin` 정상 적용 확인함 | 프론트 UI 없음. 현재 이 기능을 실제로 쓰는 방법이 curl 뿐인지, 아니면 의도적으로 미노출인지 사용자 확인 필요 |

**이 문서의 §4 점검 대상에서는 제외** — 프론트 화면이 없어 "실측 재현" 자체가 불가능하고, 특히 `/broadcast`는 실제로 발송해버리면 되돌릴 수 없으므로 점검 목적으로 호출하면 안 됨. 존재만 기록해두고, 향후 프론트 UI를 만들 계획이 있는지 별도로 사용자에게 확인할 것.

---

## 2. 인증 구조 — CLAUDE.md 기재 내용 정정 필요

CLAUDE.md "남은 작업" 절에 `NEXT_PUBLIC_ADMIN_SECRET_KEY 향후 서버 컴포넌트로 분리 권장`이라고 적혀 있으나, **실제 코드 확인 결과 이미 해결되어 있다 (outdated 항목)**:

- `frontend/app/api/admin-auth/route.ts` — Supabase 세션에서 `user.email`이 `ADMIN_EMAILS` 화이트리스트에 있는지 서버사이드에서 검증 후에만 키 반환
- `frontend/app/api/admin-proxy/route.ts` — 클라이언트가 백엔드 admin API를 직접 호출하지 않고 이 프록시를 경유. `X-Admin-Key` 헤더는 **서버사이드에서만** 붙여서 백엔드로 전달. 주석에 `[C-01 fix] Supabase 세션 기반 관리자 인증 추가 — ADMIN_SECRET_KEY 유출 시 이중 방어`라고 명시되어 있어 이미 한 차례 보안 수정이 이루어진 이력이 있음
- `NEXT_PUBLIC_` 접두사 사용처는 프론트엔드 전체에 0건(grep 확인) — 클라이언트 번들에 키 노출 없음

**결론**: 이중 인증(Supabase 세션 + ADMIN_EMAILS 화이트리스트 → 서버 프록시가 ADMIN_SECRET_KEY 부착) 구조가 이미 견고하게 구현되어 있다. 이 문서의 점검 항목이 아니다. **CLAUDE.md "남은 작업" 절에서 이 항목을 제거할 것** (이 점검 실행 시 함께 정리 권장).

**실측 재현에 필요한 것**: 서버 `.env`의 `ADMIN_EMAILS`에 등록된 이메일로 Supabase 로그인한 세션. 사용자에게 해당 계정 로그인 정보를 요청할 것.

---

## 3. 이미 검증된 것 — 재점검 불필요

지난 세션에서 백엔드 전체(`backend/` 전체 디렉토리)를 대상으로 아래 패턴을 grep 전수 검사했다. **admin 관련 파일 포함 이미 확인 완료**이므로 이 문서의 점검에서 다시 찾을 필요 없다:

| 패턴 | 결과 |
|---|---|
| `.insert(...).select(...)` 체이닝 (supabase-py에서 `AttributeError`) | `delivery.py`(3곳)·`support.py`(3곳)·`inquiry.py`(1곳) 전수 발견·수정·배포·재검증 완료. `admin.py`/`notices.py`/`stories.py`/`feedback.py`/`faq.py`/`services/faq_seed.py`는 이 패턴 없음 확인(2026-07-10 grep) |
| `.update(...).eq(...).select(...)` 체이닝 | 동일 확인 완료, `inquiry.py`의 `admin_answer_inquiry` 1건만 해당해 수정함. `competitor.py`/`notices.py`/`faq.py`의 유사 코드는 update 완료 후 **별도의 새 쿼리**로 재조회하는 정상 패턴임을 코드로 직접 확인함 |

이 문서의 점검은 **위 정적 검사로 잡히지 않는 것** — 런타임에만 드러나는 문제(스키마 컬럼 누락, 권한 로직 오류, 프론트-백엔드 데이터 형식 불일치, UI 논리 모순)에 집중한다.

---

## 4. 페이지별 점검 체크리스트

각 페이지마다 다음을 확인:
1. **실제 로그인 후 화면 진입** — 콘솔 에러 0건, 데이터 정상 표시
2. **핵심 쓰기 액션 실제 실행** — 버튼 클릭 → API 호출 → DB 반영 → 화면 갱신까지 전부
3. **사용자 화면과의 정합성** — 관리자가 한 행동(답변 등록, 상태 변경)이 실제로 사용자 화면에 반영되는지 교차 확인
4. **PC + 모바일** — 관리자도 모바일에서 접속할 가능성 고려(급한 답변 등)

### P0 — 실제 돈·고객 응대가 걸린 것 (최우선)

| 페이지 | 확인할 액션 | 교차 검증 |
|---|---|---|
| `/admin/delivery/[id]` | 상태변경(POST /status), 메시지 전송(POST /messages), 완료처리(POST /complete), 자료업로드(POST /materials) | 사용자 쪽 `/delivery/orders/[id]`에서 상태·메시지·완료보고서가 실제로 보이는지 |
| `/admin/support/[id]` | 답글 등록(POST /reply), 공개여부 변경(PATCH /visibility), 상태변경(PATCH /status) | 사용자 쪽 `/support/tickets/[id]`에서 답글·공개상태가 실제로 반영되는지. **특히 visibility를 public으로 바꿨을 때 다른 사용자에게도 노출되는지**(권한 로직 — RLS `public_answered_tickets` 정책과 실제 연동 확인) |
| `/admin`의 **문의 탭**(`InquiryTab`) | 답변 등록(PATCH /admin/{id}/answer) — 이미 코드 수정한 체이닝 버그의 실제 라이브 재현 확인(가장 우선순위 높음, 아직 실제 클릭으로 검증 안 됨) | 답변 등록 후 오류 없이 목록에 "답변완료" 상태로 반영되는지 |

### P1 — 통계 정확성 + 구조 정리 (돈은 안 걸렸지만 운영 의사결정·유지보수에 직결)

| 페이지 | 확인할 것 |
|---|---|
| `/admin` 대시보드 | `/stats`·`/subscriptions`·`/revenue` 숫자가 실제 DB 값과 일치하는지 — 특히 지난 세션에서 발견한 `end_at` 날짜-자정-파싱 오프셋 버그가 구독 만료일 집계에도 영향 주는지 확인 |
| `/admin/score-comparison` | v3.0/v3.1 등 점수 모델 버전 비교가 CLAUDE.md에 기재된 라이브 버전(`SCORE_MODEL_VERSION=v3_1`)과 일치하는 데이터를 보여주는지 |
| **`/admin` 내장 탭 vs 독립 페이지 이원화** | `NoticesTab`(`/admin` 내장)과 `/admin/notices`(독립 라우트)가 정말 중복인지, 실제 관리자가 어느 쪽을 쓰는지 사용자에게 확인. 중복이 맞다면 죽은 쪽 제거해서 "어느 화면에서 고친 게 실제로 반영되는지 헷갈리는" 혼란 방지 |

### P2 — 컨텐츠 관리 (노출 전 검수 가능해 상대적으로 안전)

| 페이지 | 확인할 것 |
|---|---|
| `/admin/notices` (+ 내장 NoticesTab) | 작성(POST) → 사용자 쪽 공지 노출 확인 → 수정(PATCH) → 삭제(DELETE) 전체 CRUD 사이클. 두 진입점 모두 같은 데이터를 다루는지 |
| `/admin`의 **FAQ 탭**(`FAQTab`) | 작성·수정·삭제 → 사용자 쪽 `/faq`·`/support`(FAQ 아코디언)에 실제 반영되는지. 최초 인벤토리에서 누락됐던 기능이라 존재 자체를 사용자에게 먼저 확인 |
| `/admin/stories` | 성공사례 등록 → `/stories`(공개 페이지)에 실제 노출되는지, `is_anonymous`·`display_name` 처리 정상인지 |
| `/admin/feedback` | 집계 수치가 실제 `user_feedback` 테이블 데이터와 일치하는지 |
| `/admin/comms` | (§1.1 정정) 카카오 발송 아님 — 컨텍스트 팁·인앱 메시지 CRUD가 실제로 사용자 대시보드에 노출/비노출(`is_active` 토글) 반영되는지 확인. 발송 관련 리스크 없음, 안전하게 테스트 가능 |

---

## 5. 표준 실측 재현 절차 (지난 세션에서 확립됨)

1. **로그인 전** — 대상 파일 서버-로컬 md5 사전확인(drift 없는지)
2. **실제 로그인** — ADMIN_EMAILS 등록 계정으로 Supabase 로그인 (Playwright)
3. **실제 액션 수행** — 폼 작성 → 제출 → `browser_console_messages`로 에러 0건 확인
4. **DB 직접 대조** — Supabase REST API로 실제 반영값 확인(서비스 롤 키, SSH 경유)
5. **버그 발견 시** — 코드 수정 → 문법검사(`ast.parse`/`tsc --noEmit`) → md5 확인 후 배포 → pm2 재시작 → 에러로그 확인 → 재현 테스트로 재검증
6. **정리** — 테스트로 만든 데이터는 REST API로 삭제(공개 노출되는 stories/notices는 특히 확실히 정리)
7. **git 커밋** — 서버 배포 완료 후 로컬 커밋(push는 사용자 확인 후)

---

## 6. 진행 순서 제안

새 대화창에서 이 문서 기준으로 재개할 때 트리거 문구 예:

> `docs/admin_screens_inspection_plan_v1.0.md 기준으로 관리자 화면 점검 진행. §4 P0부터 시작`

P0(대행서비스·문의답변 처리) → P1(통계 정확성 + 탭 이원화 정리) → P2(공지·FAQ·후기·피드백·comms 콘텐츠관리) 순으로 진행 권장. `/admin/comms`는 카카오 발송과 무관해 안전하게 진행 가능(§1.1 정정). 실제 발송 리스크가 있는 건 §1.3의 `POST /broadcast`뿐이며 이건 프론트 UI가 없어 이 점검 대상에서 제외됨 — 절대 curl로 직접 호출해 점검하지 말 것.
