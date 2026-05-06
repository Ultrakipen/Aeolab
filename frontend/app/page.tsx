import Link from "next/link";
import { Check } from "lucide-react";
import HeroHeadline from "@/components/landing/HeroHeadline";
import HeroSampleCard from "@/components/landing/HeroSampleCard";
import HeroIndustryTiles from "@/components/landing/HeroIndustryTiles";
import Testimonials from "@/components/landing/Testimonials";
import TrackedCTA from "@/components/analytics/TrackedCTA";
import PricingAnchorTracker from "@/components/analytics/PricingAnchorTracker";
import DiagnosisCounter from "@/components/landing/DiagnosisCounter";
import WhyNotShownSection from "@/components/landing/WhyNotShownSection";
import AEOvsTraditionalSection from "@/components/landing/AEOvsTraditionalSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import DiagnosticToolsSection from "@/components/landing/DiagnosticToolsSection";
import ServiceMechanismSection from "@/components/landing/ServiceMechanismSection";
import FAQSection from "@/components/landing/FAQSection";
import { createClient } from "@/lib/supabase/server";
import { LandingLogout } from "./LandingLogout";
import { SiteFooter } from "@/components/common/SiteFooter";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-white">

      {/* ── 헤더 ── (모바일 py-3 / PC py-4 — 작은 화면 가시영역 보호) */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-bold text-blue-600">AEOlab</span>
            <span className="text-sm text-gray-500 hidden sm:block">네이버·ChatGPT·Google AI 노출 관리</span>
          </div>
          <nav className="flex items-center gap-3 lg:gap-6">
            <Link href="/how-it-works" className="hidden lg:block text-base text-gray-600 hover:text-gray-900 whitespace-nowrap">서비스 안내</Link>
            <Link href="/faq" className="hidden md:block text-base text-gray-600 hover:text-gray-900">FAQ</Link>
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">요금제</Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-base text-gray-600 hover:text-gray-900 whitespace-nowrap">대시보드</Link>
                <LandingLogout email={user.email ?? ""} />
              </>
            ) : (
              <>
                <Link href="/login" className="text-base text-gray-600 hover:text-gray-900 whitespace-nowrap">로그인</Link>
                <Link href="/signup" className="hidden sm:block text-base text-gray-600 hover:text-gray-900">회원가입</Link>
                <Link
                  href="/trial"
                  className="bg-blue-600 text-white text-sm md:text-base px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap font-semibold"
                >
                  무료 진단 시작
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ══ 블록 1: 히어로 ══ */}
      <div className="bg-gradient-to-b from-blue-50/40 via-white to-white">
        <section className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
            <div>
              <div className="flex flex-wrap justify-start gap-2 mb-3">
                <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 text-sm md:text-base px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                  <span className="break-keep font-medium">네이버 파워링크 광고 끄면 즉시 사라집니다</span>
                </div>
                <div className="inline-flex items-center bg-blue-50 text-blue-700 text-sm md:text-base px-3 py-1.5 rounded-full font-medium">
                  네이버·ChatGPT·Google AI 종합 가시성
                </div>
              </div>
              <HeroHeadline />
              <p className="text-base font-semibold text-blue-600 mb-1 sm:hidden break-keep">
                네이버·ChatGPT·Google AI 노출 관리 서비스
              </p>
              <p className="text-base md:text-lg text-gray-700 mb-3 break-keep leading-relaxed">
                AI 검색 시대, 광고 없이도 지속되는 노출을 만들어드립니다
              </p>
              <div className="mb-1">
                <HeroIndustryTiles />
              </div>
              <div className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed break-keep bg-gray-50 border-l-4 border-gray-300 pl-3 pr-3 py-2.5 rounded-r-lg">
                <span className="block">음식점·카페·베이커리·바·숙박 → 네이버 AI 브리핑</span>
                <span className="block">그 외 업종 → ChatGPT·Gemini·Google AI 노출 개선{" "}
                <Link href="/how-it-works" className="text-blue-600 hover:underline font-medium whitespace-nowrap">자세히 →</Link>
                </span>
              </div>
              <div className="flex flex-col items-start gap-3 mb-2">
                <TrackedCTA
                  href="/trial"
                  location="hero"
                  label="trial_start"
                  className="bg-blue-600 text-white text-base px-6 py-3.5 rounded-xl hover:bg-blue-700 transition-colors font-bold text-center w-full sm:w-auto"
                >
                  네이버 AI 브리핑 노출 확인하기
                </TrackedCTA>
                {/* 모바일: 3줄 ✓ 리스트(왼쪽 정렬) / PC: 배지 3개 */}
                <ul className="sm:hidden space-y-1.5 w-full">
                  <li className="flex items-center gap-2 text-base text-gray-700 leading-relaxed">
                    <span className="text-emerald-600 font-bold shrink-0">✓</span>
                    <span className="break-keep">블로그 인용 분석</span>
                  </li>
                  <li className="flex items-center gap-2 text-base text-gray-700 leading-relaxed">
                    <span className="text-emerald-600 font-bold shrink-0">✓</span>
                    <span className="break-keep">스마트플레이스 자동 점검</span>
                  </li>
                  <li className="flex items-center gap-2 text-base text-gray-700 leading-relaxed">
                    <span className="text-emerald-600 font-bold shrink-0">✓</span>
                    <span className="break-keep">경쟁사 비교</span>
                  </li>
                </ul>
                <div className="hidden sm:flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 text-base text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
                    ✓ 블로그 인용 분석
                  </span>
                  <span className="inline-flex items-center gap-1 text-base text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
                    ✓ 스마트플레이스 자동 점검
                  </span>
                  <span className="inline-flex items-center gap-1 text-base text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
                    ✓ 경쟁사 비교
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <DiagnosisCounter />
              </div>
            </div>
            {/* HeroSampleCard — 모바일 hidden(800px 점유 회피), lg부터 표시 */}
            <div className="hidden lg:block">
              <HeroSampleCard variant="pc" />
            </div>
          </div>
        </section>
      </div>

      {/* ══ 블록 2: 왜 AI에 안 나오나 ══ */}
      <WhyNotShownSection />

      {/* ══ 블록 3: 가격 앵커 (전환 깔때기 — 결정 정보 조기 노출) ══ */}
      <section className="bg-orange-50 border-y border-orange-200 py-6 md:py-8 px-4 md:px-6">
        <PricingAnchorTracker />
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 items-center">
            <div className="text-center sm:text-right border-b sm:border-b-0 sm:border-r border-orange-200 pb-4 sm:pb-0 sm:pr-6">
              <p className="text-base md:text-lg text-gray-700 mb-1 font-medium">네이버 광고</p>
              <p className="text-3xl md:text-4xl font-bold text-gray-700">하루 30,000원</p>
              <p className="text-base text-gray-600 mt-1">월 90만원+ · 광고 끄면 즉시 사라짐</p>
            </div>
            <div className="text-center sm:text-left sm:pl-6">
              <p className="text-base md:text-lg text-orange-700 font-semibold mb-1">AEOlab</p>
              <p className="text-3xl md:text-4xl font-bold text-blue-700">
                한 달 9,900원
                <span className="block sm:inline text-lg md:text-xl text-emerald-600 font-semibold sm:ml-2">
                  (첫 달 4,950원)
                </span>
              </p>
              <p className="text-base text-gray-700 mt-1">감당 가능한 가격으로 AI 검색 노출 시작</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1 text-sm text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  <Check size={14} strokeWidth={2.5} />
                  언제든 해지 가능
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  <Check size={14} strokeWidth={2.5} />
                  30일 내 환불 보장
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/pricing"
              className="inline-block bg-blue-600 text-white text-lg font-bold px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              요금제 보기 →
            </Link>
            <p className="text-sm text-gray-600 mt-2">Basic 첫 달 4,950원 · 언제든 해지 가능</p>
          </div>
        </div>
      </section>

      {/* ══ 블록 4: AEOlab 동작 기준 (게이트 + 점수 + 한계) ══ */}
      <ServiceMechanismSection />

      {/* ══ 블록 5: 이용 방법 3단계 ══ */}
      <HowItWorksSection />

      {/* ══ 블록 6: 추가 도구·비교 (DiagnosticTools + AEOvs 통합 그룹) ══ */}
      <section className="bg-gray-50 py-6 md:py-8 px-4 md:px-6 border-y border-gray-200">
        <div className="max-w-5xl mx-auto text-center mb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 break-keep">
            추가 진단 도구 · 다른 방식과 비교
          </h2>
        </div>
        <DiagnosticToolsSection />
        <AEOvsTraditionalSection />
      </section>

      {/* ══ 블록 7: 후기 (실데이터 시 자동 표시) ══ */}
      <Testimonials />

      {/* ══ 블록 8: FAQ ══ */}
      <FAQSection />

      {/* ══ 블록 9: 최종 CTA ══ */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-10 md:py-14 px-4 md:px-6 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-3 break-keep">
            지금 우리 가게 AI 노출,
            <br className="sm:hidden" /> 지금 확인됩니다
          </h2>
          <p className="text-base md:text-lg text-blue-100 mb-6 break-keep">
            네이버 광고 하루 30,000원 vs AEOlab 한 달 9,900원
            <span className="block text-emerald-300 font-semibold mt-1">
              첫 달 4,950원 · 언제든 해지 가능
            </span>
          </p>
          <TrackedCTA
            href="/trial"
            location="final"
            label="trial_start"
            className="inline-block bg-white text-blue-700 text-lg md:text-xl px-10 py-4 rounded-xl hover:bg-blue-50 transition-colors font-bold shadow-xl"
          >
            무료로 내 가게 진단받기
          </TrackedCTA>
        </div>
      </section>

      <SiteFooter />

    </main>
  );
}
