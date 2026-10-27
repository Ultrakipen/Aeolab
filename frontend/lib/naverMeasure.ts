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

/** 이전 스캔 중 네이버 측정이 성공했던 가장 최근 결과 — 이번 측정이 실패했을 때 날짜와 함께 보여준다 */
export interface LastGoodNaver {
  measuredAt: string;
  inBriefing: boolean;
  aiTabVisible: boolean | null;
}

export const LAST_GOOD_MAX_AGE_DAYS = 30;

interface ScanRowLike {
  scanned_at?: string | null;
  naver_result?: (NaverResultLike & { in_briefing?: boolean | null }) | null;
  naver_ai_tab_visible?: boolean | null;
}

/** rows는 최신순. 측정에 성공한 첫 행을 30일 이내일 때만 돌려준다 (오래된 결과를 "현재"처럼 보이지 않게) */
export function pickLastGoodNaver(
  rows: ScanRowLike[] | null | undefined,
  now: Date = new Date(),
): LastGoodNaver | null {
  for (const r of rows ?? []) {
    if (!r?.scanned_at || isNaverUnmeasured(r.naver_result ?? null)) continue;
    const t = new Date(r.scanned_at).getTime();
    if (Number.isNaN(t) || now.getTime() - t > LAST_GOOD_MAX_AGE_DAYS * 86_400_000) return null;
    return {
      measuredAt: r.scanned_at,
      inBriefing: r.naver_result?.in_briefing === true,
      aiTabVisible: r.naver_ai_tab_visible ?? null,
    };
  }
  return null;
}

/** "10월 26일" 형식 */
export function fmtMonthDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
