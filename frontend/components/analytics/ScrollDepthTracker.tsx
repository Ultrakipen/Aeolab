"use client";

import { useEffect } from "react";
import { trackScrollDepth } from "@/lib/analytics";

const THRESHOLDS = [25, 50, 75, 100] as const;

/**
 * 페이지 전체 스크롤 깊이 추적 — 각 임계값(25/50/75/100%)에 도달하면 1회씩만 발화.
 * 랜딩 페이지에 마운트해 실제 이탈 지점을 데이터로 확인하기 위한 계측용, 화면에는 렌더링 없음.
 */
export default function ScrollDepthTracker() {
  useEffect(() => {
    const fired = new Set<number>();

    function handleScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) return;
      const percent = ((window.scrollY / scrollable) * 100);

      for (const threshold of THRESHOLDS) {
        if (percent >= threshold && !fired.has(threshold)) {
          fired.add(threshold);
          trackScrollDepth(threshold);
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return null;
}
