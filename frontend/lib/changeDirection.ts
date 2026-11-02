/**
 * 변화 방향("올랐다/내렸다") 판정 — 프런트 단일 소스 (2026-11-02).
 *
 * 백엔드 `services/stage_names.headline_direction`과 같은 규칙이다(`tests/test_change_direction_parity.py`가 같은 입력 격자로 두 구현의 결과를 대조한다).
 * 규칙: ① 변화가 CHANGE_DISPLAY_MIN(10점) 이상이면 방향을 말한다. ② 그보다 작아도 등급 구간(30/55/75)이 바뀌었고 변화가 STAGE_BAND_MIN_DELTA(3점) 이상이며
 *       구간 이동 방향과 점수 변화 부호가 같으면 말한다(단계 경계 근처 54.9→55.1 같은 흔들림은 제외). ③ 그 밖에는 "변화 없음(오차 범위)".
 * 근거(실측): 같은 가게의 일간 점수 변화는 중앙값 3~4점이고 60% 이상이 2점 이상이라(장애 이전·이후 기간에서 모두 확인) 0.1~2점 차이를 화살표로 말하면 측정 오차를 변화로 말하게 된다.
 * 두 값(3·10)은 제안값이다 — 비개발자 사업장 20곳 이상 × 채점 방식이 안 바뀐 4주 이상 구간이 쌓이면 재보정한다(docs/soft_launch_runbook_2026_11_02.md).
 * 백엔드는 구간을 트랙1 점수(저장된 growth_stage)로, 여기서는 가진 점수(통합)로 계산한다 — 구간 경계는 같다.
 */
export const CHANGE_DISPLAY_MIN = 10;
export const STAGE_BAND_MIN_DELTA = 3;
const STAGE_UPPER_BOUNDS = [30, 55, 75]; // services/stage_names._UPPER_BOUNDS와 같아야 한다

export type ChangeDirection = "up" | "down" | "flat";

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** 0=시작 전, 1=보강 단계, 2=개선 중, 3=양호 */
export function stageBand(score: number): number {
  let i = 0;
  for (const upper of STAGE_UPPER_BOUNDS) {
    if (score < upper) return i;
    i += 1;
  }
  return STAGE_UPPER_BOUNDS.length;
}

/** 점수 차이만 아는 경우(전·후 점수가 없을 때) — 큰 변화만 말한다. 값이 없으면 null. */
export function deltaDirection(delta: number | null | undefined): ChangeDirection | null {
  if (!isNum(delta)) return null;
  if (Math.abs(delta) >= CHANGE_DISPLAY_MIN) return delta > 0 ? "up" : "down";
  return "flat";
}

/** 변화가 방향을 말할 만큼 크면 그 값을, 아니면 null — 이미 `delta !== null && delta !== 0`으로 화살표를 그리는 화면(경쟁사 비교 등)이 기준만 바꿔 쓰게 한다. */
export function significantDelta(delta: number | null | undefined): number | null {
  const dir = deltaDirection(delta);
  return dir === "up" || dir === "down" ? (delta as number) : null;
}

/** 전·후 점수로 판정 — 어느 한쪽이 없으면 null(아직 측정 중). */
export function changeDirection(before: number | null | undefined, after: number | null | undefined): ChangeDirection | null {
  if (!isNum(before) || !isNum(after)) return null;
  const delta = after - before;
  const big = deltaDirection(delta);
  if (big !== "flat") return big;
  const bandBefore = stageBand(before);
  const bandAfter = stageBand(after);
  if (bandBefore !== bandAfter && Math.abs(delta) >= STAGE_BAND_MIN_DELTA) {
    if (bandAfter > bandBefore && delta > 0) return "up";
    if (bandAfter < bandBefore && delta < 0) return "down";
  }
  return "flat";
}

/** 행동 전·후 비교 문구 — 화살표 대신 중립 표현(인과 단정 금지: 이 행동 때문이라고 말하지 않는다). */
export function effectText(direction: ChangeDirection | null): string {
  if (direction === null) return "측정 중";
  if (direction === "up") return "상승 확인";
  if (direction === "down") return "하락 확인";
  return "변화 없음(오차 범위)";
}

/** 방향별 글자색 — 하락도 빨강이 아니라 주황 계열(이 행동 때문이라고 단정할 수 없는 측정 비교라 경고색을 쓰지 않는다) */
export function effectColorClass(direction: ChangeDirection): string {
  return direction === "up" ? "text-emerald-700" : direction === "down" ? "text-amber-700" : "text-gray-600";
}

/** 방향별 알약 배지 클래스 */
export function effectPillClass(direction: ChangeDirection): string {
  return direction === "up" ? "bg-emerald-100 text-emerald-700" : direction === "down" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600";
}

/** 행동 효과 목록 아래에 한 번 붙이는 고정 안내 */
export const EFFECT_NOTE = "행동 전후 측정 결과를 비교한 것으로, 그 행동의 효과라고 단정할 수 없습니다. 측정 시점에 따라 달라질 수 있습니다.";
