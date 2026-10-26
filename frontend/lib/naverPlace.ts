// 네이버 플레이스 관련 공용 도우미 (2026-10-26)
//
// 네이버 지역검색 API는 가게 홈페이지를 `link`로 주기 때문에(예: 어니언 성수 → https://onionkr.com)
// 등록 화면의 "네이버 플레이스 URL" 칸에 네이버 주소가 아닌 값이 자동으로 들어가던 문제를 막는다.

export function isNaverPlaceUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === "naver.me" || host === "naver.com" || host.endsWith(".naver.com");
  } catch {
    return false;
  }
}

export interface ResolvedPlace {
  status: "unique" | "ambiguous" | "mismatch" | "unverified" | "none" | "quota" | "error";
  naver_place_id: string | null;
  naver_place_url: string | null;
  matched_name: string | null;
  candidates: { id: string; name: string }[];
}

/**
 * 가게 이름으로 네이버 플레이스 ID를 자동 확정한다(서버가 네이버 검색 화면의 가게 카드 이름이 일치하는
 * 1곳일 때만 status="unique"로 돌려준다). 로그인 필요. 실패해도 등록은 계속 진행되어야 하므로 null을 돌려준다.
 */
export async function resolveNaverPlace(
  name: string,
  region: string,
  address: string,
  accessToken: string,
): Promise<ResolvedPlace | null> {
  try {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    const params = new URLSearchParams({ name, region, address });
    const res = await fetch(`${BACKEND}/api/businesses/resolve-place?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as ResolvedPlace;
  } catch {
    return null;
  }
}
