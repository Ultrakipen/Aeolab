// 변화 기록(business_action_log)의 자동 문구와 "마지막 측정" 신선도 표시 (2026-11-02)
//
// 자동 기록 문구는 저장 시점의 코드가 만든 텍스트라 이미 저장된 옛 행에는 소급되지 않는다 → 화면에서 같은 규칙으로 바꿔 보인다.
// - 경쟁사 점수는 간이 추정치(같은 경쟁사가 3일 사이 49→41→39→33점)라 "N점 앞서 있습니다" 숫자를 보이지 않는다.
// - "시작 전 → 시작 전"처럼 같은 등급을 화살표로 잇지 않는다.
// - 측정으로 확인된 적 없는 원인 단정("경쟁사 강화 또는 정보 갱신 필요")은 보이지 않는다.

const COMPETITOR_AHEAD_WITH_NUMBER = /(경쟁사\s*'[^']*'가)\s*\d+(?:\.\d+)?점\s*앞서\s*있습니다/;
const SAME_STAGE_ARROW = /\(([^()→]+?)\s*→\s*\1\s*(,|\))/;
const UNVERIFIED_CAUSE = /\s*—\s*경쟁사 강화 또는 정보 갱신 필요/;

export function displayActionLabel(label: string | null | undefined): string {
  let s = label ?? "";
  s = s.replace(COMPETITOR_AHEAD_WITH_NUMBER, "$1 내 가게보다 높은 AI 노출 구간입니다 (추정)");
  s = s.replace(SAME_STAGE_ARROW, "($1 단계 안에서$2");
  s = s.replace(UNVERIFIED_CAUSE, "");
  return s;
}

/**
 * 시스템이 자동으로 남긴 기록 — 사용자가 한 행동이 아니라 '효과'를 말할 대상이 아니다(2026-11-02 확인):
 * - competitor_ahead: 경쟁사 상태 기록 — 옆에 붙는 변화는 7일 뒤 '내 가게' 점수라 경쟁사 상태와 무관해 혼동을 준다
 * - score_up / score_down: 점수 변화 자체를 기록한 로그(전·후 점수가 곧 그 변화) — 옆에 또 변화를 붙이면 같은 말을 되풀이하거나 엇갈린다
 * - auto_recommended: 추천 카드를 열어 볼 때 남는 '추천됨' 기록(사용자가 그 행동을 했다는 뜻이 아니다)
 */
const SYSTEM_RECORD_TYPES = new Set(["competitor_ahead", "score_up", "score_down", "auto_recommended"]);

/** 행동 전·후 비교 문구(효과 표시)를 붙일 기록인가 — 사용자가 직접 한 행동만 true */
export function showsScoreDeltaBadge(actionType: string | null | undefined): boolean {
  return !SYSTEM_RECORD_TYPES.has(actionType ?? "");
}

export type MeasurementFreshness = {
  level: "fresh" | "stale" | "old" | "unknown";
  days: number | null;
  dateLabel: string; // "M월 D일" 또는 ""
};

/** 마지막 측정일의 신선도. 7일 이내=fresh("이번 주" 표현 가능), 8~13일=stale(화살표 숨김), 14일 이상=old(변화 문구 숨김) */
export function measurementFreshness(iso: string | null | undefined, now: number = Date.now()): MeasurementFreshness {
  if (!iso) return { level: "unknown", days: null, dateLabel: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { level: "unknown", days: null, dateLabel: "" };
  const days = Math.max(0, Math.floor((now - d.getTime()) / 86_400_000));
  const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const level = days <= 7 ? "fresh" : days <= 13 ? "stale" : "old";
  return { level, days, dateLabel };
}
