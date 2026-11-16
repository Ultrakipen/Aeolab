import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * 방문 시점(현재 날짜 등)에 따라 달라지는 값을 하이드레이션 불일치 없이 쓰는 훅.
 * 서버 렌더·첫 하이드레이션은 serverValue, 이후 클라이언트에서는 compute() 결과를 쓴다.
 * (ISR로 캐시된 HTML의 값과 무관하게 방문 시점으로 판정하려는 곳 — 기준값 만료 경고 등)
 * compute 는 문자열·숫자·불리언처럼 같은 입력에 같은 값(===)을 돌려주는 순수 함수여야 한다.
 */
export function useClientValue<T extends string | number | boolean>(compute: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, compute, () => serverValue);
}
