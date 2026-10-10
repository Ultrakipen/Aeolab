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

/**
 * 지번 주소 → 손님이 쓰는 동네 이름 기본값 (사장님이 고칠 수 있는 "제안"일 뿐 확정값이 아니다).
 *  "서울특별시 성동구 하왕십리동 1-2"  → "왕십리"   (상·하 + 2글자 이상이 남을 때만 떼어 낸다)
 *  "서울특별시 성동구 성수동1가 685"   → "성수동"   (○가 표기 제거)
 *  "서울특별시 노원구 상계동 1"        → "상계동"   (상계처럼 떼면 1글자가 남는 이름은 그대로)
 *  "경기도 양평군 양평읍 ..."          → "양평읍"
 * 찾지 못하면 빈 문자열.
 */
export function neighborhoodFromJibun(jibun?: string): string {
  const tokens = (jibun || "").trim().split(/\s+/).filter(Boolean);
  // 앞쪽의 시·도·시·군·구 단위 토큰은 건너뛴다
  let i = 0;
  while (i < tokens.length && /(특별시|광역시|특별자치시|특별자치도|도|시|군|구)$/.test(tokens[i])) i++;
  const raw = tokens[i] || "";
  const m = raw.match(/^([가-힣]+?)(\d*)(동|읍|면|가)$/);
  if (!m) return "";
  const base = m[1];
  if (m[3] === "가") {
    // "성수동1가" → base "성수동", "을지로3가" → base "을지로" (숫자+가 제거)
    return base.length >= 2 ? base : "";
  }
  let name = base + m[3]; // "성수동", "양평읍"
  if (m[3] === "동" && /^[상하]/.test(base) && base.length - 1 >= 2) {
    name = base.slice(1); // "하왕십리동" → "왕십리"
  }
  return name.length >= 2 ? name : "";
}

/**
 * ChatGPT가 말한 가게 이름이 내 가게와 같은 가게일 수 있는지(브랜드 같고 지점 표기만 다름).
 *  내 가게 "준오헤어 왕십리역점" vs "준오헤어 왕십리점" → true, vs "준오헤어 성수점" → false
 * 같은 가게로 "세지는 않고", 화면에서 "같은 가게일 수 있어요"라고 안내하는 데에만 쓴다.
 */
export function maybeSameShop(myName: string, placeName: string): boolean {
  const split = (n: string) => {
    const parts = n.trim().split(/\s+/).filter(Boolean);
    return { brand: parts[0] || "", stem: parts.slice(1).join("").replace(/(지점|본점|역점|점|역)$/, "") };
  };
  const a = split(myName);
  const b = split(placeName);
  if (!a.brand || a.brand !== b.brand) return false;
  if (a.stem.length < 2 || b.stem.length < 2) return false;
  if (myName.replace(/\s+/g, "") === placeName.replace(/\s+/g, "")) return false;
  return a.stem === b.stem;
}

/**
 * 동네·역 이름 제안값 — 사장님이 고칠 수 있는 기본값.
 *  1순위: 가게 이름 끝의 지점 표기에서 찾은 이름. "준오헤어 왕십리역점" → "왕십리"
 *         (손님은 행정동("행당동")이 아니라 역·동네 이름으로 찾는다. 서버 실험: "왕십리" 11/50)
 *         단, 그 이름이 주소(도로명·지번)에 실제로 들어 있을 때만 쓴다 — "성수퍼퓸점"처럼 지점명이 임의인 경우를 거른다.
 *  2순위: 지번 주소의 동 이름 (neighborhoodFromJibun)
 * 찾지 못하면 빈 문자열(비워 두면 구 이름으로만 묻는다).
 */
export function neighborhoodSuggestion(title?: string, roadAddress?: string, jibunAddress?: string): string {
  const parts = (title || "").trim().split(/\s+/).filter(Boolean);
  const last = parts.length >= 2 ? parts[parts.length - 1] : "";
  const m = last.match(/^([가-힣]{2,10}?)(역점|지점|점)$/);
  if (m) {
    const stem = m[1].replace(/역$/, "");
    const addr = `${roadAddress || ""} ${jibunAddress || ""}`;
    if (stem.length >= 2 && addr.includes(stem)) return stem;
  }
  return neighborhoodFromJibun(jibunAddress);
}
