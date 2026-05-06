import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, AlertCircle } from "lucide-react";
import { AdminDeliveryDetailClient } from "./AdminDeliveryDetailClient";

export const metadata = { title: "의뢰 상세 | AEOlab Admin" };

const ADMIN_EMAILS = ["hoozdev@gmail.com"];
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Message {
  id: string;
  sender_type: "user" | "admin";
  body: string;
  created_at: string;
}

interface OrderDetail {
  id: string;
  package_type: string;
  request_title: string;
  request_body: string;
  status: string;
  created_at: string;
  amount: number;
  business_id?: string;
  consent_agreed?: boolean;
}

const PACKAGE_DISPLAY: Record<string, string> = {
  smartplace_register: "스마트플레이스 등록 대행",
  ai_optimization: "AI 검색 최적화",
  comprehensive: "종합 풀패키지",
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  received: { label: "접수", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "진행중", color: "bg-orange-100 text-orange-700" },
  completed: { label: "완료", color: "bg-green-100 text-green-700" },
  rework: { label: "재작업", color: "bg-purple-100 text-purple-700" },
  refunded: { label: "환불", color: "bg-gray-100 text-gray-600" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-700" },
};

async function fetchAdminOrder(id: string, adminKey: string): Promise<OrderDetail | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/delivery/${id}`, {
      headers: { "X-Admin-Key": adminKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.order ?? data;
  } catch {
    return null;
  }
}

async function fetchAdminMessages(id: string, adminKey: string): Promise<Message[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/delivery/${id}/messages`, {
      headers: { "X-Admin-Key": adminKey },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages ?? data ?? [];
  } catch {
    return [];
  }
}

export default async function AdminDeliveryDetailPage({
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

  // API로 조회, 실패하면 supabase 직접 조회
  let order: OrderDetail | null = await fetchAdminOrder(id, adminKey);

  if (!order) {
    // Supabase 직접 조회 (서버 컴포넌트)
    const { data } = await supabase
      .from("delivery_orders")
      .select("id, package_type, request_title, request_body, status, created_at, amount, business_id, consent_agreed")
      .eq("id", id)
      .single();
    order = data ?? null;
  }

  if (!order) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-medium text-red-800">의뢰를 찾을 수 없습니다.</p>
            <Link href="/admin/delivery" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const messages = await fetchAdminMessages(id, adminKey);
  const statusMeta = STATUS_META[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="p-4 md:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4 flex-wrap">
        <Link href="/admin" className="hover:text-blue-600 transition-colors">관리자</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/admin/delivery" className="hover:text-blue-600 transition-colors">대행 의뢰 관리</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 truncate max-w-[160px]">{order.request_title}</span>
      </div>

      {/* 의뢰 요약 헤더 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900">{order.request_title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {PACKAGE_DISPLAY[order.package_type] ?? order.package_type} · {order.amount?.toLocaleString()}원 · {formatDate(order.created_at)}
            </p>
          </div>
          <span className={`shrink-0 text-sm font-semibold px-3 py-1.5 rounded-full ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{order.request_body}</p>
        </div>
        {order.consent_agreed !== undefined && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${order.consent_agreed ? "text-green-700" : "text-red-600"}`}>
            <div className={`w-2 h-2 rounded-full ${order.consent_agreed ? "bg-green-500" : "bg-red-400"}`} />
            {order.consent_agreed ? "부운영자 위임 동의 완료" : "동의 미완료"}
          </div>
        )}
      </div>

      {/* 클라이언트 컴포넌트: 메시지 스레드 + 상태 변경 패널 */}
      {/* adminKey는 /api/admin-proxy 서버 프록시 경유로 처리 — 클라이언트에 전달하지 않음 */}
      <AdminDeliveryDetailClient
        orderId={order.id}
        initialMessages={messages}
        currentStatus={order.status}
      />
    </div>
  );
}
