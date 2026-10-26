/**
 * 점수 계산 방식이 바뀐 날(2026-10-26 배포): 키워드 순위 항목이 미측정일 때 0점으로 세던 것을
 * 점수에서 제외하고 나머지 5개 항목 비중을 합 100%로 다시 맞추도록 바꿨다.
 * 과거 기록은 다시 계산하지 않으므로, 이 날을 전후해 점수가 오른 것처럼 보일 수 있다 — 추이 화면에서 안내한다.
 */
export const SCORE_METHOD_CHANGE_DATE = "2026-10-26";

/** 주어진 날짜들(YYYY-MM-DD 또는 ISO)이 변경일 이전과 이후를 모두 포함하는가 */
export function spansScoreMethodChange(dates: Array<string | null | undefined>): boolean {
  let before = false;
  let after = false;
  for (const d of dates) {
    const day = (d ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (day < SCORE_METHOD_CHANGE_DATE) before = true;
    else after = true;
  }
  return before && after;
}
