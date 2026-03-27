import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SettingsClient } from "./SettingsClient";
import { BusinessManager } from "./BusinessManager";

const PLAN_NAMES: Record<string, string> = {
  free: "무료 플랜",
  basic: "Basic (월 9,900원)",
  pro: "Pro (월 29,900원)",
  biz: "Biz (월 79,900원)",
  startup: "창업 패키지 (3개월 39,900원)",
  enterprise: "Enterprise",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:       { label: "활성",     color: "text-green-600 bg-green-50" },
  grace_period: { label: "유예기간", color: "text-yellow-600 bg-yellow-50" },
  suspended:    { label: "정지",     color: "text-red-600 bg-red-50" },
  cancelled:    { label: "해지됨",   color: "text-gray-500 bg-gray-100" },
  expired:      { label: "만료",     color: "text-gray-500 bg-gray-100" },
  inactive:     { label: "미구독",   color: "text-gray-400 bg-gray-50" },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const user = session.user;

  const [{ data: sub }, { data: businesses }, { data: profile }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("id, name, category, region, address, phone, website_url, keywords, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("phone")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const currentPlan = sub?.plan ?? "free";
  const currentStatus = sub?.status ?? "inactive";
  const statusInfo = STATUS_LABELS[currentStatus] ?? STATUS_LABELS["inactive"];

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">설정 · 구독 관리</h1>

      {/* 계정 정보 */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">계정</h2>
        <p className="text-sm text-gray-600">{user.email}</p>
        <p className="text-xs text-gray-400 mt-1">
          가입일: {formatDate(user.created_at)}
        </p>
      </section>

      {/* 구독 정보 */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">구독 현황</h2>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-gray-900">{PLAN_NAMES[currentPlan]}</div>
            <div className="text-sm text-gray-500 mt-0.5">
              {sub?.start_at ? `시작: ${formatDate(sub.start_at)}` : ""}
              {sub?.end_at ? ` · 만료: ${formatDate(sub.end_at)}` : ""}
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>

        {currentPlan === "free" || currentStatus === "inactive" ? (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm text-gray-500">
              유료 플랜으로 업그레이드하면 100회 샘플링, 경쟁사 분석, 개선 가이드를 이용할 수 있습니다.
            </p>
            <a
              href="/pricing"
              className="inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              요금제 보기
            </a>
          </div>
        ) : (
          <SettingsClient userId={user.id} currentPhone={profile?.phone ?? ""} />
        )}
      </section>

      {/* 등록된 사업장 */}
      {businesses && businesses.length > 0 && (
        <section className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">등록된 사업장</h2>
          <BusinessManager businesses={businesses} userId={user.id} />
        </section>
      )}

      {/* 고급 설정 링크 (Biz+) */}
      {["biz", "enterprise"].includes(currentPlan) && currentStatus === "active" && (
        <section className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">고급 설정</h2>
          <div className="space-y-2">
            <Link
              href="/settings/team"
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>팀 계정 관리</span>
                <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Biz</span>
              </div>
              <span className="text-gray-400 text-xs">→</span>
            </Link>
            <Link
              href="/settings/api-keys"
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Public API 키 관리</span>
                <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Biz</span>
              </div>
              <span className="text-gray-400 text-xs">→</span>
            </Link>
          </div>
        </section>
      )}

      {/* 플랜별 한도 안내 */}
      <section className="bg-gray-50 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">플랜별 혜택 비교</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-600">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-2 font-medium">기능</th>
                {(["free", "basic", "pro", "biz"] as const).map((plan) => (
                  <th
                    key={plan}
                    className={`pb-2 font-medium text-center ${currentPlan === plan ? "text-blue-600" : ""}`}
                  >
                    {plan === "free" ? "무료" : plan === "basic" ? "Basic" : plan === "pro" ? "Pro" : "Biz"}
                    {currentPlan === plan && <span className="block text-blue-400 font-normal">(현재)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                ["AI 스캔 (직접 실행)", "3회/월", "10회/월", "무제한", "무제한"],
                ["자동 스캔 (매일 자동)", "—", "월 1회", "주 1회", "매일"],
                ["경쟁 점포 비교", "—", "5개", "10개", "20개"],
                ["AI 개선 가이드", "—", "✓", "✓", "✓"],
                ["카카오 알림톡", "—", "✓", "✓", "✓"],
                ["변화 기록 저장", "—", "✓", "✓", "✓"],
                ["PDF 리포트", "—", "—", "✓", "✓"],
                ["엑셀 내보내기", "—", "—", "✓", "✓"],
                ["팀 계정", "—", "—", "—", "5명"],
              ] as [string, string, string, string, string][]).map(([feature, free, basic, pro, biz]) => (
                <tr key={feature} className="border-b border-gray-100">
                  <td className="py-2 text-gray-700">{feature}</td>
                  {([free, basic, pro, biz] as const).map((val, i) => {
                    const plan = ["free", "basic", "pro", "biz"][i]
                    const isCurrentPlan = currentPlan === plan
                    const isPositive = val !== "—"
                    return (
                      <td
                        key={i}
                        className={`py-2 text-center ${isCurrentPlan ? "bg-blue-50 font-medium" : ""} ${isPositive ? "text-gray-800" : "text-gray-300"}`}
                      >
                        {val === "✓" ? <span className="text-green-600 font-bold">✓</span> : val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
