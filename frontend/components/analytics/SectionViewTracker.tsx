"use client";

import { useEffect } from "react";
import { trackSectionView } from "@/lib/analytics";

/**
 * 랜딩 섹션별 도달 계측(2026-11-08) — 어느 섹션까지 읽는지 데이터로 확인해 중복·긴 섹션을 줄일 근거를 만든다.
 * 최상위 <section>마다 35% 이상 보이면 세션당 1회 발화한다. 모바일에서 접힌 섹션은 펼쳐 보이기 전에는 발화하지 않는다(헤더만 보이면 발화).
 * 화면에는 아무것도 그리지 않는다. GA4가 없으면 trackEvent가 no-op이다.
 */
export default function SectionViewTracker() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const viewport: "m" | "pc" = window.innerWidth < 768 ? "m" : "pc";
    const fired = new Set<number>();
    let observer: IntersectionObserver | null = null;

    const timer = window.setTimeout(() => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>("main section")).filter(
        (el) => !el.parentElement?.closest("section"),
      );
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLElement;
            const index = Number(el.dataset.sectionIndex);
            if (!index || fired.has(index)) continue;
            fired.add(index);
            const raw = el.querySelector("h2, h1, h3")?.textContent || el.getAttribute("aria-label") || el.querySelector("p, strong, span")?.textContent || "";
            const label = raw.replace(/\s+/g, " ").trim().slice(0, 30) || `section-${index}`;
            trackSectionView(index, label, viewport);
            observer?.unobserve(el);
          }
        },
        { threshold: 0.35 },
      );
      sections.forEach((el, i) => {
        el.dataset.sectionIndex = String(i + 1);
        observer?.observe(el);
      });
    }, 800);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  return null;
}
