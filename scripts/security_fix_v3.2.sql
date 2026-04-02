-- ========================================
-- AEOlab SECURITY FIX v3.2
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요
-- 발견된 취약점: 5건 (모두 ERROR 등급)
-- ========================================

-- [FIX 1] trial_scans — RLS 활성화
-- 문제: public 테이블인데 RLS 미활성화 → 누구나 전체 체험 스캔 데이터 조회 가능
-- 해결: RLS 활성화 (백엔드 service_role 키는 RLS 우회 → 기존 동작 영향 없음)
ALTER TABLE public.trial_scans ENABLE ROW LEVEL SECURITY;

-- [FIX 2] waitlist — RLS 활성화
-- 문제: 이메일 수집 테이블이 RLS 없이 공개 노출
-- 해결: RLS 활성화 (백엔드 service_role 키는 RLS 우회 → 기존 동작 영향 없음)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- [FIX 3] gap_cards — RLS 재활성화
-- 문제: 정책은 존재하나 RLS 비활성화 상태 (스키마 적용 누락)
-- 해결: RLS 재활성화
ALTER TABLE public.gap_cards ENABLE ROW LEVEL SECURITY;

-- [FIX 4] weekly_scores 뷰 — SECURITY INVOKER 전환
-- 문제: SECURITY DEFINER → 뷰 생성자(postgres) 권한으로 실행되어 모든 사용자 데이터 노출 위험
-- 해결: SECURITY INVOKER → 쿼리 실행 사용자 권한으로 실행, scan_results의 RLS 정상 적용
CREATE OR REPLACE VIEW public.weekly_scores WITH (security_invoker = true) AS
SELECT
  sr.business_id,
  DATE_TRUNC('week', sr.scanned_at)                           AS week_start,
  COUNT(*)                                                    AS scan_count,
  AVG(sr.total_score)                                         AS avg_total_score,
  AVG(sr.exposure_freq)                                       AS avg_exposure_freq,
  AVG(sr.naver_channel_score)                                 AS avg_naver_channel,
  AVG(sr.global_channel_score)                                AS avg_global_channel,
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

-- [FIX 5] score_trend_30d 뷰 — SECURITY INVOKER 전환
-- 문제: 동일 — SECURITY DEFINER로 score_history RLS 우회 가능
-- 해결: SECURITY INVOKER 전환
CREATE OR REPLACE VIEW public.score_trend_30d WITH (security_invoker = true) AS
SELECT
  business_id,
  score_date,
  total_score,
  rank_in_category,
  LAG(total_score) OVER (PARTITION BY business_id ORDER BY score_date) AS prev_score
FROM score_history
WHERE score_date >= CURRENT_DATE - INTERVAL '30 days';

-- ========================================
-- 적용 확인 쿼리 (실행 후 아래로 검증)
-- ========================================
-- RLS 활성화 여부 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('trial_scans', 'waitlist', 'gap_cards');
-- 모두 rowsecurity = true 이어야 합니다.
