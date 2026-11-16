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
