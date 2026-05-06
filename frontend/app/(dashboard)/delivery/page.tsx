import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

export const metadata = { title: "대행 서비스 | AEOlab" };

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface DeliveryPackage {
  id: string;
  type: string;
  name: string;
  price: number;
  description: string;
  work_hours: string;
  features: string[];
}

interface DeliveryOrder {
  id: string;
  package_type: string;
  request_title: string;
  status: string;
  created_at: string;
  amount: number;
  business_name?: string;
}

const PACKAGE_META: Record<string, { badge?: string; highlight?: boolean }> = {
  smartplace_register: { badge: "" },
  ai_optimization: { badge: "인기" },
  comprehensive: { badge: "추천", highlight: true },
};

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

async function fetchPackages(token: string): Promise<DeliveryPackage[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/delivery/packages`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pkgs: DeliveryPackage[] = (data.packages ?? data ?? []);
    // 백엔드가 amount 필드로 반환 → price로 정규화
    return pkgs.map((p: DeliveryPackage & { amount?: number }) => ({
      ...p,
      price: p.price ?? p.amount ?? 0,
    }));
  } catch {
    return [];
  }
}

async function fetchMyOrders(token: string): Promise<DeliveryOrder[]> {
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

// 패키지 API가 비어있을 때 사용할 폴백 데이터
const FALLBACK_PACKAGES: DeliveryPackage[] = [
  {
    id: "smartplace_register",
    type: "smartplace_register",
    name: "01 스마트플레이스 등록 대행",
    price: 49000,
    description: "스마트플레이스 신규 등록부터 기본정보, 메뉴, 키워드 최적화까지",
    work_hours: "5.2h 작업",
    features: [
      "스마트플레이스 신규 등록",
      "기본정보·메뉴·키워드 최적화",
      "대표 사진 구성 안내",
    ],
  },
  {
    id: "ai_optimization",
    type: "ai_optimization",
    name: "02 AI 검색 최적화",
    price: 79000,
    description: "AI 검색 최적화, 소개글·톡톡메뉴·후기답글·키워드 보강",
    work_hours: "6.0h 작업",
    features: [
      "소개글·톡톡채팅방 메뉴 최적화",
      "후기 답글 10건 작성",
      "핵심 키워드 보강",
    ],
  },
  {
    id: "comprehensive",
    type: "comprehensive",
    name: "03 종합 풀패키지",
    price: 119000,
    description: "등록+최적화+코칭+30일 재진단 — 개별 합산 158,000원 → 119,000원",
    work_hours: "11.2h 작업",
    features: [
      "01 등록 대행 전체 포함",
      "02 AI 최적화 전체 포함",
      "1:1 코칭 세션 + 30일 재진단",
    ],
  },
];

export default async function DeliveryPage() {
  const supabase = await createClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) user = data.user;
  } catch {}
  if (!user) redirect("/login");

  // 세션 토큰 획득
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";

  const [packages, orders] = await Promise.all([
    fetchPackages(token),
    fetchMyOrders(token),
  ]);

  const displayPackages = packages.length > 0 ? packages : FALLBACK_PACKAGES;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric", month: "short", day: "numeric",
    });

  return (
    <div className="p-4 md:p-8">
      {/* 헤더 */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">대행 서비스 신청</h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">
          진단 결과를 직접 실행할 시간이 없으신가요? 전문가가 대신 실행해 드립니다.
        </p>
      </div>

      {/* 패키지 카드 — PC 3열 / 모바일 1열 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
        {displayPackages.map((pkg) => {
          const meta = PACKAGE_META[pkg.type] ?? {};
          return (
            <div
              key={pkg.id}
              className={[
                "relative bg-white rounded-2xl border shadow-sm flex flex-col",
                meta.highlight
                  ? "border-blue-300 shadow-blue-100"
                  : "border-gray-100",
              ].join(" ")}
            >
              {meta.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${meta.highlight ? "bg-blue-600 text-white" : "bg-gray-800 text-white"}`}>
                    {meta.badge}
                  </span>
                </div>
              )}

              <div className="p-5 md:p-6 flex flex-col flex-1">
                <div className="mb-4">
                  <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">{pkg.name}</h2>
                  <p className="text-sm text-gray-500">{pkg.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-sm text-gray-400">{pkg.work_hours}</span>
                  </div>
                </div>

                {/* 기능 목록 */}
                <ul className="space-y-2 mb-5 flex-1">
                  {(pkg.features ?? []).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* 가격 + 버튼 */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl md:text-3xl font-bold text-gray-900">
                      {pkg.price.toLocaleString()}
                    </span>
                    <span className="text-base text-gray-500">원</span>
                    {pkg.type === "comprehensive" && (
                      <span className="ml-1 text-sm text-gray-400 line-through">158,000원</span>
                    )}
                  </div>
                  <Link
                    href={`/delivery/new?package=${pkg.type}`}
                    className={[
                      "block w-full text-center py-3 rounded-xl text-base font-semibold transition-colors",
                      meta.highlight
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-900 text-white hover:bg-gray-800",
                    ].join(" ")}
                  >
                    신청하기
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 안내 배너 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">부운영자 권한 위임 안내</p>
          <p className="text-sm text-amber-700 mt-0.5">
            결제 완료 후 네이버 스마트플레이스 부운영자 권한 등록 방법을 안내해 드립니다.
            작업 기간 동안만 임시 부여하며, 완료 후 해제됩니다.
          </p>
        </div>
      </div>

      {/* 내 의뢰 현황 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base md:text-lg font-semibold text-gray-800">내 의뢰 현황</h2>
          {orders.length > 0 && (
            <Link href="/delivery/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              전체 보기
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-base text-gray-500 mb-2">아직 신청 내역이 없습니다.</p>
            <p className="text-sm text-gray-400">위에서 패키지를 선택해 첫 대행을 신청해 보세요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {orders.slice(0, 5).map((order) => {
              const statusMeta = STATUS_META[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
              return (
                <li key={order.id}>
                  <Link
                    href={`/delivery/orders/${order.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <span className={`shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full ${statusMeta.color}`}>
                      {statusMeta.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{order.request_title}</p>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {PACKAGE_DISPLAY[order.package_type] ?? order.package_type} · {order.amount?.toLocaleString()}원
                      </p>
                    </div>
                    <span className="text-sm text-gray-400 shrink-0">{formatDate(order.created_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
