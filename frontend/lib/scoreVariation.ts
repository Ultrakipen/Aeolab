/**
 * scoreVariation.ts
 * score_history 30일 데이터에서 점수 변동 폭을 계산한다.
 * CLAUDE.md 원칙: 실측 데이터 7일 이상 없으면 수치 표시 금지, 면책 문구만 노출.
 */

export interface ScoreEntry {
  unified_score?: number | null;
  total_score?: number | null;
  score_date?: string | null;
}

export interface ScoreVariationResult {
  /** 7일 이상 데이터가 있는지 여부 — false이면 수치 표시 금지 */
  hasData: boolean;
  /** 30일 중 최솟값 */
  min?: number;
  /** 30일 중 최댓값 */
  max?: number;
  /** 변동 폭 (max - min) */
  range?: number;
  /** 표준편차 (소수점 1자리) */
  stdev?: number;
  /** 사용된 데이터 포인트 수 */
  count?: number;
}

/**
 * score_history 배열을 받아 변동 폭 정보를 반환한다.
 * 7개 미만이면 `hasData: false` 반환 — UI에서 수치 절대 표시 금지.
 */
export function calcScoreVariation(history: ScoreEntry[]): ScoreVariationResult {
  if (!history || history.length < 7) return { hasData: false };

  const scores = history
    .map((h) => {
      const v = h.unified_score ?? h.total_score;
      return typeof v === "number" && isFinite(v) ? v : null;
    })
    .filter((v): v is number => v !== null);

  if (scores.length < 7) return { hasData: false };

  const min = Math.round(Math.min(...scores));
  const max = Math.round(Math.max(...scores));
  const range = max - min;

  // 표준편차 계산
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const stdev = Math.round(Math.sqrt(variance) * 10) / 10;

  return { hasData: true, min, max, range, stdev, count: scores.length };
}
