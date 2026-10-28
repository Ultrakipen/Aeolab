/**
 * 표본 비율의 신뢰구간 — "n회 중 x회" 결과로 "약하다"를 단정해도 되는지 판단한다 (2026-10-28).
 *
 * 배경(실측): 같은 가게(어니언 성수)·같은 질문의 ChatGPT 구 이름 결과가 오늘 네 번 실행에서 18 → 16 → 28 → 12회(50회 중)로 흔들렸다.
 * 판정 기준이 30%(15회) 고정이라 28회(56%)에서는 "ChatGPT에는 나오지만…", 12회(24%)에서는 "내 가게가 잘 보이지 않습니다"로
 * 같은 가게의 한 줄 진단이 뒤집혔다. 잡음 구간의 값으로 유명한 가게를 "약하다"고 단정하면 신뢰를 잃는다.
 */

/** Wilson 95% 신뢰구간의 상한. n<=0 이면 판단 불가(1). */
export function wilsonUpper(x: number, n: number, z = 1.96): number {
  if (!(n > 0) || x < 0) return 1;
  const p = Math.min(Math.max(x / n, 0), 1);
  const z2 = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return Math.min(1, center + half);
}

/** 표본으로 보아 실제 비율이 threshold보다 **확실히** 낮은가(신뢰구간 상한 < threshold). 표본이 없거나 작아 판단이 안 되면 false. */
export function isConfidentlyBelow(x: number, n: number, threshold: number): boolean {
  return n > 0 && wilsonUpper(x, n) < threshold;
}
