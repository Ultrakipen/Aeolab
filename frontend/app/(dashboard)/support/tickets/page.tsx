import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Plus } from "lucide-react";

export const metadata = { title: "1:1 문의 | AEOlab" };

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Ticket {
  id: string;
  category: string;
  title: string;
  status: string;
  visibility: "public" | "private";
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "답변 대기", color: "bg-blue-100 text-blue-700" },
  answered: { label: "답변 완료", color: "bg-green-100 text-green-700" },
  closed: { label: "종료", color: "bg-gray-100 text-gray-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
  payment: "결제",
  feature: "기능 사용",
  score: "점수 해석",
  bug: "버그",
  other: "기타",
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "전체" },
  { value: "open", label: "답변 대기" },
  { value: "answered", label: "답변 완료" },
  { value: "closed", label: "종료" },
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

async function fetchMyTickets(token: string, status?: string): Promise<Ticket[]> {
  try {
    const url = new URL(`${BACKEND_URL}/api/support/tickets/me`);
    if (status) url.searchParams.set("status", status);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.tickets ?? data ?? [];
  } catch {
    return [];
  }
}

export default async function SupportTicketsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) user = data.user;
  } catch {}
  if (!user) redirect("/login");

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token ?? "";

  const params = await searchParams;
  const statusFilter = params.status ?? "";

  const tickets = await fetchMyTickets(token, statusFilter || undefined);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">1:1 문의</h1>
            <p className="text-sm text-gray-500 mt-1">문의 내역을 확인하고 새 문의를 작성할 수 있습니다.</p>
          </div>
          <Link
            href="/support/tickets/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            새 문의 작성
          </Link>
        </div>

        {/* 상태 필터 */}
        <div className="flex flex-wrap gap-2 mb-5">
          {STATUS_FILTER_OPTIONS.map((f) => (
            <Link
              key={f.value}
              href={f.value ? `/support/tickets?status=${f.value}` : "/support/tickets"}
              className={[
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* 목록 */}
        {tickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-500 mb-1">
              {statusFilter ? "해당 상태의 문의가 없습니다." : "아직 문의가 없습니다."}
            </p>
            <p className="text-sm text-gray-400 mb-4">궁금한 점이 있으면 문의해 주세요.</p>
            <Link
              href="/support/tickets/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              첫 문의 작성
            </Link>
          </div>
        ) : (
          <>
            {/* PC 테이블 */}
            <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500">카테고리</th>
                      <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500">제목</th>
                      <th className="text-center px-5 py-3 text-sm font-semibold text-gray-500">상태</th>
                      <th className="text-right px-5 py-3 text-sm font-semibold text-gray-500">작성일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tickets.map((ticket) => {
                      const sm = STATUS_META[ticket.status] ?? { label: ticket.status, color: "bg-gray-100 text-gray-600" };
                      return (
                        <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-500">
                              {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <Link
                              href={`/support/tickets/${ticket.id}`}
                              className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate max-w-[240px] block"
                            >
                              {ticket.title}
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-block text-sm font-semibold px-2.5 py-1 rounded-full ${sm.color}`}>
                              {sm.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-sm text-gray-400">
                            {formatDate(ticket.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 모바일 카드 */}
            <div className="md:hidden space-y-3">
              {tickets.map((ticket) => {
                const sm = STATUS_META[ticket.status] ?? { label: ticket.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <Link
                    key={ticket.id}
                    href={`/support/tickets/${ticket.id}`}
                    className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-sm text-gray-500">
                        {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                      </span>
                      <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${sm.color}`}>
                        {sm.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{ticket.title}</p>
                    <p className="text-sm text-gray-400 mt-1">{formatDate(ticket.created_at)}</p>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
