import type { ReactNode } from "react";

// 서버 컴포넌트용 스트리밍 헬퍼 — <Suspense> 안에서 Promise를 기다렸다가 렌더한다.
// 대시보드 접힘 섹션의 느린 백엔드 조회(gap·action-log·channel-trend·photo-guide)를
// 첫 화면 렌더 대기에서 분리하기 위해 사용(2026-09-30).
export default async function Await<T>({
  promise,
  children,
}: {
  promise: Promise<T>;
  children: (value: T) => ReactNode;
}) {
  return <>{children(await promise)}</>;
}
