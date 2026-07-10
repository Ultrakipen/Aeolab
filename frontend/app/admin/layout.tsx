import { createClient } from "@/lib/supabase/server";
import { AdminHeaderNav } from "./AdminHeaderNav";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));

  // 관리자가 아니면 공통 헤더·섹션 목록을 노출하지 않고 각 페이지 자체의
  // 401/redirect 처리에 그대로 맡긴다(내부 라우트 구조 노출 방지).
  if (!isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <AdminHeaderNav />
      </header>
      <div className="max-w-5xl mx-auto p-4 md:p-8">{children}</div>
    </div>
  );
}
