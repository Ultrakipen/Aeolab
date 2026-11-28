"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSafeSession } from "@/lib/supabase/client";
import { HeaderLogoutButton } from "./HeaderLogoutButton";

// variant: default=단순 헤더(이메일 표시) / header=SiteHeader 상단줄(이메일 숨김, 모바일은 로그아웃도 숨김)
// / menu=SiteHeader 모바일 메뉴 하단(로그인 상태일 때만 이메일·로그아웃)
export function AuthNavControlClient({ variant = "default" }: { variant?: "default" | "header" | "menu" }) {
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

  if (!checked) return null;

  if (variant === "menu") {
    if (!email) return null;
    return (
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 px-3 pt-3">
        <span className="min-w-0 truncate text-sm text-gray-600">{email}</span>
        <HeaderLogoutButton className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap text-sm font-semibold text-gray-700" />
      </div>
    );
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center min-h-[40px] -my-1 px-1 text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap"
      >
        로그인
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {variant === "default" ? (
        <span
          className="hidden lg:block text-sm text-gray-600 truncate max-w-[220px]"
          title={email}
        >
          {email}
        </span>
      ) : null}
      <Link
        href="/dashboard"
        title={email}
        className="text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
      >
        대시보드
      </Link>
      {variant === "header" ? (
        <span className="hidden md:inline-flex">
          <HeaderLogoutButton />
        </span>
      ) : (
        <HeaderLogoutButton />
      )}
    </div>
  );
}
