import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HeaderLogoutButton } from "./HeaderLogoutButton";

export async function AuthNavControl() {
  const supabase = await createClient();

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) user = data.user;
  } catch {
    // Invalid Refresh Token 등 인증 에러 → 비로그인 처리
  }

  if (!user) {
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
        className="hidden lg:block text-sm text-gray-500 truncate max-w-[220px]"
        title={user.email ?? ""}
      >
        {user.email}
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
