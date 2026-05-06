"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { trackClaimFunnel } from "@/lib/analytics";

/**
 * /dashboard?from=trial_claim&trial_id=... 진입 시 GA4 이벤트 1회 발송
 *
 * - auth/callback 라우트가 trial-attach 호출 후 이쪽으로 redirect
 * - 사용자가 새로고침해도 sessionStorage 가드로 중복 발송 차단
 */
export default function TrialAttachTracker() {
  const sp = useSearchParams();
  const from = sp.get("from");
  const trialId = sp.get("trial_id") ?? undefined;
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (from !== "trial_claim") return;

    const key = `aeolab_trial_attached_${trialId ?? "unknown"}`;
    try {
      if (sessionStorage.getItem(key) === "1") {
        firedRef.current = true;
        return;
      }
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    firedRef.current = true;
    trackClaimFunnel("attached", { trial_id: trialId });
  }, [from, trialId]);

  return null;
}
