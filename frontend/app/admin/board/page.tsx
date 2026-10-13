import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AdminBoardClient, type AdminPost } from "./AdminBoardClient";

export const metadata = { title: "문의 게시판 관리 | AEOlab Admin" };

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const FILTERS = [
  { value: "", label: "전체" },
  { value: "pending", label: "답변대기" },
  { value: "answered", label: "답변완료" },
];

async function fetchPosts(status: string, adminKey: string): Promise<{ items: AdminPost[]; total: number }> {
  try {
    const url = new URL(`${BACKEND_URL}/admin/board/list`);
    if (status) url.searchParams.set("status", status);
    url.searchParams.set("limit", "100");
    const res = await fetch(url.toString(), { headers: { "X-Admin-Key": adminKey }, cache: "no-store" });
    if (!res.ok) return { items: [], total: 0 };
    return await res.json();
  } catch {
    return { items: [], total: 0 };
  }
}

export default async function AdminBoardPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(user?.email && ADMIN_EMAILS.includes(user.email))) {
    return <div className="p-4 md:p-8 text-center text-gray-600">접근 권한이 없습니다.</div>;
  }

  const status = (await searchParams).status ?? "";
  const { items, total } = await fetchPosts(status, process.env.ADMIN_SECRET_KEY ?? "");

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">문의 게시판 관리</h1>
        <p className="text-sm text-gray-600 mt-1">공개 게시판(/board) 글 확인·답변·숨김·공지 (총 {total}건)</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/board?status=${f.value}` : "/admin/board"}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              status === f.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <AdminBoardClient items={items} />
    </>
  );
}
