"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trackReferral } from "@/lib/analytics";

/**
 * ?ref=kakao_share 같은 유입 소스 쿼리를 감지해 GA4로 1회 발화.
 *
 * - useSearchParams는 Suspense 경계가 필요(Next.js 16 관례). 내부 Inner 컴포넌트를 Suspense로 감싼다.
 * - trackReferral 자체가 sessionStorage로 source별 1회 보장 → 중복 걱정 없음.
 * - layout.tsx의 최상단 레벨에 1개만 배치.
 */
function ReferralTrackerInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams?.get("ref");
    if (ref) trackReferral(ref);
  }, [searchParams]);

  return null;
}

export default function ReferralTracker() {
  return (
    <Suspense fallback={null}>
      <ReferralTrackerInner />
    </Suspense>
  );
}
