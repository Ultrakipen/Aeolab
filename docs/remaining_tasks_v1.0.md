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

### 2-B. Supabase Storage 버킷 생성

> Supabase 콘솔 → Storage → New Bucket

- **버킷명**: `delivery-materials`
- **공개 여부**: Private (비공개)
- **파일 크기 제한**: 10MB
- **허용 MIME**: image/*, application/pdf, application/zip
- **사인드 URL 유효시간**: 3600초 (1시간)

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
| profiles.intro_draft 컬럼 | ⏳ 미적용 (스키마 v5.8 SQL — Supabase 실행 필요) |

---

*최종 업데이트: 2026-05-18 | 완료: §1 DB ✅ · §4 v4.1 ✅ · §5 git/배포 ✅ | 잔여: §2 체크리스트 · profiles v5.8 컬럼 추가*
