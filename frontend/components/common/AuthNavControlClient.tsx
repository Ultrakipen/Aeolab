"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSafeSession } from "@/lib/supabase/client";
import { HeaderLogoutButton } from "./HeaderLogoutButton";

export function AuthNavControlClient() {
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

  if (!email) {
    return (
      <Link
        href="/login"
        className="text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap"
      >
        로그인
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 md:gap-3">
      <span
        className="hidden md:block text-sm text-gray-500 truncate max-w-[140px]"
        title={email}
      >
        {email}
      </span>
      <Link
        href="/dashboard"
        className="text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
      >
        대시보드
      </Link>
      <HeaderLogoutButton />
    </div>
  );
}
