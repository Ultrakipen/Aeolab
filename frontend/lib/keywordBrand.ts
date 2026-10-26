/**
 * 가게 이름(상호) 키워드 판별 — 순위 요약에서 일반 키워드와 분리하기 위함.
 *
 * 이름으로 검색하면 거의 모든 가게가 1위로 나오므로(2026-10-26 17건 실측), 상호 키워드를
 * 일반 키워드와 섞어 "N개 중 M개 노출"에 세면 요약이 부풀려진다.
 * 오탐(일반 키워드를 상호로 오인)이 더 나쁘므로 보수적으로 판별한다:
 *  - 키워드가 상호(또는 지점명을 뗀 상호)를 통째로 포함할 때만 true
 *  - 상호 핵심이 3자 미만이면(예: "카페", "치킨") 일반 단어와 구별할 수 없어 false
 */
const norm = (s: string) => (s || "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");

export function isBrandKeyword(keyword: string, businessName?: string | null): boolean {
  const k = norm(keyword);
  const full = norm(businessName ?? "");
  if (!k || !full) return false;

  const candidates = [full];
  // "원천맥주 광교점"처럼 마지막 어절이 지점명(…점)이면 지점명을 뗀 상호도 상호로 본다
  const tokens = (businessName ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 && /점$/.test(tokens[tokens.length - 1])) {
    candidates.push(norm(tokens.slice(0, -1).join("")));
  }

  return candidates.some((c) => c.length >= 3 && k.includes(c));
}
