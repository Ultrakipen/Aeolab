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
  excluded_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  custom_keywords   TEXT[] DEFAULT ARRAY[]::TEXT[],
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
  -- REMOVED: zeta_scanner deprecated (v3.0)
  -- zeta_result    JSONB,
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

-- businesses: category CHECK 제약 제거 (업종이 지속 추가되므로 애플리케이션 레벨에서 검증)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_category_check;

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

-- ============================================================
-- v3.4 RLS 정책 추가 (2026-04-03)
-- inquiries / keyword_scan_results / waitlist /
-- trial_scans / notices / faqs
-- ============================================================
-- 적용 방법: Supabase Dashboard > SQL Editor에 붙여넣기 실행
-- ============================================================

-- ----------------------------------------------------------
-- 1. inquiries (High — 이메일·문의 내용 보호)
-- ----------------------------------------------------------
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- 본인 문의 조회 (로그인 사용자만)
CREATE POLICY "inquiries_select_own" ON inquiries
  FOR SELECT
  USING (auth.uid() = user_id);

-- 문의 작성: 로그인 사용자는 본인 user_id, 비로그인은 user_id NULL 허용
CREATE POLICY "inquiries_insert" ON inquiries
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

-- UPDATE/DELETE는 policy 없음 → service_role(관리자)만 가능

-- ----------------------------------------------------------
-- 2. keyword_scan_results (High — Pro+ 유료 데이터 보호)
--    biz_id 컬럼으로 businesses 테이블 소유권 검증
-- ----------------------------------------------------------
ALTER TABLE keyword_scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "keyword_scan_own" ON keyword_scan_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = keyword_scan_results.biz_id
        AND b.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------
-- 3. waitlist (Medium — 이메일 목록 보호)
-- ----------------------------------------------------------
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- 대기 등록: 누구나 INSERT 가능 (체험 전환 유입용)
CREATE POLICY "waitlist_insert" ON waitlist
  FOR INSERT
  WITH CHECK (true);

-- SELECT는 policy 없음 → service_role(관리자 대시보드)만 조회 가능

-- ----------------------------------------------------------
-- 4. trial_scans (Medium — 이메일 컬럼 보호)
-- ----------------------------------------------------------
ALTER TABLE trial_scans ENABLE ROW LEVEL SECURITY;

-- 비로그인 체험 결과 INSERT: 누구나 가능
CREATE POLICY "trial_scans_insert" ON trial_scans
  FOR INSERT
  WITH CHECK (true);

-- SELECT는 policy 없음 → 백엔드 service_role로만 조회 (ip_hash·email 보호)

-- ----------------------------------------------------------
-- 5. notices (Low — 공개 데이터, 명시적 읽기 허용)
-- ----------------------------------------------------------
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- 공개 읽기: 누구나 조회 가능
CREATE POLICY "notices_public_read" ON notices
  FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE는 policy 없음 → service_role(관리자)만 가능

-- ----------------------------------------------------------
-- 6. faqs (Low — 공개 데이터, 명시적 읽기 허용)
-- ----------------------------------------------------------
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- 공개 읽기: 누구나 조회 가능
CREATE POLICY "faqs_public_read" ON faqs
  FOR SELECT
  USING (true);

-- =============================================
-- v3.2 마이그레이션 (2026-04-03)
-- index_snapshots: 분기별 업종×지역 AI 가시성 집계 스냅샷
-- =============================================

-- ============================================================
-- index_snapshots: 분기별 업종×지역 AI 가시성 집계 스냅샷
-- 공개 인덱스 리포트용 데이터 저장 (개인정보 없음, 익명화 집계)
-- sample_count < 5인 행은 API에서 비공개 처리
-- ============================================================
CREATE TABLE IF NOT EXISTS index_snapshots (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quarter         TEXT NOT NULL,           -- '2026-Q2' 형식
  category        TEXT NOT NULL,
  region          TEXT,                    -- NULL = 전국 집계
  sample_count    INTEGER NOT NULL DEFAULT 0,
  avg_unified     NUMERIC(5,2),
  avg_track1      NUMERIC(5,2),
  avg_track2      NUMERIC(5,2),
  p25_unified     NUMERIC(5,2),
  p50_unified     NUMERIC(5,2),
  p75_unified     NUMERIC(5,2),
  p90_unified     NUMERIC(5,2),
  top_keywords    TEXT[] DEFAULT '{}',
  platform_stats  JSONB DEFAULT '{}',
  growth_dist     JSONB DEFAULT '{}',
  computed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_index_snapshots_unique
  ON index_snapshots(quarter, category, COALESCE(region, '전국'));

CREATE INDEX IF NOT EXISTS idx_index_snapshots_quarter
  ON index_snapshots(quarter DESC, category);

CREATE INDEX IF NOT EXISTS idx_index_snapshots_cat_region
  ON index_snapshots(category, region, quarter DESC);

-- RLS: 읽기는 공개, 쓰기는 service role만
ALTER TABLE index_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "index_snapshots_public_read"
  ON index_snapshots FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE는 policy 없음 → service_role(관리자)만 가능

-- =============================================
-- v3.3 마이그레이션 (2026-04-03): trial_scans v3.0 필드 추가
-- =============================================
ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS track1_score            NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS track2_score            NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS unified_score           NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS naver_weight            NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS global_weight           NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS growth_stage            TEXT,
  ADD COLUMN IF NOT EXISTS top_missing_keywords    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keyword_coverage        NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS naver_result            JSONB,
  ADD COLUMN IF NOT EXISTS kakao_result            JSONB,
  ADD COLUMN IF NOT EXISTS website_check_result    JSONB,
  ADD COLUMN IF NOT EXISTS smart_place_completeness INTEGER,
  ADD COLUMN IF NOT EXISTS has_faq                 BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_recent_post         BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_intro               BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_trial_scans_growth_stage
  ON trial_scans(growth_stage, category, region);

CREATE INDEX IF NOT EXISTS idx_trial_scans_category_region_v2
  ON trial_scans(category, region, scanned_at DESC);

-- =============================================
-- v3.4 마이그레이션 (2026-04-03): scan_analytics 테이블
-- 스캔마다 익명화 통계 저장 — 개인정보 없음
-- =============================================
CREATE TABLE IF NOT EXISTS scan_analytics (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_type            TEXT NOT NULL CHECK (scan_type IN ('trial', 'full')),
  category             TEXT NOT NULL,
  region               TEXT,
  track1_score         NUMERIC(5,2),
  track2_score         NUMERIC(5,2),
  unified_score        NUMERIC(5,2),
  naver_weight         NUMERIC(4,2),
  global_weight        NUMERIC(4,2),
  growth_stage         TEXT,
  top_missing_keywords TEXT[] DEFAULT '{}',
  keyword_coverage     NUMERIC(4,2),
  platform_mentioned   JSONB DEFAULT '{}',
  smart_place_score    INTEGER,
  scanned_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_analytics_category_region
  ON scan_analytics(category, region, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_analytics_growth_stage
  ON scan_analytics(growth_stage, category);
CREATE INDEX IF NOT EXISTS idx_scan_analytics_scanned_at
  ON scan_analytics(scanned_at DESC);

-- RLS: 읽기 공개, 쓰기는 service role만
ALTER TABLE scan_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_analytics_public_read"
  ON scan_analytics FOR SELECT USING (true);

-- =============================================
-- v3.5 마이그레이션 (2026-04-03): competitor_snapshots + scan_analytics 컬럼 추가
-- =============================================

-- 경쟁사 AI 노출 현황 독립 저장 (익명화 — 상호명/ID 없음)
CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category        TEXT NOT NULL,
  region          TEXT,
  mentioned       BOOLEAN NOT NULL DEFAULT false,
  score           INTEGER,
  track1_score    NUMERIC(5,2),
  track2_score    NUMERIC(5,2),
  unified_score   NUMERIC(5,2),
  growth_stage    TEXT,
  scanned_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_category_region
  ON competitor_snapshots(category, region, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_growth_stage
  ON competitor_snapshots(growth_stage, category);

ALTER TABLE competitor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitor_snapshots_public_read"
  ON competitor_snapshots FOR SELECT USING (true);

-- scan_analytics에 경쟁사 통계 컬럼 추가
ALTER TABLE scan_analytics
  ADD COLUMN IF NOT EXISTS competitor_count           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS competitor_mentioned_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS competitor_avg_score       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS my_vs_competitor_gap       NUMERIC(5,2);

-- =============================================
-- v3.6 마이그레이션 (2026-04-03): 쿼리 다양화 + 리뷰 스냅샷
-- =============================================

-- scan_analytics에 쿼리 노출 + 리뷰 스냅샷 컬럼 추가
ALTER TABLE scan_analytics
  ADD COLUMN IF NOT EXISTS query_exposure  JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review_count    INTEGER,
  ADD COLUMN IF NOT EXISTS avg_rating      NUMERIC(3,1);

-- competitor_snapshots에 리뷰 스냅샷 추가
ALTER TABLE competitor_snapshots
  ADD COLUMN IF NOT EXISTS review_count  INTEGER,
  ADD COLUMN IF NOT EXISTS avg_rating    NUMERIC(3,1);

-- review_snapshots: 가게별 리뷰 시계열 (개인 히스토리용)
CREATE TABLE IF NOT EXISTS review_snapshots (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  review_count INTEGER,
  avg_rating   NUMERIC(3,1),
  snapped_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_snapshots_biz_date
  ON review_snapshots(business_id, snapped_at DESC);

-- =============================================
-- v3.7 마이그레이션 (2026-04-07): scan_results v3.0 누락 컬럼 추가
-- growth_stage, growth_stage_label, is_keyword_estimated,
-- top_missing_keywords, naver_weight, global_weight
-- =============================================
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS growth_stage         TEXT,
  ADD COLUMN IF NOT EXISTS growth_stage_label   TEXT,
  ADD COLUMN IF NOT EXISTS is_keyword_estimated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS top_missing_keywords TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS naver_weight         FLOAT,
  ADD COLUMN IF NOT EXISTS global_weight        FLOAT;

-- =============================================
-- v3.1 마이그레이션 (2026-04-07): 사업자등록번호 컬럼 추가
-- =============================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_registration_no TEXT;

-- =============================================
-- v3.1 마이그레이션 — 인스타그램 연동 + 3채널 개편 (2026-04-08)
-- =============================================

-- businesses 테이블: 인스타그램 연동 정보
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS instagram_username       TEXT,
  ADD COLUMN IF NOT EXISTS instagram_connected      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS instagram_follower_count INTEGER,
  ADD COLUMN IF NOT EXISTS instagram_post_count_30d INTEGER;

-- scan_results 테이블: 인스타그램 시그널 결과
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS instagram_result JSONB;

-- 인덱스: 인스타그램 연동 사업장 조회
CREATE INDEX IF NOT EXISTS idx_businesses_instagram
  ON businesses(instagram_connected)
  WHERE instagram_connected = TRUE;

-- =============================================
-- v3.2 마이그레이션 (2026-04-08): 카카오맵 완성도 체크리스트
-- =============================================

-- businesses 테이블: 카카오맵 완성도 관련 컬럼
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS kakao_checklist   JSONB    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kakao_score       INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kakao_registered  BOOLEAN  DEFAULT FALSE;

-- 인덱스: 카카오맵 등록 사업장 조회
CREATE INDEX IF NOT EXISTS idx_businesses_kakao_registered
  ON businesses(kakao_registered)
  WHERE kakao_registered = TRUE;

-- 인덱스: 카카오 점수 순위 조회 (category별)
CREATE INDEX IF NOT EXISTS idx_businesses_kakao_score
  ON businesses(category, kakao_score DESC)
  WHERE kakao_score > 0;

-- =============================================
-- v3.3 마이그레이션 (2026-04-08): 무료 스캔 우회 방지
-- 사업장 삭제 후 재등록해도 무료 스캔 1회 이상 사용 불가
-- =============================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS free_scan_used    BOOLEAN    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS free_scan_used_at TIMESTAMPTZ;

-- =============================================
-- v3.4 마이그레이션 (2026-04-09): 네이버 데이터 연동
-- =============================================

-- 1. competitors 테이블: 네이버 플레이스 데이터 컬럼 추가
ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS naver_place_id       TEXT,
  ADD COLUMN IF NOT EXISTS place_review_count   INTEGER,
  ADD COLUMN IF NOT EXISTS place_avg_rating     NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS place_has_faq        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS place_has_recent_post BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS place_has_menu       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS place_photo_count    INTEGER,
  ADD COLUMN IF NOT EXISTS place_synced_at      TIMESTAMPTZ;

-- 인덱스: 경쟁사 네이버 플레이스 조회 (naver_place_id 있는 행만)
CREATE INDEX IF NOT EXISTS idx_competitors_naver_place
  ON competitors(business_id, naver_place_id)
  WHERE naver_place_id IS NOT NULL;

-- 2. keyword_search_volume 테이블: 키워드 검색량 (네이버 DataLab)
CREATE TABLE IF NOT EXISTS keyword_search_volume (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword      TEXT NOT NULL,
  category     TEXT NOT NULL,
  monthly_pc   INTEGER DEFAULT 0,
  monthly_mo   INTEGER DEFAULT 0,
  competition  TEXT,
  trend_data   JSONB,
  synced_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(keyword, category)
);

ALTER TABLE keyword_search_volume ENABLE ROW LEVEL SECURITY;

-- 키워드 검색량은 공통 참조 데이터 — 인증 사용자 읽기 허용
CREATE POLICY "authenticated users can read keyword volume"
  ON keyword_search_volume FOR SELECT
  USING (auth.role() = 'authenticated');

-- 인덱스: 업종별 PC 검색량 내림차순 조회
CREATE INDEX IF NOT EXISTS idx_keyword_volume_category
  ON keyword_search_volume(category, monthly_pc DESC);

-- 3. industry_trends 테이블: 업종별 트렌드 (네이버 DataLab)
CREATE TABLE IF NOT EXISTS industry_trends (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category        TEXT NOT NULL,
  region          TEXT,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  trend_data      JSONB NOT NULL,
  trend_direction TEXT,
  trend_delta     NUMERIC(5,1),
  synced_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, region, period_start, period_end)
);

ALTER TABLE industry_trends ENABLE ROW LEVEL SECURITY;

-- 업종 트렌드도 공통 참조 데이터 — 인증 사용자 읽기 허용
CREATE POLICY "authenticated users can read industry trends"
  ON industry_trends FOR SELECT
  USING (auth.role() = 'authenticated');

-- 인덱스: 업종·최신순 조회
CREATE INDEX IF NOT EXISTS idx_industry_trends_cat
  ON industry_trends(category, synced_at DESC);


-- ============================================================
-- v4.0 ALTER TABLE — 네이버 데이터 연동 서비스 3종 (2026-04-09)
-- ============================================================

-- 1. competitors 테이블: 네이버 플레이스 크롤링 결과 컬럼 추가
ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS naver_place_id            TEXT,
  ADD COLUMN IF NOT EXISTS naver_review_count        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS naver_avg_rating          NUMERIC(3,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_faq                   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_recent_post           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_menu                  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS naver_photo_count         INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS naver_place_name          TEXT,
  ADD COLUMN IF NOT EXISTS naver_place_last_synced_at TIMESTAMPTZ;

-- 인덱스: naver_place_id 조회
CREATE INDEX IF NOT EXISTS idx_competitors_naver_place_id
  ON competitors(naver_place_id)
  WHERE naver_place_id IS NOT NULL;

-- 2. keyword_volumes 테이블: 네이버 검색광고 키워드 검색량 캐시
CREATE TABLE IF NOT EXISTS keyword_volumes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword       TEXT NOT NULL,
  category      TEXT NOT NULL,
  monthly_pc    INT DEFAULT 0,
  monthly_mo    INT DEFAULT 0,
  monthly_total INT DEFAULT 0,
  competition   TEXT DEFAULT 'unknown',  -- high | medium | low | unknown
  cached_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(keyword, category)
);

ALTER TABLE keyword_volumes ENABLE ROW LEVEL SECURITY;

-- 인증 사용자 읽기 허용 (공통 참조 데이터)
CREATE POLICY "authenticated users can read keyword volumes"
  ON keyword_volumes FOR SELECT
  USING (auth.role() = 'authenticated');

-- 서비스 롤 전용 쓰기 허용
CREATE POLICY "service role can manage keyword volumes"
  ON keyword_volumes FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_keyword_volumes_lookup
  ON keyword_volumes(keyword, category, cached_at DESC);

-- 3. industry_trends 테이블 컬럼 보완
--    (기존: synced_at / period_start / period_end — 신규: cached_at / keywords_used 추가)
ALTER TABLE industry_trends
  ADD COLUMN IF NOT EXISTS cached_at     TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS keywords_used JSONB;

-- UNIQUE 제약 재정의 (category, region 쌍으로 단순화 — 날짜 구분 불필요)
-- 기존 unique 제약이 있으면 DROP 후 재생성 (안전 처리)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'industry_trends_category_region_period_start_period_end_key'
  ) THEN
    -- 기존 데이터 이전 UNIQUE는 유지, 새 upsert는 category+region 기준
    NULL;
  END IF;
END $$;

-- cached_at 기준 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_industry_trends_cat_cached
  ON industry_trends(category, region, cached_at DESC);

-- =============================================
-- v4.0 블로그 진단 연동 (2026-04-09)
-- =============================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS blog_url              TEXT,
  ADD COLUMN IF NOT EXISTS blog_analyzed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blog_keyword_coverage NUMERIC(4,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blog_post_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blog_latest_post_date DATE;

-- =============================================
-- v4.1 좌표(lat/lng) 컬럼 추가 (2026-04-09)
-- 사업장·경쟁사 지도 표시용 — 카카오 Geocoding API로 주소 변환 저장
-- =============================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- 지도 반경 검색 성능용 인덱스 (PostGIS 없이 btree로 대체)
CREATE INDEX IF NOT EXISTS idx_businesses_lat_lng
  ON businesses(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitors_lat_lng
  ON competitors(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- =============================================
-- v4.2 스마트플레이스 사용자 자기확인 컬럼 추가 (2026-04-10)
-- Playwright 미감지 시 사용자가 직접 완료 표시 가능하도록
-- =============================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS has_photos          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_review_response BOOLEAN DEFAULT FALSE;

-- =============================================
-- v4.3 경쟁사 상세 정보 컬럼 추가 (2026-04-10)
-- 블로그 언급 수, 웹사이트 SEO 점수, 보유 키워드 등 경쟁사 심층 분석용
-- =============================================
ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS blog_mention_count   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS website_url          TEXT,
  ADD COLUMN IF NOT EXISTS website_seo_score    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS website_seo_result   JSONB,
  ADD COLUMN IF NOT EXISTS comp_keywords        TEXT[],
  ADD COLUMN IF NOT EXISTS detail_synced_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_competitors_detail_synced
  ON competitors(business_id, detail_synced_at);

-- =============================================
-- v3.1: profiles 테이블 onboarding_done 컬럼 추가 (2026-04-11)
-- 온보딩 완료 여부 추적 (미완료 시 온보딩 가이드 재노출)
-- =============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE;

-- v3.1: scan_results 테이블 exposure_freq 컬럼 타입 확인용 주석
-- (기존 NUMERIC 컬럼 유지, 변경 없음)

-- =============================================
-- v4.5 competitors.has_intro 컬럼 추가 (2026-04-13)
-- competitor_place_crawler.py가 저장 시도하나 컬럼 누락으로 fallback만 동작했던 버그 수정
-- =============================================
ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS has_intro BOOLEAN DEFAULT FALSE;

-- =============================================
-- v4.5 businesses.blog_mention_count 컬럼 추가 (2026-04-13)
-- naver_visibility.py에서 수집한 블로그 언급 수를 내 가게에도 저장
-- =============================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS blog_mention_count INTEGER DEFAULT 0;

-- =============================================
-- v5.0 행동 완료 추적 + 경쟁사 변화 감지 (2026-04-13)
-- 1. action_completions: 행동 완료 → 7일 재스캔 → Before/After 결과 추적
-- 2. competitors.prev_*: 경쟁사 주간 변화 감지 기준값
-- =============================================

-- ── 1. 행동 완료 추적 테이블 ────────────────────────────
CREATE TABLE IF NOT EXISTS action_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'faq_keyword' | 'intro_keyword' | 'review_reply' | 'blog_post'
  keyword TEXT,              -- 추가한 키워드
  action_text TEXT,          -- 사용자가 복사해서 쓴 실제 텍스트
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  rescan_at TIMESTAMPTZ,     -- 완료 후 7일 뒤 (completed_at + 7일)
  rescan_done BOOLEAN DEFAULT FALSE,
  rescan_scan_id UUID,
  before_score NUMERIC,
  after_score NUMERIC,
  before_mentioned BOOLEAN,
  after_mentioned BOOLEAN,
  before_screenshot_url TEXT,
  after_screenshot_url TEXT,
  result_summary TEXT        -- FAQ 추가 후 AI 브리핑에 노출됨 등
);

CREATE INDEX IF NOT EXISTS idx_action_completions_biz ON action_completions(business_id);
CREATE INDEX IF NOT EXISTS idx_action_completions_rescan ON action_completions(rescan_at) WHERE rescan_done = FALSE;
CREATE INDEX IF NOT EXISTS idx_action_completions_user ON action_completions(user_id);

-- RLS
ALTER TABLE action_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can manage own actions" ON action_completions
  FOR ALL USING (auth.uid() = user_id);

-- ── 2. 경쟁사 변화 감지용 컬럼 추가 ────────────────────
ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS prev_has_faq BOOLEAN,
  ADD COLUMN IF NOT EXISTS prev_has_menu BOOLEAN,
  ADD COLUMN IF NOT EXISTS prev_has_recent_post BOOLEAN,
  ADD COLUMN IF NOT EXISTS prev_review_count INTEGER,
  ADD COLUMN IF NOT EXISTS prev_photo_count INTEGER,
  ADD COLUMN IF NOT EXISTS change_detected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS change_summary TEXT;  -- FAQ 신규 등록, 소식 추가


-- =============================================
-- v3.1 행동-결과 타임라인 테이블 (A-3, B-4)
-- 체크박스 체크/가이드 생성 날짜 저장 → 7일 후 점수 변화 연결
-- =============================================
CREATE TABLE IF NOT EXISTS business_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  -- action_type: faq_registered | intro_updated | post_published | review_replied | guide_generated
  action_label TEXT NOT NULL,
  action_date DATE NOT NULL DEFAULT CURRENT_DATE,
  score_before FLOAT,
  score_after FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_action_log_biz_date
  ON business_action_log(business_id, action_date DESC);

-- =============================================
-- v3.2 blog_analysis_json 컬럼 추가 (2026-04-14)
-- blog_analyzer.py 결과 저장: {posts, keywords, freshness_days, gap_keywords}
-- =============================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS blog_analysis_json JSONB;

-- =============================================
-- v3.3 guides.context CHECK 제약 수정 (2026-04-14)
-- 'faq_draft' 값 추가: FAQ 초안 월별 한도 체크에 필요
-- guides.context = 'faq_draft' 시 CHECK 위반으로 한도 카운트가 항상 0이었던 버그 수정
-- =============================================
ALTER TABLE guides DROP CONSTRAINT IF EXISTS guides_context_check;
ALTER TABLE guides
  ADD CONSTRAINT guides_context_check
  CHECK (context IN ('location_based', 'non_location', 'faq_draft'));

-- =============================================
-- v3.4 sp_completeness_json 컬럼 추가 (2026-04-16)
-- naver_place_stats.py check_smart_place_completeness() 결과 저장
-- {is_smart_place, has_faq, has_recent_post, has_intro, photo_count, review_count, score}
-- =============================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS sp_completeness_json JSONB;

-- =============================================
-- v3.5 before_after 테이블 — 블로그 키워드 스크린샷 지원 (2026-04-17)
-- before_after.capture_type CHECK 제약 확장: 'blog_keyword' 추가
-- before_after.keyword 컬럼 추가: 어떤 키워드로 캡처했는지 저장
-- =============================================
ALTER TABLE before_after DROP CONSTRAINT IF EXISTS before_after_capture_type_check;
ALTER TABLE before_after
  ADD CONSTRAINT before_after_capture_type_check
  CHECK (capture_type IN ('before', 'after_30d', 'after_60d', 'after_90d',
                          'before_naver_ai', 'before_google',
                          'blog_keyword'));
ALTER TABLE before_after
  ADD COLUMN IF NOT EXISTS keyword TEXT;

CREATE INDEX IF NOT EXISTS idx_before_after_blog_keyword
  ON before_after(business_id, capture_type, keyword, created_at DESC)
  WHERE capture_type = 'blog_keyword';

-- =============================================
-- v3.6 blog_analysis 테이블 추가 (2026-04-17)
-- 키워드별 네이버 블로그 검색 결과 구조화 분석 저장
-- blog-screenshots 스크린샷 방식 → 구조화 카드 방식 전환
-- =============================================
CREATE TABLE IF NOT EXISTS blog_analysis (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  keyword      TEXT NOT NULL,
  my_rank      INTEGER,           -- NULL = 상위 10위 내 미노출
  posts_json   JSONB NOT NULL DEFAULT '[]',  -- 상위 10개 포스팅 배열
  analyzed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 사업장+키워드 기준 최신 1개만 유지 (UPSERT용 고유 인덱스)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_analysis_biz_kw
  ON blog_analysis(business_id, keyword);

-- 최신 분석 결과 빠른 조회용
CREATE INDEX IF NOT EXISTS idx_blog_analysis_analyzed
  ON blog_analysis(business_id, analyzed_at DESC);


-- =============================================
-- v3.2: first_exposure 알림 추적
-- =============================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS first_exposure_notified_at TIMESTAMPTZ;


-- =============================================
-- v3.2: Basic 1회 무료 체험 (2026-04-22)
-- =============================================
-- 회원가입 후 결제 없이 Full Scan(4종 AI) 1회 + 가이드 1회 체험 허용
-- basic_trial_used: 이미 체험 사용 여부 (true → 차단)
-- basic_trial_used_at: 체험 사용 시각 (분석·마케팅용)
-- basic_trial_business_id: 체험 대상 사업장 (가이드 생성 허용 판정용)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS basic_trial_used         BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS basic_trial_used_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS basic_trial_business_id  UUID        REFERENCES businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_basic_trial_used
  ON profiles(basic_trial_used)
  WHERE basic_trial_used = TRUE;


-- =============================================
-- v3.3: 첫 달 50% 할인 추적 (2026-04-22)
-- =============================================
-- Basic 신규 가입자에게 첫 달 4,950원(50%) 자동 적용.
-- first_month_discount_until: 할인 적용 종료일(가입일 +30일). 초과 시 자동결제 정상가.
-- first_payment_amount: 첫 결제 실제 금액(감사 용도).
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS first_month_discount_until DATE,
  ADD COLUMN IF NOT EXISTS first_payment_amount       INT;

-- =============================================
-- billing_cycle 컬럼 추가 (2026-04-27)
-- =============================================
-- webhook.py가 결제 확정 시 billing_cycle='monthly'|'yearly' 저장.
-- 누락 시 settings/page.tsx SELECT 에러 → sub=null → 설정 페이지 "무료 플랜" 오표시.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly'));


-- =============================================
-- v3.4: 경쟁사 스마트플레이스 FAQ 수집 (2026-04-23)
-- =============================================
-- 경쟁사 사장님이 네이버 스마트플레이스에 등록한 FAQ 질문 텍스트를 주 1회 수집.
-- "내 가게에 없는 Q&A를 경쟁사는 가지고 있다"는 직접 증거 — ChatGPT로 얻을 수 없는 데이터.
-- 저작권 이슈를 피하기 위해 답변 본문은 저장하지 않고 질문 텍스트만 보관.
CREATE TABLE IF NOT EXISTS competitor_faqs (
  id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID      NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  naver_place_id  TEXT      NOT NULL,
  questions       JSONB     NOT NULL DEFAULT '[]'::jsonb,  -- list[str] 질문 텍스트
  question_count  INT       GENERATED ALWAYS AS (jsonb_array_length(questions)) STORED,
  collected_at    TIMESTAMPTZ DEFAULT NOW(),
  error           TEXT
);
CREATE INDEX IF NOT EXISTS idx_competitor_faqs_competitor_id ON competitor_faqs(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_faqs_collected_at  ON competitor_faqs(collected_at DESC);
ALTER TABLE competitor_faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitor_faqs_select_via_owner" ON competitor_faqs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM competitors c JOIN businesses b ON b.id = c.business_id
    WHERE c.id = competitor_faqs.competitor_id AND b.user_id = auth.uid()
  )
);

-- ============================================================
-- v3.2 — 사용자 맞춤 키워드 (2026-04-23)
-- 사용자가 블로그 진단·경쟁사 관리에서 키워드를 삭제/추가하면 저장
-- ============================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS excluded_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS custom_keywords TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_businesses_custom_keywords
  ON businesses USING GIN (custom_keywords);


-- ============================================================
-- v3.3 — 트라이얼 신뢰도 강화 1라운드 (2026-04-23)
-- 무료 체험 시 (a) 네이버 지역검색으로 매칭된 가게 데이터,
--                (b) 스마트플레이스 자동 진단 결과를 보존.
-- 회원가입 → 사업장 등록으로 이어질 때 미리 채워진 정보로 활용 가능.
-- ============================================================

ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS place_data        JSONB,
  ADD COLUMN IF NOT EXISTS smart_place_check JSONB;


-- ============================================================
-- v3.4 — 트라이얼 신뢰도 강화 2라운드 (2026-04-23)
-- 무료 체험에서 사용된 Gemini 10회 샘플링의 AI 응답 원문
-- (쿼리·가게명 언급 여부·발췌문)을 보존해 사용자가
-- "AI가 실제로 내 가게를 인식하는지" 직접 증거로 확인 가능.
-- ============================================================

ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS ai_evidence JSONB;


-- ============================================================
-- v3.7 -- 재방문 변화 요약 (2026-04-24)
-- 대시보드 재방문 시 last_dashboard_visit 이후 점수 변화를
-- 사용자에게 요약해 보여주기 위한 방문 타임스탬프 컬럼.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_dashboard_visit TIMESTAMPTZ;


-- =============================================
-- 테스트 계정 구독 행 삽입 (개발용, 2026-04-27)
-- =============================================
-- hoozdev@gmail.com → plan: basic
-- hoozdev_pro@gmail.com → plan: pro
-- hoozdev_biz@gmail.com → plan: biz
--
-- 실행 전: 이 3개 계정이 Supabase Auth에 가입되어 있는지 확인하세요.
-- 미가입 시 INSERT ... SELECT에서 0행 삽입됨 (오류 아님).
INSERT INTO subscriptions (user_id, plan, status, start_at, end_at, billing_cycle)
SELECT
  id AS user_id,
  CASE
    WHEN email = 'hoozdev@gmail.com'      THEN 'basic'
    WHEN email = 'hoozdev_pro@gmail.com'  THEN 'pro'
    WHEN email = 'hoozdev_biz@gmail.com'  THEN 'biz'
  END AS plan,
  'active'   AS status,
  NOW()      AS start_at,
  NOW() + INTERVAL '10 years' AS end_at,
  'monthly'  AS billing_cycle
FROM auth.users
WHERE email IN (
  'hoozdev@gmail.com',
  'hoozdev_pro@gmail.com',
  'hoozdev_biz@gmail.com'
)
ON CONFLICT (user_id) DO UPDATE SET
  plan       = EXCLUDED.plan,
  status     = 'active',
  end_at     = NOW() + INTERVAL '10 years';

-- ===========================================================
-- v4.0 단계 0: AI 브리핑 노출 설정 추적 + 업종 분류
-- 2026-04-30 — FAQ 별도 메뉴 없음 확정 (4개 출처 일치)
--             업종별 AI 브리핑 대상 분리
-- ===========================================================

-- 사용자가 직접 확인하는 AI 정보 탭 상태
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS ai_info_tab_status TEXT
    DEFAULT 'unknown'
    CHECK (ai_info_tab_status IN ('not_visible', 'off', 'on', 'disabled', 'unknown'));

COMMENT ON COLUMN businesses.ai_info_tab_status IS
  '스마트플레이스 → 업체정보 → AI 정보 탭 상태 (사용자 직접 확인).
   not_visible=메뉴 없음(비대상), off=OFF, on=ON, disabled=비활성(조건미달), unknown=미확인';

-- ===========================================================
-- v4.1 (2026-04-30): 프랜차이즈 게이팅 + 생성 콘텐츠 초안 저장
-- 근거: 네이버 공식(help.naver.com/service/30026/contents/24632)
--      "프랜차이즈 업종의 경우 현재 제공되지 않으며 추후 확대 예정"
-- ===========================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS is_franchise BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN businesses.is_franchise IS
  '프랜차이즈 가맹점 여부. TRUE면 ACTIVE 업종(음식점/카페 등)이어도 AI 브리핑 inactive 처리.
   네이버 공식 2026-04-30 확인 — 프랜차이즈는 현재 AI 브리핑 제공 대상 제외(추후 확대 예정)';

-- AI 자동 생성 콘텐츠 초안 저장 (재방문 시 재로드용)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS naver_intro_draft TEXT,
  ADD COLUMN IF NOT EXISTS naver_intro_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS talktalk_faq_draft JSONB,
  ADD COLUMN IF NOT EXISTS talktalk_faq_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN businesses.naver_intro_draft IS
  'Claude Sonnet 자동 생성 소개글 최신 초안 (재생성 시 덮어씀). 사용자 복사용';
COMMENT ON COLUMN businesses.talktalk_faq_draft IS
  '톡톡 FAQ + 채팅방 메뉴 자동 생성 최신 초안. JSON: {items: [...], chat_menus: [...]}';


-- ===========================================================
-- 2026-05-01: score_history.score_breakdown 컬럼 추가
-- score_attribution 엔드포인트가 항목별 변화 분석을 위해 필요.
-- ALTER 미실행 시 routers/report.py가 graceful fallback으로 unified_score만 사용 (기능 약화).
-- ===========================================================
ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

COMMENT ON COLUMN score_history.score_breakdown IS
  '점수 항목별 분해(JSONB). 예: {"keyword_gap_score": 30, "review_quality": 60, ...}.
   score_attribution 분석 시 행동 전후 항목별 변화 산출에 사용.';


-- ===========================================================
-- 2026-04-30 Phase A: 키워드 순위 추적 + 카카오 자동 점검 + 월별 추천 한도
-- (graceful fallback 설계 — 미실행 시 서비스 정상 동작, 단 schema 동기화 필요)
-- ===========================================================

-- businesses: 그룹 분류 + 카카오 자동 점검
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS user_group TEXT,
  ADD COLUMN IF NOT EXISTS kakao_auto_check_result JSONB,
  ADD COLUMN IF NOT EXISTS kakao_auto_check_at TIMESTAMPTZ;

COMMENT ON COLUMN businesses.user_group IS
  'ACTIVE / LIKELY / INACTIVE — briefing_engine.get_briefing_eligibility() 결과 캐시. score_engine.NAVER_TRACK_WEIGHTS_V3_1 분기에 사용';
COMMENT ON COLUMN businesses.kakao_auto_check_result IS
  '카카오맵 자동 점검 결과 (JSONB). naver_place_stats.get_kakao_place_info() 반환값 저장';

-- scan_results: 키워드 순위 + 측정 컨텍스트 + 블로그 C-rank
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS keyword_ranks JSONB,
  ADD COLUMN IF NOT EXISTS measurement_context JSONB,
  ADD COLUMN IF NOT EXISTS blog_crank_score FLOAT;

COMMENT ON COLUMN scan_results.keyword_ranks IS
  '키워드별 순위 결과 JSONB. [{keyword, pc_rank, mobile_rank, place_rank, measured_at}]';
COMMENT ON COLUMN scan_results.blog_crank_score IS
  '블로그 C-rank 추정값 (0~100). blog_analyzer.estimate_crank_score() 산출';

-- score_history: 키워드 순위 평균 + 블로그 C-rank + 그룹 스냅샷
ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS keyword_rank_avg FLOAT,
  ADD COLUMN IF NOT EXISTS blog_crank_score FLOAT,
  ADD COLUMN IF NOT EXISTS user_group_snapshot TEXT;

COMMENT ON COLUMN score_history.keyword_rank_avg IS
  '스캔 시점 키워드 평균 순위 (낮을수록 좋음). 추세 분석용';

-- notifications: 키워드 변동 알림 페이로드
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS keyword_change_payload JSONB;

COMMENT ON COLUMN notifications.keyword_change_payload IS
  '키워드 순위 변동 알림 세부 내용. {keyword, prev_rank, curr_rank, delta}';

-- profiles: 키워드 자동 추천 월별 한도 + 리셋 타임스탬프
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS keyword_suggest_count_month INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keyword_suggest_reset_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.keyword_suggest_count_month IS
  '이번 달 키워드 자동 추천 사용 횟수. 플랜별 한도: Free/Basic 1, Pro 4, Biz 10';
COMMENT ON COLUMN profiles.keyword_suggest_reset_at IS
  '키워드 추천 한도 리셋 타임스탬프 (매월 1일 자동 리셋)';

-- trial_scans: 클레임 전환 깔때기 (v3.6)
ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_email TEXT,
  ADD COLUMN IF NOT EXISTS converted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN trial_scans.claimed_at IS
  '사용자가 Trial 결과를 클레임(저장 요청)한 시각';
COMMENT ON COLUMN trial_scans.converted_user_id IS
  'Trial 클레임 후 회원가입·로그인 완료된 사용자 auth.users.id (전환율 측정용)';


-- =============================================
-- §3.2 사진 카테고리 진단 (2026-05-04)
-- =============================================
-- 네이버 AI 이미지 필터 카테고리별 사진 수 저장
-- 예: {"음식-음료": 12, "메뉴": 0, "풍경": 5}
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS photo_categories JSONB;

COMMENT ON COLUMN scan_results.photo_categories IS
  '네이버 AI 이미지 필터 카테고리별 사진 수 {"음식-음료": 12, "메뉴": 0, "풍경": 5}';


-- =============================================
-- Sprint 1: 대행 의뢰 게시판 (2026-05-04)
-- =============================================
-- delivery_orders: 대행 의뢰 — 비밀 게시판 글 1행 1글
-- delivery_messages: 의뢰 내 운영자·사용자 메시지

CREATE TABLE IF NOT EXISTS delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL CHECK (package_type IN ('smartplace_register','ai_optimization','comprehensive')),
  amount INT NOT NULL,
  payment_key TEXT,                   -- 토스 결제 키
  order_name TEXT,                    -- 토스 orderName

  -- 게시글 본문
  request_title TEXT NOT NULL,
  request_body TEXT NOT NULL,

  -- 사용자 노출 상태 (3단계 단순화)
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received','in_progress','completed','rework','refunded','cancelled'
  )),

  -- 위임 동의
  consent_agreed BOOLEAN DEFAULT FALSE,
  consent_signed_at TIMESTAMPTZ,
  consent_ip TEXT,

  -- 자료
  materials_url JSONB DEFAULT '[]'::jsonb,

  -- 작업 진행
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,
  completion_report JSONB,

  -- 30일 재진단 (패키지 03만)
  score_before NUMERIC,
  score_after NUMERIC,
  followup_scan_id UUID,
  rework_reason TEXT,
  rework_count INT DEFAULT 0,

  -- 환불·후기
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

COMMENT ON TABLE delivery_orders IS '대행 의뢰 — 비밀 게시판 글 1행 1글. 패키지별 가격: smartplace_register=49k, ai_optimization=79k, comprehensive=119k';
COMMENT ON COLUMN delivery_orders.package_type IS '패키지 타입: smartplace_register(4.9만), ai_optimization(7.9만), comprehensive(11.9만)';
COMMENT ON COLUMN delivery_orders.amount IS '결제 금액 (원)';
COMMENT ON COLUMN delivery_orders.status IS 'received→in_progress→completed 또는 rework→refunded/cancelled';
COMMENT ON COLUMN delivery_orders.consent_agreed IS '위임 동의 여부 (계약)';
COMMENT ON COLUMN delivery_orders.score_before IS '30일 재진단 시작 전 점수 (comprehensive 패키지만)';
COMMENT ON COLUMN delivery_orders.score_after IS '30일 재진단 완료 후 점수 (comprehensive 패키지만)';
COMMENT ON COLUMN delivery_orders.rework_count IS '추가 작업 회차 (최대 2회)';


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

COMMENT ON TABLE delivery_messages IS '의뢰 내 운영자·사용자 메시지';
COMMENT ON COLUMN delivery_messages.author_type IS 'user(사용자) 또는 admin(운영자)';
COMMENT ON COLUMN delivery_messages.author_id IS '작성자 auth.users.id (author_type=admin인 경우도 저장)';
COMMENT ON COLUMN delivery_messages.read_at IS '수신자가 읽은 시각 (null=미읽)';

-- =============================================
-- Sprint 2 마이그레이션 — Q&A 게시판 (2026-05-04)
-- =============================================

-- ──────────────────────────────────────────
-- 1. support_tickets (Q&A 게시판 글)
-- ──────────────────────────────────────────
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

-- 인덱스: 사용자별 글 조회, 상태별 글 조회, 공개된 답변글
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_public ON support_tickets(visibility, status)
  WHERE visibility = 'public' AND status = 'answered';

-- RLS: 본인 글만 조회 / 공개된 답변글도 조회 가능
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_tickets" ON support_tickets;
CREATE POLICY "user_own_tickets" ON support_tickets FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "public_answered_tickets" ON support_tickets;
CREATE POLICY "public_answered_tickets" ON support_tickets FOR SELECT
  USING (visibility = 'public' AND status = 'answered');

COMMENT ON TABLE support_tickets IS '사용자 Q&A 게시판 글';
COMMENT ON COLUMN support_tickets.category IS '카테고리: payment(결제), feature(기능), score(점수), bug(버그), other(기타)';
COMMENT ON COLUMN support_tickets.visibility IS '공개 범위: private(비공개), public(공개)';
COMMENT ON COLUMN support_tickets.status IS '상태: open(열림), answered(답변됨), closed(종료)';
COMMENT ON COLUMN support_tickets.attachment_urls IS '첨부 파일 URL 배열 (Storage 퍼블릭 파일)';
COMMENT ON COLUMN support_tickets.view_count IS '조회수 (public answered만 증가)';

-- ──────────────────────────────────────────
-- 2. support_replies (Q&A 답변·코멘트)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','admin')),
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 글 내 답변 조회 (최신순)
CREATE INDEX IF NOT EXISTS idx_replies_ticket ON support_replies(ticket_id, created_at);

-- RLS: 본인 글 또는 공개된 글의 답변만 조회 / 열린 글에만 댓글 작성
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

COMMENT ON TABLE support_replies IS '글 내 답변·코멘트 (사용자 또는 관리자)';
COMMENT ON COLUMN support_replies.author_type IS 'user(사용자) 또는 admin(운영자)';
COMMENT ON COLUMN support_replies.author_id IS '작성자 auth.users.id';

