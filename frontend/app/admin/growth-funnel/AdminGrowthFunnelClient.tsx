"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

// 관리자 API는 서버 사이드 프록시를 통해 호출 (ADMIN_SECRET_KEY 클라이언트 비노출)
const ADMIN_PROXY = "/api/admin-proxy";

interface SignupWeekly {
  week: string;
  trial_scans: number;
  signups: number;
  businesses_registered: number;
  paid_conversions: number;
}

interface DeliveryWeekly {
  week: string;
  orders_created: number;
  paid: number;
}

interface GrowthFunnelData {
  weekly: SignupWeekly[];
  totals: {
    trial_scans: number;
    signups: number;
    businesses_registered: number;
    paid_conversions: number;
  };
  signup_to_paid_rate_pct: number;
  data_caveat: string;
  delivery_funnel: {
    weekly: DeliveryWeekly[];
    totals: {
      orders_created: number;
      paid: number;
      in_progress_or_later: number;
      completed: number;
      refunded: number;
      testimonials: number;
    };
    created_to_paid_rate_pct: number;
    paid_to_completed_rate_pct: number;
    data_caveat: string;
  };
}

const TABS = [
  { key: "signup", label: "가입 퍼널 (체험→가입→전환)" },
  { key: "delivery", label: "대행서비스 퍼널 (신청→결제→완료)" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-3 border border-gray-100">
      <div className="text-sm text-gray-600 mb-0.5">{label}</div>
      <div className="text-xl font-bold text-gray-800">{value}</div>
    </div>
  );
}

export default function AdminGrowthFunnelClient() {
  const [data, setData] = useState<GrowthFunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("signup");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ADMIN_PROXY}?path=admin/growth-funnel&weeks=12`);
        if (!res.ok) throw new Error("불러오기 실패");
        setData(await res.json());
      } catch {
        setError("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">성장 퍼널</h1>
        <p className="text-sm text-gray-600 mt-1">최근 12주 기준 단계별 발생 건수 스냅샷</p>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "text-sm font-semibold px-4 py-2 rounded-full transition-colors",
              tab === t.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && data && tab === "signup" && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-600 mb-4">{data.data_caveat}</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <StatCard label="무료체험" value={data.totals.trial_scans} />
            <StatCard label="가입" value={data.totals.signups} />
            <StatCard label="사업장 등록" value={data.totals.businesses_registered} />
            <StatCard label="유료 전환" value={data.totals.paid_conversions} />
            <StatCard label="가입→전환율" value={`${data.signup_to_paid_rate_pct}%`} />
          </div>
          {data.weekly.length > 0 ? (
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-sm text-gray-600 border-b border-gray-100">
                    <th className="pb-2 pr-3">주(월요일 시작)</th>
                    <th className="pb-2 pr-3">무료체험</th>
                    <th className="pb-2 pr-3">가입</th>
                    <th className="pb-2 pr-3">사업장 등록</th>
                    <th className="pb-2">유료 전환</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weekly.map((w) => (
                    <tr key={w.week} className="border-b border-gray-50">
                      <td className="py-2 pr-3 text-gray-700">{w.week}</td>
                      <td className="py-2 pr-3 text-gray-600">{w.trial_scans}</td>
                      <td className="py-2 pr-3 text-gray-600">{w.signups}</td>
                      <td className="py-2 pr-3 text-gray-600">{w.businesses_registered}</td>
                      <td className="py-2 font-semibold text-gray-800">{w.paid_conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-600 py-8 text-center">최근 12주 내 데이터가 없습니다.</p>
          )}
        </div>
      )}

      {!loading && !error && data && tab === "delivery" && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-600 mb-4">{data.delivery_funnel.data_caveat}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <StatCard label="신청" value={data.delivery_funnel.totals.orders_created} />
            <StatCard label="결제완료" value={data.delivery_funnel.totals.paid} />
            <StatCard label="진행중 이상" value={data.delivery_funnel.totals.in_progress_or_later} />
            <StatCard label="완료" value={data.delivery_funnel.totals.completed} />
            <StatCard label="후기 작성" value={data.delivery_funnel.totals.testimonials} />
            <StatCard label="환불" value={data.delivery_funnel.totals.refunded} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard label="신청→결제 전환율" value={`${data.delivery_funnel.created_to_paid_rate_pct}%`} />
            <StatCard label="결제→완료 전환율" value={`${data.delivery_funnel.paid_to_completed_rate_pct}%`} />
          </div>
          {data.delivery_funnel.weekly.length > 0 ? (
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="text-left text-sm text-gray-600 border-b border-gray-100">
                    <th className="pb-2 pr-3">주(월요일 시작)</th>
                    <th className="pb-2 pr-3">신청</th>
                    <th className="pb-2">결제완료</th>
                  </tr>
                </thead>
                <tbody>
                  {data.delivery_funnel.weekly.map((w) => (
                    <tr key={w.week} className="border-b border-gray-50">
                      <td className="py-2 pr-3 text-gray-700">{w.week}</td>
                      <td className="py-2 pr-3 text-gray-600">{w.orders_created}</td>
                      <td className="py-2 font-semibold text-gray-800">{w.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-600 py-8 text-center">최근 12주 내 주문이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
