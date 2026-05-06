import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, AlertCircle } from "lucide-react";
import { AdminSupportClient } from "./AdminSupportClient";

export const metadata = { title: "문의 상세 | AEOlab Admin" };

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

interface Reply {
  id: string;
  sender_type: "user" | "admin";
  body: string;
  is_public: boolean;
  created_at: string;
}

interface TicketDetail {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  is_public: boolean;
  created_at: string;
  replies?: Reply[];
}

async function fetchTicket(id: string, adminKey: string): Promise<TicketDetail | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/support/${id}`, {
      headers: { "X-Admin-Key": adminKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ticket ?? data;
  } catch {
    return null;
  }
}

export default async function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const adminKey = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY ?? "";
  const ticket = await fetchTicket(id, adminKey);

  if (!ticket) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-medium text-red-800">문의를 찾을 수 없습니다.</p>
            <Link
              href="/admin/support"
              className="text-sm text-blue-600 hover:underline mt-2 inline-block"
            >
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const replies: Reply[] = ticket.replies ?? [];
  const statusMeta = STATUS_META[ticket.status] ?? { label: ticket.status, color: "bg-gray-100 text-gray-600" };
  const catLabel = CATEGORY_LABELS[ticket.category] ?? ticket.category;

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 md:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4 flex-wrap">
        <Link href="/admin" className="hover:text-blue-600 transition-colors">
          관리자
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/admin/support" className="hover:text-blue-600 transition-colors">
          Q&A 문의 관리
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 truncate max-w-[160px]">{ticket.title}</span>
      </div>

      {/* 문의 요약 헤더 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-sm text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                {catLabel}
              </span>
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${statusMeta.color}`}>
                {statusMeta.label}
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 break-words">
              {ticket.title}
            </h1>
            <p className="text-sm text-gray-400 mt-1">{formatDate(ticket.created_at)}</p>
          </div>
        </div>

        {/* 문의 본문 */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {ticket.body}
          </p>
        </div>
      </div>

      {/* 클라이언트 컴포넌트: 답글 스레드 + 액션 패널 */}
      <AdminSupportClient
        ticketId={ticket.id}
        initialReplies={replies}
        currentStatus={ticket.status}
        isPublic={ticket.is_public ?? true}
      />
    </div>
  );
}
