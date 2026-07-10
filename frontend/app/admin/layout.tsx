import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

const NAV_ITEMS = [
  { href: "/admin/delivery", label: "대행 의뢰" },
  { href: "/admin/support", label: "Q&A 문의" },
  { href: "/admin/feedback", label: "피드백" },
  { href: "/admin/notices", label: "공지사항" },
  { href: "/admin/score-comparison", label: "점수 모델 비교" },
  { href: "/admin/business", label: "사업장 조회" },
  { href: "/admin/ops", label: "운영 현황" },
];

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
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-base font-bold text-gray-900 shrink-0">
            AEOlab 관리자
          </Link>
          <nav className="flex flex-wrap gap-1 justify-end">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-gray-600 hover:text-blue-600 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="max-w-5xl mx-auto p-4 md:p-8">{children}</div>
    </div>
  );
}
