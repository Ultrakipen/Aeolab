"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function HeaderLogoutButton({
  className = "text-sm text-gray-500 hover:text-gray-900 transition-colors whitespace-nowrap",
}: {
  className?: string;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button onClick={handleLogout} className={className}>
      로그아웃
    </button>
  );
}
