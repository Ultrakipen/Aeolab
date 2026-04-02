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
-- trial_scans (무료 체험 스캔 데이터 — 시장 정보 축적)
-- ========================================
-- 비로그인 체험 결과를 저장해 벤치마크·시장 데이터로 활용
-- 개인정보: IP는 SHA256 해시 저장, 이메일은 선택 수집
CREATE TABLE IF NOT EXISTS trial_scans (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scanned_at                 TIMESTAMPTZ DEFAULT now(),

  -- 사업장 정보 (공개 정보)
  business_name              TEXT NOT NULL,
  category                   TEXT,
  region                     TEXT,
  keyword                    TEXT,
  email                      TEXT,  -- 선택 입력, waitlist와 연계

  -- 내 가게 네이버 가시성
  is_smart_place             BOOLEAN,
  naver_rank                 INT,        -- NULL = 미노출
  blog_mentions              INT,
  search_query               TEXT,       -- 실제 사용된 검색어

  -- 경쟁 데이터
  naver_competitors          JSONB,      -- [{rank, name, address, category}]
  top_competitor_name        TEXT,
  top_competitor_blog_count  INT,

  -- AI 스캔 결과
  ai_mentioned               BOOLEAN,
  total_score                NUMERIC(5,1),
  grade                      TEXT,
  score_breakdown            JSONB,

  -- 카카오맵 가시성
  kakao_rank                 INT,        -- NULL = 미노출
  is_on_kakao                BOOLEAN,
  kakao_competitors          JSONB,      -- [{rank, name, address, category}]

  -- 메타
  ip_hash                    TEXT        -- SHA256(IP), 개인정보 비식별화
);

-- 벤치마크 집계용 인덱스
CREATE INDEX IF NOT EXISTS idx_trial_scans_category_region
  ON trial_scans(category, lower(region), scanned_at DESC);

-- 이메일 재접촉용 인덱스
CREATE INDEX IF NOT EXISTS idx_trial_scans_email
  ON trial_scans(email)
  WHERE email IS NOT NULL;

-- 특정 업체 재방문 추적
CREATE INDEX IF NOT EXISTS idx_trial_scans_business
  ON trial_scans(lower(business_name), lower(region));

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
-- v1.7 신규 컬럼 추가 (ALTER TABLE)
-- Supabase SQL Editor에서 실행하세요
-- ========================================

-- businesses: Google/카카오 Place ID (정보 완성도 + 채널 점수에 반영)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS kakao_place_id  TEXT;

-- scan_results: 채널 분리 점수 + 카카오 스캔 결과 + 웹사이트 SEO 체크 결과
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS naver_channel_score  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS global_channel_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS kakao_result         JSONB,
  ADD COLUMN IF NOT EXISTS website_check_result JSONB;

-- 채널 점수 인덱스 (채널별 랭킹 조회용)
CREATE INDEX IF NOT EXISTS idx_scan_naver_channel
  ON scan_results(business_id, naver_channel_score DESC);
CREATE INDEX IF NOT EXISTS idx_scan_global_channel
  ON scan_results(business_id, global_channel_score DESC);

-- ========================================
-- v1.8 신규 컬럼 추가 (ALTER TABLE)
-- Supabase SQL Editor에서 실행하세요
-- ========================================

-- score_history: 채널 점수 시계열 추적
ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS naver_channel_score  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS global_channel_score NUMERIC(5,2);

-- businesses: category CHECK 제약 완화 (더 많은 업종 허용)
-- 기존 CHECK 제약 삭제 후 재생성
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_category_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_category_check
  CHECK (category IN (
    'restaurant','cafe','hospital','academy','law','beauty','shop',
    'bakery','gym','pet','pharmacy','convenience','laundry',
    'clinic','dental','hair','nail','massage',
    'food','health','education','professional','shopping','living','culture','media','accommodation',
    'online','expert','creator','startup','other'
  ));

-- businesses: 트랙 구분 컬럼 추가 (위치 기반 / 비위치 기반)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'location_based'
    CHECK (business_type IN ('location_based', 'non_location'));

-- ========================================
-- v1.9 신규 컬럼 추가 (ALTER TABLE)
-- Supabase SQL Editor에서 실행하세요
-- ========================================

-- guides: 체크리스트 완료 항목 DB 저장 (rank 번호 배열)
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS checklist_done JSONB DEFAULT '[]';

-- businesses: 영수증 리뷰 / 방문자 리뷰 수 수동 입력 (네이버 AI 브리핑 신뢰도 신호)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS receipt_review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitor_review_count INTEGER DEFAULT 0;

-- ========================================
-- Supabase Storage 버킷 (Storage 탭에서 수동 생성)
-- ========================================
-- before-after  : 스크린샷 저장 (Public, 파일 크기 제한 5MB)
-- 버킷 생성 후 RLS policy 추가:
--   INSERT: service_role only (백엔드에서만 업로드)
--   SELECT: public (이미지 공개 URL)

-- ========================================
-- v2.1 도메인 모델 시스템 신규 컬럼 추가 (ALTER TABLE)
-- Supabase SQL Editor에서 실행하세요
-- ========================================

-- guides: ActionPlan 구조화 데이터 저장
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS scan_id          UUID REFERENCES scan_results(id),
  ADD COLUMN IF NOT EXISTS context          TEXT DEFAULT 'location_based'
    CHECK (context IN ('location_based', 'non_location')),
  ADD COLUMN IF NOT EXISTS next_month_goal  TEXT,
  ADD COLUMN IF NOT EXISTS tools_json       JSONB DEFAULT '{}';

-- guides: items_json에 ActionItem 구조 저장 (기존 JSONB 컬럼 재사용)
-- tools_json: ActionTools (json_ld_schema, faq_list, keyword_list, blog_post_template, smart_place_checklist, seo_checklist)

-- score_history: context 컬럼 추가 (non_location 사업장 구분)
ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS context TEXT DEFAULT 'location_based';

-- businesses: receipt_review_count 혹시 없을 경우 보완
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS receipt_review_count INTEGER DEFAULT 0;

-- ========================================
-- v2.2 신규 테이블 + 뷰 추가
-- Supabase SQL Editor에서 실행하세요
-- ========================================

-- gap_cards (주간 경쟁사 갭 카드 이력)
-- gap_card.py가 생성한 PNG를 Storage에 올리고 URL·메타를 여기에 기록
CREATE TABLE IF NOT EXISTS gap_cards (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id          UUID REFERENCES businesses(id) ON DELETE CASCADE,
  card_type            TEXT DEFAULT 'weekly'
                         CHECK (card_type IN ('weekly', 'monthly', 'milestone')),
  region_label         TEXT,           -- 예: '역삼동 / 카페 AI 경쟁 현황'
  competitors_snapshot JSONB,          -- [{name, score, rank}] 스냅샷
  my_score             NUMERIC(5,2),
  my_rank              INTEGER,
  image_url            TEXT,           -- Supabase Storage 공개 URL
  kakao_share_url      TEXT,           -- 카카오톡 공유 URL (향후 활용)
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gap_cards_biz_created
  ON gap_cards(business_id, created_at DESC);

ALTER TABLE gap_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_gap_cards" ON gap_cards
  USING (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = gap_cards.business_id AND b.user_id = auth.uid()
  ));
CREATE POLICY "own_gap_cards_insert" ON gap_cards
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM businesses b WHERE b.id = gap_cards.business_id AND b.user_id = auth.uid()
  ));

-- weekly_scores 뷰 — 플랫폼·주간 단위 집계 (dev_doc § 2.3 기준)
-- scan_results JSONB에서 각 AI 플랫폼 언급 여부를 weekly 단위로 집계
CREATE OR REPLACE VIEW weekly_scores AS
SELECT
  sr.business_id,
  DATE_TRUNC('week', sr.scanned_at)                           AS week_start,
  COUNT(*)                                                    AS scan_count,
  AVG(sr.total_score)                                         AS avg_total_score,
  AVG(sr.exposure_freq)                                       AS avg_exposure_freq,
  AVG(sr.naver_channel_score)                                 AS avg_naver_channel,
  AVG(sr.global_channel_score)                                AS avg_global_channel,
  -- 플랫폼별 언급률 (JSONB → boolean)
  ROUND(
    AVG(CASE WHEN (sr.gemini_result->>'mentioned')::boolean THEN 1 ELSE 0 END) * 100, 1
  )                                                           AS gemini_mention_rate,
  ROUND(
    AVG(CASE WHEN (sr.chatgpt_result->>'mentioned')::boolean THEN 1 ELSE 0 END) * 100, 1
  )                                                           AS chatgpt_mention_rate,
  ROUND(
    AVG(CASE WHEN (sr.naver_result->>'mentioned')::boolean THEN 1 ELSE 0 END) * 100, 1
  )                                                           AS naver_mention_rate
FROM scan_results sr
GROUP BY sr.business_id, DATE_TRUNC('week', sr.scanned_at)
ORDER BY week_start DESC;


-- ========================================
-- v3.0 듀얼트랙 모델 — track 점수 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- ========================================

-- scan_results: 듀얼트랙 점수 + keyword_coverage 추가
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS track1_score     FLOAT,
  ADD COLUMN IF NOT EXISTS track2_score     FLOAT,
  ADD COLUMN IF NOT EXISTS unified_score    FLOAT,
  ADD COLUMN IF NOT EXISTS keyword_coverage FLOAT;

-- score_history: 듀얼트랙 점수 추가 (30일 추세용)
ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS track1_score  FLOAT,
  ADD COLUMN IF NOT EXISTS track2_score  FLOAT,
  ADD COLUMN IF NOT EXISTS unified_score FLOAT;

-- scan_results 검색 인덱스 (track1 기준 성장 단계 조회용)
CREATE INDEX IF NOT EXISTS idx_scan_results_track1
  ON scan_results(business_id, track1_score DESC, scanned_at DESC);

-- score_history 추세 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_score_history_tracks
  ON score_history(business_id, score_date DESC);

-- ========================================
-- v3.1 review_replies 테이블 추가
-- 리뷰 답변 초안 생성 이력 (guide.py /review-reply 엔드포인트)
-- Supabase SQL Editor에서 실행하세요
-- ========================================

CREATE TABLE IF NOT EXISTS review_replies (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  review_text   TEXT NOT NULL,
  reply_draft   TEXT NOT NULL,
  sentiment     TEXT NOT NULL DEFAULT 'neutral'
                  CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  keywords_used TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_replies_biz_created
  ON review_replies(business_id, created_at DESC);

ALTER TABLE review_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_review_replies" ON review_replies
  USING (EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = review_replies.business_id AND b.user_id = auth.uid()
  ));

CREATE POLICY "own_review_replies_insert" ON review_replies
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = review_replies.business_id AND b.user_id = auth.uid()
  ));


-- ========================================
-- v3.1 공지사항/FAQ 테이블 추가
-- Supabase SQL Editor에서 실행하세요
-- ========================================

CREATE TABLE IF NOT EXISTS notices (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',  -- general / update / maintenance
  is_pinned   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faqs (
  id          BIGSERIAL PRIMARY KEY,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',  -- general / pricing / scan / guide
  order_num   INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notices_pinned_created ON notices (is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faqs_category_order ON faqs (category, order_num);

-- ── v3.2 문의(Q&A) ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inquiries (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  subject      TEXT NOT NULL,
  content      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending / answered
  answer       TEXT,
  answered_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_user   ON inquiries (user_id, created_at DESC);

-- =============================================
-- v3.3 마이그레이션 (2026-04-02)
-- =============================================

-- 1. trial_scans — 팔로업 이메일 발송 추적 컬럼
--    체험 스캔 후 D+1/D+3/D+7 재접촉 이메일 관리
ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS followup_sent_1  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_sent_3  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_sent_7  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

-- trial_scans.email 컬럼은 v1.0 CREATE TABLE에 이미 존재
-- 혹시 누락된 환경을 위해 IF NOT EXISTS로 보완 추가
ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 팔로업 스케줄러용 인덱스 (미발송 + 이메일 있는 레코드 빠른 조회)
CREATE INDEX IF NOT EXISTS idx_trial_scans_followup
  ON trial_scans(scanned_at)
  WHERE email IS NOT NULL AND followup_sent_1 = FALSE;

-- 2. businesses — 네이버 플레이스 URL + 스마트플레이스 자동 체크 일시
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS naver_place_url              TEXT,
  ADD COLUMN IF NOT EXISTS smart_place_auto_checked_at  TIMESTAMPTZ;

-- 3. scan_results — 스마트플레이스 자동 체크 결과 (JSONB)
--    {is_smart_place, has_faq, has_recent_post, has_intro, score}
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS smart_place_completeness_result JSONB;

-- 4. review_replies — 기존 v3.1 테이블에 누락 컬럼 추가
--    (user_id, reviewer_name, rating, reply_type, is_posted, posted_at, updated_at)
ALTER TABLE review_replies
  ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS rating        INTEGER,
  ADD COLUMN IF NOT EXISTS reply_type    TEXT NOT NULL DEFAULT 'positive',
  ADD COLUMN IF NOT EXISTS is_posted     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS posted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS platform      TEXT NOT NULL DEFAULT 'naver',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- review_replies user_id 인덱스 (사용자별 답변 목록 조회)
CREATE INDEX IF NOT EXISTS idx_review_replies_user
  ON review_replies(user_id)
  WHERE user_id IS NOT NULL;
