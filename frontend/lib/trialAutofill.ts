/**
 * 무료 체험 "가게 이름만 입력" 흐름 — 네이버 지역검색 후보에서 지역·검색어를 자동 추출.
 * 업종 변환은 lib/categories.ts mapNaverCategory 사용 (여기서 중복 구현 금지).
 */

const METRO_SHORT: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
};

/**
 * 도로명/지번 주소 → 진단용 지역 문자열.
 *  "서울특별시 성동구 아차산로9길 8"      → "서울 성동구"
 *  "경상남도 창원시 의창구 중앙대로 1"     → "창원시 의창구"
 *  "경기도 양평군 양평읍 ..."              → "양평군"
 */
export function shortRegionFromAddress(address?: string): string {
  const tokens = (address || "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  const first = tokens[0];
  if (METRO_SHORT[first]) {
    if (first === "세종특별자치시") return "세종";
    return tokens[1] ? `${METRO_SHORT[first]} ${tokens[1]}` : METRO_SHORT[first];
  }
  if (/도$/.test(first) && tokens[1]) {
    if (/시$/.test(tokens[1]) && tokens[2] && /구$/.test(tokens[2])) {
      return `${tokens[1]} ${tokens[2]}`;
    }
    return tokens[1];
  }
  return tokens.slice(0, 2).join(" ");
}

/**
 * 네이버 업종 문자열 → "손님이 검색하는 말" 기본값.
 *  "음식점>카페,디저트" → "카페", "병원,의원>치과" → "치과", "미용>미용실" → "미용실"
 * 마지막 단계(리프)의 첫 항목을 쓰고, 너무 길거나 비면 fallback(업종 라벨)을 쓴다.
 */
export function keywordFromNaverCategory(raw?: string, fallback = ""): string {
  const leaf = (raw || "").split(">").pop()?.trim() || "";
  const first = leaf.split(/[,，]/)[0]?.trim() || "";
  if (first && first.length <= 12) return first;
  return fallback;
}
