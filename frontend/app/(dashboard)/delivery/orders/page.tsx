import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

export const metadata = { title: "내 의뢰 목록 | AEOlab" };

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface DeliveryOrder {
  id: string;
  package_type: string;
  request_title: string;
  status: string;
  created_at: string;
  amount: number;
  business_name?: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  received: { label: "접수", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "진행중", color: "bg-orange-100 text-orange-700" },
  completed: { label: "완료", color: "bg-green-100 text-green-700" },
  rework: { label: "재작업", color: "bg-purple-100 text-purple-700" },
  refunded: { label: "환불", color: "bg-gray-100 text-gray-600" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-700" },
};

const PACKAGE_DISPLAY: Record<string, string> = {
  smartplace_register: "스마트플레이스 등록 대행",
  ai_optimization: "AI 검색 최적화",
  comprehensive: "종합 풀패키지",
};

async function fetchOrders(token: string): Promise<DeliveryOrder[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/delivery/orders/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.orders ?? data ?? [];
  } catch {
    return [];
  }
}

export default async function DeliveryOrdersPage() {
  const supabase = await createClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) user = data.user;
  } catch {}
  if (!user) redirect("/login");

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";

  const orders = await fetchOrders(token);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric", month: "short", day: "numeric",
    });

  return (
    <div className="p-4 md:p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 md:mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <a href="/delivery" className="hover:text-blue-600 transition-colors">대행 서비스</a>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-700">내 의뢰 목록</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">내 의뢰 목록</h1>
        </div>
        <Link
          href="/delivery/new"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          새 의뢰
        </Link>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-base font-medium text-gray-700 mb-2">
              아직 신청한 의뢰가 없습니다.
            </p>
            <p className="text-sm text-gray-500 mb-5">
              대행 서비스를 신청하면 전문가가 직접 실행해 드립니다.
            </p>
            <Link
              href="/delivery"
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              서비스 보기
            </Link>
          </div>
        ) : (
          <>
            {/* PC 테이블 헤더 */}
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500">
              <span>상태</span>
              <span>제목</span>
              <span>패키지</span>
              <span className="text-right">금액</span>
              <span className="text-right">신청일</span>
            </div>

            <ul className="divide-y divide-gray-50">
              {orders.map((order) => {
                const statusMeta = STATUS_META[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <li key={order.id}>
                    <Link
                      href={`/delivery/orders/${order.id}`}
                      className="flex flex-col md:grid md:grid-cols-[auto_1fr_auto_auto_auto] md:items-center gap-2 md:gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                    >
                      {/* 모바일: 상태 + 날짜 행 */}
                      <div className="flex items-center justify-between md:contents">
                        <span className={`shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full ${statusMeta.color}`}>
                          {statusMeta.label}
                        </span>
                        <span className="text-sm text-gray-400 md:hidden">{formatDate(order.created_at)}</span>
                      </div>

                      {/* 제목 */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                          {order.request_title}
                        </p>
                        {order.business_name && (
                          <p className="text-sm text-gray-400 mt-0.5">{order.business_name}</p>
                        )}
                      </div>

                      {/* 패키지명 */}
                      <span className="text-sm text-gray-500 md:text-right">
                        {PACKAGE_DISPLAY[order.package_type] ?? order.package_type}
                      </span>

                      {/* 금액 */}
                      <span className="text-sm font-semibold text-gray-800 md:text-right">
                        {order.amount?.toLocaleString()}원
                      </span>

                      {/* 날짜 (PC) */}
                      <span className="hidden md:block text-sm text-gray-400 text-right whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
