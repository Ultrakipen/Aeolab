# AEOlab 대행 서비스 남은 작업 런북 v1.0

> 작성 2026-05-19 | 근거 문서: `docs/agency_service_and_iboss_improvements_v1.0.md` (기획 확정본) + `신규기능.txt` (next-feature 기획 요약)
> 이 문서는 두 문서 교차 검토 → 오판·누락·수정·보완 반영 → 실행 체크리스트 통합본

---

## §0 교차 검토 결과 (신규기능.txt vs 기획 확정본)

### 0.1 오판 (next-feature 기획에서 사실과 다른 항목)

| # | 오판 내용 | 실제 사실 | 근거 |
|---|---------|---------|------|
| O-1 | "DB 변경 없음 — 5개 테이블 이미 존재" | 테이블은 존재하나 **RLS 정책 적용 여부 미확인**. 기획서 §7.3 RLS SQL이 실행됐는지 불명 | CLAUDE.md "delivery_orders 테이블 존재 확인" + code-review "RLS 확인 필수" 경고 |
| O-2 | "약 4.5h — backend + frontend" | 기획 확정본 Sprint 1-A+B 전체 작업량은 **약 3~4일** (토스 결제 연동 + 자료 첨부 + 메시지 교환 + 위임 동의 포함) | `docs/agency_service_and_iboss_improvements_v1.0.md §11 Sprint 1` |
| O-3 | "DELIVERY_PRICES 서버 매핑만 주의" | 토스 현재 `test_` 키 운영 중 → **실결제 전환 시 `live_` 교체 필요** (Sprint 1 내 처리 or 이전에 완료) | CLAUDE.md "실결제 전환 시 TOSS_SECRET_KEY test_ → live_ 교체" |

### 0.2 누락 (next-feature 기획에서 빠진 항목)

| # | 누락 항목 | 중요도 | 포함되어야 할 Sprint |
|---|---------|--------|-------------------|
| N-1 | **Sprint 1-B 정적 데이터 2종** — `talktalk_templates.py` + `reply_templates.py` | 높음 | Sprint 1 (운영자 시급 직결) |
| N-2 | **토스 1회성 결제 연동** — `/delivery/new`에서 결제 완료 후 `received` 상태 전환 | 높음 | Sprint 1 핵심 |
| N-3 | **자료 첨부 (Supabase Storage)** — 사용자가 사진·메뉴 엑셀 업로드 (비공개 버킷 `delivery-materials`) | 높음 | Sprint 1 |
| N-4 | **위임 동의 체크박스** — 단순 boolean + IP + DB 기록 (PDF·전자서명 X) | 중간 | Sprint 1 |
| N-5 | **7일 내 자료 미제출 자동 취소 스케줄러** | 중간 | Sprint 1 (스케줄러 1건 추가) |
| N-6 | **운영자 관리 페이지** `/admin/delivery` — 단순 목록 + status 필터 | 높음 | Sprint 3 |
| N-7 | **메시지 교환** `/api/delivery/orders/{id}/messages` — 운영자·사용자 1:1 | 높음 | Sprint 1 (게시판 핵심) |

### 0.3 수정 (기존 기획 확정본에서 변경 필요한 항목)

| # | 기획 확정본 원문 | 수정 사항 | 이유 |
|---|----------------|---------|------|
| R-1 | `tool_usage_log` 테이블 — Sprint 1 | **Phase 2로 이동** (플랜 게이트 한도 집계는 자동화 도구 AI 호출 도입 시 필요) | 정적 데이터 2종은 무제한 제공 가능, 집계 불필요 |
| R-2 | 메뉴 일괄 등록 엑셀 양식 `GET /api/tools/menu-template.xlsx` | **이미 구현 완료** (2026-05-18) — `backend/services/menu_template.py` + `GuideClient.tsx` | CLAUDE.md 2026-05-18 업데이트 기록 |
| R-3 | Sprint 1-B 자동화 도구 4종 | **톡톡·답글 템플릿 2종만** Sprint 1. 메뉴 엑셀은 완료, 소개글 AI는 Phase 2 | 메뉴 엑셀 기구현으로 Sprint 1 범위 축소 |
| R-4 | §3.2 패키지 02 작업 시간 "250분 (Sprint 1 후)" | 메뉴 엑셀이 이미 구현됐으므로 **Phase 2 소개글 AI 도입 전까지 01·02·03 시급 목표 유지** | 메뉴 엑셀 구현 완료로 Phase 2 자동화 범위 축소 |

### 0.4 보완 (기획에 없으나 추가 권장 사항)

| # | 보완 항목 | 우선순위 | 이유 |
|---|---------|--------|------|
| A-1 | **RLS 정책 실행 여부 Supabase Dashboard 직접 확인** | P0 (착수 전 필수) | 사용자 간 의뢰 노출 보안 사고 방지 |
| A-2 | **`DELIVERY_PRICES` config** — `backend/config/prices.py`에 대행 가격 3종 추가 (단일 소스) | P0 | amount 변조 방지, CLAUDE.md 단일 소스 원칙 |
| A-3 | **`DeliveryRecommendCard` 대시보드 위젯** — 점수·등록 상태 기반 패키지 자동 추천 | P2 | Sprint 4에서 구현, 전환율 ↑ |
| A-4 | **카카오 알림톡 4종 비즈센터 신청** — `AEOLAB_DELIVERY_01·02·03·04` | 사용자 직접, P1 | Sprint 3 연동 전 신청 완료 필요 |

---

## §1 이미 완료된 항목 (Sprint 1 착수 전 확인)

| 항목 | 완료 일자 | 근거 |
|------|---------|------|
| `delivery_orders`·`delivery_messages`·`support_tickets`·`support_replies`·`success_stories` DB 테이블 생성 | 미상 | CLAUDE.md "DB 5개 테이블 존재 확인" |
| Supabase Storage `delivery-materials` 버킷 생성 (Private, 10MB) | 미상 | CLAUDE.md 확인 |
| `AgencyServiceSection.tsx` 랜딩 카드 3종 (정적 UI) | 2026-05-18 | CLAUDE.md 업데이트 |
| `GET /api/tools/menu-template.xlsx` — 메뉴 일괄 등록 엑셀 양식 | 2026-05-18 | CLAUDE.md 업데이트 |
| `frontend/components/common/FreeToolsSection.tsx` — 랜딩 무료 도구 섹션 | 2026-05-18 | CLAUDE.md 업데이트 |

---

## §2 Sprint 1 — 대행 의뢰 게시판 MVP + 정적 데이터 2종

> **착수 전 필수 확인 (A-1·A-2)**: Supabase RLS + `DELIVERY_PRICES` config 추가

### 2.1 사전 확인 (착수 전 사용자 직접)

- [ ] **Supabase Dashboard** → `delivery_orders` 테이블 → RLS 탭 → Enable Row Level Security + policy "user_own_orders" 존재 여부 확인
  - 미적용 시 → SQL Editor에서 §7.3 RLS SQL 실행 (`docs/agency_service_and_iboss_improvements_v1.0.md §7.3`)
- [ ] `TOSS_SECRET_KEY` 현재 `test_` — Sprint 1은 test_ 키로 진행 가능 (실결제 전 `live_` 교체)

### 2.2 백엔드 (backend-dev 에이전트)

| 파일 | 작업 | 비고 |
|------|------|------|
| `backend/config/prices.py` | `DELIVERY_PRICES = {"smartplace_register": 49000, "ai_optimization": 79000, "comprehensive": 119000}` 추가 | amount 변조 방지 단일 소스 |
| `backend/routers/delivery.py` | 신규 | 아래 엔드포인트 전체 |
| `backend/main.py` | `from routers.delivery import router as delivery_router` + include 1줄 | |
| `backend/services/talktalk_templates.py` | 신규 — 톡톡 채팅방 메뉴 업종 템플릿 JSONB (25개 업종 × 5종) | AI 호출 0 |
| `backend/services/reply_templates.py` | 신규 — 후기 답글 템플릿 (25개 업종 × 3감정 × 5~7패턴) | AI 호출 0 |
| `backend/routers/tools.py` | 기존 존재 시 수정, 없으면 신규 — 2개 GET 엔드포인트 추가 | |
| `scheduler/jobs.py` | `delivery_auto_cancel_job` 추가 — 결제 후 7일 내 자료 미제출 시 자동 취소 (09:00 KST 매일) | |

**엔드포인트 목록**:

```
GET  /api/delivery/packages              비로그인 — 패키지 3종 가격·내용
POST /api/delivery/orders                로그인 필수 — 의뢰 작성 (package_type, request_title, request_body)
     └─ 서버에서 DELIVERY_PRICES[package_type] → amount (클라이언트 amount 파라미터 수신 금지)
     └─ 토스 단건결제 toss_billing.py 재사용 또는 신규 결제 흐름
POST /api/delivery/orders/{id}/materials 로그인 필수 — 자료 업로드 (Supabase Storage 사인드 URL 반환)
POST /api/delivery/orders/{id}/consent   로그인 필수 — 위임 동의 (IP 기록)
GET  /api/delivery/orders/me             로그인 필수 — 내 의뢰 목록
GET  /api/delivery/orders/{id}           로그인 필수 — 의뢰 상세
GET  /api/delivery/orders/{id}/messages  로그인 필수 — 메시지 목록
POST /api/delivery/orders/{id}/messages  로그인 필수 — 사용자 메시지 작성
GET  /api/tools/talktalk-templates/{category}          로그인 + Basic+ — 톡톡 템플릿
GET  /api/tools/reply-templates/{category}/{sentiment} 로그인 + Basic+ — 답글 템플릿
```

### 2.3 프론트엔드 (frontend-dev 에이전트)

| 파일 | 작업 |
|------|------|
| `frontend/types/index.ts` | `DeliveryOrder`, `DeliveryMessage`, `DeliveryPackage` 타입 추가 |
| `frontend/lib/api.ts` | 래퍼 8개 추가 |
| `frontend/app/(dashboard)/delivery/page.tsx` | 패키지 3종 비교 + "새 의뢰 작성" 버튼 (기존 AgencyServiceSection 카드와 연결) |
| `frontend/app/(dashboard)/delivery/new/page.tsx` | 의뢰 작성 폼 (상품 선택·제목·의뢰 내용·자료 첨부·위임 동의 체크·결제 버튼) |
| `frontend/app/(dashboard)/delivery/orders/page.tsx` | 내 의뢰 목록 (status 배지: 접수·진행·완료) |
| `frontend/app/(dashboard)/delivery/orders/[id]/page.tsx` | 의뢰 상세 (의뢰 내용 + 상태 배지 + 메시지 + 완료 보고서) |
| `frontend/app/(dashboard)/layout.tsx` | NAV_ITEMS에 "대행 의뢰" + `/delivery` 추가 |
| `frontend/app/page.tsx` | AgencyServiceSection CTA href → `/delivery` 연결 |

### 2.4 검증 포인트 (배포 전 메인 세션 직접 확인)

1. `grep -n "DELIVERY_PRICES" /var/www/aeolab/backend/config/prices.py` — 3종 가격 존재
2. `grep -n "delivery" /var/www/aeolab/backend/main.py` — router include 확인
3. `grep -n "user_own_orders" /var/www/aeolab/backend/routers/delivery.py` — RLS 호출 방식 확인 (supabase-py RLS는 auth 토큰 필요)
4. 프론트 빌드 TypeScript 0건
5. PM2 error.log 0건

---

## §3 Sprint 2 — Q&A 게시판 MVP

> 트리거: Sprint 1 배포·안정화 후 (1주 운영 후 착수 권장)

### 3.1 DB (db-migrate 에이전트)

```sql
-- docs/agency_service_and_iboss_improvements_v1.0.md §7.1~7.2 SQL 그대로 실행
-- support_tickets + support_replies + RLS
```

### 3.2 백엔드 + 프론트엔드

| 파일 | 작업 |
|------|------|
| `backend/routers/support.py` | 신규 — 사용자 문의 + 공개 FAQ + admin 답변 |
| `frontend/app/(dashboard)/support/*` | 목록·작성·상세 3페이지 |
| `frontend/app/(public)/help/page.tsx` | 공개 FAQ (비로그인) |
| `frontend/app/admin/support/page.tsx` | 관리자 문의 목록 + 미답변 필터 |

**엔드포인트**:
```
POST /api/support/tickets
GET  /api/support/tickets/me
GET  /api/support/tickets/{id}
POST /api/support/tickets/{id}/replies
GET  /api/support/public
POST /admin/support/{id}/reply
PATCH /admin/support/{id}/visibility
```

---

## §4 Sprint 3 — 운영자 보드 + 카카오 알림톡 3종

> 트리거: 첫 주문 발생 후 즉시 착수 (주문이 와야 관리 화면 필요)

### 4.1 사용자 직접 (Sprint 3 착수 전 완료 필요)

- [ ] 카카오 비즈센터 알림톡 신규 신청 4종:
  - `AEOLAB_DELIVERY_01` 대행 의뢰 접수 완료
  - `AEOLAB_DELIVERY_02` 대행 작업 시작
  - `AEOLAB_DELIVERY_03` 대행 작업 완료
  - `AEOLAB_DELIVERY_04` 30일 결과 보고
- [ ] 신청 후 승인까지 약 2~5 영업일 소요

### 4.2 백엔드 + 프론트엔드

| 파일 | 작업 |
|------|------|
| `backend/routers/admin.py` | `/admin/delivery/{id}/status` + `/admin/delivery/{id}/messages` + `/admin/delivery/{id}/complete` + `/admin/delivery/{id}/rework` 추가 |
| `frontend/app/admin/delivery/page.tsx` | 의뢰 목록 + status 필터 (칸반 X) |
| `frontend/app/admin/delivery/[id]/page.tsx` | 의뢰 상세 + 작업 입력 + 메시지 + 완료 보고서 첨부 |
| `scheduler/jobs.py` | 30일 후 자동 재진단 잡 (패키지 03만, `work_completed_at + 30d`) |

---

## §5 Sprint 4 — 성공 사례 갤러리 + 아이보스 P1 도구

> 트리거: Sprint 3 완료 + 첫 완료 사례 확보 후

### 5.1 DB (db-migrate 에이전트)

```sql
-- docs/agency_service_and_iboss_improvements_v1.0.md §7.4 success_stories SQL 실행
```

### 5.2 백엔드 + 프론트엔드

| 파일/페이지 | 작업 |
|-----------|------|
| `backend/routers/stories.py` | 신규 |
| `frontend/app/(public)/stories/*` | 갤러리 + 상세 2페이지 |
| `frontend/app/admin/stories/page.tsx` | 큐레이션 (운영자 게시) |
| `frontend/app/(public)/tools/keyword/page.tsx` | 공개 키워드 생성기 (비로그인, IP당 분당 3회) |
| `frontend/app/(public)/tools/ad-cost-calculator/page.tsx` | 정적 광고비 계산기 |
| `frontend/app/page.tsx` | `AdCostCalculator` 섹션 추가 |
| `frontend/app/(dashboard)/dashboard/` | `DeliveryRecommendCard` + `SeasonalKeywordBanner` 위젯 |

---

## §6 Sprint 5 — SOP + 베타 시범 운영

> 개발 없음 — 운영자 직접

- [ ] 베타 사용자 3~5명 무료 시범 (운영자 직접 작업)
- [ ] 시범 5건 완료 → SOP 작업 매뉴얼 문서화
- [ ] 후기 1건 이상 → `/stories` 첫 콘텐츠 게시
- [ ] 정상가 출시 홈페이지 공지

---

## §7 Phase 2 — 자동화 도구 (BEP 5명+ 도달 후)

> 트리거: 유료 구독자 5명 달성 or 1~2개월 후

| 항목 | 파일 | 비고 |
|------|------|------|
| `tool_usage_log` DB 마이그레이션 | docs §7.5 SQL | |
| 소개글 AI 초안 생성기 | `backend/services/intro_draft.py` | Claude Haiku, 60분→15분 |
| `POST /api/tools/intro-draft` | `backend/routers/tools.py` 추가 | Pro+ 월 10회 |
| 대시보드 소개글 초안 버튼 | `frontend/components/dashboard/IntroductionCard.tsx` 수정 | Basic+ 게이트 |

---

## §8 사용자 직접 처리 (코드 변경 없음)

| 항목 | 시점 | 중요도 |
|------|------|--------|
| **Supabase RLS 확인·적용** (`delivery_orders` + `delivery_messages`) | Sprint 1 착수 전 | P0 |
| **카카오 비즈센터 알림톡 4종 신청** | Sprint 3 착수 2주 전 | P1 |
| **토스 실결제 전환** `TOSS_SECRET_KEY test_ → live_` + pm2 restart | 실결제 오픈 전 | P1 |
| 베타 사용자 3~5명 모집 | Sprint 5 전 | P1 |
| `profiles.intro_draft` v5.8 컬럼 (Supabase SQL Editor) | 조건부 (소개글 AI 구현 시) | P2 |
| v4.1 ALTER 5건 (Supabase SQL Editor) | 선택 (graceful fallback 가능) | P3 |
| `testimonials.ts` 베타 후기 실데이터 교체 | 첫 후기 확보 후 | P2 |

---

## §9 전체 일정 요약

```
[Sprint 1] 대행 의뢰 게시판 MVP + 정적 데이터 2종  ← 다음 즉시 착수
[Sprint 2] Q&A 게시판 MVP                          ← Sprint 1 안정화 후
[Sprint 3] 운영자 보드 + 알림톡 3종                ← 첫 주문 발생 후
[Sprint 4] 성공 사례 갤러리 + 아이보스 P1 도구       ← 첫 완료 사례 후
[Sprint 5] SOP + 베타 시범 (운영자 직접)
[Phase 2]  소개글 AI + 엑셀 자동화 (BEP 5명+)
[Phase 3]  외주·월정액·파트너 디렉토리 (BEP 20명+)
```

---

## §10 Sprint 1 구현 순서 (에이전트 호출 시퀀스)

```
1. [사전] Supabase RLS 확인·적용 (사용자 직접)
2. [병렬] backend-dev → delivery.py + prices.py + talktalk_templates.py + reply_templates.py + tools.py + scheduler jobs
3. [순차] frontend-dev → 타입·api 래퍼 → 페이지 4개 → NAV + 랜딩 CTA 연결
4. code-review → deploy
5. [검증] 메인 세션 직접 grep 4개 패턴
6. git commit + push
```

---

*작성 2026-05-19 | 다음 갱신: Sprint 1 완료 시*
