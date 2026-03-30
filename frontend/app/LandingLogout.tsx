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
    <div className="flex items-center gap-3">
      <Link href="/settings" className="text-sm text-gray-600 hover:text-blue-600 hidden sm:block transition-colors">{email}</Link>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
      >
        로그아웃
      </button>
    </div>
  );
}
