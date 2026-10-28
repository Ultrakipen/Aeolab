/**
 * 무료 체험에서 사장님이 직접 입력한 리뷰 수·평점 (2026-10-28).
 *
 * 이 값은 AEOlab이 측정한 값이 아니다 — 화면에서는 항상 "입력하신 값"으로 구분해 보여 주고,
 * 측정값(확인된 것)과 섞지 않는다. 체험에는 점수 숫자가 노출되지 않으므로 여기서는 표시와
 * 가입 후 사업장 등록으로의 이어받기만 맡는다. 서버에는 저장하지 않아 업종 평균 등 집계를 오염시키지 않는다.
 */

export interface TrialReviewInput {
  review_count: number | null;
  avg_rating: number | null;
}

const KEY = "aeolab_trial_review_input";

export const REVIEW_COUNT_MAX = 1_000_000;

/** 빈 문자열은 null(입력 안 함). 0 이상의 정수만 허용, 그 외는 undefined(잘못된 값). */
export function parseReviewCount(raw: string): number | null | undefined {
  const s = raw.trim().replace(/,/g, "");
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return n <= REVIEW_COUNT_MAX ? n : undefined;
}

/** 빈 문자열은 null. 0 초과 5 이하만 허용(0점 평점은 입력 오류로 본다), 소수 첫째 자리로 맞춘다. */
export function parseRating(raw: string): number | null | undefined {
  const s = raw.trim();
  if (s === "") return null;
  if (!/^\d(\.\d+)?$/.test(s)) return undefined;
  const n = Math.round(Number(s) * 10) / 10;
  return n > 0 && n <= 5 ? n : undefined;
}

export function loadTrialReviewInput(): TrialReviewInput | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<TrialReviewInput>;
    const rc = typeof j.review_count === "number" && Number.isInteger(j.review_count) && j.review_count >= 0 && j.review_count <= REVIEW_COUNT_MAX ? j.review_count : null;
    const ar = typeof j.avg_rating === "number" && j.avg_rating > 0 && j.avg_rating <= 5 ? j.avg_rating : null;
    return rc === null && ar === null ? null : { review_count: rc, avg_rating: ar };
  } catch {
    return null;
  }
}

export function saveTrialReviewInput(v: TrialReviewInput | null): void {
  try {
    if (!v || (v.review_count === null && v.avg_rating === null)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // localStorage 접근 실패 시 무시
  }
}

export function clearTrialReviewInput(): void {
  saveTrialReviewInput(null);
}

/** "리뷰 1,234개 · 평점 4.3" — 값이 있는 것만 */
export function describeTrialReviewInput(v: TrialReviewInput | null): string {
  if (!v) return "";
  const parts: string[] = [];
  if (v.review_count !== null) parts.push(`리뷰 ${v.review_count.toLocaleString()}개`);
  if (v.avg_rating !== null) parts.push(`평점 ${v.avg_rating}`);
  return parts.join(" · ");
}
