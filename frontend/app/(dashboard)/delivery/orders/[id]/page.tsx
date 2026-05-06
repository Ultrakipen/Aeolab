import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import DeliveryOrderClient from "./DeliveryOrderClient";

export const metadata = { title: "의뢰 상세 | AEOlab" };

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface CompletionReport {
  items?: string[];
  screenshot_urls?: string[];
  summary?: string;
}

interface OrderDetail {
  id: string;
  package_type: string;
  request_title: string;
  request_body: string;
  status: string;
  created_at: string;
  updated_at?: string;
  amount: number;
  business_name?: string;
  consent_agreed: boolean;
  completion_report?: CompletionReport | null;
}

interface Message {
  id: string;
  order_id: string;
  sender_type: "user" | "admin";
  body: string;
  created_at: string;
}

const PACKAGE_DISPLAY: Record<string, string> = {
  smartplace_register: "스마트플레이스 등록 대행",
  ai_optimization: "AI 검색 최적화",
  comprehensive: "종합 풀패키지",
};

const STATUS_STEPS = ["received", "in_progress", "completed"];
const STATUS_LABELS: Record<string, string> = {
  received: "접수",
  in_progress: "진행중",
  completed: "완료",
  rework: "재작업",
  refunded: "환불",
  cancelled: "취소",
};
const STATUS_META: Record<string, { label: string; color: string }> = {
  received: { label: "접수", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "진행중", color: "bg-orange-100 text-orange-700" },
  completed: { label: "완료", color: "bg-green-100 text-green-700" },
  rework: { label: "재작업", color: "bg-purple-100 text-purple-700" },
  refunded: { label: "환불", color: "bg-gray-100 text-gray-600" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-700" },
};

async function fetchOrder(id: string, token: string): Promise<OrderDetail | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/delivery/orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.order ?? data;
  } catch {
    return null;
  }
}

async function fetchMessages(id: string, token: string): Promise<Message[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/delivery/orders/${id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages ?? data ?? [];
  } catch {
    return [];
  }
}

export default async function DeliveryOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  const { payment } = await searchParams;

  const supabase = await createClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) user = data.user;
  } catch {}
  if (!user) redirect("/login");

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";

  const [order, messages] = await Promise.all([
    fetchOrder(id, token),
    fetchMessages(id, token),
  ]);

  if (!order) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-medium text-red-800">의뢰를 찾을 수 없습니다.</p>
            <p className="text-sm text-red-600 mt-1">
              존재하지 않거나 접근 권한이 없는 의뢰입니다.
            </p>
            <a href="/delivery/orders" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              목록으로 돌아가기
            </a>
          </div>
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
  const currentStepIndex = STATUS_STEPS.indexOf(order.status);

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="p-4 md:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/delivery" className="hover:text-blue-600 transition-colors">대행 서비스</a>
        <ChevronRight className="w-4 h-4" />
        <a href="/delivery/orders" className="hover:text-blue-600 transition-colors">내 의뢰 목록</a>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 truncate max-w-[120px] md:max-w-none">{order.request_title}</span>
      </div>

      {/* 결제 실패 배너 */}
      {payment === "fail" && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">결제가 완료되지 않았습니다.</p>
            <p className="text-sm text-amber-700 mt-0.5">
              의뢰는 생성되었습니다. 운영자가 확인 후 연락드립니다.
            </p>
          </div>
        </div>
      )}

      {/* PC 2열 / 모바일 1열 */}
      <div className="flex flex-col md:flex-row gap-5 md:gap-6">

        {/* 좌측: 의뢰 내용 + 메시지 스레드 */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* 의뢰 내용 카드 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-lg md:text-xl font-bold text-gray-900">{order.request_title}</h1>
                <p className="text-sm text-gray-500 mt-1">{formatDate(order.created_at)}</p>
              </div>
              <span className={`shrink-0 text-sm font-semibold px-3 py-1.5 rounded-full ${statusMeta.color}`}>
                {statusMeta.label}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{order.request_body}</p>
            </div>
          </div>

          {/* 완료 보고서 */}
          {order.status === "completed" && order.completion_report && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h2 className="text-base font-semibold text-green-800">완료 보고서</h2>
              </div>
              {order.completion_report.summary && (
                <p className="text-sm text-green-700 mb-4">{order.completion_report.summary}</p>
              )}
              {(order.completion_report.items ?? []).length > 0 && (
                <ul className="space-y-2 mb-4">
                  {order.completion_report.items!.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-green-700">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {(order.completion_report.screenshot_urls ?? []).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {order.completion_report.screenshot_urls!.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl overflow-hidden border border-green-200 hover:opacity-90 transition-opacity"
                    >
                      <img src={url} alt={`완료 스크린샷 ${i + 1}`} className="w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 메시지 스레드 */}
          <DeliveryOrderClient
            orderId={order.id}
            initialMessages={messages}
            isDisabled={order.status === "completed" || order.status === "cancelled" || order.status === "refunded"}
            token={token}
          />
        </div>

        {/* 우측: 진행 상태 + 패키지 정보 */}
        <div className="w-full md:w-72 shrink-0 space-y-4">

          {/* 진행 상태 스텝 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">진행 상태</h2>

            {/* 정상 스텝 플로우 (received/in_progress/completed) */}
            {STATUS_STEPS.includes(order.status) ? (
              <div className="space-y-0">
                {STATUS_STEPS.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  const isDone = idx < currentStepIndex;
                  return (
                    <div key={step} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={[
                          "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border-2",
                          isActive
                            ? "bg-blue-600 border-blue-600 text-white"
                            : isDone
                            ? "bg-green-500 border-green-500 text-white"
                            : "bg-white border-gray-200 text-gray-400",
                        ].join(" ")}>
                          {isDone ? "✓" : idx + 1}
                        </div>
                        {idx < STATUS_STEPS.length - 1 && (
                          <div className={`w-0.5 h-8 mt-1 ${isDone ? "bg-green-300" : "bg-gray-200"}`} />
                        )}
                      </div>
                      <div className="pt-1 pb-8 last:pb-0">
                        <p className={`text-sm font-semibold ${isActive ? "text-blue-700" : isDone ? "text-green-700" : "text-gray-400"}`}>
                          {STATUS_LABELS[step]}
                        </p>
                        {isActive && (
                          <p className="text-sm text-gray-500 mt-0.5">현재 단계</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${statusMeta.color}`}>
                {statusMeta.label}
              </div>
            )}
          </div>

          {/* 패키지 정보 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">패키지 정보</h2>
            <dl className="space-y-2.5">
              <div className="flex justify-between gap-2">
                <dt className="text-sm text-gray-500">패키지</dt>
                <dd className="text-sm font-medium text-gray-800 text-right">
                  {PACKAGE_DISPLAY[order.package_type] ?? order.package_type}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-sm text-gray-500">결제 금액</dt>
                <dd className="text-sm font-bold text-blue-600">
                  {order.amount?.toLocaleString()}원
                </dd>
              </div>
              {order.business_name && (
                <div className="flex justify-between gap-2">
                  <dt className="text-sm text-gray-500">사업장</dt>
                  <dd className="text-sm font-medium text-gray-800 text-right truncate max-w-[140px]">
                    {order.business_name}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-sm text-gray-500">신청일</dt>
                <dd className="text-sm text-gray-600">
                  {new Date(order.created_at).toLocaleDateString("ko-KR")}
                </dd>
              </div>
            </dl>
          </div>

          {/* 위임 동의 현황 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">위임 동의 현황</h2>
            <div className={`flex items-center gap-2 text-sm ${order.consent_agreed ? "text-green-700" : "text-red-600"}`}>
              <div className={`w-2 h-2 rounded-full ${order.consent_agreed ? "bg-green-500" : "bg-red-400"}`} />
              {order.consent_agreed ? "부운영자 위임 동의 완료" : "동의 미완료"}
            </div>
            {order.consent_agreed && (
              <p className="text-sm text-gray-500 mt-2">
                작업 시작 전 부운영자 등록 방법을 안내드립니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
