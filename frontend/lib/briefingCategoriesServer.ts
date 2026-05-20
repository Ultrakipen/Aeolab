/**
 * 서버 컴포넌트 전용 — AI 브리핑 업종 분류를 백엔드 API에서 동적으로 가져옴.
 * 백엔드 BRIEFING_*_CATEGORIES 변경 시 프론트 재배포 없이 자동 반영.
 * API 실패 시 userGroup.ts 하드코딩 값으로 fallback.
 *
 * Next.js fetch revalidate: 1800 — 30분 캐시 (백엔드와 동일 TTL).
 */

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

const FALLBACK_ACTIVE = ["restaurant", "cafe", "bakery", "bar", "accommodation"];
const FALLBACK_LIKELY = [
  "beauty", "nail", "skincare", "massage", "spa",
  "pet", "fitness", "yoga", "pharmacy",
  "dance", "ballet", "semi_permanent",
];

export interface BriefingCategories {
  active: readonly string[];
  likely: readonly string[];
}

export async function fetchBriefingCategories(): Promise<BriefingCategories> {
  try {
    const res = await fetch(`${BACKEND}/api/public/briefing-categories`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const active: string[] = Array.isArray(data.active) ? data.active : FALLBACK_ACTIVE;
    const likely: string[] = Array.isArray(data.likely) ? data.likely : FALLBACK_LIKELY;
    return { active, likely };
  } catch {
    return { active: FALLBACK_ACTIVE, likely: FALLBACK_LIKELY };
  }
}
