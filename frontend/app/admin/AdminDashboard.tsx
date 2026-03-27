"use client";

import { useState, useEffect, useCallback } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

interface Stats {
  total_subscribers: number;
  active_subscribers: number;
  mrr: number;
  bep_progress: number;
  plan_distribution: Record<string, number>;
  scan_count_today: number;
  scan_count_month: number;
  waitlist_count: number;
}

interface RevenueRow {
  month: string;
  revenue: number;
  subscriber_count: number;
}

interface SubRow {
  user_id: string;
  email?: string;
  plan: string;
  status: string;
  start_at: string;
  end_at: string;
}

const PLAN_PRICES: Record<string, number> = {
  basic: 9900, pro: 29900, biz: 79900, startup: 39900, enterprise: 200000,
};

export function AdminDashboard() {
  const [adminKey, setAdminKey] = useState(ADMIN_KEY);
  const [authed, setAuthed] = useState(!!ADMIN_KEY);
  const [stats, setStats] = useState<Stats | null>(null);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const headers = { "X-Admin-Key": key };
      const [statsRes, revenueRes, subsRes] = await Promise.all([
        fetch(`${BACKEND}/admin/stats`, { headers }),
        fetch(`${BACKEND}/admin/revenue`, { headers }),
        fetch(`${BACKEND}/admin/subscriptions`, { headers }),
      ]);
      if (!statsRes.ok) {
        if (statsRes.status === 403) {
          setError("관리자 키가 올바르지 않습니다.");
          setAuthed(false);
          return;
        }
        throw new Error("API 오류");
      }
      setStats(await statsRes.json());
      setRevenue(await revenueRes.json());
      setSubs(await subsRes.json());
      setAuthed(true);
    } catch (e) {
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed && adminKey) fetchAll(adminKey);
  }, [authed, adminKey, fetchAll]);

  if (!authed) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <h1 className="text-xl font-bold text-gray-900 mb-6">관리자 접근</h1>
          <input
            type="password"
            placeholder="관리자 키 입력"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && fetchAll(adminKey)}
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={() => fetchAll(adminKey)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            확인
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const BEP_TARGET = 20;
  const bepPct = stats ? Math.min(100, Math.round((stats.active_subscribers / BEP_TARGET) * 100)) : 0;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AEOlab 관리자</h1>
            <p className="text-sm text-gray-400">실시간 구독자·매출·스캔 현황</p>
          </div>
          <button
            onClick={() => fetchAll(adminKey)}
            className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            새로고침
          </button>
        </div>

        {/* 핵심 지표 */}
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "활성 구독자",   value: `${stats.active_subscribers}명`, sub: `전체 ${stats.total_subscribers}명` },
                { label: "월 매출 (MRR)", value: `${stats.mrr.toLocaleString()}원`, sub: "이번 달 예상" },
                { label: "BEP 달성도",   value: `${bepPct}%`, sub: `목표 ${BEP_TARGET}명` },
                { label: "이번 달 스캔", value: `${stats.scan_count_month}회`, sub: `오늘 ${stats.scan_count_today}회` },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                  <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
                </div>
              ))}
            </div>

            {/* BEP 진행 바 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">BEP 달성 진행률</span>
                <span className="text-sm text-gray-500">
                  {stats.active_subscribers} / {BEP_TARGET}명 ({bepPct}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full">
                <div
                  className={`h-3 rounded-full transition-all ${bepPct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${bepPct}%` }}
                />
              </div>
              {bepPct >= 100 && (
                <p className="text-xs text-green-600 mt-2 font-medium">BEP 달성! 월 비용 ~8만원 커버됩니다.</p>
              )}
            </div>

            {/* 플랜별 분포 */}
            {stats.plan_distribution && Object.keys(stats.plan_distribution).length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">플랜별 구독자 분포</h2>
                <div className="space-y-2">
                  {Object.entries(stats.plan_distribution).map(([plan, count]) => {
                    const revenue = (PLAN_PRICES[plan] ?? 0) * (count as number);
                    return (
                      <div key={plan} className="flex items-center gap-3">
                        <div className="w-16 text-xs text-gray-600 capitalize">{plan}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${Math.min(100, ((count as number) / Math.max(stats.active_subscribers, 1)) * 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 w-8 text-right">{count as number}명</div>
                        <div className="text-xs text-gray-400 w-20 text-right">{revenue.toLocaleString()}원</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* 월별 매출 */}
        {revenue.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">월별 매출 추이</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-2">월</th>
                    <th className="pb-2 text-right">매출</th>
                    <th className="pb-2 text-right">구독자</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.slice(0, 12).map((row) => (
                    <tr key={row.month} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">{row.month}</td>
                      <td className="py-2 text-right font-medium">{row.revenue.toLocaleString()}원</td>
                      <td className="py-2 text-right text-gray-500">{row.subscriber_count}명</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 구독자 목록 */}
        {subs.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              구독자 목록 ({subs.length}명)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-2">이메일</th>
                    <th className="pb-2">플랜</th>
                    <th className="pb-2">상태</th>
                    <th className="pb-2">만료일</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub) => (
                    <tr key={sub.user_id} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700 text-xs">{sub.email ?? sub.user_id.slice(0, 8) + "..."}</td>
                      <td className="py-2">
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full capitalize">
                          {sub.plan}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          sub.status === "active" ? "bg-green-50 text-green-700" :
                          sub.status === "grace_period" ? "bg-yellow-50 text-yellow-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-gray-400">
                        {sub.end_at ? new Date(sub.end_at).toLocaleDateString("ko-KR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
