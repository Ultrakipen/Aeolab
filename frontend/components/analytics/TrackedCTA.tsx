"use client";

import Link from "next/link";
import { trackCTA } from "@/lib/analytics";
import type { ReactNode, MouseEvent } from "react";

interface Props {
  href: string;
  location: string;
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * GA4 CTA 클릭을 자동으로 발송하는 Link 래퍼
 * - location: 'hero' | 'final' | 'header' 등 위치
 * - label: 'trial_start' | 'sample_view' 등 의미
 */
export default function TrackedCTA({ href, location, label, className, children }: Props) {
  const handleClick = (_e: MouseEvent<HTMLAnchorElement>) => {
    const extra: Record<string, unknown> = {};
    // hero CTA는 클릭 시점에 노출 중이던 헤드라인 인덱스를 함께 보내
    // 어느 헤드라인이 클릭 유도력 높은지 1주 후 분석 가능하게 함
    if (location === "hero" && typeof window !== "undefined") {
      try {
        const idx = window.sessionStorage.getItem("aeolab_headline_index");
        if (idx !== null) extra.headline_index = Number(idx);
      } catch {
        // sessionStorage 차단 시 무시
      }
    }
    trackCTA(location, label, extra);
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
