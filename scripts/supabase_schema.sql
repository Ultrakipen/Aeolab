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
