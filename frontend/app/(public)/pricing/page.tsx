import type { Metadata } from "next";
import Link from "next/link";
import { type LucideIcon, BarChart3, Radar, Search, PenLine, Bell, CheckCircle2, Trophy, MessageSquare, MapPin, Lightbulb } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import { PayButton } from "./PayButton";
import { BizContactButton } from "./BizContactButton";
import PlanRecommender from "./PlanRecommender";
import GroupHeadlineBanner from "./GroupHeadlineBanner";
import { PLANS, PLAN_PRICES, FIRST_MONTH_DISCOUNT_PRICES } from "@/lib/plans";
import ChannelDifferentiationCard from "@/components/common/ChannelDifferentiationCard";
import { IconTile } from "@/components/common/IconTile";
import { MoreInfo } from "@/components/common/MoreInfo";

export const metadata: Metadata = {
  title: "요금제 | AEOlab — AI 검색 노출 진단 서비스",
  description: "Basic 월 17,900원부터 Biz까지. 네이버 AI 브리핑·ChatGPT·Gemini·Google AI 4채널 노출 진단. 신규 가입 첫 달 50% 할인.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "AEOlab 요금제 — 월 17,900원부터",
    description: "Basic·창업패키지·Pro·Biz 비교. 소상공인 AI 검색 노출 진단 서비스. 신규 첫 달 50% 할인.",
  },
};

// 플랜 카드 색상 테마 — Basic은 어두운 강조 카드, 나머지는 흰 카드 (2026-10-07)
const CARD_THEME: Record<string, {
  wrap: string; badge: string; sub: string; pill: string; pillText: string; line: string;
  check: string; detailLine: string; summary: string; moreText: string; moreTitle: string; dot: string;
}> = {
  Basic: {
    wrap: "bg-[#0E1A3A] text-white shadow-xl",
    badge: "bg-blue-600 text-white",
    sub: "text-[#C9D3F5]",
    pill: "bg-[#DDF7EA] text-[#0B6B45]",
    pillText: "",
    line: "bg-white/15",
    check: "#5EE0A6",
    detailLine: "border-white/15",
    summary: "text-white",
    moreText: "text-[#E3E9FF]",
    moreTitle: "text-white",
    dot: "text-[#5EE0A6]",
  },
  Pro: {
    wrap: "bg-white border border-gray-200 text-[#0E1A3A]",
    badge: "bg-blue-50 text-blue-700",
    sub: "text-gray-600",
    pill: "bg-gray-100 text-gray-700 font-medium",
    pillText: "Basic의 모든 기능 + 아래 내용",
    line: "bg-gray-200",
    check: "#2B5BFF",
    detailLine: "border-gray-200",
    summary: "text-blue-700",
    moreText: "text-gray-600",
    moreTitle: "text-[#0E1A3A]",
    dot: "text-blue-600",
  },
  "창업패키지": {
    wrap: "bg-white border border-gray-200 text-[#0E1A3A]",
    badge: "bg-amber-50 text-amber-900",
    sub: "text-gray-600",
    pill: "bg-gray-100 text-gray-700 font-medium",
    pillText: "오픈한 뒤에도 그대로 이용",
    line: "bg-gray-200",
    check: "#B26A00",
    detailLine: "border-gray-200",
    summary: "text-blue-700",
    moreText: "text-gray-600",
    moreTitle: "text-[#0E1A3A]",
    dot: "text-amber-700",
  },
};

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-600">AEOlab</Link>
          <div className="flex items-center gap-4">
            <Link href="/how-it-works" className="hidden lg:block text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap">서비스 안내</Link>
            <Link href="/faq" className="hidden md:block text-sm text-gray-600 hover:text-gray-900">FAQ</Link>
            <Link href="/demo" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900">미리보기</Link>
            <Link href="/showcase" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900">실사용 화면</Link>
            <AuthNavControlClient />
            <Link href="/trial" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              무료 체험
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 md:px-6 py-12 md:py-16">
        {/* 타이틀 */}
        <h1 className="text-3xl md:text-5xl font-bold text-center text-gray-900 mb-3">요금제</h1>
        <p className="text-center text-base md:text-xl text-gray-600 mb-6">
          어려운 설정은 필요 없어요. 알아서 확인하고, 뭘 고치면 되는지 쉬운 말로 알려드려요.
        </p>

        {/* 실사용 화면 유도 배너 */}
        <div className="text-center mb-6">
          <Link
            href="/showcase"
            className="inline-flex items-center gap-1.5 text-sm md:text-base text-blue-600 font-semibold hover:underline"
          >
            <Lightbulb className="inline w-4 h-4 mr-1 text-amber-500" aria-hidden="true" /> 실제 구독 사업장 화면 8개를 그대로 확인해보세요 →
          </Link>
        </div>

        {/* 업종 선택 → 그룹별 가치 메시지 */}
        <GroupHeadlineBanner />

        {/* ─── 상황 질문 → 추천 플랜 (15초 퀴즈를 비교표보다 먼저 노출) ─── */}
        <div className="mb-10 mt-8">
          <PlanRecommender />
        </div>

        {/* ─── 플랜 카드: 3개 (2026-10-07 쉬운 문구 + 핵심/전체 2단 구조 개편) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6 mb-6 mt-8">
          {[PLANS[1], PLANS[2], PLANS[4]].map((plan) => {
            const t = CARD_THEME[plan.name];
            const firstMonth = plan.name === "Basic" ? FIRST_MONTH_DISCOUNT_PRICES.basic : undefined;
            return (
              <div
                key={plan.name}
                id={`plan-${plan.name.replace(/\s+/g, "-")}`}
                className={`scroll-mt-20 rounded-3xl p-6 md:p-8 flex flex-col ${t.wrap}`}
              >
                <div className={`self-start text-sm font-bold px-3 py-1 rounded-full ${t.badge}`}>{plan.badge}</div>
                <div className="mt-4 text-3xl font-black tracking-tight">{plan.name}</div>
                <div className={`mt-1.5 text-base md:text-[17px] leading-relaxed break-keep ${t.sub}`}>{plan.description}</div>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl md:text-5xl font-black tracking-tight">{plan.price.replace("원", "")}</span>
                  <span className={`text-base md:text-lg ${t.sub}`}>원 {plan.period}</span>
                </div>
                <div className={`mt-2.5 self-start text-[15px] font-bold px-3.5 py-1.5 rounded-lg ${t.pill}`}>
                  {firstMonth ? `첫 달은 반값, ${firstMonth.toLocaleString()}원` : t.pillText}
                </div>
                <div className="mt-6">
                  <PayButton
                    planName={plan.name}
                    amount={plan.amount}
                    highlight={plan.highlight}
                    signupHref={plan.href}
                    firstMonthAmount={firstMonth}
                    ctaText={plan.cta}
                  />
                </div>
                <div className={`my-6 h-px ${t.line}`} />
                <ul className="space-y-4 md:space-y-5">
                  {plan.highlights.map((f, i) => (
                    <li key={f.title} className={`${i >= 3 ? "hidden md:flex" : "flex"} gap-3`}>
                      <CheckIcon color={t.check} />
                      <div>
                        <div className="text-base md:text-[17px] font-bold break-keep">{f.title}</div>
                        <div className={`mt-0.5 text-[15px] leading-relaxed break-keep ${t.sub}`}>{f.desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <details className={`group mt-6 pt-2 border-t ${t.detailLine}`}>
                  <summary className={`flex items-center justify-between min-h-12 text-base font-bold list-none [&::-webkit-details-marker]:hidden ${t.summary}`}>
                    이 플랜의 모든 기능 보기
                    <span className="text-xl group-open:hidden" aria-hidden="true">+</span>
                    <span className="text-xl hidden group-open:inline" aria-hidden="true">−</span>
                  </summary>
                  <ul className={`mt-3 space-y-3 text-[15px] leading-relaxed ${t.moreText}`}>
                    {plan.highlights.slice(3).map((f) => (
                      <li key={f.title} className="flex gap-2.5 md:hidden">
                        <span className={`font-black ${t.dot}`} aria-hidden="true">·</span>
                        <span><b className={t.moreTitle}>{f.title}</b> — {f.desc}</span>
                      </li>
                    ))}
                    {plan.moreFeatures.map((f) => (
                      <li key={f.title} className="flex gap-2.5">
                        <span className={`font-black ${t.dot}`} aria-hidden="true">·</span>
                        <span><b className={t.moreTitle}>{f.title}</b> — {f.desc}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}
        </div>

        {/* ─── Biz: 다점포·대행사 문의 배너 ─── */}
        {(() => {
          const biz = PLANS[3];
          return (
            <div id="plan-Biz" className="scroll-mt-20 rounded-3xl bg-gradient-to-br from-blue-50 to-violet-50 p-6 md:p-8 mb-12">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div>
                  <div className="text-[15px] font-bold text-violet-800">가게가 여러 곳이거나 대행사라면</div>
                  <div className="mt-1 text-2xl md:text-3xl font-black text-gray-900">
                    Biz <span className="text-lg md:text-xl font-medium">월 {biz.price}</span>
                  </div>
                  <div className="mt-1.5 text-base text-gray-700 leading-relaxed break-keep">{biz.description}</div>
                </div>
                <div className="md:w-56 shrink-0">
                  <BizContactButton cta={biz.cta} />
                </div>
              </div>
              <details className="group mt-4 pt-2 border-t border-blue-200">
                <summary className="flex items-center justify-between min-h-12 text-base font-bold text-blue-800 list-none [&::-webkit-details-marker]:hidden">
                  Biz의 모든 기능 보기
                  <span className="text-xl group-open:hidden" aria-hidden="true">+</span>
                  <span className="text-xl hidden group-open:inline" aria-hidden="true">−</span>
                </summary>
                <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-gray-700">
                  {[...biz.highlights, ...biz.moreFeatures].map((f) => (
                    <li key={f.title} className="flex gap-2.5">
                      <span className="font-black text-blue-700" aria-hidden="true">·</span>
                      <span><b className="text-gray-900">{f.title}</b> — {f.desc}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          );
        })()}

        {/* ─── 한눈에 비교 (핵심 6가지, 쉬운 말) ─── */}
        <div className="mb-12">
          <h2 className="text-2xl md:text-4xl font-black text-center text-gray-900">한눈에 비교해 보세요</h2>
          <p className="mt-2 text-center text-base text-gray-600">꼭 필요한 6가지만 골랐어요</p>
          <p className="text-sm text-gray-600 text-center mt-3 md:hidden">← 옆으로 밀어서 보세요</p>
          <div className="mt-4 md:mt-6 bg-white border border-gray-200 rounded-2xl overflow-x-auto" tabIndex={0}>
            <table className="w-full min-w-[560px] border-collapse text-[15px] md:text-base">
              <thead>
                <tr>
                  <th className="p-4 w-[28%]"><span className="sr-only">기능</span></th>
                  <th className="p-3 text-center bg-blue-50"><div className="font-black text-blue-700 text-base md:text-lg">Basic</div><div className="font-medium text-gray-600 text-sm">17,900원</div></th>
                  <th className="p-3 text-center"><div className="font-black text-base md:text-lg">Pro</div><div className="font-medium text-gray-600 text-sm">29,900원</div></th>
                  <th className="p-3 text-center"><div className="font-black text-base md:text-lg">창업패키지</div><div className="font-medium text-gray-600 text-sm">23,900원</div></th>
                  <th className="p-3 text-center"><div className="font-black text-base md:text-lg">Biz</div><div className="font-medium text-gray-600 text-sm">79,500원</div></th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["자동으로 확인해 주는 횟수", "주 2번", "주 3번", "주 1번", "매일"],
                  ["내가 원할 때 바로 확인", "하루 2번", "하루 5번", "하루 3번", "하루 10번"],
                  ["비교해 볼 근처 가게", "3곳", "5곳", "5곳", "제한 없음"],
                  ["\"이렇게 고치세요\" 안내서", "월 3번", "월 10번", "월 5번", "월 20번"],
                  ["변화 기록 보관", "60일", "90일", "90일", "계속 보관"],
                  ["등록할 수 있는 가게", "1곳", "2곳", "1곳", "5곳"],
                ].map(([label, ...vals]) => (
                  <tr key={label} className="border-t border-gray-100">
                    <th scope="row" className="p-4 text-left font-bold text-gray-900">{label}</th>
                    {vals.map((v, i) => (
                      <td key={i} className={`p-3 text-center text-gray-800 ${i === 0 ? "bg-blue-50" : ""}`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-sm text-gray-600">그 밖의 세부 기능은 아래 &quot;전체 기능 비교표&quot;에서 확인하실 수 있어요</p>
        </div>

        {/* ─── 채널 분기 안내 ─── */}
        <div className="mb-8">
          <p className="text-center text-sm font-semibold text-gray-600 mb-4">
            어떤 요금제든 당신의 업종에 맞는 채널을 측정합니다.
          </p>
          <ChannelDifferentiationCard variant="compact" />

          {/* 모든 업종 공통 — 네이버 일반 검색·지도(플레이스) SEO */}
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 md:px-6 py-4">
            <div className="flex items-start gap-3">
              <IconTile icon={MapPin} tone="green" size="sm" className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm md:text-base font-bold text-green-900 mb-1 break-keep">
                  모든 업종 공통 — 네이버 일반 검색·지도(플레이스) 상위 노출도 함께 개선
                </p>
                <p className="text-sm md:text-base text-green-800 leading-relaxed break-keep">
                  네이버 AI 브리핑 대상 업종이 아니어도 걱정 마세요. 스마트플레이스 소개글·소식·리뷰·키워드를
                  개선하면 <strong>네이버 일반 검색과 지도(플레이스) 상위 노출</strong>이 함께 올라갈 가능성이 높아집니다.
                  이 효과는 <strong>업종·프랜차이즈 여부와 관계없이 모든 사업장에 공통</strong>으로 적용됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 플랜 기능 비교표 (기본 접힘 — 2026-09-07 외부 진단 반영) ─── */}
        <details className="group bg-slate-50 border border-slate-200 rounded-xl mb-14 overflow-hidden">
          <summary className="flex items-center justify-between cursor-pointer px-6 py-5 select-none list-none">
            <span className="text-lg md:text-xl font-bold text-slate-900">전체 기능 비교표 보기 (16개 항목)</span>
            <span className="ml-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </summary>
          <div className="px-4 md:px-6 pb-6 overflow-x-auto" tabIndex={0}>
          <p className="text-sm text-gray-600 text-center mb-4 md:hidden">← 좌우로 밀어 비교하세요</p>
          <table className="w-full min-w-[560px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-gray-600 font-medium w-36">기능</th>
                <th className="text-center py-3 px-2 text-blue-600 font-semibold">Basic<br/><span className="font-normal text-blue-600 text-sm">17,900원</span></th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">Pro<br/><span className="font-normal text-gray-600 text-sm">29,900원</span></th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">창업패키지<br/><span className="font-normal text-gray-600 text-sm">23,900원</span></th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">Biz<br/><span className="font-normal text-gray-600 text-sm">79,500원</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ["자동 스캔", "주 2회", "주 3회", "주 1회", "매일"],
                ["수동 스캔", "하루 2회", "하루 5회", "하루 3회", "하루 10회"],
                ["내 검색어가 몇 등인지 확인", "주 1회", "매일", "매일", "매일"],
                ["키워드 자동 추천 (월)", "5회", "20회", "10회", "무제한"],
                ["소개글·톡톡 메뉴 초안 만들기 (월)", "10건", "월 30건", "월 20건", "월 60건"],
                ["경쟁사 비교", "3개", "5개", "5개", "무제한"],
                ["AI 개선 가이드", "월 3회", "월 10회", "월 5회", "월 20회"],
                ["블로그 AI 진단 (월)", "5회", "10회", "5회", "무제한"],
                ["리뷰 답변 초안", "월 50회", "무제한", "무제한", "무제한"],
                ["위기관리 가이드 (월)", "20회", "무제한", "무제한", "무제한"],
                ["히스토리 보관", "60일", "90일", "90일", "무제한"],
                ["엑셀(CSV) 내보내기", "✓", "✓", "✓", "✓"],
                ["PDF 리포트", "—", "✓", "—", "✓"],
                ["광고 대응 가이드", "—", "✓", "—", "✓"],
                ["창업 시장 분석", "—", "—", "✓", "✓"],
                ["사업장 수", "1개", "2개", "1개", "5개"],
              ].map(([feature, ...vals]) => (
                <tr key={feature as string} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3 text-gray-600">{feature}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`py-2.5 px-2 text-center ${i === 0 ? "text-blue-600 font-medium" : "text-gray-600"} ${v === "—" ? "text-gray-600" : ""}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-gray-600 mt-2 text-right">— : 해당 플랜에 포함되지 않음</p>
          </div>
        </details>

        {/* PlanRecommender는 상단(GroupHeadlineBanner 직후)으로 이동함 — 2026-09-07 외부 진단 반영 */}

        {/* ─── 포함된 진단 도구 ─── */}
        <div className="mb-14">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-block bg-blue-100 text-blue-700 text-sm font-bold px-2.5 py-1 rounded-full">
                Basic 이상 포함
              </span>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">추가 진단 도구</h2>
            </div>
            <p className="text-sm text-gray-600 mb-5 break-keep">
              AI 노출 점수가 낮은 <strong>원인을 찾는</strong> 도구 두 가지를 구독에 포함해 제공합니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconTile icon={PenLine} tone="indigo" size="sm" />
                  <p className="font-semibold text-gray-900 text-sm">블로그 AI 진단</p>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed break-keep">
                  내 블로그가 AI 브리핑에 인용되는지 분석 · 홍보형/정보형 비율 · 개선 제목 자동 제안
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconTile icon={Search} tone="blue" size="sm" />
                  <p className="font-semibold text-gray-900 text-sm">스마트플레이스 자동 점검</p>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed break-keep">
                  채팅방 메뉴·소개글·최근 소식 누락 자동 확인 · 즉시 쓸 수 있는 초안 제공
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 업종별 노출 범위 안내 (면책 문구) ─── */}
        <div className="mb-12 rounded-xl border border-amber-200 bg-amber-50 p-5 md:p-6">
          <h3 className="text-lg md:text-xl font-bold text-amber-900 mb-1 break-keep">
            내 업종은 어디에 해당하나요? — 노출 범위 안내
          </h3>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            네이버 AI 브리핑은 업종에 따라 대상이 나뉩니다. 하지만 어느 단계든 AEOlab으로 개선 가능한 채널이 있습니다.
          </p>

          {/* 단계별 분류 */}
          <div className="space-y-2.5 mb-4">
            <div className="rounded-xl bg-white border border-green-200 px-4 py-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">AI 브리핑 대상</span>
                <span className="text-sm font-semibold text-gray-900">음식점 · 카페 · 베이커리 · 바 · 숙박</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed break-keep">
                네이버 AI 브리핑(플레이스형) + AI탭 + 글로벌 AI까지 3개 채널 모두 노출 가능 (단, 프랜차이즈 가맹점은 네이버 공식 정책상 '플레이스형' AI 브리핑 제외 — 정보형 AI 브리핑은 콘텐츠로 노출 가능)
              </p>
            </div>

            <div className="rounded-xl bg-white border border-blue-200 px-4 py-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">아직 대상 아님</span>
                <span className="text-sm font-semibold text-gray-900">뷰티 · 네일 · 피트니스 · 요가 · 약국 · 반려동물 등</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed break-keep">
                현재 AI탭(정식 출시, 업종 제한 발표 없음) + 글로벌 AI 노출 가능. 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다. '플레이스형(가게 정보를 요약해 보여주는 방식)' AI 브리핑은 아직 대상이 아니며, 확대 여부는 네이버가 발표하지 않았습니다. 소개글·사진을 미리 갖춰두면 도움이 될 수 있습니다.
              </p>
            </div>

            <div className="rounded-xl bg-white border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">비대상 · 프랜차이즈</span>
                <span className="text-sm font-semibold text-gray-900">병원 · 법무 · 교육 · 쇼핑몰 등</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed break-keep">
                '플레이스형' AI 브리핑 대상은 아니지만, 블로그·콘텐츠로 '정보형 AI 브리핑'에 노출될 수 있고 AI탭 + ChatGPT · Gemini · Google AI 등 글로벌 AI 가시성도 집중 개선합니다.
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm md:text-base text-gray-600 leading-relaxed break-keep">
            구독 전 내 업종이 어디에 해당하는지{" "}
            <Link href="/trial" className="text-blue-600 hover:underline font-medium">
              무료 진단
            </Link>
            으로 확인하시거나, AEOlab 동작 원리는{" "}
            <Link href="/how-it-works" className="text-blue-600 hover:underline font-medium">
              서비스 안내 매뉴얼
            </Link>
            ·{" "}
            <a
              href="https://help.naver.com/service/30026/contents/24632"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              네이버 공식 안내
            </a>
            를 참고하세요.
          </p>
        </div>

        {/* ─── ChatGPT·네이버 광고와 비교 (아코디언) ─── */}
        <details className="group bg-slate-50 border border-slate-200 rounded-xl mb-12 overflow-hidden">
          <summary className="flex items-center justify-between cursor-pointer px-6 py-5 select-none list-none">
            <span className="text-lg md:text-xl font-bold text-slate-900">
              ChatGPT·네이버 광고와 비교
            </span>
            <span className="ml-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </summary>

          <div className="px-6 pb-6">
            {/* 가치 비교 배너 */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-red-700 mb-1">네이버 키워드 광고</div>
                <div className="text-sm text-gray-600">광고를 끄면 노출이 사라집니다</div>
                <div className="text-sm text-gray-600 mt-1">비용이 계속 들어야 유지</div>
              </div>
              <div className="flex items-center justify-center text-gray-600 text-3xl font-thin hidden sm:flex">vs</div>
              <div className="sm:hidden border-t border-gray-200 pt-3" />
              <div>
                <div className="text-2xl font-bold text-blue-600 mb-1">{PLAN_PRICES.basic.toLocaleString()}원</div>
                <div className="text-sm text-gray-600">AEOlab Basic 한 달</div>
                <div className="text-sm text-gray-600 mt-1">AI 노출 구조 자체를 개선</div>
              </div>
            </div>

            {/* ChatGPT 비교 카드 목록 */}
            <p className="text-sm md:text-base text-slate-500 text-center mb-5">
              ChatGPT에게 물어봐도 알 수 없는 것들을 AEOlab은 매주 자동으로 측정·수집·비교합니다
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(
                [
                  {
                    Icon: BarChart3,
                    title: "내 가게가 AI에 몇 % 확률로 나오는지",
                    why: "같은 질문을 100번씩 물어 몇 번 나오는지 측정합니다(Gemini·ChatGPT 각 100회, 총 200회, ± 오차 범위 표시). ChatGPT 단발 질의는 오차 범위 표시 불가.",
                  },
                  {
                    Icon: Radar,
                    title: "지금 당장 내 가게가 네이버 AI에 나오는지",
                    why: "네이버 블로그는 robots.txt에서 ChatGPT(GPTBot·OAI-SearchBot) 등 주요 AI 수집 봇을 차단하고 있습니다(2026-10-07 확인) — ChatGPT로는 네이버 AI 노출을 확인할 수 없습니다",
                  },
                  {
                    Icon: Search,
                    title: "경쟁사 스마트플레이스 소개글·채팅방 메뉴에 뭐 있는지",
                    why: "경쟁사 소개글·톡톡 메뉴를 자동으로 모읍니다 → 내 가게에 없는 항목 목록 제공 (ChatGPT로는 네이버 스마트플레이스 정보를 직접 확인하기 어렵습니다)",
                  },
                  {
                    Icon: PenLine,
                    title: "내 블로그 글이 AI 브리핑에 인용될 가능성",
                    why: "네이버 블로그 정보는 ChatGPT가 직접 접근하기 어렵습니다. 광고 같은 글 vs 도움 되는 글 비율을 분석해 AI에 인용되기 쉬운 글 제목을 자동 제안합니다. (Basic 이상 포함)",
                  },
                  {
                    Icon: Bell,
                    title: "근처 경쟁 가게 AI 노출이 이번 주 올랐는지",
                    why: "경쟁 가게의 변화를 자동으로 감지해 카카오톡으로 알려드립니다 (ChatGPT는 지속 추적 불가)",
                  },
                  {
                    Icon: CheckCircle2,
                    title: "소개글·FAQ 수정 후 7일 뒤 얼마나 달라졌는지",
                    why: "고친 지 7일 뒤 다시 측정해 변화를 보여드립니다(점수 숫자 대신 단계 표시). ChatGPT는 전·후 비교 불가.",
                  },
                  {
                    Icon: Trophy,
                    title: "우리 동네에서 AI 검색 순위가 몇 위인지",
                    why: "ChatGPT는 우리 동네 실시간 순위를 알 수 없습니다",
                  },
                  {
                    Icon: MessageSquare,
                    title: "리뷰 답변·소개글 Q&A 초안 글쓰기",
                    why: "ChatGPT도 잘합니다. AEOlab에는 내 가게·경쟁사 모니터링 데이터 기반으로 포함됩니다.",
                    isAmber: true,
                  },
                ] as { Icon: LucideIcon; title: string; why: string; isAmber?: boolean }[]
              ).map((item) => (
                <div
                  key={item.title}
                  className={`flex items-start gap-3 rounded-xl p-4 border ${
                    item.isAmber
                      ? "bg-amber-50 border-amber-100"
                      : "bg-white border-slate-100"
                  }`}
                >
                  <span className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${
                    item.isAmber ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"
                  }`} aria-hidden="true">
                    <item.Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-sm md:text-base font-semibold text-slate-800">{item.title}</p>
                    <p className={`text-sm mt-0.5 ${item.isAmber ? "text-amber-700" : "text-slate-500"}`}>
                      {item.why}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed text-center">
              ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
              측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
            </p>
          </div>
        </details>

        {/* ─── FAQ ─── */}
        <div className="mb-10">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 text-center">자주 묻는 질문</h2>
          <div className="space-y-3 max-w-2xl mx-auto">
            <MoreInfo summary="내 업종도 네이버 AI 브리핑에 노출되나요?" tone="soft">
              <p className="text-sm leading-relaxed break-keep">네이버 AI 브리핑은 크게 두 유형입니다.</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                <li><strong>① 플레이스형</strong> — 가게 플레이스 카드를 요약. 음식점·카페·베이커리·바·숙박 5개 업종이 현재 대상(프랜차이즈 제외).</li>
                <li><strong>② 정보형(추천형)</strong> — 블로그·콘텐츠를 출처로 종합. 업종 제한이 없어 전 업종도 콘텐츠가 잘 갖춰지면 노출될 수 있습니다.</li>
              </ul>
              <p className="mt-2 text-sm leading-relaxed break-keep">뷰티·네일·반려동물·헬스·요가·약국 등은 AI탭(2026-06-25 정식 출시)도 대상입니다. 어느 업종이든 스마트플레이스·블로그·키워드를 개선하면 네이버 일반 검색·지도 상위 노출도 공통으로 향상될 수 있습니다.</p>
            </MoreInfo>
            <MoreInfo summary="구독은 언제든지 해지할 수 있나요?" tone="soft">
              <p className="text-sm leading-relaxed break-keep">네. 언제든지 해지 가능합니다. 결제일로부터 7일 이내 + 서비스 미이용 상태(스캔·가이드 생성 전)인 경우 전액 환불됩니다. 7일 경과 또는 서비스 이용 후에는 현재 결제 기간 만료일까지 계속 이용 가능하며, 잔여 기간 환불은 제공되지 않습니다. 자세한 내용은 이용약관 §5를 참고해 주세요.</p>
            </MoreInfo>
            <MoreInfo summary="환불 정책은 어떻게 되나요?" tone="soft">
              <p className="text-sm leading-relaxed break-keep">결제 후 7일 이내 서비스를 사용하지 않으셨다면 전액 환불해 드립니다. 7일 경과 또는 서비스 이용(스캔·가이드 생성) 후에는 현재 결제 기간 만료일까지 서비스를 이용하실 수 있으며, 잔여 기간 환불은 제공되지 않습니다(이용약관 §5 기준). 설정 페이지에서 구독을 해지하면 환불 자격 여부가 자동으로 확인되어 즉시 처리됩니다. 문의사항은 support@aeolab.co.kr(이메일)로 접수해 주세요.</p>
            </MoreInfo>
            <MoreInfo summary="첫 달 50% 할인은 어떻게 적용되나요?" tone="soft">
              <p className="text-sm leading-relaxed break-keep">Basic 플랜 신규 가입 시 첫 달은 8,950원으로 결제됩니다. 이후 매달 자동으로 정상가 17,900원이 청구됩니다. 이전에 한 번이라도 구독한 이력이 있는 경우 할인이 적용되지 않습니다.</p>
            </MoreInfo>
            <MoreInfo summary="플랜 업그레이드·다운그레이드는 가능한가요?" tone="soft">
              <p className="text-sm leading-relaxed break-keep">언제든지 설정 페이지에서 플랜을 변경할 수 있습니다. 업그레이드 시 즉시 새 플랜이 적용되며, 다운그레이드 시 현재 결제 기간 만료일 이후부터 적용됩니다.</p>
            </MoreInfo>
          </div>
          <div className="text-center mt-6">
            <Link href="/faq" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              전체 FAQ 보기 →
            </Link>
          </div>
        </div>

        {/* 법적 고지 */}
        <p className="text-sm text-center text-gray-600">
          구독 신청 시{" "}
          <a href="/terms" className="underline hover:text-gray-600">이용약관</a>
          {" "}및{" "}
          <a href="/privacy" className="underline hover:text-gray-600">개인정보처리방침</a>
          에 동의하는 것으로 간주됩니다.
        </p>
      </section>

      <SiteFooter activePage="/pricing" />
    </main>
  );
}
