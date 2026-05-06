-- Phase A-1 DB 마이그레이션 (Supabase SQL Editor 실행)
-- 목적: service_unification_v1.0.md §8 기준 v3.1 점수 모델·키워드 트래킹·카카오맵 자동 점검 컬럼 추가
-- 작성: 2026-04-30 / v1.2 기획 반영
-- 미실행 시 graceful fallback 동작 (백엔드 _BIZ_OPTIONAL_COLS, 프론트 try/catch)

-- ────────────────────────────────────────────────────────────────
-- [1] businesses 테이블 — user_group 캐시 + 카카오맵 자동 점검
-- ────────────────────────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS user_group TEXT
    CHECK (user_group IN ('ACTIVE', 'LIKELY', 'INACTIVE'));

COMMENT ON COLUMN businesses.user_group IS
  'AI 브리핑 노출 가능성 + 프랜차이즈 게이팅 결과. INACTIVE는 프랜차이즈 포함.
   v3.1 점수 모델 그룹별 가중치 재분배에 사용 (service_unification_v1.0.md §3.2)';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS kakao_auto_check_result JSONB,
  ADD COLUMN IF NOT EXISTS kakao_auto_check_at     TIMESTAMPTZ;

COMMENT ON COLUMN businesses.kakao_auto_check_result IS
  '카카오맵 자동 점검 결과 (Playwright). {"is_registered": bool, "rank": int, "review_count": int, "measured_at": "..."}';

-- 백필: 기존 사업장 user_group 일괄 분류
UPDATE businesses SET user_group = CASE
  WHEN COALESCE(is_franchise, false) = true THEN 'INACTIVE'
  WHEN category IN ('restaurant','cafe','bakery','bar','accommodation') THEN 'ACTIVE'
  WHEN category IN ('beauty','nail','pet','fitness','yoga','pharmacy') THEN 'LIKELY'
  ELSE 'INACTIVE'
END
WHERE user_group IS NULL;

-- 인덱스 (그룹별 조회 빠르게)
CREATE INDEX IF NOT EXISTS idx_businesses_user_group ON businesses(user_group);

-- ────────────────────────────────────────────────────────────────
-- [2] scan_results 테이블 — 키워드 순위 측정 + 측정 환경 기록
-- ────────────────────────────────────────────────────────────────
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS keyword_ranks         JSONB,
  ADD COLUMN IF NOT EXISTS measurement_context   JSONB,
  ADD COLUMN IF NOT EXISTS blog_crank_score      NUMERIC(5,2);

COMMENT ON COLUMN scan_results.keyword_ranks IS
  '네이버 키워드 순위 측정 결과 (Playwright).
   {"keyword": {"pc_rank": 3, "mobile_rank": 5, "place_rank": 2, "measured_at": "..."}, ...}
   순위 미노출 시 null';

COMMENT ON COLUMN scan_results.measurement_context IS
  '측정 환경 기록 (재현성 검증용).
   {"location": "Seoul", "device": "PC|mobile", "logged_in": false, "scanned_at": "...", "playwright_version": "..."}';

COMMENT ON COLUMN scan_results.blog_crank_score IS
  '블로그 C-rank 추정 점수 (0~100). 발행 빈도 + 외부 인용 + 업체명 매칭 가중 합산.
   주의: 정확한 C-rank는 네이버 비공개 — 사용자 화면에 "(추정)" 명시 필수';

-- GIN 인덱스 (키워드 검색 빠르게)
CREATE INDEX IF NOT EXISTS idx_scan_results_keyword_ranks
  ON scan_results USING GIN (keyword_ranks);

-- ────────────────────────────────────────────────────────────────
-- [3] score_history 테이블 — 시계열 신규 항목
-- ────────────────────────────────────────────────────────────────
ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS keyword_rank_avg     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS blog_crank_score     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS user_group_snapshot  TEXT;

COMMENT ON COLUMN score_history.keyword_rank_avg IS
  '측정 시점 키워드 평균 순위 (낮을수록 좋음). 미노출 키워드는 99로 간주';
COMMENT ON COLUMN score_history.user_group_snapshot IS
  '점수 측정 시점의 그룹 분류. 사후 사용자가 카테고리 변경 시 시계열 분석 보존';

-- ────────────────────────────────────────────────────────────────
-- [4] notifications 테이블 — 키워드 변동 알림 멱등키
-- ────────────────────────────────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS keyword_change_payload JSONB;

COMMENT ON COLUMN notifications.keyword_change_payload IS
  '키워드 순위 변동 알림 (AEOLAB_KW_01) 전송 데이터.
   {"keyword": "...", "before_rank": 5, "after_rank": 2, "delta": -3}';

-- ────────────────────────────────────────────────────────────────
-- [5] 검증 — 백필 결과 확인
-- ────────────────────────────────────────────────────────────────
SELECT
  user_group,
  COUNT(*) AS biz_count,
  COUNT(*) FILTER (WHERE is_franchise = true) AS franchise_count
FROM businesses
GROUP BY user_group
ORDER BY biz_count DESC;

-- 신규 컬럼 존재 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'businesses'
  AND column_name IN ('user_group', 'kakao_auto_check_result', 'kakao_auto_check_at', 'is_franchise')
ORDER BY column_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scan_results'
  AND column_name IN ('keyword_ranks', 'measurement_context', 'blog_crank_score')
ORDER BY column_name;
