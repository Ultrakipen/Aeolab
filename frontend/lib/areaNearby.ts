// 내 가게 중심 반경 300m 업종 분포 — 타입과 화면 계산(순수 함수). 값은 /api/area/nearby 응답(집계만, 가게 이름 없음).

export interface NearbyGroup {
  lcls: string; // 대분류
  mcls: string; // 중분류
  scls: string; // 소분류(가장 구체적인 업종 이름)
  count: number;
}

export interface NearbyPlace {
  label: string;
  address: string;
  lon: number;
  lat: number;
}

export type NearbyResult =
  | {
      available: true;
      radius_m: number;
      center: { lon: number; lat: number };
      total: number; // API가 알려 준 반경 안 전체 업소 수
      counted: number; // 실제로 받아 센 수(total 보다 작으면 적게 집계된 것)
      complete: boolean;
      stdr_ym: string | null;
      groups: NearbyGroup[];
    }
  | { available: false; reason: "fetch_failed" | "daily_limit" | "ip_limit"; radius_m: number };

export interface LargeGroup {
  lcls: string;
  count: number;
  items: NearbyGroup[];
}

// 대분류별 묶음 — 개수 많은 순. 같은 개수면 이름순(항상 같은 순서가 나오게)
export function groupByLarge(groups: NearbyGroup[]): LargeGroup[] {
  const map = new Map<string, LargeGroup>();
  for (const g of groups) {
    const cur = map.get(g.lcls) ?? { lcls: g.lcls, count: 0, items: [] };
    cur.count += g.count;
    cur.items.push(g);
    map.set(g.lcls, cur);
  }
  const out = [...map.values()];
  for (const l of out) l.items.sort((a, b) => b.count - a.count || a.scls.localeCompare(b.scls, "ko"));
  return out.sort((a, b) => b.count - a.count || a.lcls.localeCompare(b.lcls, "ko"));
}

// 전체 중 비중(%) — 소수 첫째 자리. 분모가 0이면 null(0%처럼 보이지 않게)
export function sharePct(count: number, denominator: number): number | null {
  if (!(denominator > 0) || count < 0) return null;
  return Math.round((count / denominator) * 1000) / 10;
}

// 업종 이름 검색(대분류·중분류·소분류 어느 쪽이든 일치) — 공백 무시
export function filterGroups(groups: NearbyGroup[], query: string): NearbyGroup[] {
  const q = query.replace(/\s+/g, "");
  if (!q) return groups;
  return groups.filter((g) => `${g.lcls}${g.mcls}${g.scls}`.replace(/\s+/g, "").includes(q));
}

// "202609" → "2026년 9월"
export function formatStdrYm(ym: string | null): string {
  if (!ym || !/^\d{6}$/.test(ym)) return "";
  return `${ym.slice(0, 4)}년 ${Number(ym.slice(4))}월`;
}
