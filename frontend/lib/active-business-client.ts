/**
 * 클라이언트에서 활성 사업장을 전환할 때 항상 호출한다.
 * `aeolab_active_biz` 쿠키(서버 컴포넌트의 getActiveBusinessId가 읽는 단일 소스)와
 * localStorage를 함께 갱신해, 페이지별 로컬 biz_id 전환이 다른 페이지 이동 시에도 유지되게 한다.
 *
 * 배경(2026-07-26): 대시보드/가이드 탭, 경쟁사 스위처가 각자 URL의 biz_id 쿼리만 바꾸고
 * 이 쿠키를 갱신하지 않아, 다른 페이지로 이동하면 첫 번째 등록 사업장으로 되돌아가는 버그가 있었음.
 */
export function syncActiveBusinessCookie(bizId: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `aeolab_active_biz=${bizId}; path=/; max-age=31536000; samesite=lax`;
  try {
    localStorage.setItem("aeolab.activeBizId", bizId);
  } catch {
    // 프라이빗 브라우징 등 localStorage 접근 실패는 무시 — 쿠키만으로도 충분
  }
  window.dispatchEvent(new CustomEvent("aeolab:active-biz-changed", { detail: { bizId } }));
}
