"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email: string;
  plan: string | null;
}

export function PageHeaderAvatarMenu({ email, plan }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 외부 클릭 시 닫힘
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initial = email ? email[0].toUpperCase() : "?";

  const planLabel: Record<string, string> = {
    free: "무료", basic: "Basic", pro: "Pro", biz: "Biz",
    startup: "창업패키지",
  };
  const planText = planLabel[plan ?? "free"] ?? "무료";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="사용자 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center transition-colors"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
        >
          {/* 계정 정보 */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{email}</p>
            <p className="text-sm text-gray-500">{planText} 요금제</p>
          </div>

          {/* 메뉴 항목 */}
          <div className="py-1">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
            >
              설정
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
            >
              로그아웃
            </button>
          </div>

          {/* 구분선 */}
          <div className="border-t border-gray-100 py-1">
            <Link
              href="/how-it-works"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
            >
              서비스 매뉴얼
            </Link>
            <Link
              href="/delivery"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
            >
              대행 서비스
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
