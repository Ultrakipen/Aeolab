import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, AlertCircle, Store } from "lucide-react";
import { AdminSupportClient } from "./AdminSupportClient";
import { CATEGORY_LABEL } from "@/lib/categories";

export const metadata = { title: "문의 상세 | AEOlab Admin" };

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

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
  author_type: "user" | "admin";
  body: string;
  created_at: string;
}

interface LatestScan {
  scanned_at: string;
  total_score: number | null;
  track1_score: number | null;
  track2_score: number | null;
  unified_score: number | null;
}

interface BusinessSummary {
  id: string;
  name: string;
  category: string;
  region: string;
  is_active: boolean;
  created_at: string;
  latest_scan: LatestScan | null;
}

interface TicketDetail {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  visibility: "public" | "private";
  created_at: string;
  replies?: Reply[];
  businesses?: BusinessSummary[];
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

  const adminKey = process.env.ADMIN_SECRET_KEY ?? "";
  const ticket = await fetchTicket(id, adminKey);

  if (!ticket) {
    return (
      <div className="max-w-2xl mx-auto">
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
    <>
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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
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

      {/* 문의자 사업장 정보 (고객지원 조회용) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Store className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-800">문의자 사업장</h2>
        </div>
        {!ticket.businesses || ticket.businesses.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 사업장이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {ticket.businesses.map((biz) => (
              <div key={biz.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-900">{biz.name}</span>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {CATEGORY_LABEL[biz.category] ?? biz.category}
                  </span>
                  {biz.region && <span className="text-sm text-gray-400">{biz.region}</span>}
                  {!biz.is_active && (
                    <span className="text-sm text-red-600 bg-red-50 px-2 py-0.5 rounded-full">비활성</span>
                  )}
                </div>
                {biz.latest_scan ? (
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
                    <span>최근 스캔: {formatDate(biz.latest_scan.scanned_at)}</span>
                    <span>종합 {biz.latest_scan.unified_score?.toFixed(1) ?? "—"}점</span>
                    <span>네이버 트랙 {biz.latest_scan.track1_score?.toFixed(1) ?? "—"}점</span>
                    <span>글로벌 트랙 {biz.latest_scan.track2_score?.toFixed(1) ?? "—"}점</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">아직 스캔 이력이 없습니다.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 클라이언트 컴포넌트: 답글 스레드 + 액션 패널 */}
      <AdminSupportClient
        ticketId={ticket.id}
        initialReplies={replies}
        currentStatus={ticket.status}
        isPublic={ticket.visibility === "public"}
      />
    </>
  );
}
