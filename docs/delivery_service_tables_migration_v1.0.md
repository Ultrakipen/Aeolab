# 대행 서비스 DB 테이블 마이그레이션 v1.0

**상태**: ✅ 테이블 정의 완료 (scripts/supabase_schema.sql)  
**날짜**: 2026-05-22  
**대상**: Supabase PostgreSQL 5개 테이블

---

## 📋 개요

AEOlab 대행 서비스(Smart Place 대행 등록·AI 최적화·종합 패키지) 운영을 위한 5개 DB 테이블을 Supabase에 생성합니다.

| 테이블 | 행 | 역할 | 핵심 컬럼 |
|--------|-----|------|---------|
| **delivery_orders** | 1757 | 의뢰 주문 | package_type, status, amount, work_completed_at, followup_scan_id |
| **delivery_messages** | 1822 | 의뢰 내 메시지 | order_id, author_type, body |
| **support_tickets** | 1857 | Q&A 게시판 글 | category, visibility, status, view_count |
| **support_replies** | 1899 | Q&A 답변/댓글 | ticket_id, author_type, body |
| **success_stories** | 2019 | 성공 사례 갤러리 | delivery_order_id, score_before/after, is_published |

---

## ✅ 현재 상태

### 백엔드 통합 완료
- ✅ `routers/stories.py` — success_stories 조회/등록/편집
- ✅ `routers/support.py` — support_tickets/replies CRUD
- ✅ `routers/delivery.py` — delivery_orders/messages 관리
- ✅ `scheduler/jobs.py` — 자동 스케줄러 작업 3개 등록:
  - `delivery_auto_cancel_job` — 미결제 주문 72시간 후 자동 취소
  - `delivery_30day_rescan_job` — 완료 주문 30일 후 재스캔 추적
  - `delivery_completion_reminder_job` — 진행 중 주문 7일 후 완료 알림

### 서버 연결 검증
```
GET /health → {"database": "ok"}
```
✅ Supabase 연결 정상 (모든 기존 테이블 접근 가능)

---

## 🚀 실행 방법

### 1단계: Supabase SQL Editor 접속

1. [Supabase 대시보드](https://supabase.com/dashboard) 열기
2. 프로젝트 선택: `duqepesuqquqffqvlkxf` (AEOlab)
3. 좌측 메뉴 → **SQL Editor** 클릭

### 2단계: 테이블 생성 확인 (선택사항)

먼저 다음 쿼리로 현재 상태 확인:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' 
AND table_name IN (
  'delivery_orders',
  'delivery_messages',
  'support_tickets',
  'support_replies',
  'success_stories'
)
ORDER BY table_name;
```

결과:
- **5개 모두 나옴** → 이미 생성됨, 아래 실행 불필요 ✅
- **부분 또는 0개** → 아래 SQL 실행

### 3단계: 테이블 생성 SQL 실행

`scripts/supabase_schema.sql` 1757~2051행 전체를 SQL Editor에 붙여넣고 **Execute** 버튼 클릭.

또는 생성 순서별로 아래 SQL을 순서대로 실행:

#### (1) delivery_orders 생성
```sql
CREATE TABLE IF NOT EXISTS delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL CHECK (package_type IN ('smartplace_register','ai_optimization','comprehensive')),
  amount INT NOT NULL,
  payment_key TEXT,
  order_name TEXT,
  request_title TEXT NOT NULL,
  request_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_progress','completed','rework','refunded','cancelled')),
  consent_agreed BOOLEAN DEFAULT FALSE,
  consent_signed_at TIMESTAMPTZ,
  consent_ip TEXT,
  materials_url JSONB DEFAULT '[]'::jsonb,
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,
  completion_report JSONB,
  score_before NUMERIC,
  score_after NUMERIC,
  followup_scan_id UUID,
  rework_reason TEXT,
  rework_count INT DEFAULT 0,
  refund_reason TEXT,
  refund_amount INT,
  testimonial_consent BOOLEAN DEFAULT FALSE,
  testimonial_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_user ON delivery_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_orders(status, created_at);
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_orders" ON delivery_orders;
CREATE POLICY "user_own_orders" ON delivery_orders FOR ALL
  USING (auth.uid() = user_id);
```

#### (2) delivery_messages 생성
```sql
CREATE TABLE IF NOT EXISTS delivery_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','admin')),
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  attachment_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_msg_order ON delivery_messages(order_id, created_at);
ALTER TABLE delivery_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_order_messages" ON delivery_messages;
CREATE POLICY "user_own_order_messages" ON delivery_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM delivery_orders o
      WHERE o.id = delivery_messages.order_id AND o.user_id = auth.uid()
    )
  );
```

#### (3) support_tickets 생성
```sql
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('payment','feature','score','bug','other')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  attachment_urls JSONB DEFAULT '[]'::jsonb,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_public ON support_tickets(visibility, status)
  WHERE visibility = 'public' AND status = 'answered';

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_tickets" ON support_tickets;
CREATE POLICY "user_own_tickets" ON support_tickets FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "public_answered_tickets" ON support_tickets;
CREATE POLICY "public_answered_tickets" ON support_tickets FOR SELECT
  USING (visibility = 'public' AND status = 'answered');
```

#### (4) support_replies 생성
```sql
CREATE TABLE IF NOT EXISTS support_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','admin')),
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replies_ticket ON support_replies(ticket_id, created_at);
ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_view_ticket_replies" ON support_replies;
CREATE POLICY "user_view_ticket_replies" ON support_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_replies.ticket_id
        AND (t.user_id = auth.uid() OR (t.visibility = 'public' AND t.status = 'answered'))
    )
  );

DROP POLICY IF EXISTS "user_insert_reply" ON support_replies;
CREATE POLICY "user_insert_reply" ON support_replies FOR INSERT
  WITH CHECK (
    author_type = 'user' AND author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_replies.ticket_id AND t.user_id = auth.uid() AND t.status != 'closed'
    )
  );
```

#### (5) success_stories 생성
```sql
CREATE TABLE IF NOT EXISTS success_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  delivery_order_id UUID REFERENCES delivery_orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  score_before NUMERIC,
  score_after NUMERIC,
  score_delta NUMERIC GENERATED ALWAYS AS (score_after - score_before) STORED,
  is_anonymous BOOLEAN DEFAULT TRUE,
  display_name TEXT,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stories_category ON success_stories(category, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_delta ON success_stories(score_delta DESC) 
  WHERE score_delta IS NOT NULL AND score_delta > 0;
CREATE INDEX IF NOT EXISTS idx_stories_published ON success_stories(published_at DESC);

ALTER TABLE success_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "stories_public_select" ON success_stories FOR SELECT USING (TRUE);
```

#### (6) delivery_orders 컬럼 추가 (이미 생성된 경우)
```sql
ALTER TABLE delivery_orders 
  ADD COLUMN IF NOT EXISTS work_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_scan_id UUID REFERENCES scan_results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS materials_url JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_delivery_followup 
  ON delivery_orders(package_type, status, work_completed_at)
  WHERE followup_scan_id IS NULL;
```

---

## ✔️ 검증 체크리스트

SQL 실행 후 다음을 확인하세요:

```sql
-- 1. 테이블 5개 모두 생성됨
SELECT count(*) FROM information_schema.tables 
WHERE table_name IN ('delivery_orders','delivery_messages','support_tickets','support_replies','success_stories');
-- 결과: 5

-- 2. delivery_orders RLS 정책
SELECT count(*) FROM pg_policies 
WHERE tablename = 'delivery_orders' AND policyname = 'user_own_orders';
-- 결과: 1

-- 3. support_tickets 인덱스
SELECT count(*) FROM pg_indexes 
WHERE tablename = 'support_tickets' AND schemaname = 'public';
-- 결과: 3 (idx_tickets_user, idx_tickets_status, idx_tickets_public)

-- 4. success_stories 컬럼 (score_delta 자동 계산 확인)
SELECT column_name, is_generated, generation_expression 
FROM information_schema.columns 
WHERE table_name = 'success_stories' AND column_name = 'score_delta';
-- 결과: score_delta | YES | (score_after - score_before)
```

---

## 📝 스키마 파일 위치

- **로컬**: `C:/app_build/aeolab/scripts/supabase_schema.sql`
- **서버**: `/var/www/aeolab/scripts/supabase_schema.sql`
- **범위**: 1757~2051행 (delivery_orders부터 idx_delivery_followup까지)

---

## 🔗 관련 라우터

생성 후 다음 엔드포인트가 활성화됩니다:

### Delivery (대행 의뢰)
- `POST /api/delivery/orders` — 의뢰 생성
- `GET /api/delivery/orders/{id}` — 의뢰 조회
- `GET /api/delivery/orders` — 사용자 의뢰 목록
- `PATCH /api/delivery/orders/{id}/status` — 상태 변경
- `POST /api/delivery/messages` — 메시지 작성
- `GET /api/delivery/messages/{order_id}` — 메시지 조회

### Support (Q&A 게시판)
- `POST /api/support/tickets` — 질문 등록
- `GET /api/support/tickets` — 질문 목록
- `GET /api/support/tickets/{id}` — 질문 상세
- `POST /api/support/tickets/{id}/replies` — 답변 작성
- `GET /api/support/tickets/{id}/replies` — 답변 조회

### Stories (성공 사례)
- `GET /api/stories` — 공개 성공 사례 목록
- `POST /api/stories` — 성공 사례 등록 (대행 완료 후)
- `GET /api/stories/{id}` — 성공 사례 상세

---

## ⚠️ 주의사항

1. **생성 순서**: delivery_orders → delivery_messages → support_tickets → support_replies → success_stories (외래 키 의존성)
2. **RLS 활성화**: 모든 테이블에 RLS 정책이 자동 생성됨 (사용자 데이터 보호)
3. **일괄 실행**: SQL Editor에서 위 6개 섹션을 모두 복사하여 한 번에 실행 권장 (or 순서대로 개별 실행)
4. **이미 생성된 경우**: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` 때문에 재실행해도 안전

---

**마이그레이션 완료 후**: `backend` 및 `frontend` 재배포는 불필요 (라우터·컴포넌트 이미 통합됨)

