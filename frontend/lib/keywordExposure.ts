import { isBrandKeyword } from "./keywordBrand";

/**
 * 네이버 검색 첫 화면(광고 제외)에 노출이 확인된 키워드 — 순위 측정 결과(`keyword_ranks`) 기준.
 *
 * 서버 강점 카드 규칙(`backend/services/strength_signals._keywords_item`)과 같다. 한쪽을 바꾸면
 * 다른 쪽도 같이 바꿀 것:
 *  - 가게 이름(상호) 키워드는 제외 (이름 검색은 거의 모든 가게가 1위라 강점이 아니다)
 *  - 측정 오류 행(`error`)은 제외 (미노출로 세지 않는다)
 *  - pc_rank / mobile_rank / place_rank 중 하나라도 양의 숫자면 노출
 *  - 측정 시각이 30일 이내일 때만 쓴다 (시각을 알 수 없으면 쓰지 않는다)
 */
export const FIRST_SCREEN_MAX_AGE_DAYS = 30;

export interface FirstScreenKeywords {
  count: number;
  names: string[];
}

const posNum = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v > 0;

export function getFirstScreenKeywords(
  keywordRanks: Record<string, unknown> | null | undefined,
  businessName: string | null | undefined,
  scannedAt: string | null | undefined,
  now: Date = new Date(),
): FirstScreenKeywords | null {
  if (!keywordRanks || typeof keywordRanks !== "object") return null;

  const ctx = keywordRanks["_context"];
  const ctxAt = ctx && typeof ctx === "object" ? (ctx as { scanned_at?: unknown }).scanned_at : null;
  const stamp = (typeof ctxAt === "string" && ctxAt) || scannedAt || null;
  if (!stamp) return null;
  const ts = new Date(stamp);
  if (Number.isNaN(ts.getTime())) return null;
  if (now.getTime() - ts.getTime() > FIRST_SCREEN_MAX_AGE_DAYS * 86_400_000) return null;

  const names: string[] = [];
  for (const [kw, d] of Object.entries(keywordRanks)) {
    if (kw.startsWith("_") || !d || typeof d !== "object") continue;
    const row = d as Record<string, unknown>;
    if (row.error) continue;
    if (isBrandKeyword(kw, businessName)) continue;
    if (posNum(row.pc_rank) || posNum(row.mobile_rank) || posNum(row.place_rank)) names.push(kw);
  }
  return names.length > 0 ? { count: names.length, names } : null;
}
