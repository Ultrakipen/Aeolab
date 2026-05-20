-- v5.9: 운영자-사용자 소통 인프라 5개 테이블
-- Supabase SQL Editor에서 실행할 것

-- 1. 인앱 컨텍스트 팁 (운영자가 대시보드 섹션별로 노출)
CREATE TABLE IF NOT EXISTS context_tips (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  section         TEXT        NOT NULL,                         -- 'score' | 'action' | 'ai_insight' 등
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  cta_label       TEXT,
  cta_url         TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  priority        INT         NOT NULL DEFAULT 0,
  industry_filter JSONB,                                        -- NULL = 전 업종, ["restaurant","cafe"] = 특정 업종만
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_context_tips_section   ON context_tips (section)    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_context_tips_priority  ON context_tips (priority);

-- 2. 운영자 → 세그먼트 인앱 메시지
CREATE TABLE IF NOT EXISTS in_app_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  body             TEXT        NOT NULL,
  cta_label        TEXT,
  cta_url          TEXT,
  target_segment   TEXT        NOT NULL DEFAULT 'all',          -- 'all' | 'free' | 'basic' | 'pro' | 'biz'
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_in_app_messages_active ON in_app_messages (is_active, expires_at);

-- 3. 메시지 읽음 추적
CREATE TABLE IF NOT EXISTS message_reads (
  message_id  UUID        NOT NULL REFERENCES in_app_messages(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- 4. 사용자 피드백 (NPS/만족도)
CREATE TABLE IF NOT EXISTS user_feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,                             -- 'guide_generated' | 'scan_complete'
  rating      INT         NOT NULL CHECK (rating IN (0, 1)),    -- 0=아쉬워요, 1=도움됐어요
  context     TEXT,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_feedback_event_type ON user_feedback (event_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback (created_at DESC);

-- 5. 시스템 상태 (점검 중 배너 제어)
CREATE TABLE IF NOT EXISTS system_status (
  key         TEXT        PRIMARY KEY,                          -- 'maintenance' | 'scan_status'
  value       TEXT        NOT NULL DEFAULT 'false',
  message     TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 초기값 삽입 (중복 실행 안전)
INSERT INTO system_status (key, value, message)
VALUES
  ('maintenance', 'false', ''),
  ('scan_status',  'normal', '')
ON CONFLICT (key) DO NOTHING;

-- RLS (운영 단계에서 추가 설정 권장)
-- context_tips: 읽기 공개, 쓰기 서비스롤만
-- in_app_messages: 읽기 공개, 쓰기 서비스롤만
-- message_reads: 본인 행만 읽기/쓰기
-- user_feedback: 삽입 공개, 읽기 서비스롤만
-- system_status: 읽기 공개, 쓰기 서비스롤만
