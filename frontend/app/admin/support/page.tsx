import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "Q&A 문의 관리 | AEOlab Admin" };

const ADMIN_EMAILS = ["hoozdev@gmail.com"];
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:     { label: "미답변",   color: "bg-orange-100 text-orange-700" },
  answered: { label: "답변완료", color: "bg-green-100 text-green-700" },
  closed:   { label: "종료",     color: "bg-gray-100 text-gray-600" },
};

const CATEGORY_LABELS: Record<string, string> = {
  payment: "결제",
  feature: "기능",
  score:   "점수",
  bug:     "버그",
  other:   "기타",
};

const STATUS_FILTERS = [
  { value: "",         label: "전체" },
  { value: "open",     label: "미답변" },
  { value: "answered", label: "답변완료" },
  { value: "closed",   label: "종료" },
];

interface Ticket {
  id: string;
  category: string;
  title: string;
  status: string;
  created_at: string;
}

interface TicketsResponse {
  tickets: Ticket[];
  total: number;
  open_count: number;
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

async function fetchTickets(statusFilter: string, adminKey: string): Promise<TicketsResponse> {
  try {
    const url = new URL(`${BACKEND_URL}/admin/support/tickets`);
    if (statusFilter) url.searchParams.set("status", statusFilter);
    const res = await fetch(url.toString(), {
      headers: { "X-Admin-Key": adminKey },
      cache: "no-store",
    });
    if (!res.ok) return { tickets: [], total: 0, open_count: 0 };
    return await res.json();
  } catch {
    return { tickets: [], total: 0, open_count: 0 };
  }
}

export default async function AdminSupportPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));
  if (!isAdmin) {
    return (
      <div className="p-4 md:p-8 text-center text-gray-500">
        <p className="text-base">접근 권한이 없습니다.</p>
      </div>
    );
  }

  const params = await searchParams;
  const statusFilter = params.status ?? "";
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY ?? "";

  const { tickets, open_count } = await fetchTickets(statusFilter, adminKey);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Q&A 문의 관리</h1>
        <p className="text-sm text-gray-500 mt-1">사용자 문의 목록 및 답변 관리</p>
      </div>

      {/* 상태 탭 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.value;
          const showBadge = f.value === "open" && open_count > 0;
          return (
            <Link
              key={f.value}
              href={f.value ? `/admin/support?status=${f.value}` : "/admin/support"}
              className={[
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}
            >
              {f.label}
              {showBadge && (
                <span
                  className={[
                    "inline-flex items-center justify-center w-5 h-5 rounded-full text-sm font-bold",
                    isActive ? "bg-white text-blue-600" : "bg-orange-500 text-white",
                  ].join(" ")}
                >
                  {open_count > 99 ? "99+" : open_count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* PC 테이블 */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {tickets.length === 0 ? (
          <div className="py-16 text-center text-base text-gray-500">
            {statusFilter
              ? `[${STATUS_META[statusFilter]?.label ?? statusFilter}] 상태의 문의가 없습니다.`
              : "문의가 없습니다."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500 w-24">카테고리</th>
                  <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500">제목</th>
                  <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500 w-28">상태</th>
                  <th className="text-right px-5 py-3 text-sm font-semibold text-gray-500 w-28">작성일</th>
                  <th className="text-center px-5 py-3 text-sm font-semibold text-gray-500 w-20">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tickets.map((ticket) => {
                  const sm = STATUS_META[ticket.status] ?? { label: ticket.status, color: "bg-gray-100 text-gray-600" };
                  const catLabel = CATEGORY_LABELS[ticket.category] ?? ticket.category;
                  return (
                    <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                          {catLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[300px]">
                          {ticket.title}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block text-sm font-semibold px-2.5 py-1 rounded-full ${sm.color}`}>
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-400">
                        {formatDate(ticket.created_at)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Link
                          href={`/admin/support/${ticket.id}`}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          상세 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 모바일 카드 목록 */}
      <div className="md:hidden space-y-3">
        {tickets.length === 0 ? (
          <div className="py-12 text-center text-base text-gray-500 bg-white rounded-2xl border border-gray-100">
            문의가 없습니다.
          </div>
        ) : (
          tickets.map((ticket) => {
            const sm = STATUS_META[ticket.status] ?? { label: ticket.status, color: "bg-gray-100 text-gray-600" };
            const catLabel = CATEGORY_LABELS[ticket.category] ?? ticket.category;
            return (
              <Link
                key={ticket.id}
                href={`/admin/support/${ticket.id}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                      {catLabel}
                    </span>
                    <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${sm.color}`}>
                      {sm.label}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400 shrink-0">{formatDate(ticket.created_at)}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {ticket.title}
                </p>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
