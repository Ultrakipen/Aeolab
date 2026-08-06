import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import { PayButton } from "./PayButton";
import { BizContactButton } from "./BizContactButton";
import PlanRecommender from "./PlanRecommender";
import GroupHeadlineBanner from "./GroupHeadlineBanner";
import { PLANS, FIRST_MONTH_DISCOUNT_PRICES } from "@/lib/plans";
import ChannelDifferentiationCard from "@/components/common/ChannelDifferentiationCard";

export const metadata: Metadata = {
  title: "요금제 | AEOlab — AI 검색 노출 진단 서비스",
  description: "Basic 월 11,900원부터 Biz까지. 네이버 AI 브리핑·ChatGPT·Gemini·Google AI 4채널 노출 진단. 신규 가입 첫 달 50% 할인.",
  openGraph: {
    title: "AEOlab 요금제 — 월 11,900원부터",
    description: "Basic·창업패키지·Pro·Biz 비교. 소상공인 AI 검색 노출 진단 서비스. 신규 첫 달 50% 할인.",
  },
};

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
        <p className="text-center text-base md:text-xl text-gray-500 mb-6">
          네이버 AI 브리핑 · ChatGPT · Gemini — AI가 내 가게를 먼저 추천하게 만드세요
        </p>

        {/* 업종 선택 → 그룹별 가치 메시지 */}
        <GroupHeadlineBanner />

        {/* ─── 플랜 카드: 상단 3개 ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 mt-8">
          {[PLANS[1], PLANS[2], PLANS[4]].map((plan) => (
            <div
              key={plan.name}
              id={`plan-${plan.name.replace(/\s+/g, "-")}`}
              className={`scroll-mt-20 rounded-xl p-5 md:p-6 flex flex-col ${
                plan.highlight
                  ? "bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2"
                  : "bg-white border border-gray-200"
              }`}
            >
              {plan.badge && (
                <div className={`text-sm font-semibold mb-2 ${plan.highlight ? "text-blue-100" : "text-blue-600"}`}>
                  {plan.badge}
                </div>
              )}
              <div className={`text-2xl md:text-3xl font-bold mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                {plan.name}
              </div>
              <div className={`text-sm md:text-base mb-2 leading-snug ${plan.highlight ? "text-blue-200" : "text-gray-500"}`}>
                {plan.description}
              </div>
              {plan.killerFeature && (
                <div className={`text-sm md:text-base font-medium mb-3 px-3 py-2 rounded-lg ${
                  plan.highlight ? "bg-white/15 text-white" : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}>
                  ✦ {plan.killerFeature}
                </div>
              )}
              <div className={`text-3xl md:text-4xl font-bold mb-1 mt-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                {plan.price}
                <span className={`text-base font-normal ${plan.highlight ? "text-blue-200" : "text-gray-500"}`}>
                  {plan.period}
                </span>
              </div>
              {plan.name === "Basic" && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  plan.highlight ? "bg-emerald-400/20 text-emerald-100" : "bg-emerald-50 text-emerald-700"
                }`}>
                  첫 달 50% 할인 — 5,950원 (이후 월 11,900원)
                </div>
              )}
              {plan.valueTag && (
                <div className={`mt-3 text-sm md:text-base font-medium px-3 py-1.5 rounded-lg self-start ${
                  plan.highlight ? "bg-blue-500/50 text-blue-100" : "bg-green-50 text-green-700 border border-green-200"
                }`}>
                  {plan.valueTag}
                </div>
              )}

              <ul className="mt-4 mb-6 space-y-2 md:space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`text-sm md:text-base flex gap-2 leading-snug ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}>
                    <span className={`mt-0.5 shrink-0 ${plan.highlight ? "text-blue-200" : "text-blue-500"}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.isPay ? (
                <PayButton
                  planName={plan.name}
                  amount={plan.amount}
                  highlight={plan.highlight}
                  signupHref={plan.href}
                  firstMonthAmount={plan.name === "Basic" ? FIRST_MONTH_DISCOUNT_PRICES.basic : undefined}
                  ctaText={plan.cta}
                />
              ) : (
                <Link
                  href={plan.href}
                  className={`block text-center py-3 rounded-xl font-semibold transition-colors ${
                    plan.highlight
                      ? "bg-white text-blue-600 hover:bg-blue-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* ─── Biz 플랜 앵커 안내 ─── */}
        <div className="flex items-center justify-center gap-3 mb-6 -mt-4">
          <span className="text-sm text-gray-500">여러 사업장이 필요하신가요?</span>
          <a href="#plan-Biz" className="text-sm font-semibold text-blue-600 hover:underline">
            Biz 플랜 보기 ↓
          </a>
        </div>

        {/* ─── 플랜 카드: Biz ─── */}
        <div className="grid grid-cols-1 max-w-lg mx-auto gap-6 mb-12">
          {[PLANS[3]].map((plan) => (
            <div
              key={plan.name}
              id={`plan-${plan.name.replace(/\s+/g, "-")}`}
              className="scroll-mt-20 bg-white border border-gray-200 rounded-xl p-5 md:p-6 flex flex-col"
            >
              {plan.badge && (
                <div className="text-sm font-semibold text-blue-600 mb-2">{plan.badge}</div>
              )}
              <div className="text-2xl font-bold text-gray-900 mb-0.5">{plan.name}</div>
              <div className="text-sm md:text-base text-gray-500 mb-1">{plan.description}</div>
              {plan.valueTag && (
                <div className="text-sm md:text-base font-medium mb-3 px-3 py-1.5 rounded-lg inline-block self-start bg-green-50 text-green-700 border border-green-200">
                  {plan.valueTag}
                </div>
              )}
              <div className="text-4xl font-bold text-gray-900 mb-1 mt-2">
                {plan.price}
                <span className="text-base font-normal text-gray-500">{plan.period}</span>
              </div>
              <ul className="mt-4 mb-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm md:text-base flex gap-2 text-gray-600 leading-snug">
                    <span className="text-blue-500 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.isPay ? (
                <PayButton
                  planName={plan.name}
                  amount={plan.amount}
                  highlight={false}
                  signupHref={plan.href}
                />
              ) : plan.href.startsWith("mailto:") ? (
                <BizContactButton cta={plan.cta} />
              ) : (
                <Link
                  href={plan.href}
                  className="block text-center py-3 rounded-xl font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
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
              <span className="text-2xl shrink-0" aria-hidden="true">📍</span>
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

        {/* ─── 플랜 기능 비교표 ─── */}
        <div className="overflow-x-auto mb-14">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 text-center">플랜 기능 비교</h2>
          <p className="text-sm text-gray-500 text-center mb-4 md:hidden">← 좌우로 밀어 비교하세요</p>
          <table className="w-full min-w-[560px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-gray-500 font-medium w-36">기능</th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">창업패키지<br/><span className="font-normal text-gray-500 text-sm">12,900원</span></th>
                <th className="text-center py-3 px-2 text-blue-600 font-semibold">Basic<br/><span className="font-normal text-blue-400 text-sm">11,900원</span></th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">Pro<br/><span className="font-normal text-gray-500 text-sm">23,900원</span></th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">Biz<br/><span className="font-normal text-gray-500 text-sm">49,900원</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ["자동 스캔", "주 1회", "주 2회", "주 3회", "매일"],
                ["수동 스캔", "하루 3회", "하루 2회", "하루 5회", "하루 10회"],
                ["키워드 순위 측정 주기", "주 1회", "주 1회", "주 3회", "매일"],
                ["키워드 자동 추천 (월)", "10회", "5회", "20회", "무제한"],
                ["AI 콘텐츠 자동 생성 (소개글·채팅방메뉴, 월합산)", "월 20건", "10건", "월 30건", "월 60건"],
                ["경쟁사 비교", "5개", "3개", "5개", "무제한"],
                ["AI 개선 가이드", "월 5회", "월 3회", "월 10회", "월 20회"],
                ["블로그 AI 진단 (월)", "5회", "5회", "10회", "무제한"],
                ["리뷰 답변 초안", "무제한", "월 50회", "무제한", "무제한"],
                ["위기관리 가이드 (월)", "무제한", "20회", "무제한", "무제한"],
                ["히스토리 보관", "90일", "60일", "90일", "무제한"],
                ["엑셀(CSV) 내보내기", "✓", "✓", "✓", "✓"],
                ["PDF 리포트", "—", "—", "✓", "✓"],
                ["광고 대응 가이드", "—", "—", "✓", "✓"],
                ["창업 시장 분석", "✓", "—", "—", "✓"],
                ["사업장 수", "1개", "1개", "2개", "5개"],
              ].map(([feature, ...vals]) => (
                <tr key={feature as string} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3 text-gray-600">{feature}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`py-2.5 px-2 text-center ${i === 1 ? "text-blue-600 font-medium" : "text-gray-600"} ${v === "—" ? "text-gray-500" : ""}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-gray-500 mt-2 text-right">— : 해당 플랜에 포함되지 않음</p>
        </div>

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
                  <span className="text-xl" aria-hidden="true">📝</span>
                  <p className="font-semibold text-gray-900 text-sm">블로그 AI 진단</p>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed break-keep">
                  내 블로그가 AI 브리핑에 인용되는지 분석 · 홍보형/정보형 비율 · 개선 제목 자동 제안
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl" aria-hidden="true">🏪</span>
                  <p className="font-semibold text-gray-900 text-sm">스마트플레이스 자동 점검</p>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed break-keep">
                  채팅방 메뉴·소개글·최근 소식 누락 자동 확인 · 즉시 쓸 수 있는 초안 제공
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 상황 질문 → 추천 플랜 ─── */}
        <div className="mb-14">
          <PlanRecommender />
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
                <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">확대 예상</span>
                <span className="text-sm font-semibold text-gray-900">뷰티 · 네일 · 피트니스 · 요가 · 약국 · 반려동물 등</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed break-keep">
                현재 AI탭(정식 출시, 업종 제한 없음) + 글로벌 AI 노출 가능. 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다. '플레이스형' AI 브리핑 확대에 대비해 소개글·사진을 미리 준비할 수 있습니다.
              </p>
            </div>

            <div className="rounded-xl bg-white border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">비대상 · 프랜차이즈</span>
                <span className="text-sm font-semibold text-gray-900">병원 · 법무 · 교육 · 쇼핑몰 등</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed break-keep">
                '플레이스형' AI 브리핑 대상은 아니지만, 블로그·콘텐츠로 '정보형 AI 브리핑'에 노출될 수 있고 AI탭 + ChatGPT · Gemini · Google AI · 카카오맵 등 글로벌 AI 가시성도 집중 개선합니다.
              </p>
            </div>
          </div>

          {/* 공통 안내 — 네이버 일반 검색 SEO */}
          <div className="rounded-xl bg-green-100/60 border border-green-200 px-4 py-3 mb-4">
            <p className="text-sm md:text-base text-green-900 leading-relaxed break-keep">
              <strong>📍 어느 단계든 공통:</strong> 위 어느 경우에 해당하든, 스마트플레이스·블로그·키워드를 개선하면
              <strong> 네이버 일반 검색과 지도(플레이스) 상위 노출</strong>은 함께 향상될 수 있습니다. '플레이스형' AI 브리핑 대상이 아니어도 블로그·콘텐츠로 '정보형 AI 브리핑'과 네이버 검색에서 더 잘 찾히게 만들 수 있습니다.
            </p>
          </div>

          <p className="text-sm md:text-base text-gray-600 leading-relaxed break-keep">
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
                <div className="text-2xl font-bold text-red-500 mb-1">300,000원</div>
                <div className="text-sm text-gray-500">키워드 광고 월 1일치</div>
                <div className="text-sm text-gray-500 mt-1">광고 끄면 즉시 노출 0</div>
              </div>
              <div className="flex items-center justify-center text-gray-500 text-3xl font-thin hidden sm:flex">vs</div>
              <div className="sm:hidden border-t border-gray-200 pt-3" />
              <div>
                <div className="text-2xl font-bold text-blue-600 mb-1">11,900원</div>
                <div className="text-sm text-gray-500">AEOlab Basic 한 달</div>
                <div className="text-sm text-gray-500 mt-1">AI 노출 구조 자체를 개선</div>
              </div>
            </div>

            {/* ChatGPT 비교 카드 목록 */}
            <p className="text-sm md:text-base text-slate-500 text-center mb-5">
              ChatGPT에게 물어봐도 알 수 없는 것들을 AEOlab은 매주 자동으로 측정·수집·비교합니다
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  icon: "📊",
                  title: "내 가게가 AI에 몇 % 확률로 나오는지",
                  why: "Gemini·ChatGPT 각 100회 (총 200회) 질의 → ± 오차 범위 표시 (ChatGPT 단발 질의는 오차 범위 표시 불가)",
                },
                {
                  icon: "📡",
                  title: "지금 당장 내 가게가 네이버 AI에 나오는지",
                  why: "네이버는 ChatGPT·Gemini 봇 크롤링을 robots.txt로 전면 차단 — ChatGPT로는 네이버 AI 노출을 확인할 수 없습니다",
                },
                {
                  icon: "🔍",
                  title: "경쟁사 스마트플레이스 소개글·채팅방 메뉴에 뭐 있는지",
                  why: "매주 월요일 05:00 경쟁사 소개글·채팅방 메뉴 자동 수집 → 내 가게에 없는 항목 목록 제공 (ChatGPT는 네이버 스마트플레이스 접근 불가)",
                },
                {
                  icon: "📝",
                  title: "내 블로그 글이 AI 브리핑에 인용될 가능성",
                  why: "네이버 블로그 정보는 ChatGPT가 직접 접근하기 어렵습니다. 홍보형·정보형 비율을 분석해 AI에 인용되기 쉬운 글 제목을 자동 제안합니다. (Basic 이상 포함)",
                },
                {
                  icon: "🔔",
                  title: "근처 경쟁 가게 AI 노출이 이번 주 올랐는지",
                  why: "매주 월요일 03:00 자동 감지 → 변화 시 카카오톡 알림 (ChatGPT는 지속 추적 불가)",
                },
                {
                  icon: "✅",
                  title: "FAQ·소개글 수정 후 7일간 점수가 얼마나 올랐는지",
                  why: "행동 날짜 기록 → 7일 후 자동 재스캔 → 점수 변화 타임라인 (ChatGPT는 전·후 비교 불가)",
                },
                {
                  icon: "🏆",
                  title: "우리 동네에서 AI 검색 순위가 몇 위인지",
                  why: "ChatGPT는 우리 동네 실시간 순위를 알 수 없습니다",
                },
                {
                  icon: "💬",
                  title: "리뷰 답변·소개글 Q&A 초안 글쓰기",
                  why: "ChatGPT도 잘합니다. AEOlab에는 내 가게·경쟁사 모니터링 데이터 기반으로 포함됩니다.",
                  isAmber: true,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`flex items-start gap-3 rounded-xl p-4 border ${
                    (item as { isAmber?: boolean }).isAmber
                      ? "bg-amber-50 border-amber-100"
                      : "bg-white border-slate-100"
                  }`}
                >
                  <span className={`text-2xl shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${
                    (item as { isAmber?: boolean }).isAmber
                      ? "bg-amber-100"
                      : "bg-blue-50"
                  }`}>
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-sm md:text-base font-semibold text-slate-800">{item.title}</p>
                    <p className={`text-sm mt-0.5 ${(item as { isAmber?: boolean }).isAmber ? "text-amber-700" : "text-slate-500"}`}>
                      {item.why}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed text-center">
              ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
              측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
            </p>
          </div>
        </details>

        {/* ─── FAQ ─── */}
        <div className="mb-10">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 text-center">자주 묻는 질문</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {[
              {
                q: "내 업종도 네이버 AI 브리핑에 노출되나요?",
                a: "네이버 AI 브리핑은 크게 두 유형입니다. ① 가게 플레이스 카드를 요약하는 '플레이스형'은 음식점·카페·베이커리·바·숙박 5개 업종이 현재 대상(프랜차이즈 제외)입니다. ② 블로그·콘텐츠를 출처로 종합하는 '정보형(추천형)'은 업종 제한이 없어, 사진·학원·병원 등 전 업종도 콘텐츠가 잘 갖춰지면 노출될 수 있습니다. 뷰티·네일·반려동물·헬스·요가·약국 등은 AI탭(2026-06-25 정식 출시)도 대상입니다. 그 외 업종은 정보형 AI 브리핑 + ChatGPT·Gemini·Google AI 노출 개선 중심으로 가치를 제공합니다. 어느 업종이든 스마트플레이스·블로그·키워드를 개선하면 네이버 일반 검색·지도(플레이스) 상위 노출도 공통으로 향상될 수 있습니다.",
              },
              {
                q: "구독은 언제든지 해지할 수 있나요?",
                a: "네. 언제든지 해지 가능합니다. 결제일로부터 7일 이내 + 서비스 미이용 상태(스캔·가이드 생성 전)인 경우 전액 환불됩니다. 7일 경과 또는 서비스 이용 후에는 현재 결제 기간 만료일까지 계속 이용 가능하며, 잔여 기간 환불은 제공되지 않습니다. 자세한 내용은 이용약관 §3을 참고해 주세요.",
              },
              {
                q: "환불 정책은 어떻게 되나요?",
                a: "결제 후 7일 이내 서비스를 사용하지 않으셨다면 전액 환불해 드립니다. 7일 경과 또는 서비스 이용(스캔·가이드 생성) 후에는 현재 결제 기간 만료일까지 서비스를 이용하실 수 있으며, 잔여 기간 환불은 제공되지 않습니다(이용약관 §3 기준). 설정 페이지에서 구독을 해지하면 환불 자격 여부가 자동으로 확인되어 즉시 처리되며, 별도 문의 없이 진행됩니다. 문의사항은 네이버 톡톡(partner.talk.naver.com 검색 후 AEOlab 채널)으로 접수해 주세요.",
              },
              {
                q: "첫 달 50% 할인은 어떻게 적용되나요?",
                a: "Basic 플랜 신규 가입 시 첫 달은 5,950원으로 결제됩니다. 이후 매달 자동으로 정상가 11,900원이 청구됩니다. 이전에 한 번이라도 구독한 이력이 있는 경우 할인이 적용되지 않습니다.",
              },
              {
                q: "플랜 업그레이드·다운그레이드는 가능한가요?",
                a: "언제든지 설정 페이지에서 플랜을 변경할 수 있습니다. 업그레이드 시 즉시 새 플랜이 적용되며, 다운그레이드 시 현재 결제 기간 만료일 이후부터 적용됩니다.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border border-gray-100 rounded-xl p-4">
                <div className="font-semibold text-gray-900 text-base md:text-lg mb-2">{q}</div>
                <div className="text-sm md:text-base text-gray-600 leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/faq" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              전체 FAQ 보기 →
            </Link>
          </div>
        </div>

        {/* 법적 고지 */}
        <p className="text-sm text-center text-gray-500">
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
