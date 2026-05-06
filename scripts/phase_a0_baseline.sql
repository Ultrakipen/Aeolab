-- Phase A-0 베이스라인 측정 (Supabase SQL Editor 실행)
-- 목적: service_unification_v1.0.md §1.1 그룹 분포 + §11 KPI 베이스라인 갱신용 실데이터 수집
-- 출력 결과를 본 문서에 기록 후 Phase A-1 시작
-- 작성: 2026-04-30 / v1.2 (3차 재검토 반영)

-- ────────────────────────────────────────────────────────────────
-- [1] 그룹별 가입자 분포 (§1.1 갱신용)
-- ────────────────────────────────────────────────────────────────
WITH grouped AS (
  SELECT
    CASE
      WHEN COALESCE(is_franchise, false) = true THEN 'INACTIVE_FRANCHISE'
      WHEN category IN ('restaurant','cafe','bakery','bar','accommodation') THEN 'ACTIVE'
      WHEN category IN ('beauty','nail','pet','fitness','yoga','pharmacy') THEN 'LIKELY'
      ELSE 'INACTIVE'
    END AS user_group,
    *
  FROM businesses
)
SELECT
  user_group,
  COUNT(*) AS biz_count,
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM businesses), 0), 1) AS pct,
  COUNT(*) FILTER (WHERE category IS NOT NULL) AS with_category
FROM grouped
GROUP BY user_group
ORDER BY biz_count DESC;

-- ────────────────────────────────────────────────────────────────
-- [2] 그룹별 평균 점수 (§3.5 시뮬레이션 + §11 베이스라인)
-- ────────────────────────────────────────────────────────────────
WITH grouped AS (
  SELECT
    b.id AS biz_id,
    CASE
      WHEN COALESCE(b.is_franchise, false) = true THEN 'INACTIVE_FRANCHISE'
      WHEN b.category IN ('restaurant','cafe','bakery','bar','accommodation') THEN 'ACTIVE'
      WHEN b.category IN ('beauty','nail','pet','fitness','yoga','pharmacy') THEN 'LIKELY'
      ELSE 'INACTIVE'
    END AS user_group,
    s.track1_score,
    s.track2_score,
    s.unified_score
  FROM businesses b
  LEFT JOIN LATERAL (
    SELECT track1_score, track2_score, unified_score
    FROM scan_results
    WHERE business_id = b.id
    ORDER BY scanned_at DESC
    LIMIT 1
  ) s ON true
)
SELECT
  user_group,
  COUNT(*) FILTER (WHERE track1_score IS NOT NULL) AS scanned,
  ROUND(AVG(track1_score)::numeric, 1)  AS avg_track1,
  ROUND(AVG(track2_score)::numeric, 1)  AS avg_track2,
  ROUND(AVG(unified_score)::numeric, 1) AS avg_unified,
  ROUND(STDDEV(unified_score)::numeric, 1) AS stddev_unified
FROM grouped
GROUP BY user_group
ORDER BY scanned DESC;

-- ────────────────────────────────────────────────────────────────
-- [3] 30일 환불·취소율 (§11 베이스라인)
-- 실제 스키마: subscriptions에 canceled_at 없음. status='cancelled' + end_at 사용
-- ────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) AS total_subs,
  COUNT(*) FILTER (WHERE status = 'cancelled')                    AS canceled_total,
  COUNT(*) FILTER (WHERE status = 'expired')                      AS expired_total,
  COUNT(*) FILTER (WHERE status = 'active')                       AS active_total,
  COUNT(*) FILTER (
    WHERE status IN ('cancelled', 'expired')
      AND end_at IS NOT NULL
      AND start_at IS NOT NULL
      AND end_at - start_at < INTERVAL '30 days'
  ) AS ended_within_30d,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE status IN ('cancelled', 'expired')
        AND end_at IS NOT NULL
        AND start_at IS NOT NULL
        AND end_at - start_at < INTERVAL '30 days'
    ) / NULLIF(COUNT(*) FILTER (WHERE status != 'inactive'), 0),
    2
  ) AS ended_30d_pct
FROM subscriptions;

-- ────────────────────────────────────────────────────────────────
-- [4] 그룹별 ARPU (§11 베이스라인)
-- ────────────────────────────────────────────────────────────────
WITH active_subs AS (
  SELECT
    b.id AS biz_id,
    CASE
      WHEN COALESCE(b.is_franchise, false) = true THEN 'INACTIVE_FRANCHISE'
      WHEN b.category IN ('restaurant','cafe','bakery','bar','accommodation') THEN 'ACTIVE'
      WHEN b.category IN ('beauty','nail','pet','fitness','yoga','pharmacy') THEN 'LIKELY'
      ELSE 'INACTIVE'
    END AS user_group,
    s.plan,
    CASE s.plan
      WHEN 'basic'     THEN 9900
      WHEN 'startup'   THEN 12900
      WHEN 'pro'       THEN 18900
      WHEN 'biz'       THEN 49900
      WHEN 'enterprise' THEN 200000
      ELSE 0
    END AS plan_price
  FROM businesses b
  JOIN subscriptions s ON s.user_id = b.user_id
  WHERE s.status = 'active'
)
SELECT
  user_group,
  COUNT(*) AS active_subscribers,
  ROUND(AVG(plan_price)::numeric, 0) AS avg_arpu,
  SUM(plan_price) AS group_mrr
FROM active_subs
GROUP BY user_group
ORDER BY group_mrr DESC;

-- ────────────────────────────────────────────────────────────────
-- [5] 신규 사용자 키워드 입력률 (§11 입력 완료율)
-- ────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) AS total_biz,
  COUNT(*) FILTER (WHERE COALESCE(array_length(keywords, 1), 0) >= 3) AS with_3plus_keywords,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE COALESCE(array_length(keywords, 1), 0) >= 3)
      / NULLIF(COUNT(*), 0),
    1
  ) AS pct_with_3plus
FROM businesses;

-- ────────────────────────────────────────────────────────────────
-- [6] 점수 모델 영향 시뮬레이션 (10명 샘플) — Phase A-3 호환
-- ────────────────────────────────────────────────────────────────
SELECT
  s.business_id,
  b.category,
  COALESCE(b.is_franchise, false) AS is_franchise,
  CASE
    WHEN COALESCE(b.is_franchise, false) = true THEN 'INACTIVE'
    WHEN b.category IN ('restaurant','cafe','bakery','bar','accommodation') THEN 'ACTIVE'
    WHEN b.category IN ('beauty','nail','pet','fitness','yoga','pharmacy') THEN 'LIKELY'
    ELSE 'INACTIVE'
  END AS user_group,
  s.track1_score AS v3_0_track1,
  s.track2_score,
  s.unified_score
FROM scan_results s
JOIN businesses b ON b.id = s.business_id
WHERE s.scanned_at > now() - INTERVAL '30 days'
ORDER BY s.scanned_at DESC
LIMIT 10;
