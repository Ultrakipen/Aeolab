/**
 * 네이버 AI 브리핑·AI탭 스캔이 "측정되지 못한" 경우 판별 (단일 소스).
 *
 * 백엔드 `score_engine._is_naver_unmeasured`와 같은 규칙이다 — 캡차 차단이든 접속 실패
 * (`page_load_failed`)·대기열 초과(`PLAYWRIGHT_QUEUE_TIMEOUT`)·일일 상한(`quota_skipped`)이든
 * 측정이 안 된 것을 화면에서 "아직 미노출"로 보이면 안 된다.
 * (과거 화면은 `captcha_detected`만 봐서 점수는 제외하는데 카드는 "미노출"로 나갔다 — 2026-10-27)
 *
 * naver_result가 아예 없으면(옛 스캔·빠른 측정) 측정하지 않은 것이므로 마찬가지로 미측정이다.
 */
export interface NaverResultLike {
  captcha_detected?: boolean | null;
  error?: string | null;
  quota_skipped?: boolean | null;
}

export function isNaverUnmeasured(result: NaverResultLike | null | undefined): boolean {
  if (!result) return true;
  return result.captcha_detected === true || !!result.error || result.quota_skipped === true;
}
