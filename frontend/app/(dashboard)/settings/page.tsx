import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Crown, Zap, Users, Key, ChevronRight, Calendar, Clock } from "lucide-react";
import { SettingsClient } from "./SettingsClient";
import { BusinessManager } from "./BusinessManager";
import { AccountClient } from "./AccountClient";

const PLAN_META: Record<string, { name: string; color: string; gradient: string; badge: string }> = {
  free:       { name: "무료 플랜",      color: "text-gray-600",    gradient: "from-gray-400 to-slate-500",    badge: "bg-gray-100 text-gray-600" },
  basic:      { name: "Basic",          color: "text-blue-600",    gradient: "from-blue-500 to-indigo-600",   badge: "bg-blue-100 text-blue-700" },
  startup:    { name: "창업 패키지",    color: "text-amber-600",   gradient: "from-amber-400 to-orange-500",  badge: "bg-amber-100 text-amber-700" },
  pro:        { name: "Pro",            color: "text-violet-600",  gradient: "from-violet-500 to-purple-600", badge: "bg-violet-100 text-violet-700" },
  biz:        { name: "Biz",            color: "text-emerald-600", gradient: "from-emerald-500 to-teal-600",  badge: "bg-emerald-100 text-emerald-700" },
  enterprise: { name: "Enterprise",    color: "text-rose-600",    gradient: "from-rose-500 to-pink-600",     badge: "bg-rose-100 text-rose-700" },
};

const PLAN_PRICE: Record<string, string> = {
  free: "무료", basic: "월 9,900원", startup: "월 16,900원",
  pro: "월 22,900원", biz: "월 49,900원", enterprise: "월 200,000원",
};

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  active:       { label: "구독 중",  color: "text-emerald-700 bg-emerald-50 border border-emerald-200", dot: "bg-emerald-500" },
  grace_period: { label: "유예기간", color: "text-amber-700 bg-amber-50 border border-amber-200",       dot: "bg-amber-500" },
  suspended:    { label: "정지됨",   color: "text-red-700 bg-red-50 border border-red-200",              dot: "bg-red-500" },
  cancelled:    { label: "해지됨",   color: "text-gray-600 bg-gray-100 border border-gray-200",          dot: "bg-gray-400" },
  expired:      { label: "만료됨",   color: "text-gray-600 bg-gray-100 border border-gray-200",          dot: "bg-gray-400" },
  inactive:     { label: "미구독",   color: "text-gray-500 bg-gray-50 border border-gray-200",           dot: "bg-gray-300" },
};

const PLAN_LIMITS: Record<string, { scan: string; competitors: string; autoScan: string }> = {
  free:       { scan: "—",          competitors: "—",      autoScan: "—" },
  basic:      { scan: "하루 2회",   competitors: "3개",    autoScan: "주 1회" },
  startup:    { scan: "하루 3회",   competitors: "5개",    autoScan: "주 1회" },
  pro:        { scan: "하루 5회",   competitors: "10개",   autoScan: "주 3회" },
  biz:        { scan: "무제한",     competitors: "무제한", autoScan: "매일" },
  enterprise: { scan: "무제한",     competitors: "무제한", autoScan: "매일" },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const autoEditBiz = params.tab === "business";

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");

  const [{ data: sub }, { data: businesses }, { data: profile }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, status, start_at, end_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("id, name, category, region, address, phone, website_url, blog_url, keywords, receipt_review_count, visitor_review_count, avg_rating, naver_place_id, naver_place_url, google_place_id, kakao_place_id, is_smart_place, has_faq, has_recent_post, has_intro, review_sample, kakao_score, kakao_checklist, kakao_registered, business_type, business_registration_no, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("phone, kakao_scan_notify, kakao_competitor_notify")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const currentPlan = sub?.plan ?? "free";
  const currentStatus = sub?.status ?? "inactive";
  const isActive = currentStatus === "active" || currentStatus === "grace_period";
  const planMeta = PLAN_META[currentPlan] ?? PLAN_META.free;
  const statusMeta = STATUS_META[currentStatus] ?? STATUS_META.inactive;
  const planLimits = PLAN_LIMITS[currentPlan] ?? PLAN_LIMITS.free;

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  const daysUntilEnd = sub?.end_at
    ? Math.ceil((new Date(sub.end_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="p-4 md:p-8">
      {/* 페이지 헤더 */}
      <div className="mb-5 md:mb-6 max-w-2xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">설정 · 구독 관리</h1>
        <p className="text-sm text-gray-500 mt-1">{user.email}</p>
      </div>

      {/* ── 단일 컬럼 레이아웃 ── */}
      <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">

          {/* ── 구독 현황 카드 ── */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 그라데이션 배너 */}
            <div className={`bg-gradient-to-r ${planMeta.gradient} px-5 py-4 md:py-5`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Crown className="w-5 h-5 text-white" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg leading-tight">{planMeta.name}</div>
                    <div className="text-white/80 text-sm">{PLAN_PRICE[currentPlan]}</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white border border-white/30">
                  <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
                  {statusMeta.label}
                </span>
              </div>
            </div>

            {/* 구독 상세 */}
            <div className="p-4 md:p-5">
              {isActive && sub ? (
                <div className="space-y-4">
                  {/* 날짜 정보 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.8} />
                      <div>
                        <div className="text-sm text-gray-500">구독 시작</div>
                        <div className="text-base font-semibold text-gray-800">{formatDate(sub.start_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <Clock className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.8} />
                      <div>
                        <div className="text-sm text-gray-500">다음 결제일</div>
                        <div className="text-base font-semibold text-gray-800">
                          {formatDate(sub.end_at)}
                          {daysUntilEnd !== null && daysUntilEnd > 0 && (
                            <span className="ml-1.5 text-sm text-gray-400 font-normal">({daysUntilEnd}일 후)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 플랜 한도 요약 */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "직접 스캔",  value: planLimits.scan },
                      { label: "경쟁사",     value: planLimits.competitors },
                      { label: "자동 스캔",  value: planLimits.autoScan },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center bg-gray-50 rounded-xl p-3">
                        <div className="text-base font-bold text-gray-800">{value}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm md:text-base text-gray-600">
                    유료 플랜으로 업그레이드하면 100회 AI 샘플링, 경쟁사 분석, 자동 개선 가이드를 이용할 수 있습니다.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "AI 스캔",    value: "100회", desc: "Gemini 샘플링" },
                      { label: "경쟁사",     value: "5개",   desc: "비교 분석" },
                      { label: "개선 가이드", value: "매월",  desc: "Claude AI 생성" },
                    ].map(({ label, value, desc }) => (
                      <div key={label} className="text-center bg-blue-50 rounded-xl p-3">
                        <div className="text-base font-bold text-blue-700">{value}</div>
                        <div className="text-sm text-blue-600 mt-0.5">{label}</div>
                        <div className="text-sm text-blue-400">{desc}</div>
                      </div>
                    ))}
                  </div>
                  <a
                    href="/pricing"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white text-base font-medium px-5 py-3 rounded-xl hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center sm:justify-start"
                  >
                    <Zap className="w-4 h-4" />
                    요금제 보기
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* ── 알림 및 결제 설정 (활성 구독자만) ── */}
          {isActive && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 md:px-5 py-4 border-b border-gray-100">
                <h2 className="text-base md:text-lg font-semibold text-gray-800">알림 · 결제 설정</h2>
                <p className="text-sm text-gray-500 mt-0.5">카카오 알림톡 수신 번호 및 결제 카드를 관리합니다.</p>
              </div>
              <div className="p-4 md:p-5">
                <SettingsClient
                  currentPhone={profile?.phone ?? ""}
                  kakaoScanNotify={profile?.kakao_scan_notify ?? true}
                  kakaoCompetitorNotify={profile?.kakao_competitor_notify ?? true}
                  subscriptionStatus={currentStatus}
                  userId={user.id}
                />
              </div>
            </section>
          )}

          {/* ── 플랜별 기능 비교 ── */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 md:px-5 py-4 border-b border-gray-100">
              <h2 className="text-base md:text-lg font-semibold text-gray-800">플랜별 기능 비교</h2>
            </div>
            <div className="p-4 md:p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-600 min-w-[480px]">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <th className="pb-3 pr-4 font-medium text-gray-700 text-sm">기능</th>
                      {(["free", "basic", "pro", "biz"] as const).map((plan) => {
                        const meta = PLAN_META[plan];
                        const isCurrent = currentPlan === plan;
                        return (
                          <th key={plan} className={`pb-3 text-center font-medium min-w-[80px] text-sm ${isCurrent ? meta.color : "text-gray-500"}`}>
                            {plan === "free" ? "무료" : plan === "basic" ? "Basic" : plan === "pro" ? "Pro" : "Biz"}
                            {isCurrent && (
                              <span className={`block text-xs font-semibold mt-0.5 px-1.5 py-0.5 rounded-full mx-auto w-fit ${meta.badge}`}>
                                현재
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ["직접 스캔/일",   "—",        "2회",     "5회",    "무제한"],
                      ["자동 스캔",      "—",        "주 1회",  "주 3회", "매일"],
                      ["경쟁사 비교",    "—",        "3개",     "10개",   "무제한"],
                      ["AI 개선 가이드", "—",        "월 5회",  "월 8회", "월 20회"],
                      ["카카오 알림톡",  "—",        "✓",       "✓",      "✓"],
                      ["PDF 리포트",     "—",        "—",       "✓",      "✓"],
                      ["엑셀 내보내기",  "—",        "—",       "✓",      "✓"],
                      ["팀 계정",        "—",        "—",       "—",      "5명"],
                    ] as [string, string, string, string, string][]).map(([feature, free, basic, pro, biz]) => (
                      <tr key={feature} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-4 text-gray-700 font-medium text-sm">{feature}</td>
                        {([free, basic, pro, biz] as const).map((val, i) => {
                          const plan = ["free", "basic", "pro", "biz"][i];
                          const isCurrent = currentPlan === plan;
                          return (
                            <td
                              key={i}
                              className={`py-2.5 text-center text-sm ${isCurrent ? "bg-blue-50/60 font-medium" : ""} ${val === "—" ? "text-gray-300" : "text-gray-700"}`}
                            >
                              {val === "✓" ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span>
                              ) : val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!isActive && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <a
                    href="/pricing"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Zap className="w-4 h-4" />
                    전체 요금제 비교 보기
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* ── 등록된 사업장 ── */}
          {businesses && businesses.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 md:px-5 py-4 border-b border-gray-100">
                <h2 className="text-base md:text-lg font-semibold text-gray-800">등록된 사업장</h2>
                <p className="text-sm text-gray-500 mt-0.5">사업장 정보를 수정하면 AI 분석 정확도가 높아집니다.</p>
              </div>
              <div className="p-4 md:p-5">
                <BusinessManager businesses={businesses} userId={user.id} autoEdit={autoEditBiz} />
              </div>
            </section>
          )}

          {/* ── 계정 설정 ── */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 md:px-5 py-4 border-b border-gray-100">
              <h2 className="text-base md:text-lg font-semibold text-gray-800">계정 설정</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {user.email} · 가입일 {formatDate(user.created_at)}
              </p>
            </div>
            <div className="p-4 md:p-5">
              <AccountClient currentEmail={user.email ?? ""} />
            </div>
          </section>

          {/* ── 고급 설정 (Biz+) ── */}
          {["biz", "enterprise"].includes(currentPlan) && isActive && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 md:px-5 py-4 border-b border-gray-100">
                <h2 className="text-base md:text-lg font-semibold text-gray-800">고급 설정</h2>
              </div>
              <div className="p-3">
                <div className="space-y-1">
                  <Link
                    href="/settings/team"
                    className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-purple-500" strokeWidth={1.8} />
                      </div>
                      <div>
                        <div className="text-base font-medium text-gray-800 group-hover:text-gray-900">팀 계정 관리</div>
                        <div className="text-sm text-gray-400">최대 {currentPlan === "enterprise" ? "20" : "5"}명 초대 가능</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                  </Link>
                  <Link
                    href="/settings/api-keys"
                    className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <Key className="w-4 h-4 text-emerald-500" strokeWidth={1.8} />
                      </div>
                      <div>
                        <div className="text-base font-medium text-gray-800 group-hover:text-gray-900">Public API 키 관리</div>
                        <div className="text-sm text-gray-400">최대 5개 발급 가능</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                  </Link>
                </div>
              </div>
            </section>
          )}

      </div>
    </div>
  );
}
