"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  trackMobileFloatingCtaShown,
  trackMobileFloatingCtaClick,
} from "@/lib/analytics";

/**
 * 모바일 전용 하단 고정 CTA — PC에서는 완전히 숨김(md:hidden).
 *
 * 노출 규칙 (usePathname 기반):
 *   /            → 스크롤 > 600px 일 때만 등장 (히어로 지난 후)
 *   /demo        → 진입 즉시 노출
 *   /pricing     → 진입 즉시 노출
 *   /trial 하위  → 노출 안 함 (이미 진단 중)
 *   /dashboard 하위 → 노출 안 함 (이미 회원)
 *   그 외        → 노출 안 함 (auth, payment 등 방해 금지)
 *
 * 노출 시 mobile_floating_cta_shown 이벤트를 세션+page 단위 1회만 발화.
 * 클릭 시 mobile_floating_cta_click 이벤트 발화 후 /trial로 이동.
 *
 * Safe area 대응: padding-bottom: env(safe-area-inset-bottom) — iOS 홈바 가림 방지.
 */

type PageKey = "home" | "demo" | "pricing";

interface PageConfig {
  key: PageKey;
  label: string;
  scrollThreshold: number; // 0 이면 즉시 노출
}

function resolvePage(pathname: string | null): PageConfig | null {
  if (!pathname) return null;

  // Trial / Dashboard 는 완전 제외 (세그먼트 경계로 판단)
  if (pathname === "/trial" || pathname.startsWith("/trial/")) return null;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return null;

  if (pathname === "/") {
    return { key: "home", label: "무료 진단 시작 →", scrollThreshold: 600 };
  }
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    return { key: "demo", label: "내 가게 무료 진단 →", scrollThreshold: 0 };
  }
  if (pathname === "/pricing" || pathname.startsWith("/pricing/")) {
    return { key: "pricing", label: "무료 진단 시작 →", scrollThreshold: 0 };
  }
  return null;
}

export default function MobileFloatingCTA() {
  const pathname = usePathname();
  const config = resolvePage(pathname);

  // 스크롤 위치 — 외부 시스템(window) 구독이라 useEffect에서 업데이트가 맞다.
  // threshold 0 인 페이지는 아래 derived 로직에서 즉시 true가 되므로 이 state에 영향받지 않는다.
  const [scrolledPastThreshold, setScrolledPastThreshold] = useState(false);

  useEffect(() => {
    // 페이지가 바뀔 때마다 초기 상태 동기화 + 리스너 재등록.
    // threshold 0 페이지에서도 리스너를 붙이지만 부하가 거의 없어 단순화를 우선한다.
    if (!config) return;

    const threshold = config.scrollThreshold;

    // 외부 시스템(window.scrollY) 값을 React state에 반영하는 전형적인 구독 패턴
    const sync = () => {
      setScrolledPastThreshold(window.scrollY > threshold);
    };
    sync();

    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [config]);

  // 노출 여부는 상태가 아닌 derived value — render 중 계산
  const visible = !!config && (config.scrollThreshold <= 0 || scrolledPastThreshold);

  // 노출 이벤트 — visible=true가 되는 순간 1회만 (세션+page 단위 dedupe는 analytics 모듈이 담당)
  useEffect(() => {
    if (visible && config) {
      trackMobileFloatingCtaShown(config.key);
    }
  }, [visible, config]);

  if (!config || !visible) return null;

  const handleClick = () => {
    trackMobileFloatingCtaClick(config.key);
  };

  return (
    <div
      // md:hidden → 데스크톱(≥768px)에서 완전히 숨김
      // fixed + bottom-0 + safe-area-inset-bottom 로 홈바 가림 방지
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      role="region"
      aria-label="모바일 무료 진단 시작"
    >
      <div className="px-4 py-3">
        <Link
          href="/trial"
          onClick={handleClick}
          aria-label={config.label}
          className="flex items-center justify-center w-full py-3 rounded-xl bg-blue-600 text-white text-base font-bold hover:bg-blue-700 transition-colors"
        >
          {config.label}
        </Link>
      </div>
    </div>
  );
}
