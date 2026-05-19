# AEOlab — 잔여 작업 런북 v1.0

> **작성일**: 2026-05-18  
> **상태**: 현재 남은 작업 전체 목록. 새 대화창 트리거 명령 포함.  
> **최종 완료**: 2026-05-18 P2 버그 수정 + 랜딩 대행 서비스 섹션 + 리드젠 A·B·C + 네이버 AI 검색 최적화 M1~M3

---

## 0. 새 대화창 트리거 명령

각 작업별 1줄 시작 명령:

```
# 대행 서비스 DB 테이블 생성
"docs/remaining_tasks_v1.0.md §1 기준으로 대행 서비스 DB 테이블 생성 SQL 안내해줘"

# 대행 서비스 전체 점검 (결제·알림·스토리지)
"docs/remaining_tasks_v1.0.md §2 기준으로 대행 서비스 출시 전 체크리스트 확인해줘"

# git 커밋 (현재 uncommitted 80+ 파일)
"docs/remaining_tasks_v1.0.md §5 기준으로 현재 변경사항 git commit 해줘"

# P2 AI탭 스캐너 활성화 (6월 트리거 후)
"docs/p2_p3_execution_runbook.md 기준으로 P2 실행할 것"

# 소개글 AI 초안 생성기 구현 (BEP 5명+ 후)
"docs/remaining_tasks_v1.0.md §3 기준으로 소개글 AI 초안 기능 구현해줘"

# M1 완료 후 신규 잔여 작업 (2026-05-18)
"docs/remaining_tasks_v1.0.md §9 기준으로 신규 잔여 작업 진행해줘"

# 변경분 일괄 git 커밋
"docs/remaining_tasks_v1.0.md §9-A 기준으로 현재 변경 11개 파일 git 커밋해줘"

# 신규 가이드 페이지 dogfood
"docs/remaining_tasks_v1.0.md §9-B 기준으로 blog-strategy + chatgpt-search 비로그인 dogfood 해줘"
```

---

## 1. 대행 서비스 DB 테이블 생성 (즉시 가능, 사용자 직접)

> **위치**: Supabase SQL Editor → 직접 실행  
> **이유**: `/delivery`, `/support`, `/stories`, `/admin/delivery` 페이지가 이미 구현됨. DB만 없어서 빈 상태.

### 1-A. delivery_orders 테이블

```sql
CREATE TABLE IF NOT EXISTS delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL CHECK (package_id IN ('smartplace_register','ai_optimization','comprehensive')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled','refunded')),
  business_name TEXT,
  contact_phone TEXT,
  contact_kakao TEXT,
  notes TEXT,
  materials_url TEXT[],
  amount INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  toss_payment_key TEXT,
  toss_order_id TEXT UNIQUE,
  admin_memo TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own orders" ON delivery_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own orders" ON delivery_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_delivery_orders_user_id ON delivery_orders(user_id);
CREATE INDEX idx_delivery_orders_status ON delivery_orders(status);
```

### 1-B. delivery_messages 테이블

```sql
CREATE TABLE IF NOT EXISTS delivery_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES delivery_orders(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user','admin')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delivery_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order owner sees messages" ON delivery_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM delivery_orders WHERE id = order_id AND user_id = auth.uid())
  );
```

### 1-C. support_tickets 테이블

```sql
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bug','feature','billing','usage','other')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users create own tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 1-D. support_replies 테이블

```sql
CREATE TABLE IF NOT EXISTS support_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user','admin')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket owner sees replies" ON support_replies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
  );
```

### 1-E. success_stories 테이블

```sql
CREATE TABLE IF NOT EXISTS success_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES delivery_orders(id),
  business_name TEXT NOT NULL,
  category TEXT,
  region TEXT,
  before_score INTEGER,
  after_score INTEGER,
  score_delta INTEGER GENERATED ALWAYS AS (after_score - before_score) STORED,
  highlight TEXT,
  body TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE success_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "published stories are public" ON success_stories
  FOR SELECT USING (is_published = TRUE);
```

---

## 2. 대행 서비스 출시 전 체크리스트 (사용자 직접)

### 2-A. 카카오 알림톡 4종 신규 신청 (비즈센터)

> 기존 5종(`AEOLAB_SCORE_01` 등)은 승인 완료. 대행 서비스용 4종 추가 신청 필요.

| 템플릿 코드 | 발송 시점 | 내용 |
|-----------|---------|------|
| `AEOLAB_DELIVERY_01` | 접수 완료 | "대행 신청이 접수됐습니다. 담당자가 24시간 내 카카오톡으로 연락드립니다." |
| `AEOLAB_DELIVERY_02` | 작업 시작 | "대행 작업이 시작됐습니다. 완료 예정일: #{date}" |
| `AEOLAB_DELIVERY_03` | 작업 완료 | "대행 작업이 완료됐습니다. 결과를 확인해보세요." |
| `AEOLAB_DELIVERY_04` | 30일 재진단 | "신청 30일 후 자동 재진단 결과를 보내드립니다." |

신청 경로: [카카오 비즈니스](https://business.kakao.com/) → 알림톡 채널 관리 → 템플릿 추가

### 2-B. Supabase Storage 버킷 생성 ✅ 완료 (2026-05-18)

> SDK로 자동 생성 완료 — Supabase 콘솔에서 확인 가능

- **버킷명**: `delivery-materials` ✅
- **공개 여부**: Private ✅
- **파일 크기 제한**: 10MB ✅
- **허용 MIME**: image/jpeg, image/png, image/webp, image/gif, application/pdf, application/zip ✅

### 2-C. 토스페이먼츠 1회성 결제 상품 등록

> 토스페이먼츠 대시보드 → 상품 관리 → 1회성 결제 (정기결제 아님)

| 상품명 | 금액 | 설명 |
|--------|------|------|
| 스마트플레이스 등록 대행 | 49,000원 | 소개글·메뉴·사진 등록 일체 |
| AI 검색 최적화 대행 | 79,000원 | AI 브리핑 친화 최적화 + 톡톡 채팅방 메뉴 |
| 종합 풀패키지 대행 | 119,000원 | 01+02 + 1:1 코칭 + 30일 재진단 |

> **주의**: 현재 `TOSS_SECRET_KEY=test_...` — 실결제 전환 시 `live_...`로 교체 후 `pm2 restart aeolab-backend`

### 2-D. 베타 후기 1~3개 확보

> 인터뷰 완료 후 `frontend/lib/testimonials.ts` 수정

```typescript
// 현재 (placeholder)
{ isPlaceholder: true, name: "...", ... }

// 수정 후
{ isPlaceholder: false, name: "실제이름", business: "실제사업장명", ... }
```

---

## 3. 소개글 AI 초안 생성기 (Phase 2 — BEP 5명+ 이후)

> **조건**: 유료 구독자 5명 이상 확보 후 진행  
> **트리거**: "소개글 AI 초안 기능 구현해줘"

### 3-A. 백엔드

```python
# POST /api/tools/intro-draft
# 플랜 게이트: Pro+
# 월 10회 제한 (profiles.intro_draft_count_month)
# 모델: Claude Haiku (claude-haiku-4-5-20251001)
# 입력: category, region, keywords[], business_name, strengths
# 출력: intro_text (1,000자), keywords_used[], estimated_score
```

DB 컬럼 추가 필요:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intro_draft_count_month INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intro_draft_reset_at TIMESTAMPTZ;
```

### 3-B. 프론트엔드

- 위치: `frontend/app/(dashboard)/guide/` 또는 `QuickToolsSection` 내
- UI: 업종·지역·강점 입력 → "초안 생성" 버튼 → 결과 textarea + 복사 버튼
- 월 10회 사용 현황 표시 (배지)

---

## 4. 선택적 ALTER TABLE (v4.1 — graceful fallback 가능)

> **우선순위**: 낮음. 미실행 시에도 모든 기능 정상 동작(graceful fallback)  
> **위치**: Supabase SQL Editor

```sql
-- 프랜차이즈 게이팅 활성화
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_franchise BOOLEAN DEFAULT FALSE;

-- 네이버 소개글 초안 자동 로드
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS naver_intro_draft TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS naver_intro_generated_at TIMESTAMPTZ;

-- 톡톡 채팅방 메뉴 초안
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS talktalk_faq_draft JSONB;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS talktalk_faq_generated_at TIMESTAMPTZ;
```

---

## 5. git 커밋 ✅ 완료 (2026-05-18)

> **커밋**: `057d62e` — 300파일, +37,733/-9,094 라인  
> **배포**: GitHub Actions → 서버 자동 배포 완료 (PM2 both online, error.log 0건)  
> **검증**: `/api/delivery/packages` 200 OK, 서버 `057d62e` 확인

---

## 6. 시기 의존 작업 (트리거 대기)

### 6-A. P2 AI탭 스캐너 (6월 트리거)

> **트리거**: 네이버 AI탭이 비로그인 상태에서도 표시될 때  
> **확인 명령** (주 1회):

```bash
ssh root@115.68.231.57 'cd /var/www/aeolab && source venv/bin/activate && python3 -c "
import asyncio
from playwright.async_api import async_playwright
async def t():
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=[\"--no-sandbox\",\"--disable-dev-shm-usage\"])
        pg = await br.new_page()
        await pg.goto(\"https://search.naver.com/search.naver?query=강남역+맛집\", timeout=20000)
        await pg.wait_for_timeout(3000)
        tabs = await pg.query_selector_all(\"a[role=tab]\")
        for t in tabs: print(\"tab:\", await t.inner_text())
        await br.close()
asyncio.run(t())
"'
# 출력에 "AI" 탭 보이면 P2 실행
```

P2 실행 트리거:
```
"docs/p2_p3_execution_runbook.md 기준으로 P2 실행할 것"
```

### 6-B. P3 점수 모델 v3.1 (구독자 늘 때)

> **트리거**: 백엔드 로그에 `[P3-READY]` 메시지 발생  
> **확인 명령** (구독자 늘 때마다):

```bash
ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 500 --nostream | grep "P3-READY"'
```

P3 실행 트리거:
```
"docs/p2_p3_execution_runbook.md 기준으로 P3 실행할 것"
```

---

## 7. 장기 과제 (구독자 확보 후)

| 작업 | 조건 | 예상 공수 |
|------|------|---------|
| 네이버 DataLab API 연동 | 구독자 100명+ | 3일 |
| `smart_place_completeness` Playwright 완전 자동화 | 구독자 50명+ | 2일 |
| 경쟁사 keyword_gap 실시간 자동화 | 구독자 50명+ | 1일 |
| Google 스크린샷 DataForSEO 재도입 | 구독자 50명+ | 1일 |
| AEOlab 인증 파트너 디렉토리 | 대행 서비스 안정 후 | 3~5일 |
| Vercel + Railway 분리 | 구독자 100명+ | 2일 |
| 서버 업그레이드 (vCPU2 → 상위) | 홈페이지 완성 후 | — |

---

## 8. 현재 서버 상태 요약 (2026-05-18 기준)

| 항목 | 상태 |
|------|------|
| PM2 aeolab-backend (포트 8000) | ✅ online |
| PM2 aeolab-frontend (포트 3000) | ✅ online |
| Supabase v3.5 스키마 | ✅ 적용 완료 |
| 카카오 알림톡 5종 | ✅ 승인 완료 |
| GA4 G-KCZTWYK7QV | ✅ 라이브 |
| 결제 TOSS_SECRET_KEY | ⏳ test_ 상태 (실결제 전환 필요) |
| 대행 서비스 DB 테이블 | ✅ 이미 생성됨 (5개 테이블 확인) |
| 베타 후기 | ⏳ placeholder 상태 |
| profiles.intro_draft 컬럼 | ✅ 적용 완료 (intro_draft_count_month / intro_draft_reset_at 존재 확인 2026-05-18) |
| `/guide/chatgpt-search` 비로그인 SEO | ✅ 복원 (middleware publicGuidePaths 화이트리스트) |
| `/guide/blog-strategy` 신규 페이지 | ✅ 배포 (로그인 사용자용) |
| M1 베이스라인 SQL 실행 | ✅ 완료 (결과는 다음 캡처 시 비교 기록) |
| git 변경 (uncommitted) | ⏳ 11개 파일 (§9-A) |

---

## 9. M1 완료 후 신규 잔여 작업 (2026-05-18 갱신)

> **배경**: `docs/naver_ai_optimization_remaining_tasks_v1.0.md` P0/P1/P2 모두 처리 완료. 그 사이클에서 발견·해결한 chatgpt-search 라우팅 충돌·middleware 화이트리스트 포함. 본 섹션은 다음 작업 사이클의 우선순위 정리.

### 9-A. 🔴 즉시 (당일~3일)

#### 9-A-1. git 커밋 + 푸시 (11개 파일)

```bash
git -C C:/app_build/aeolab add \
  backend/scheduler/jobs.py \
  backend/services/briefing_engine.py \
  frontend/middleware.ts \
  "frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx" \
  "frontend/app/(public)/demo/page.tsx" \
  "frontend/app/(public)/trial/components/TrialResultStep.tsx" \
  "frontend/app/(dashboard)/guide/blog-strategy/" \
  docs/naver_ai_optimization_remaining_tasks_v1.0.md \
  docs/baseline_m1_20260518.md \
  docs/naver_ai_search_optimization_plan_v1.0.md \
  docs/p2_p3_execution_runbook.md \
  docs/remaining_tasks_v1.0.md

# 삭제 파일도 stage (라우팅 충돌 해결)
git -C C:/app_build/aeolab rm "frontend/app/(dashboard)/guide/chatgpt-search/page.tsx"

git -C C:/app_build/aeolab commit -m "feat: naver AI optimization remaining tasks P0/P1 + middleware public guide whitelist"
git -C C:/app_build/aeolab push origin main
```

> GitHub Actions가 자동 배포 트리거. 서버 변경은 이미 SCP로 직접 반영됐으므로 push는 git 이력 동기화 목적.

#### 9-A-2. 신규·복원 가이드 페이지 dogfood

| URL | 기대 | 검증 방법 |
|-----|------|---------|
| https://aeolab.co.kr/guide/chatgpt-search | 비로그인 200 (SEO 페이지) | 시크릿 브라우저 |
| https://aeolab.co.kr/guide/blog-strategy | 비로그인 → /login | 시크릿 브라우저 |
| `/dashboard` → AI 정보 탭 → 블로그 UGC 카드 → "블로그 후기 늘리기 전략 →" 버튼 | 로그인 사용자 신규 페이지 진입 | 로그인 후 클릭 |
| SiteFooter "ChatGPT 최적화 가이드" 링크 | 비로그인 200 | 랜딩페이지 푸터 |

#### 9-A-3. 백엔드 simulate_ai_tab_answer 응답 필드 확인

```bash
ssh root@115.68.231.57 'cd /var/www/aeolab && source venv/bin/activate && python3 -c "
from services.briefing_engine import simulate_ai_tab_answer
r = simulate_ai_tab_answer({\"name\":\"테스트\",\"category\":\"legal\",\"region\":\"강남구\",\"keywords\":[\"이혼\"]}, None, \"legal\")
print(\"ai_tab_eligibility:\", r.get(\"ai_tab_eligibility\"))
print(\"simulation_version:\", r.get(\"simulation_version\"))
"'
# 기대: ai_tab_eligibility: beta / simulation_version: v2
```

---

### 9-B. 🟡 1주 내

#### 9-B-1. M1 베이스라인 §2 결과 채우기 (다음 캡처 시점)

> 단일 시점 데이터만 있어 비교 가치가 낮음. **M2 적용 후** 또는 **P3 v3.1 활성화 직전** 시점에 동일 SQL을 재실행하여 한 번에 비교 표로 정리.
>
> 트리거: 사용자가 결과를 채팅에 공유하거나, `"baseline_m1 결과 채워줘"` 한 줄로 메인 세션이 SQL 재실행 안내.

#### 9-B-2. AI탭 예약 연동 자동 점검 (P1) ✅ 완료 (2026-05-18)

> 근거: `docs/naver_ai_tab_대응_개발계획_v1.0.md` P1 항목
> 파일: `backend/services/smart_place_auto_check.py`, `backend/services/briefing_engine.py`, `backend/routers/report.py`, `frontend/app/(dashboard)/guide/ai-info-tab/{page,AiInfoTabGuide}.tsx`
> 작업 완료 내역:
> - `_detect_reservation()` + `_detect_photo_count()` smart_place_auto_check.py에 구현됨 (선행)
> - `build_direct_briefing_paths()`에 `has_reservation: bool | None` 파라미터 추가 → False 시 5번째 경로 `reservation_setup` 노출
> - `routers/report.py` conversion_tips에서 `businesses.sp_completeness_json` SELECT 후 `has_reservation` 추출하여 전달
> - `ai-info-tab/page.tsx`에서 `sp_completeness_json.has_reservation`/`photo_count` 추출하여 `AiInfoTabGuide`에 전달
> - `AiInfoTabGuide` INACTIVE/프랜차이즈 분기 ②사진/③예약 항목에 동적 배지(✓ 통과/연동됨/미연동) + "지금 설정하기" 링크
> 점수 미반영 유지 — AI탭 베타 단계, 정밀 셀렉터 실측 후 v3.2에서 가중치 검토
> 검증: 서버 build_direct_briefing_paths(has_reservation=False) → 5개 경로 반환 / chatgpt-search 200, ai-info-tab 307(redirect) / PM2 error 0건

#### 9-B-3. `(public)/guide` 추가 가이드 페이지 화이트리스트 검토

> middleware.ts `publicGuidePaths`가 현재 `/guide/chatgpt-search` 1개만 포함. 향후 `/guide/blog-strategy`도 비로그인 SEO 가치 있으면 화이트리스트 추가 검토.
>
> 결정 기준: 푸터·랜딩에서 비로그인 사용자가 접근할 가이드인가? blog-strategy는 현재 로그인 사용자용으로만 노출되므로 미추가 유지.

---

### 9-C. 🟢 시기 의존 (조건 충족 시)

| 작업 | 트리거 | 실행 문서 |
|------|--------|---------|
| **P2 AI탭 스캐너 활성화** | 6월 네이버 AI탭 비로그인 표시 확인 | `docs/p2_p3_execution_runbook.md` P2 |
| **P3 v3.1 점수 모델 활성화** | 베타 5명 + `[P3-READY]` 로그 | 같은 문서 P3 |
| **P4 v3.2 점수 모델 활성화** | P2 가동 30일 + P3 안정화 30일 | 같은 문서 P4 (2026-05-18 신규) |
| **AD_BRIEFING_SELECTORS 실측** | Q2 광고 영역 첫 노출 시 | 같은 문서 P2 Step 8 (신규) |
| **briefing_category_expansion_monitor 결과 확인** | 매월 1일 09:00 자동 실행 | `pm2 logs aeolab-backend | grep expansion_monitor` |

---

### 9-D. 🔵 비즈니스 (BEP 20명까지)

| # | 작업 | 우선순위 근거 |
|---|------|--------------|
| 1 | 다음 기능 기획 → `next-feature` 에이전트 | `docs/next_features_v1.0.md` 기준 |
| 2 | 베타 후기 1~3개 확보 → `lib/testimonials.ts` `isPlaceholder: false` | 사회적 증거(랜딩 전환율 직결) |
| 3 | 랜딩 추가 개선 (P4 잔여) | `memory/project_landing_next.md` |
| 4 | 대행 서비스 출시 체크리스트 (§2) | 매출 다변화 |
| 5 | Phase 0 사용자 인터뷰 (베타 1~3명) | 제품 검증 |

---

### 9-E. 회고 — 이번 사이클 발견 사항

| 항목 | 영향 | 재발 방지 |
|------|------|----------|
| Deploy 에이전트 무단 변경 (`(public)/guide/chatgpt-search` 폴더 삭제) | SiteFooter 푸터 링크 깨짐, 비로그인 SEO 페이지 손실 | CLAUDE.md "에이전트 보고 검증 의무" 강화. 라우팅 충돌은 메인 세션이 직접 결정 |
| 베이스라인 SQL 컬럼명 오류 (`created_at`·`track1_score` 사용) | 사용자 첫 실행 실패 | schema.sql을 먼저 확인하고 작성. 추정 컬럼명 금지 |
| 잔여 작업 문서 P1-1 결함 진단 오인 (22건 → 실제 57개) | 메인 세션 검증으로 스킵 판정 | 에이전트 보고를 코드 grep으로 항상 교차 검증 |
| Next.js 16 route group 라우팅 충돌 ((public) ↔ (dashboard) 동일 URL) | 빌드 에러 → 한 쪽 폴더 삭제 필요 | 신규 가이드 페이지 추가 시 같은 URL 중복 여부 확인. `(public)/guide/X` + `(dashboard)/guide/X` 중복은 금지 |

---

*최종 업데이트: 2026-05-18 | 완료: §1 DB ✅ · §4 v4.1 ✅ · §5 git/배포 ✅ · §9 신규 잔여 작업 문서화 ✅ | 잔여: §2 체크리스트 · profiles v5.8 컬럼 · §9-A git 커밋 · §9-B-1 베이스라인 결과 채우기*
