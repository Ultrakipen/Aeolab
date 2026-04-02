import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Notice } from "@/types";

const CATEGORY_BADGE: Record<string, string> = {
  general: "bg-gray-100 text-gray-600",
  update: "bg-blue-100 text-blue-700",
  maintenance: "bg-amber-100 text-amber-700",
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "일반",
  update: "서비스 업데이트",
  maintenance: "점검 안내",
};

async function fetchNotice(id: string): Promise<Notice | null> {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  try {
    const res = await fetch(BACKEND_URL + "/api/notices/" + id, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function NoticeDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const notice = await fetchNotice(params.id);
  if (!notice) notFound();

  const formattedDate = new Date(notice.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Link href="/notices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4 md:mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        목록으로
      </Link>

      <div className="border-b border-gray-200 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          {notice.is_pinned && <span className="text-red-500">📌</span>}
          <span className={"inline-block px-2 py-0.5 rounded text-xs font-medium " + CATEGORY_BADGE[notice.category]}>
            {CATEGORY_LABEL[notice.category]}
          </span>
        </div>
        <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug mb-2">{notice.title}</h1>
        <p className="text-sm text-gray-400">{formattedDate}</p>
      </div>

      <div className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
        {notice.content}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100">
        <Link href="/notices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          목록으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
