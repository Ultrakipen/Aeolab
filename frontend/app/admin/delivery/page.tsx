import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "대행 의뢰 관리 | AEOlab Admin" };

const ADMIN_EMAILS = ["hoozdev@gmail.com"];

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

const STATUS_FILTERS = [
  { value: "", label: "전체" },
  { value: "received", label: "접수" },
  { value: "in_progress", label: "진행중" },
  { value: "completed", label: "완료" },
  { value: "cancelled", label: "취소" },
];

interface DeliveryOrder {
  id: string;
  status: string;
  package_type: string;
  request_title: string;
  amount: number;
  created_at: string;
  business_id: string;
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminDeliveryPage({ searchParams }: PageProps) {
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

  let query = supabase
    .from("delivery_orders")
    .select("id, status, package_type, request_title, amount, created_at, business_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: orders, error } = await query;

  const rows: DeliveryOrder[] = orders ?? [];

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      month: "2-digit", day: "2-digit",
    });

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">대행 의뢰 관리</h1>
        <p className="text-sm text-gray-500 mt-1">전체 대행 의뢰 목록 및 상태 관리</p>
      </div>

      {/* 상태 필터 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/delivery?status=${f.value}` : "/admin/delivery"}
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          데이터를 불러오는 중 오류가 발생했습니다.
        </div>
      )}

      {/* PC 테이블 */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-base text-gray-500">
            {statusFilter ? `[${STATUS_META[statusFilter]?.label ?? statusFilter}] 상태의 의뢰가 없습니다.` : "의뢰가 없습니다."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500">상태</th>
                  <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500">패키지</th>
                  <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500">제목</th>
                  <th className="text-right px-5 py-3 text-sm font-semibold text-gray-500">금액</th>
                  <th className="text-right px-5 py-3 text-sm font-semibold text-gray-500">신청일</th>
                  <th className="text-center px-5 py-3 text-sm font-semibold text-gray-500">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((order) => {
                  const sm = STATUS_META[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className={`inline-block text-sm font-semibold px-2.5 py-1 rounded-full ${sm.color}`}>
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {PACKAGE_DISPLAY[order.package_type] ?? order.package_type}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {order.request_title}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {order.amount?.toLocaleString()}원
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-400">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Link
                          href={`/admin/delivery/${order.id}`}
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
        {rows.length === 0 ? (
          <div className="py-12 text-center text-base text-gray-500 bg-white rounded-2xl border border-gray-100">
            의뢰가 없습니다.
          </div>
        ) : (
          rows.map((order) => {
            const sm = STATUS_META[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
            return (
              <Link
                key={order.id}
                href={`/admin/delivery/${order.id}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className={`shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full ${sm.color}`}>
                    {sm.label}
                  </span>
                  <span className="text-sm text-gray-400">{formatDate(order.created_at)}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1 truncate">
                  {order.request_title}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {PACKAGE_DISPLAY[order.package_type] ?? order.package_type}
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    {order.amount?.toLocaleString()}원
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
