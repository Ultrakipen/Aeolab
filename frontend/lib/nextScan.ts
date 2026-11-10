/**
 * "다음 자동 측정" 안내 문구 (2026-11-10).
 *
 * 백엔드 `/api/report/score-delta`의 next_auto_scan(플랜·사업장 슬롯 요일 규칙으로 계산한 KST 02:00)을 사람이 읽는 말로 바꾼다.
 * 이전에는 "오늘/내일"만 말할 수 있어 주 2회·주 1회 플랜에도 항상 "내일"이라고 안내했다.
 * 값이 없거나 읽을 수 없으면 null — 모르면 말하지 않는다(화면은 이 문구를 숨긴다).
 */
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatNextScan(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = d.getHours().toString().padStart(2, "0");
  const diffH = Math.round((d.getTime() - now.getTime()) / 3600000);
  if (diffH <= 1) return "곧";
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (dayDiff <= 0) return `오늘 ${hh}:00`;
  if (dayDiff === 1) return `내일 ${hh}:00`;
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]}) ${hh}:00`;
}
