import type { BizinfoView } from "@/lib/supportBoard";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// 백엔드는 하루 한 번 받아 둔 파일을 읽을 뿐이라 부담이 작다 — 페이지 ISR 주기와 같게 한 시간
export const BIZINFO_REVALIDATE_SECONDS = 3600;

/**
 * 기업마당 스냅샷 조회. 실패하면 throw 한다 — 실패 화면이 ISR 캐시에 한 시간 남지 않고 직전의 정상 페이지가 유지된다.
 * (스냅샷이 아직 없으면 available=false 를 그대로 돌려준다.)
 */
export async function fetchBizinfo(): Promise<BizinfoView> {
  const res = await fetch(`${BACKEND_URL}/api/bizinfo`, { next: { revalidate: BIZINFO_REVALIDATE_SECONDS } });
  if (!res.ok) throw new Error(`bizinfo ${res.status}`);
  return (await res.json()) as BizinfoView;
}

/** 스냅샷이 만들어진 날짜(사이트맵 lastmod 용 — 실제로 내용이 바뀐 날만 반영). 실패하면 null(빌드·요청을 막지 않는다) */
export async function fetchBizinfoUpdatedAt(): Promise<Date | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/bizinfo`, { next: { revalidate: BIZINFO_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const j = (await res.json()) as BizinfoView;
    if (!j.available || !j.generated_at) return null;
    const t = Date.parse(j.generated_at);
    return Number.isFinite(t) ? new Date(t) : null;
  } catch {
    return null;
  }
}
