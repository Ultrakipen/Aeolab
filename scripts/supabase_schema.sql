-- AEOlab Supabase PostgreSQL 스키마 v1.5
-- Supabase SQL Editor에서 실행하세요
-- v1.3 변경: zeta_result 추가, team_members/api_keys 테이블 추가, profiles 트리거 추가
-- v1.4 변경: keyword_scan_results 테이블 추가
-- v1.5 변경: profiles에 kakao_scan_notify/kakao_competitor_notify 추가
--            ai_citations에 sentiment/mention_type 추가

-- ========================================
-- businesses (사업장)
-- ========================================
CREATE TABLE IF NOT EXISTS businesses (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('restaurant','cafe','hospital','academy','law','beauty','shop')),
  region           TEXT NOT NULL,
  address          TEXT,
  phone            TEXT,
  naver_place_id   TEXT,
  website_url      TEXT,
  keywords         TEXT[],
  has_schema       BOOLEAN DEFAULT false,
  review_count     INTEGER DEFAULT 0,
  avg_rating       NUMERIC(3,2) DEFAULT 0,
  keyword_diversity NUMERIC(3,2) DEFAULT 0,
  mention_score    NUMERIC(5,2) DEFAULT 50,
  freshness_score  NUMERIC(5,2) DEFAULT 50,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_business" ON businesses
  USING (auth.uid() = user_id);
CREATE POLICY "own_business_insert" ON businesses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_business_update" ON businesses
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- competitors (경쟁사)
-- ========================================
CREATE TABLE IF NOT EXISTS competitors (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_competitor" ON competitors
  USING (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = competitors.business_id AND b.user_id = auth.uid()
  ));
CREATE POLICY "own_competitor_insert" ON competitors
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = competitors.business_id AND b.user_id = auth.uid()
  ));
CREATE POLICY "own_competitor_update" ON competitors
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = competitors.business_id AND b.user_id = auth.uid()
  ));
CREATE POLICY "own_competitor_delete" ON competitors
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = competitors.business_id AND b.user_id = auth.uid()
  ));

-- ========================================
-- scan_results (AI 스캔 결과)
-- 8개 플랫폼: gemini, chatgpt, perplexity, grok, naver, claude, zeta, google
-- ========================================
CREATE TABLE IF NOT EXISTS scan_results (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id       UUID REFERENCES businesses(id) ON DELETE CASCADE,
  scanned_at        TIMESTAMPTZ DEFAULT now(),
  query_used        TEXT NOT NULL,
  gemini_result     JSONB,
  chatgpt_result    JSONB,
  perplexity_result JSONB,
  grok_result       JSONB,
  naver_result      JSONB,
  claude_result     JSONB,
  zeta_result       JSONB,
  google_result     JSONB,
  exposure_freq     NUMERIC(5,2) DEFAULT 0,
  total_score       NUMERIC(5,2) DEFAULT 0,
  score_breakdown   JSONB,
  rank_in_query     INTEGER,
  competitor_scores JSONB
);

CREATE INDEX IF NOT EXISTS idx_scan_biz_time ON scan_results(business_id, scanned_at DESC);

ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_scan" ON scan_results
  USING (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = scan_results.business_id AND b.user_id = auth.uid()
  ));
CREATE POLICY "own_scan_insert" ON scan_results
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = scan_results.business_id AND b.user_id = auth.uid()
  ));

-- ========================================
-- ai_citations (AI 인용 실증)
-- ========================================
CREATE TABLE IF NOT EXISTS ai_citations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id      UUID REFERENCES scan_results(id) ON DELETE CASCADE,
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,
  query        TEXT NOT NULL,
  mentioned    BOOLEAN DEFAULT false,
  excerpt      TEXT,
  sentiment    TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  mention_type TEXT CHECK (mention_type IN ('recommendation', 'information', 'comparison', 'warning')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_citation" ON ai_citations
  USING (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = ai_citations.business_id AND b.user_id = auth.uid()
  ));

-- ========================================
-- score_history (점수 시계열 — 30일 추세)
-- ========================================
CREATE TABLE IF NOT EXISTS score_history (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id        UUID REFERENCES businesses(id) ON DELETE CASCADE,
  score_date         DATE NOT NULL,
  total_score        NUMERIC(5,2),
  exposure_freq      NUMERIC(5,2),
  rank_in_category   INTEGER,
  total_in_category  INTEGER,
  weekly_change      NUMERIC(5,2),
  UNIQUE(business_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_score_history_biz_date ON score_history(business_id, score_date DESC);

ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_score_history" ON score_history
  USING (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = score_history.business_id AND b.user_id = auth.uid()
  ));
CREATE POLICY "own_score_history_insert" ON score_history
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = score_history.business_id AND b.user_id = auth.uid()
  ));

-- 30일 추세 뷰
CREATE OR REPLACE VIEW score_trend_30d AS
SELECT
  business_id,
  score_date,
  total_score,
  rank_in_category,
  LAG(total_score) OVER (PARTITION BY business_id ORDER BY score_date) AS prev_score
FROM score_history
WHERE score_date >= CURRENT_DATE - INTERVAL '30 days';

-- ========================================
-- before_after (Before/After 스크린샷)
-- capture_type: before | after_30d | after_60d | after_90d
-- ========================================
CREATE TABLE IF NOT EXISTS before_after (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  capture_type TEXT NOT NULL CHECK (capture_type IN ('before', 'after_30d', 'after_60d', 'after_90d')),
  platform     TEXT NOT NULL DEFAULT 'chatgpt',
  image_url    TEXT NOT NULL,
  query_used   TEXT,
  score_at_capture NUMERIC(5,2)
);

CREATE INDEX IF NOT EXISTS idx_before_after_biz ON before_after(business_id, created_at DESC);

ALTER TABLE before_after ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_before_after" ON before_after
  USING (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = before_after.business_id AND b.user_id = auth.uid()
  ));
CREATE POLICY "own_before_after_insert" ON before_after
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = before_after.business_id AND b.user_id = auth.uid()
  ));

-- ========================================
-- guides (개선 가이드)
-- ========================================
CREATE TABLE IF NOT EXISTS guides (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   UUID REFERENCES businesses(id) ON DELETE CASCADE,
  scan_id       UUID REFERENCES scan_results(id) ON DELETE SET NULL,
  generated_at  TIMESTAMPTZ DEFAULT now(),
  summary       TEXT,
  items_json    JSONB,
  priority_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_guides_biz ON guides(business_id, generated_at DESC);

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_guide" ON guides
  USING (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = guides.business_id AND b.user_id = auth.uid()
  ));
CREATE POLICY "own_guide_insert" ON guides
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = guides.business_id AND b.user_id = auth.uid()
  ));

-- ========================================
-- subscriptions (구독 정보)
-- status: trial_pending → active → grace_period → suspended → cancelled/expired
-- ========================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan         TEXT NOT NULL DEFAULT 'free'
                 CHECK (plan IN ('free','basic','pro','biz','startup','enterprise')),
  status       TEXT NOT NULL DEFAULT 'inactive'
                 CHECK (status IN ('active','grace_period','suspended','cancelled','expired','inactive')),
  start_at     TIMESTAMPTZ,
  end_at       TIMESTAMPTZ,
  billing_key  TEXT,
  customer_key TEXT,
  grace_until  DATE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_subscription" ON subscriptions
  USING (auth.uid() = user_id);
CREATE POLICY "own_subscription_insert" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_subscription_update" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- notifications (알림 발송 이력)
-- ========================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  content    JSONB,
  sent_at    TIMESTAMPTZ DEFAULT now(),
  channel    TEXT DEFAULT 'kakao',
  status     TEXT DEFAULT 'sent' CHECK (status IN ('sent','failed','pending'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, sent_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_notifications" ON notifications
  USING (auth.uid() = user_id);

-- ========================================
-- profiles (사용자 공개 프로필 — auth.users 확장)
-- 카카오 알림톡 수신 번호 저장용
-- auth.users INSERT 시 트리거로 자동 생성
-- ========================================
CREATE TABLE IF NOT EXISTS profiles (
  user_id                  UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  phone                    TEXT,
  kakao_scan_notify        BOOLEAN DEFAULT true,
  kakao_competitor_notify  BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON profiles
  USING (auth.uid() = user_id);
CREATE POLICY "own_profile_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_profile_update" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- 회원가입 시 profiles 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- team_members (팀 계정 — Biz 플랜)
-- ========================================
CREATE TABLE IF NOT EXISTS team_members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'viewer')),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, email)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_team_members" ON team_members
  USING (auth.uid() = owner_id);
CREATE POLICY "own_team_members_insert" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own_team_members_delete" ON team_members
  FOR DELETE USING (auth.uid() = owner_id);

-- ========================================
-- api_keys (Public API 키 — Biz/Enterprise)
-- ========================================
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,
  key_hash     TEXT NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id, created_at DESC);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_api_keys" ON api_keys
  USING (auth.uid() = user_id);
CREATE POLICY "own_api_keys_insert" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_api_keys_update" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- ========================================
-- waitlist (대기자 명단 — Phase 0)
-- ========================================
CREATE TABLE IF NOT EXISTS waitlist (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT NOT NULL,
  business_name TEXT,
  category      TEXT,
  region        TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email)
);

-- ========================================
-- keyword_scan_results (키워드별 노출 추적 — Pro+)
-- ========================================
CREATE TABLE IF NOT EXISTS keyword_scan_results (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  biz_id               UUID REFERENCES businesses(id) ON DELETE CASCADE,
  scan_id              UUID REFERENCES scan_results(id) ON DELETE CASCADE,
  keyword              TEXT NOT NULL,
  query_used           TEXT NOT NULL,
  gemini_frequency     INTEGER DEFAULT 0,
  chatgpt_mentioned    BOOLEAN DEFAULT FALSE,
  perplexity_mentioned BOOLEAN DEFAULT FALSE,
  exposure_rate        NUMERIC(5,3) DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_keyword_scan_biz_id ON keyword_scan_results(biz_id, created_at DESC);

-- ========================================
-- 성능 인덱스 (v1.5 추가)
-- ========================================

-- 업종·지역 랭킹/벤치마크 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_businesses_category_active
  ON businesses(category, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_businesses_region_lower
  ON businesses(lower(region));

CREATE INDEX IF NOT EXISTS idx_businesses_category_region
  ON businesses(category, lower(region))
  WHERE is_active = true;

-- score_history 날짜 범위 조회 최적화
CREATE INDEX IF NOT EXISTS idx_score_history_date
  ON score_history(score_date DESC);

-- ai_citations 조회 최적화 (mention-context)
CREATE INDEX IF NOT EXISTS idx_ai_citations_biz_created
  ON ai_citations(business_id, created_at DESC);

-- before_after 조회 최적화
CREATE INDEX IF NOT EXISTS idx_before_after_biz_type
  ON before_after(business_id, capture_type, created_at DESC);

-- guides 최신 가이드 조회 최적화
CREATE INDEX IF NOT EXISTS idx_guides_biz_generated
  ON guides(business_id, generated_at DESC);

-- ========================================
-- Supabase Storage 버킷 (Storage 탭에서 수동 생성)
-- ========================================
-- before-after  : 스크린샷 저장 (Public, 파일 크기 제한 5MB)
-- 버킷 생성 후 RLS policy 추가:
--   INSERT: service_role only (백엔드에서만 업로드)
--   SELECT: public (이미지 공개 URL)
