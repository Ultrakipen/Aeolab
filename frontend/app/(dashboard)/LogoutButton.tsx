"use client";

import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const handleLogout = async () => {
    try {
      await createClient().auth.signOut();
    } catch {
      // 세션이 이미 만료된 경우 signOut()이 예외를 던질 수 있음 —
      // 그래도 아래 리다이렉트는 항상 실행돼야 "버튼 눌러도 반응 없음"이 되지 않음
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
    >
      로그아웃
    </button>
  );
}
