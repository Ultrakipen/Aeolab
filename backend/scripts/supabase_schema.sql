-- AEOlab Supabase Schema Additions
-- 이 파일의 각 블록은 Supabase SQL Editor에서 직접 실행하세요.
-- 모든 구문은 IF NOT EXISTS / IF EXISTS 패턴으로 멱등성 보장.

-- v5.8: 성공 사례 갤러리 (Sprint 4, 2026-05-17)
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
CREATE INDEX IF NOT EXISTS idx_stories_delta ON success_stories(score_delta DESC) WHERE score_delta IS NOT NULL AND score_delta > 0;
CREATE INDEX IF NOT EXISTS idx_stories_published ON success_stories(published_at DESC);

ALTER TABLE success_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "stories_public_select" ON success_stories FOR SELECT USING (TRUE);

-- v5.8: delivery_orders 재스캔 추적 컬럼 (delivery_30day_rescan_job 사용)
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS work_completed_at TIMESTAMPTZ;
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS followup_scan_id UUID REFERENCES scan_results(id) ON DELETE SET NULL;
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS materials_url JSONB DEFAULT '[]'::jsonb;
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS refund_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_delivery_followup ON delivery_orders(package_type, status, work_completed_at)
  WHERE followup_scan_id IS NULL;
