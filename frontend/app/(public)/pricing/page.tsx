import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Crown,
  Zap,
  Star,
  TrendingUp,
  Users,
  BarChart3,
  ArrowRight,
  Infinity,
} from "lucide-react";
import { PayButton } from "./PayButton";
import { BizContactButton } from "./BizContactButton";
import { FaqAccordion } from "./FaqAccordion";
import { FeatureList } from "./FeatureList";
import { PLANS } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { LandingLogout } from "@/app/LandingLogout";

export const metadata: Metadata = {
  title: "요금제 — AEOlab AI 검색 노출 최적화",
  description:
    "Basic 9,900원부터 시작하는 AEOlab 요금제. 네이버·카카오·ChatGPT 3채널 자동 스캔, 경쟁사 분석, 개선 가이드로 AI 검색 노출을 높이세요.",
  openGraph: {
    title: "AEOlab 요금제 — 월 9,900원으로 AI 검색 노출 시작",
    description:
      "광고비 하루치로 한 달 AI 노출 전략. Basic·Pro·Biz·창업패키지 중 내 사업에 맞는 플랜을 선택하세요.",
  },
};

/**
 * 요금제 페이지 v4.0 — PC·모바일 전면 최적화 (2026-04-03)
 *
 * 레이아웃:
 *   PC  : 유료 3개 플랜 grid-cols-3, 창업패키지 별도 섹션
 *   모바일: 단일 컬럼 스택
 */

// 플랜별 CTA 버튼 색상
const PLAN_COLORS: Record<string, { btn: string; ring: string; header: string; badge: string }> = {
  Basic: {
    btn: "bg-blue-600 text-white hover:bg-blue-700",
    ring: "ring-2 ring-blue-500 ring-offset-2",
    header: "bg-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
  Pro: {
    btn: "bg-indigo-600 text-white hover:bg-indigo-700",
    ring: "",
    header: "bg-white",
    badge: "bg-indigo-50 text-indigo-700",
  },
  Biz: {
    btn: "bg-emerald-600 text-white hover:bg-emerald-700",
    ring: "",
    header: "bg-white",
    badge: "bg-emerald-50 text-emerald-700",
  },
};

// 비교표 데이터
const COMPARE_ROWS: [string, string, string, string, string][] = [
  ["자동 AI 스캔", "주 1회", "주 3회", "매일", "주 1회"],
  ["수동 스캔", "하루 2회", "하루 5회", "무제한", "하루 3회"],
  ["경쟁사 비교", "3곳", "10곳", "무제한", "5곳"],
  ["AI 개선 가이드", "월 5회", "월 8회", "월 20회", "월 5회"],
  ["리뷰 답변 초안", "월 10회", "월 50회", "무제한", "월 20회"],
  ["히스토리 보관", "30일", "90일", "무제한", "90일"],
  ["엑셀(CSV) 내보내기", "—", "✓", "✓", "✓"],
  ["PDF 성과 보고서", "—", "✓", "✓", "—"],
  ["ChatGPT 광고 대응", "—", "✓", "✓", "—"],
  ["창업 시장 분석", "—", "—", "✓", "✓"],
  ["팀 계정", "—", "—", "5명", "—"],
  ["사업장 수", "1개", "1개", "5개", "1개"],
  ["외부 연동 API 키", "—", "—", "✓", "—"],
];

const FAQ_ITEMS = [
  {
    q: "우리 가게가 네이버 AI 브리핑에 나오는지 어떻게 아나요?",
    a: "무료 체험에서 업종·지역을 입력하면 1분 안에 네이버 AI 브리핑 준비도와 ChatGPT·Gemini 노출 점수를 바로 확인할 수 있습니다. 신용카드 없이 즉시 진단 가능합니다.",
  },
  {
    q: "경쟁 가게는 AI에 잘 나오는데 우리 가게는 왜 안 나올까요?",
    a: "대부분 스마트플레이스 FAQ 미등록, 리뷰 키워드 부족, AI 검색 최적화 정보 없음이 원인입니다. AEOlab은 부족한 키워드와 즉시 복사·붙여넣기 가능한 FAQ 문구를 바로 제공합니다.",
  },
  {
    q: "Basic과 Pro 중 어떤 걸 골라야 하나요?",
    a: "처음이라면 Basic을 추천합니다. 매주 자동으로 AI 7개를 점검하고 경쟁사 3곳을 비교합니다. 경쟁이 치열하거나 경쟁사 10곳을 비교하고 싶다면 Pro가 맞습니다. Pro는 주 3회 자동 스캔과 PDF 보고서가 포함됩니다.",
  },
  {
    q: "광고비랑 병행해서 써야 하나요?",
    a: "광고와 AI 노출은 완전히 다른 채널입니다. 광고는 돈을 내는 동안만 노출되고, AI 노출은 정보 최적화가 잘 되면 광고 없이 지속됩니다. 병행하면 효과가 더 크지만, AEOlab만으로도 AI 노출 구조 개선이 가능합니다.",
  },
  {
    q: "ChatGPT가 네이버를 못 크롤링한다던데 의미가 있나요?",
    a: "네이버가 AI 크롤러를 차단했기 때문에, 소상공인이 AI가 직접 읽을 수 있는 구조화된 정보를 별도로 만들어야 합니다. AEOlab은 그 정보(AI 검색 최적화 코드)와 FAQ를 자동으로 생성해 드립니다.",
  },
  {
    q: "창업 패키지는 언제 쓰는 건가요?",
    a: "아직 가게를 오픈하지 않았거나, 새 지역에 2호점을 내기 전에 그 지역 경쟁 강도를 먼저 파악하고 싶을 때 적합합니다. 이 업종·지역에서 AI 검색에 현재 노출되는 경쟁 가게들을 분석하고, 틈새 키워드를 발굴해 드립니다.",
  },
  {
    q: "구독은 언제든지 해지할 수 있나요?",
    a: "네. 대시보드 설정에서 언제든지 해지 가능합니다. 해지 후 현재 결제 기간이 끝날 때까지 서비스를 계속 이용할 수 있습니다.",
  },
];

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const mainPlans = [PLANS[1], PLANS[2], PLANS[3]]; // Basic, Pro, Biz
  const startupPlan = PLANS[4]; // 창업 패키지

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">
            AEOlab
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:block"
                >
                  대시보드
                </Link>
                <LandingLogout email={user.email ?? ""} />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:block"
                >
                  로그인
                </Link>
                <Link
                  href="/trial"
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  무료 체험
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6">

        {/* ── 히어로 섹션 ── */}
        <section className="py-10 md:py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-5">
            <Zap className="w-4 h-4" />
            <span>광고 없이 AI 검색 노출을 개선하는 유일한 방법</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            내 가게,<br className="sm:hidden" />{" "}
            AI 검색에 더 잘 노출되게 하는 법
          </h1>
          <p className="text-base md:text-xl text-gray-500 mb-6 max-w-2xl mx-auto leading-relaxed">
            네이버·카카오·ChatGPT 3채널에서<br className="hidden sm:block" />
            내 가게 노출 여부를 매주 자동으로 진단하고 개선 방법을 알려드립니다
          </p>

          {/* 주요 지표 3가지 */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 max-w-xl mx-auto mb-8">
            {[
              { num: "3채널", label: "핵심 AI 채널 진단" },
              { num: "1분", label: "무료 즉시 진단" },
              { num: "9,900원", label: "Basic 월정액" },
            ].map(({ num, label }) => (
              <div key={label} className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
                <div className="text-lg md:text-2xl font-bold text-blue-600">{num}</div>
                <div className="text-base text-gray-500 mt-1 leading-snug">{label}</div>
              </div>
            ))}
          </div>

          <Link
            href="/trial"
            className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold text-base md:text-lg px-6 md:px-8 py-3 md:py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
          >
            무료로 내 가게 AI 점수 확인
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-sm text-gray-400 mt-3">신용카드 불필요 · 1분 완성 · 로그인 없이 체험</p>
        </section>

        {/* ── 광고비 vs AEOlab 비교 배너 ── */}
        <section className="mb-10 md:mb-14">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-8">
            <div className="text-center mb-5 md:mb-6">
              <span className="text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                광고비를 아무리 써도 AI 추천 순위는 바뀌지 않습니다
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 items-center text-center">
              <div className="bg-red-50 rounded-xl p-4 md:p-6">
                <div className="text-sm text-red-500 font-semibold uppercase tracking-wide mb-2">기존 광고</div>
                <div className="text-2xl md:text-4xl font-bold text-red-500 mb-1">5~30만원</div>
                <div className="text-base text-gray-600 font-medium mb-2">네이버 키워드 광고 1일 (업종별 상이)</div>
                <div className="text-base text-gray-500 bg-red-50/80 rounded-lg px-3 py-1.5">
                  광고 끄면 즉시 노출 0<br />효과 지속 없음
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="hidden sm:block text-3xl font-light text-gray-300">vs</div>
                <div className="sm:hidden flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-sm font-medium text-gray-400">vs</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 md:p-6">
                <div className="text-sm text-blue-600 font-semibold uppercase tracking-wide mb-2">AEOlab</div>
                <div className="text-2xl md:text-4xl font-bold text-blue-600 mb-1">9,900원</div>
                <div className="text-base text-gray-600 font-medium mb-2">Basic 한 달 전체</div>
                <div className="text-base text-gray-600 bg-blue-50/80 rounded-lg px-3 py-1.5">
                  AI 노출 구조 자체를 개선<br />누적 효과 · 광고 없이 지속
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 핵심 가치 3가지 ── */}
        <section className="mb-10 md:mb-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: <BarChart3 className="w-6 h-6 text-blue-600" />,
                title: "내 가게가 AI에 보이나요?",
                desc: "네이버 AI 브리핑을 주력으로, 네이버·카카오·ChatGPT 3채널 노출 여부를 매주 자동 진단합니다",
                bg: "bg-blue-50",
              },
              {
                icon: <TrendingUp className="w-6 h-6 text-indigo-600" />,
                title: "경쟁 가게는 왜 앞서나요?",
                desc: "경쟁사가 AI에서 더 잘 보이는 이유를 키워드 단위로 분석해 따라잡을 방법을 제시합니다",
                bg: "bg-indigo-50",
              },
              {
                icon: <Zap className="w-6 h-6 text-amber-600" />,
                title: "오늘 당장 뭘 해야 하나요?",
                desc: "복사·붙여넣기만 하면 되는 FAQ 문구, 리뷰 답변 초안, AI 브리핑 등록 가이드를 제공합니다",
                bg: "bg-amber-50",
              },
            ].map(({ icon, title, desc, bg }) => (
              <div key={title} className={`${bg} rounded-xl p-5 md:p-6`}>
                <div className="mb-3">{icon}</div>
                <div className="font-bold text-gray-900 text-base md:text-lg mb-2">{title}</div>
                <div className="text-base text-gray-600 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 유료 플랜 3개 ── */}
        <section className="mb-10 md:mb-14">
          <div className="text-center mb-6 md:mb-8">
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">요금제 선택</h2>
            <p className="text-base text-gray-500">언제든지 해지 가능 · 첫 달 환불 보장</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {mainPlans.map((plan) => {
              const colors = PLAN_COLORS[plan.name] ?? PLAN_COLORS.Pro;
              const isHighlight = plan.highlight;

              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl flex flex-col bg-white border ${
                    isHighlight
                      ? "border-blue-400 shadow-xl shadow-blue-100 " + colors.ring
                      : "border-gray-200 shadow-sm"
                  }`}
                >
                  {/* 인기 배지 */}
                  {isHighlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shadow-md">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        소상공인 첫 시작
                      </span>
                    </div>
                  )}

                  {/* 플랜 헤더 */}
                  <div
                    className={`p-5 md:p-6 pb-5 rounded-t-2xl ${
                      isHighlight ? "bg-blue-600" : "bg-gray-50"
                    } ${isHighlight ? "" : "border-b border-gray-100"}`}
                  >
                    {/* 배지 */}
                    {plan.badge && (
                      <span
                        className={`text-sm font-semibold px-2.5 py-1 rounded-full inline-block mb-3 ${
                          isHighlight
                            ? "bg-blue-500 text-blue-100"
                            : colors.badge
                        }`}
                      >
                        {plan.badge}
                      </span>
                    )}

                    {/* valueTag */}
                    {plan.valueTag && (
                      <div
                        className={`text-base md:text-sm font-medium mb-3 leading-snug ${
                          isHighlight ? "text-blue-200" : "text-emerald-700"
                        }`}
                      >
                        {plan.valueTag}
                      </div>
                    )}

                    {/* 플랜명 */}
                    <div
                      className={`text-xl md:text-2xl font-bold mb-1 ${
                        isHighlight ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {plan.name}
                    </div>

                    {/* 설명 */}
                    <div
                      className={`text-base md:text-sm mb-4 leading-snug ${
                        isHighlight ? "text-blue-200" : "text-gray-500"
                      }`}
                    >
                      {plan.description}
                    </div>

                    {/* 가격 */}
                    <div className="flex items-end gap-1">
                      <span
                        className={`text-4xl md:text-5xl font-extrabold tracking-tight ${
                          isHighlight ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {plan.price}
                      </span>
                      <span
                        className={`text-sm font-normal pb-1 ${
                          isHighlight ? "text-blue-200" : "text-gray-400"
                        }`}
                      >
                        {plan.period}
                      </span>
                    </div>
                  </div>

                  {/* 킬러 기능 강조 */}
                  {plan.killerFeature && (
                    <div
                      className={`px-5 md:px-6 py-3 text-base md:text-sm font-medium leading-snug flex items-start gap-2 border-b ${
                        isHighlight
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : "bg-amber-50 text-amber-800 border-amber-100"
                      }`}
                    >
                      <Zap className={`w-4 h-4 shrink-0 mt-0.5 ${isHighlight ? "text-blue-600" : "text-amber-600"}`} />
                      <span>{plan.killerFeature}</span>
                    </div>
                  )}

                  {/* 기능 목록 */}
                  <div className="p-5 md:p-6 pt-4 flex-1">
                    <FeatureList
                      features={plan.features}
                      isHighlight={isHighlight}
                    />
                  </div>

                  {/* CTA */}
                  <div className="px-5 md:px-6 pb-5 md:pb-6">
                    {plan.isPay ? (
                      <PayButton
                        planName={plan.name}
                        amount={plan.amount}
                        highlight={isHighlight}
                        signupHref={plan.href}
                      />
                    ) : plan.href.startsWith("mailto:") ? (
                      <BizContactButton cta={plan.cta} />
                    ) : (
                      <Link
                        href={plan.href}
                        className={`block text-center py-3 md:py-3.5 rounded-xl font-semibold transition-colors text-base md:text-sm ${
                          isHighlight
                            ? "bg-white text-blue-600 hover:bg-blue-50"
                            : colors.btn
                        }`}
                      >
                        {plan.cta}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 창업 패키지 별도 섹션 ── */}
        <section className="mb-10 md:mb-14">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm font-semibold text-gray-500 shrink-0 px-2 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              예비 창업자를 위한 특별 플랜
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="max-w-2xl mx-auto bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
            {/* 창업 헤더 */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 md:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100">
              <div>
                <span className="text-sm font-bold bg-amber-200 text-amber-800 px-2.5 py-1 rounded-full inline-block mb-2">
                  {startupPlan.badge}
                </span>
                <div className="text-lg md:text-xl font-bold text-gray-900 mb-1">{startupPlan.name}</div>
                <div className="text-base text-gray-600">{startupPlan.description}</div>
              </div>
              <div className="shrink-0 sm:text-right">
                <div className="text-3xl md:text-4xl font-extrabold text-gray-900">{startupPlan.price}</div>
                <div className="text-sm text-gray-400">{startupPlan.period}</div>
              </div>
            </div>

            {/* 킬러 기능 */}
            <div className="px-5 md:px-6 py-3 border-b border-amber-100 bg-amber-50/60 flex items-start gap-2">
              <Crown className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-base font-medium text-amber-800">{startupPlan.killerFeature}</div>
            </div>

            {/* 기능 목록 2컬럼 */}
            <div className="p-5 md:p-6">
              <FeatureList
                features={startupPlan.features}
                isHighlight={false}
                grid={true}
              />
              <PayButton
                planName={startupPlan.name}
                amount={startupPlan.amount}
                highlight={false}
                signupHref={startupPlan.href}
              />
            </div>
          </div>
        </section>

        {/* ── 플랜 기능 비교표 ── */}
        <section className="mb-10 md:mb-14">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 text-center">
            플랜별 기능 한눈에 비교
          </h2>
          <p className="text-base text-gray-500 text-center mb-6">모든 플랜에 네이버·카카오·ChatGPT 3채널 듀얼트랙 스캔 엔진 포함</p>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
            <table className="w-full min-w-[560px] text-base border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 bg-gray-50">
                  <th className="text-left py-4 px-4 text-gray-500 font-medium w-32 md:w-44">기능</th>
                  <th className="text-center py-4 px-3">
                    <div className="font-bold text-blue-700 text-sm md:text-base">Basic</div>
                    <div className="text-gray-500 text-sm mt-0.5">9,900원</div>
                  </th>
                  <th className="text-center py-4 px-3">
                    <div className="font-bold text-indigo-700 text-sm md:text-base">Pro</div>
                    <div className="text-gray-500 text-sm mt-0.5">22,900원</div>
                  </th>
                  <th className="text-center py-4 px-3">
                    <div className="font-bold text-emerald-700 text-sm md:text-base">Biz</div>
                    <div className="text-gray-500 text-sm mt-0.5">49,900원</div>
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        <Infinity className="w-3 h-3" />
                        3가지 무제한
                      </span>
                    </div>
                  </th>
                  <th className="text-center py-4 px-3">
                    <div className="font-bold text-amber-700 text-sm md:text-base">창업</div>
                    <div className="text-gray-500 text-sm mt-0.5">16,900원</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {COMPARE_ROWS.map(([feature, basic, pro, biz, startup]) => {
                  const renderCell = (val: string, colorClass: string) => {
                    if (val === "—") {
                      return (
                        <td key={val + feature} className="py-3 px-3 text-center">
                          <XCircle className="w-4 h-4 text-gray-200 mx-auto" />
                        </td>
                      );
                    }
                    if (val === "✓") {
                      return (
                        <td key={val + feature} className="py-3 px-3 text-center">
                          <CheckCircle2 className={`w-4 h-4 mx-auto ${colorClass}`} />
                        </td>
                      );
                    }
                    const isUnlimited = val === "무제한";
                    return (
                      <td key={val + feature} className={`py-3 px-3 text-center font-medium ${isUnlimited ? "text-emerald-600" : colorClass}`}>
                        {isUnlimited ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Infinity className="w-3.5 h-3.5" />
                            <span className="text-base">무제한</span>
                          </span>
                        ) : (
                          <span className="text-base">{val}</span>
                        )}
                      </td>
                    );
                  };

                  return (
                    <tr key={feature} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-gray-700 text-base font-medium">{feature}</td>
                      {renderCell(basic, "text-blue-600")}
                      {renderCell(pro, "text-indigo-600")}
                      {renderCell(biz, "text-emerald-600")}
                      {renderCell(startup, "text-amber-600")}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 무료 체험 CTA 배너 ── */}
        <section className="mb-10 md:mb-14">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-lg shadow-blue-200">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-200" />
                <span className="text-blue-200 text-base font-medium">먼저 확인해보세요</span>
              </div>
              <div className="font-bold text-xl md:text-2xl mb-1">로그인 없이 지금 바로 무료 체험</div>
              <div className="text-blue-200 text-base">
                내 가게 AI 노출 점수 + 없는 키워드 3개 + FAQ 문구 — 1분 완성
              </div>
            </div>
            <Link
              href="/trial"
              className="shrink-0 bg-white text-blue-600 font-bold text-base px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center gap-2 whitespace-nowrap shadow-md"
            >
              무료 체험 시작
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* ── FAQ 섹션 ── */}
        <section className="mb-12 md:mb-16">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 text-center">
            사장님들이 가장 많이 묻는 질문
          </h2>
          <p className="text-base text-gray-500 text-center mb-6">궁금한 점을 클릭하면 답변을 볼 수 있어요</p>
          <FaqAccordion items={FAQ_ITEMS} />
        </section>

        {/* 법적 고지 */}
        <div className="border-t border-gray-100 pt-8 pb-10 text-center">
          <p className="text-sm text-gray-400">
            구독 신청 시{" "}
            <a href="/terms" className="underline hover:text-gray-600 transition-colors">
              이용약관
            </a>
            {" "}및{" "}
            <a href="/privacy" className="underline hover:text-gray-600 transition-colors">
              개인정보처리방침
            </a>
            에 동의하는 것으로 간주됩니다.
          </p>
          <p className="text-xs text-gray-300 mt-2">
            AEOlab · hello@aeolab.co.kr · aeolab.co.kr
          </p>
          <p className="text-xs text-gray-300 mt-1">
            사업자등록번호 202-19-10353 · 대표 김봉후 · 070-8095-1478
          </p>
        </div>
      </div>
    </main>
  );
}
