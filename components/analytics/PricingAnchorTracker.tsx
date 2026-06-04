"use client";

import { useEffect, useRef } from "react";
import { trackPricingAnchorView } from "@/lib/analytics";

/**
 * 가격 앵커 섹션 노출 감지 (IntersectionObserver) → GA4 1회 발화.
 *
 * 1순위 변경(가격 앵커 상향)의 도달률을 측정하기 위한 추적용 빈 div.
 * 30% 이상 노출 시 발화 후 즉시 disconnect — 페이지당 단 한 번만 측정.
 */
export default function PricingAnchorTracker() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            trackPricingAnchorView();
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return <div ref={ref} aria-hidden="true" className="h-px w-full" />;
}
