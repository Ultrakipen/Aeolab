"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSafeSession } from "@/lib/supabase/client";
import { HeaderLogoutButton } from "@/components/common/HeaderLogoutButton";

/**
 * 랜딩 페이지 헤더 전용 인증 네비게이션
 * - 세션 확인 전: 무료 진단 버튼만 표시 (비로그인 기본값, SSR 캐시 가능)
 * - 비로그인: 로그인 링크 + 무료 진단 버튼
 * - 로그인(lg 미만): 대시보드 · 이메일(sm+) · 로그아웃 텍스트 나열
 * - 로그인(lg 이상): "대시보드"는 핵심 재진입 동선이라 상시 노출 유지,
 *   이메일 · 로그아웃만 아바타 드롭다운으로 묶어 산만함 방지
 */
export function LandingHeaderNav() {
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

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
          className="inline-block text-sm font-medium px-2 sm:px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50 whitespace-nowrap"
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
      {/* lg 미만: 텍스트 나열 (항목 적어 그대로 유지) */}
      <div className="flex items-center gap-0.5 lg:hidden">
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
      </div>

      {/* lg 이상: 대시보드 상시 노출 + 계정(이메일·로그아웃) 아바타 드롭다운 */}
      <div className="hidden lg:flex items-center gap-0.5 ml-1">
        <Link
          href="/dashboard"
          className="text-sm font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50 whitespace-nowrap"
          style={{ color: "#2563EB" }}
        >
          대시보드
        </Link>
        <div className="relative ml-1" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white transition-transform hover:scale-105"
            style={{ background: "#2563EB" }}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="계정 메뉴"
          >
            {email.charAt(0).toUpperCase()}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg py-1 z-50">
              <Link
                href="/settings"
                title={email}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-gray-600 truncate border-b border-slate-100 hover:text-blue-600"
              >
                {email}
              </Link>
              <div className="px-1 py-1">
                <HeaderLogoutButton className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-slate-50 rounded transition-colors cursor-pointer" />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
