"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function LandingLogout({ email }: { email: string }) {
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-3 shrink-0">
      <Link href="/settings" className="text-sm text-gray-600 hover:text-blue-600 hidden sm:block transition-colors whitespace-nowrap max-w-[160px] truncate">{email}</Link>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
      >
        로그아웃
      </button>
    </div>
  );
}
