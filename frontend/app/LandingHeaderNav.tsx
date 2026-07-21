"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSafeSession } from "@/lib/supabase/client";
import { HeaderLogoutButton } from "@/components/common/HeaderLogoutButton";

/**
 * 랜딩 페이지 헤더 전용 인증 네비게이션
 * - 세션 확인 전: 무료 진단 버튼만 표시 (비로그인 기본값, SSR 캐시 가능)
 * - 비로그인: 로그인 링크 + 무료 진단 버튼
 * - 로그인: 대시보드 링크 + 로그아웃 버튼
 */
export function LandingHeaderNav() {
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    getSafeSession().then((session) => {
      if (!active) return;
      setEmail(session?.user?.email ?? null);
      setChecked(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // 세션 확인 전: 무료 진단 버튼만 표시
  if (!checked) {
    return (
      <Link
        href="/trial"
        className="ml-1.5 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors hover:bg-[#1D4ED8] whitespace-nowrap"
        style={{ background: "#2563EB" }}
      >
        무료 진단
      </Link>
    );
  }

  // 비로그인
  if (!email) {
    return (
      <>
        <Link
          href="/login"
          className="hidden sm:inline-block text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50 whitespace-nowrap"
          style={{ color: "#475569" }}
        >
          로그인
        </Link>
        <Link
          href="/trial"
          className="ml-1.5 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors hover:bg-[#1D4ED8] whitespace-nowrap"
          style={{ background: "#2563EB" }}
        >
          무료 진단
        </Link>
      </>
    );
  }

  // 로그인 상태
  return (
    <>
      <Link
        href="/dashboard"
        className="text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50 whitespace-nowrap"
        style={{ color: "#475569" }}
      >
        대시보드
      </Link>
      <Link
        href="/settings"
        title={email}
        className="hidden sm:block text-sm text-gray-600 hover:text-blue-600 transition-colors whitespace-nowrap max-w-[220px] truncate mx-3"
      >
        {email}
      </Link>
      <HeaderLogoutButton />
    </>
  );
}
