// /area(우리 동네 상권) 공통 — 타입·조회·표기 보조. 값은 백엔드가 미리 수집한 스냅샷이며 방문자 요청이 외부 API를 부르지 않는다.

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// 페이지 ISR 주기와 같게 — 백엔드는 파일 한 개를 읽을 뿐이라 부담이 작다
export const AREA_REVALIDATE_SECONDS = 3600;

export interface AreaSbiz {
  total_count: number | null;
  density_per_km2: number | null;
  radius_m: number | null;
  confidence: "good" | "medium" | "low" | null;
  partial_failure: boolean;
  stdr_ym: string | null;
  scope_label?: string;
}

export interface AreaClosure {
  closure_rate: number | null;
  active_count: number | null;
  closed_count: number | null;
  national_avg: number | null;
  comparison: "lower" | "similar" | "higher" | null;
  scope_label: string;
}

export interface AreaDetail {
  region_slug: string;
  category: string;
  region_label?: string;
  category_label?: string;
  available: boolean;
  reason?: "unsupported" | "not_collected" | "no_data";
  collected_at?: string | null;
  sbiz?: AreaSbiz | null;
  closure?: AreaClosure | null;
}

export interface AreaRegion {
  slug: string;
  label: string;
  sido: string;
  sigungu: string;
}

export interface AreaMeta {
  regions: AreaRegion[];
  categories: { value: string; label: string }[];
}

// Next가 한글 경로 값을 인코딩된 채로 줄 수 있어 방어적으로 한 번 풀어 준다
export function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/**
 * 상세 조회. 404=지원하지 않는 지역·업종(null), 그 외 실패는 throw —
 * 실패 화면이 ISR 캐시에 남아 한 시간 동안 보이는 일을 막는다(throw 하면 직전에 만든 정상 페이지가 유지됨).
 */
export async function fetchAreaDetail(region: string, category: string): Promise<AreaDetail | null> {
  const res = await fetch(
    `${BACKEND_URL}/api/area/${encodeURIComponent(region)}/${encodeURIComponent(category)}`,
    { next: { revalidate: AREA_REVALIDATE_SECONDS } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`area detail ${res.status}`);
  return (await res.json()) as AreaDetail;
}

export async function fetchAreaMeta(): Promise<AreaMeta> {
  const res = await fetch(`${BACKEND_URL}/api/area/meta`, { next: { revalidate: AREA_REVALIDATE_SECONDS } });
  if (!res.ok) throw new Error(`area meta ${res.status}`);
  return (await res.json()) as AreaMeta;
}

// 사이트맵용 — 실패해도 빌드·요청을 막지 않는다(빈 목록)
export async function fetchAreaAvailable(): Promise<{ region: string; category: string }[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/area/available`, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: { region: string; category: string }[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// 선택 화면용 — 값이 모인 (지역→업종 목록). 실패하면 null(표시를 막지 않고 전부 선택 가능하게 둔다: 빈 목록으로 오인해 모두 잠그지 않도록)
export async function fetchAreaAvailability(): Promise<Record<string, string[]> | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/area/available`, { next: { revalidate: AREA_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: { region: string; category: string }[] };
    if (!Array.isArray(data.items)) return null;
    const map: Record<string, string[]> = {};
    for (const it of data.items) (map[it.region] ??= []).push(it.category);
    return map;
  } catch {
    return null;
  }
}

/** "202609" → "2026년 9월". 형식이 다르면 null(추측해서 만들지 않는다) */
export function formatStdrYm(v: string | null | undefined): string | null {
  if (!v || !/^\d{6}$/.test(v)) return null;
  const m = Number(v.slice(4, 6));
  if (m < 1 || m > 12) return null;
  return `${v.slice(0, 4)}년 ${m}월`;
}

/** 수집 시각(ISO) → "2026-11-15". 형식이 다르면 null */
export function formatCollectedDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** 시도 순서 유지한 채 묶기 — 허브·선택 화면용 */
export function groupBySido(regions: AreaRegion[]): { sido: string; regions: AreaRegion[] }[] {
  const order: string[] = [];
  const map = new Map<string, AreaRegion[]>();
  for (const r of regions) {
    if (!map.has(r.sido)) {
      map.set(r.sido, []);
      order.push(r.sido);
    }
    map.get(r.sido)!.push(r);
  }
  return order.map((sido) => ({ sido, regions: map.get(sido)! }));
}

export function areaPath(region: string, category: string): string {
  return `/area/${encodeURIComponent(region)}/${encodeURIComponent(category)}`;
}
