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

**실측 재현에 필요한 것**: 서버 `.env`의 `ADMIN_EMAILS`에 등록된 이메일로 Supabase 로그인한 세션. 계정 목록은 `docs/.admin_credentials.local`(git 추적 제외, `.gitignore` 등록됨 — 비밀번호 등 민감정보는 이 파일에만 기록) 참조. 화이트리스트 이메일 자체(`hoozsay@gmail.com`, `hoozdev@gmail.com`)는 서버 `.env`에도 있는 비민감 정보.

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

> `docs/admin_screens_inspection_plan_v1.0.md 기준으로 관리자 화면 점검 진행. §4 P1부터 시작`

P0(대행서비스·문의답변 처리) → P1(통계 정확성 + 탭 이원화 정리) → P2(공지·FAQ·후기·피드백·comms 콘텐츠관리) 순으로 진행 권장. `/admin/comms`는 카카오 발송과 무관해 안전하게 진행 가능(§1.1 정정). 실제 발송 리스크가 있는 건 §1.3의 `POST /broadcast`뿐이며 이건 프론트 UI가 없어 이 점검 대상에서 제외됨 — 절대 curl로 직접 호출해 점검하지 말 것.

---

## 7. P0 실측 재현 완료 (2026-07-10, git `27ddf98`)

> 재점검(오판 0건 확인) 후 실제 admin 계정으로 로그인해 브라우저 조작으로 P0 전체 실측 재현. 정적 코드리뷰만으로는 절대 못 잡는 4건의 실제 라이브 버그를 이 세션에서 처음 발견·수정·검증함 — §0의 교훈("코드 읽고 괜찮아 보인다로 끝내지 말 것")이 이번에도 그대로 재현됨.

### 신규 발견 + 수정 완료 (4건)

| # | 위치 | 증상 | 근본 원인 | 상태 |
|---|------|------|----------|------|
| 1 | `delivery.py admin_create_message` | 운영자 메시지 전송 **100% 500 에러** | `delivery_messages.sender_id`는 `NOT NULL UUID`인데 문자열 `"admin"` 삽입 → Postgres `22P02` | ✅ sentinel UUID로 수정 |
| 2 | `support.py admin_reply_ticket` | 관리자 답글 등록 **100% 500 에러** | 동일 클래스: `support_replies.author_id`에 문자열 `"system"` 삽입 | ✅ sentinel UUID로 수정 |
| 3 | `AdminSupportClient.tsx` 답글 스레드 | 운영자 답글도 항상 "사용자"로 표시 | 존재하지 않는 `sender_type` 참조(실제 필드명 `author_type`) | ✅ 필드명 수정 |
| 4 | `admin/support/[id]` 공개설정 토글 | 상태 표시 항상 "공개 중" 고정 + 토글 클릭 시 **100% 422 에러** | 존재하지 않는 `is_public` boolean 참조(실제는 `visibility` 문자열 "public"/"private") | ✅ 필드명+타입 수정 |

### 부수 발견 — ADMIN_EMAILS 하드코딩 (6개 페이지, 이 문서 §2 조사 범위 밖에서 발견)

`/admin`, `/admin/delivery`, `/admin/delivery/[id]`, `/admin/support`, `/admin/support/[id]`, `/admin/score-comparison` **6개 page.tsx**가 `ADMIN_EMAILS = ["hoozdev@gmail.com"]`로 하드코딩되어 있어, 서버 `.env`의 실제 화이트리스트(`hoozsay@gmail.com,hoozdev@gmail.com`) 중 `hoozsay@gmail.com`은 이 6개 페이지에서 전부 차단당하는 상태였음(`/admin`은 빈 화면, 나머지는 "접근 권한이 없습니다"). 이 세션의 테스트 계정이 우연히 `hoozdev@gmail.com`이라 최초엔 안 보였다가, admin-proxy 등 다른 파일과 대조하며 발견함. `admin/notices/page.tsx`·`admin/feedback/page.tsx`가 이미 쓰던 env 기반 패턴으로 6개 파일 전부 통일.

### 검증 방법 (그대로 재사용 가능한 패턴)

1. 실제 DB에 테스트 데이터 직접 INSERT(Supabase REST, service role key) — 결제 플로우 없이도 관리자 액션 테스트 가능
2. Playwright로 실제 로그인 세션에서 버튼 클릭 → `browser_console_messages(level: "error")`로 즉시 확인
3. 500/422 재현 시 서버 `pm2 logs aeolab-backend --err`로 실제 스택트레이스 확인(추측 금지)
4. 수정 후 **같은 재현 스텝을 다시 실행**해 실제로 고쳐졌는지 확인(코드만 보고 "맞다" 판단 금지)
5. 테스트 데이터는 전부 REST DELETE로 정리

### 남은 것

P1(통계 정확성 + `NoticesTab` vs `/admin/notices` 탭 이원화 정리) · P2(공지·FAQ·후기·피드백·comms) — 이 세션에서 미착수. 별도로 `notices` 테이블 `severity`/`target_segment`/`cta_label`/`cta_url` 필드 소실 버그도 같은 세션에서 발견·수정 완료(git `2fe3df9`, 이 문서 범위 밖이지만 연관 발견).

---

## 8. P1 실측 재현 완료 (2026-07-10, git `332af48`~`270df92`)

> 정적 코드리뷰만으로는 못 잡는 런타임 크래시를 실제 로그인 후 브라우저 콘솔 확인으로 발견 — §0 교훈이 P1에서도 재현됨.

### 신규 발견 + 수정 완료 (3건)

| # | 위치 | 증상 | 근본 원인 | 상태 |
|---|------|------|----------|------|
| 1 | `/admin/score-comparison` | **페이지 진입 시 100% 크래시**(`Cannot read properties of undefined (reading 'diff_avg')`) | 프론트가 `data.groups["active"\|"likely"\|"inactive"\|"franchise"]`(소문자+존재하지 않는 franchise)로 접근하는데 백엔드는 `"ACTIVE"\|"LIKELY"\|"INACTIVE"`(대문자, franchise 키 없음) 반환. 실제 curl로 백엔드 응답 확인 후 확정 | ✅ 키 대소문자 통일 + franchise 제거 + `count:0` null 안전 가드 |
| 2 | `/admin/score-comparison` "v3.1 활성화 1-click 명령" | 서버가 이미 수 주 전 `SCORE_MODEL_VERSION=v3_1` 전환 완료(2026-07-06 확인)인데도 "아직 비활성"인 것처럼 활성화 명령을 노출하는 죽은 UI. `calc_shadow_v3_1()`이 라이브 경로와 동일한 `calc_track1_score_v3_1()`을 호출해 v30/v31 비교값이 사실상 동일 포뮬러 비교(실측 데이터 31건 중 28건 diff=0)임도 확인 | 코드 추적(`score_engine.py:915-918` vs `:1443`)으로 확정, 사용자 확인 후 처리 방향 결정 | ✅ 활성화 CTA 제거 → "이미 라이브 적용 중" 안내 배너로 교체 |
| 3 | `/admin` 내장 `NoticesTab` vs `/admin/notices` | 같은 `api/notices`를 다루는 중복 구현. 내장 탭은 `severity`/`target_segment`/`cta_label`/`cta_url` 필드가 아예 없어 이 탭으로 작성 시 필드 소실(git `2fe3df9`가 고친 문제가 이 탭에서는 재발 가능) | 실제 `notices` 테이블 조회 결과 두 화면 다 사용 이력 없음(seed 데이터만 존재) → 완전성 기준으로 `/admin/notices`를 canonical로 판단(사용자 확인) | ✅ 내장 탭 제거, 상단 "공지사항 관리 →" 링크만 유지 |

### 확인 완료, 문제 없음

- `/admin` 대시보드 `/stats`·`/subscriptions`·`/revenue` — Supabase REST 직접 조회로 5개 구독 전부 대조, MRR 181,500원·플랜별 분포·월별 매출 전부 코드 로직대로 정확히 일치. `end_at` 자정-파싱 오프셋 버그(기존에 별도 수정됨)는 이 통계 집계 경로에 영향 없음(상태 필드만 사용, end_at 비교 없음)

### 검증 방법

1. 실제 로그인 세션으로 Playwright 브라우저 콘솔 에러 확인 → 크래시 최초 포착
2. 서버 SSH로 `curl -H 'X-Admin-Key: ...'`로 백엔드 원본 JSON 응답 직접 확인 → 키 불일치 확정
3. 코드 추적으로 `calc_shadow_v3_1`과 라이브 `calculate_score` 경로가 동일 함수 호출함을 확인
4. Supabase REST로 `subscriptions`·`notices` 테이블 직접 조회해 화면 표시값과 대조
5. 수정 후 md5 확인 → scp 배포 → `npm run build` → `pm2 restart` → 에러로그 확인 → 같은 재현 스텝으로 재검증(크래시 소멸, 콘솔 에러 0건)
6. git 커밋 3건(`332af48` 크래시 수정, `e702cc8` CTA→배너, `270df92` NoticesTab 제거)

### 남은 것

P2(공지·FAQ·후기·피드백·comms 콘텐츠관리) — 미착수.

---

## 9. P2 실측 재현 완료 (2026-07-10, git `1857415`~`103e072`)

> P1 완료 보고 직후 재검증 과정에서 §4 체크리스트에 없던 **"실제 사용자 화면 노출까지 확인"** 단계를 추가로 밟다가, 정적 리뷰로는 절대 못 잡는 심각한 버그 3건을 신규 발견함. §0 교훈("코드 읽고 괜찮아 보인다로 끝내지 말 것")이 P1 재검증과 P2 양쪽에서 또 재현됨.

### 재검증 중 신규 발견 (P1 범위 밖, 우연히 발견)

| # | 위치 | 증상 | 근본 원인 | 상태 |
|---|------|------|----------|------|
| 1 | `/notices/[id]` (사용자 전체) | 공지 목록의 **모든 상세 링크가 100% 404**(신규 공지·기존 공지 id=2 포함, 이 세션 이전부터 존재) | Next.js 16에서 동적 라우트 `params`가 Promise로 변경됐는데 이 파일만 구버전 동기식 타입(`params.id` 직접 접근) 사용 → 항상 `undefined` → 백엔드 `/api/notices/undefined` 404 → `notFound()` | ✅ 다른 `[id]` 라우트와 동일한 `Promise<{id}>` + `await` 패턴으로 통일 |

### P2 체크리스트 진행 결과

| 페이지 | 확인 내용 | 결과 |
|---|---|---|
| `/admin/notices` | 작성(POST)→사용자 `/notices` 노출→수정(PATCH)→삭제(DELETE) 전체 CRUD 사이클 실측 | ✅ 전부 정상. PATCH 테스트 중 위 notices/[id] 404 버그 발견 |
| `/admin`의 **FAQ 탭** | 작성·삭제 실측 + 콘텐츠 정확성 대조 | 🔴 **15개 FAQ 중 10개가 2026-04-02 런칭일 seed 데이터 그대로 방치** — 요금제 가격 오류(창업패키지 16,900원→실제 12,900원, Pro 22,900원→실제 18,900원, `backend/config/prices.py` 대조), 폐기된 AI 플랫폼 언급(Perplexity·Grok·Claude 스캐너 — CLAUDE.md "제거됨" 목록), 스캔 주기 오류("Pro·Biz 매일"→실제 월·수·금 3회, `jobs.py:329` 대조), 폐기된 Q&A탭 등록 안내(2026-05-01 폐기, 소개글 방식으로 대체됨) — **공개 `/support` 페이지에 실사용자 노출 중이던 상태**. PATCH API로 10건 전부 수정+라이브 재검증 완료 |
| `/admin`의 **FAQ 탭 수정 기능 부재** | 최초 인벤토리에서 "작성·수정·삭제" 지원한다고 가정했으나 실제론 **수정(PATCH) 버튼이 아예 없어** 위 콘텐츠 오류를 고치려면 API 직접 호출이 유일한 방법이었음 | ✅ `NoticesClient`와 동일한 인라인 수정 폼 패턴 신규 추가 (`AdminDashboard.tsx`) |
| `/admin/stories` | 성공사례 등록→`/stories` 공개 노출 확인, `score_before`/`score_after` 필드가 "점수 텍스트 전용 원칙" 위반 아닌지 확인 | ✅ 정상 노출 확인. `getScoreTextLabel()`로 텍스트 변환 후 표시해 원칙 준수 확인(반증 통과). 삭제는 UI에 의도적으로 없음(백엔드에 DELETE 엔드포인트 자체가 없음, "Supabase에서 직접 처리" 안내가 정확) |
| `/admin/feedback` | 집계 수치가 `user_feedback` 테이블과 일치하는지 | ✅ 일치(둘 다 0건 — "아직 데이터 없음" 정상 표시) |
| `/admin/comms` — 시스템 상태 탭 | 3개 토글(점검모드·AI탭 스캐너·스캔상태)이 실제 DB 값 반영하는지 | 🔴 **AI탭 스캐너 토글이 항상 "OFF"로 오표시** — 실제 DB(`system_status.ai_tab_enabled`)는 `true`(2026-05-20 수동 활성화)였으나 `GET /api/system/status` 응답에 이 필드가 아예 없어 프론트가 `?? false`로 항상 OFF 렌더링. CLAUDE.md의 "AI탭 스캐너 활성 운영 중" 기재와 실측 DB는 일치했고, **버그는 이 admin 화면의 표시 로직에만 있었음**(다른 곳 문서·코드는 정상) | ✅ 응답에 `ai_tab_enabled` 필드 추가, 라이브 재검증(OFF→ON 정상 표시) |
| `/admin/comms` — 컨텍스트 팁 탭 | CRUD + `is_active` 토글이 사용자 대시보드 노출/비노출 반영되는지 | ✅ 정상. 토글 클릭→즉시 배지 반영, `GET /api/tips`(사용자용)가 `is_active=True` 필터링 확인 |
| `/admin/comms` — 인앱 메시지 탭 | 목록 로드 + `is_active` 필터링 구조 | ✅ 정상. `GET /api/messages`도 동일 `is_active` 필터링 패턴 확인 |
| `/admin` 대시보드 | (P1에서 이미 검증 완료 — 재확인 불필요) | — |

### 검증 방법 재사용 패턴

1. 실제 테스트 데이터 생성(공지·FAQ 확인용 성공사례) → 사용자 화면 즉시 대조 → 삭제로 정리
2. 콘텐츠 정확성은 **코드 단일 소스**(`prices.py`·`jobs.py` cron·CLAUDE.md "제거됨" 목록)와 직접 대조 — 근거 없이 "이상해 보인다"로 단정 안 함
3. UI가 "괜찮아 보이는" 값(OFF)을 표시해도 **반드시 실제 DB 값과 대조** — 이번 세션 최대 교훈(§0 반복 재현)
4. 수정 후 같은 재현 스텝(라이브 클릭·API 응답 확인)으로 재검증, 콘솔 에러 0건 확인
5. FAQ 콘텐츠 수정은 admin UI에 PATCH 버튼이 없어 API 직접 호출로 우회 → 이후 UI에 수정 버튼 신규 구현으로 재발 방지

### 이 점검 시리즈 완료

P0(§7)·P1(§8)·P2(§9) 전부 완료. git `27ddf98`(P0) → `332af48`~`27b9883`(P1) → `1857415`~`103e072`(P2). §1.3의 `/broadcast`(카카오 전체발송)·`system_status.py POST`(이미 인증 정상 확인됨, §2)는 프론트 UI가 없어 이 점검 대상에서 계속 제외.

---

## 10. 사후 재검증 — 오판/누락 점검 + 기능 완비성 + 전 화면 모바일 실측 (2026-07-10, git `5424329`)

> 사용자 요청: "오판과 누락은 없었으며 관리자 관련 기능이 필요한 기능들로 구현되었는지? 모바일/PC에서 최적화 되어 나타나는지?" 세 가지를 모두 재검증.

### 10.1 오판 방지 재검증 — 통과

score-comparison 라이브 API·FAQ 가격 API·시스템 상태 API 3건을 curl로 재조회해 §8·§9에서 보고한 수정 내용이 여전히 유효함을 확인. 추가로 `days=7` 필터가 실제로 `count:0`(INACTIVE 그룹 데이터 없음) 케이스를 만들어냄을 발견 — §8에서 추가한 null 안전 가드(`GroupCard`의 `count===0` 조기 반환)가 실제 프로덕션 데이터로 검증된 것도 확인.

### 10.2 기능 완비성 — 대부분 충족, 낮은 우선순위 공백 4건 발견(버그 아님)

각 화면의 CRUD·필터가 실제 운영에 필요한 수준으로 구현되어 있는지 반증 기반으로 점검. `/admin/delivery`·`/admin/support`는 상태별 필터 탭 보유, `/admin` FAQ·문의·공지사항은 전체 CRUD 보유(FAQ 수정 기능은 이번 세션에 신규 추가). 아래는 "버그"가 아니라 "아직 구현되지 않은 편의 기능" — 현재 구독자 5명(BEP 목표 20명) 규모에서는 필수는 아니나, 사용자 확인 후 필요 시 구현 검토:

1. 구독자 목록에 검색/필터 UI 없음(백엔드 `list_subscriptions`는 `plan`/`status` 쿼리 파라미터 이미 지원, admin 화면에 노출만 안 됨) — 구독자 20명+ 도달 시 필요해질 가능성
2. 특정 사업장/사용자를 관리자가 직접 조회하는 "고객지원용 조회" 화면 없음 — 현재는 Supabase 직접 조회로 대응 중
3. 관리자가 구독을 직접 취소/환불 처리하는 UI·API 없음 — Toss 콘솔/Supabase 직접 처리 필요
4. `/admin/stories` 성공사례 수정(PATCH) 불가 — 삭제는 의도적으로 UI에 없음(문서화됨)이지만, 오탈자 등 수정도 백엔드에 PATCH 엔드포인트 자체가 없어 동일하게 Supabase 직접 필요

### 10.3 전 화면 모바일(390px) 실측 — 신규 버그 1건 발견·수정

`document.documentElement.scrollWidth` 측정으로 전 관리자 화면(대시보드 3탭·notices·score-comparison·delivery·support·stories·feedback·comms 3탭, 총 12개 화면/탭)을 전수 점검.

| 화면 | 결과 |
|---|---|
| `/admin` 대시보드·FAQ·문의 3탭 | ✅ 정상(375~390) |
| `/admin/notices` | ✅ 정상(390) |
| `/admin/score-comparison` | ✅ 정상(375) |
| `/admin/delivery`, `/admin/support` | ✅ 정상(390) |
| `/admin/stories` | ✅ 정상(390) — 새 사례 작성 폼 포함 |
| `/admin/feedback` | ✅ 정상(390) |
| `/admin/comms` — 시스템 상태 탭 | ✅ 정상(390) |
| `/admin/comms` — **컨텍스트 팁·인앱 메시지 탭** | 🔴 **가로 스크롤 발생(scrollWidth 474px), "삭제" 버튼이 화면 밖으로 밀려 보이지 않음** |

**근본 원인 2가지 중첩**(스크린샷만으로는 안 보이다가 `scrollWidth` 실측 후 재확인해서야 시각적으로도 확인됨 — §0 교훈이 "실측" 단계에서도 반복 재현):
1. "새 팁/메시지 추가" 폼의 `grid-cols-2`가 네이티브 `<select>`의 콘텐츠 기준 최소 너비(내부 옵션 중 가장 긴 텍스트)를 강제해 그리드 트랙이 좁아지지 못함
2. 목록 카드의 `flex items-start justify-between gap-3` 행이 좁은 화면에서도 제목/본문 + "비활성화"/"삭제" 버튼을 가로 배치로 강제

**수정**: 폼은 `grid-cols-1 sm:grid-cols-2` + `min-w-0`, 카드 행은 `flex-col sm:flex-row`로 전환해 모바일에서 버튼이 콘텐츠 아래로 자연스럽게 쌓이도록 변경. 배포 후 재측정으로 두 탭 모두 스크롤 없음(scrollWidth 380/390) 확인, 콘솔 에러 0건.

### 10.4 종합 결론

오판·누락 없음(§10.1 확인). 기능은 핵심 운영 요구는 충족하나 스케일 확대 시 필요해질 공백 4건 존재(§10.2, 결정 대기). 모바일 최적화는 1건의 실제 버그를 발견·수정 후 전체 화면 정상 확인(§10.3). git `5424329`.
