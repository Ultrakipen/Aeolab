import Link from "next/link";
import { Check, Lock, CreditCard, Clock } from "lucide-react";
import HeroSection from "@/components/landing/HeroSection";
import ChatGPTCompareSection from "@/components/landing/ChatGPTCompareSection";
import AEOCompareSection from "@/components/landing/AEOCompareSection";
import DashboardPreview from "@/components/landing/DashboardPreview";
import TrackedCTA from "@/components/analytics/TrackedCTA";
import PricingAnchorTracker from "@/components/analytics/PricingAnchorTracker";
import FAQSection from "@/components/landing/FAQSection";
import Testimonials from "@/components/landing/Testimonials";
import FreeToolsSection from "@/components/landing/FreeToolsSection";
import AgencyServiceSection from "@/components/landing/AgencyServiceSection";
import InlineKeywordWidget from "@/components/landing/InlineKeywordWidget";
import { HowAeolabIntegrated } from "@/components/landing/HowAeolabIntegrated";
import { MobileAccordion } from "@/components/landing/MobileAccordion";
import { LandingHeaderNav } from "./LandingHeaderNav";
import { SiteFooter } from "@/components/common/SiteFooter";
import LandingScrollAnimation from "@/components/landing/LandingScrollAnimation";
import HeaderHelpSearch from "@/components/landing/HeaderHelpSearch";
import HelpFAQFloat from "@/components/landing/HelpFAQFloat";

const FLOAT_SHADOW = "var(--aeo-shadow-float)";

export default function LandingPage() {

  return (
    <main className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <LandingScrollAnimation />

      {/* ── 헤더 ── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          background: "rgba(255,255,255,0.95)",
          borderColor: "#E2E8F0",
          height: "64px",
        }}
      >
        <div className="max-w-[1020px] mx-auto px-4 md:px-7 h-full flex items-center justify-between">
          {/* 로고 */}
          <div className="flex items-center gap-1 shrink-0">
            <span
              className="text-lg font-black"
              style={{ color: "#0F172A", fontFamily: "var(--font-pretendard,'Pretendard Variable',sans-serif)", letterSpacing: "-0.8px" }}
            >
              AEO
            </span>
            <span
              className="text-lg font-black"
              style={{ color: "#2563EB", fontFamily: "var(--font-pretendard,'Pretendard Variable',sans-serif)" }}
            >
              lab
            </span>
            <span
              className="hidden sm:flex items-center text-sm ml-2 px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
              style={{ color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE" }}
            >
              AI 노출 관리
            </span>
          </div>

          {/* 네비게이션 */}
          <nav className="flex items-center gap-0.5 shrink-0">
            <Link
              href="/how-it-works"
              className="hidden lg:inline-block text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50 whitespace-nowrap"
              style={{ color: "#475569" }}
            >
              서비스 안내
            </Link>
            <Link
              href="/pricing"
              className="hidden md:inline-block text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50 whitespace-nowrap"
              style={{ color: "#475569" }}
            >
              요금제
            </Link>
            <Link
              href="/faq"
              className="hidden md:inline-block text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50 whitespace-nowrap"
              style={{ color: "#475569" }}
            >
              FAQ
            </Link>
            {/* PC 전용 도움말 검색창 — lg:flex (lg 미만에서 숨김) */}
            <div className="hidden lg:flex items-center ml-2">
              <HeaderHelpSearch />
            </div>
            <LandingHeaderNav />
          </nav>
        </div>
      </header>

      {/* ── 1. HERO ── */}
      <HeroSection />

      {/* ── 1-B. 3중 효과 배너 — Hero 직후 ── */}
      <div className="bg-blue-50 border-b border-blue-100 py-3 px-4">
        <div className="max-w-[1020px] mx-auto flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-1.5 sm:gap-6 text-sm text-gray-700 text-center">
          <span className="font-semibold text-gray-800 whitespace-nowrap">스마트플레이스·블로그 개선 방법을 알면</span>
          <span className="hidden sm:block text-gray-500">→</span>
          <span className="whitespace-nowrap">🔍 <strong className="text-blue-700">네이버 검색 상위노출</strong> 가능성 ↑</span>
          <span className="hidden sm:block text-gray-500">·</span>
          <span className="whitespace-nowrap">🤖 <strong className="text-purple-700">AI 브리핑·AI탭</strong> 노출 가능성 ↑</span>
          <span className="hidden sm:block text-gray-500">·</span>
          <span className="whitespace-nowrap">💬 <strong className="text-green-700">ChatGPT·Gemini·Google AI</strong> 노출 현황 측정·추적</span>
        </div>
      </div>

      {/* ── 2. WHY — Before / After (#FFFFFF) ── */}
      <section className="px-4 py-12 md:py-20" style={{ background: "#FFFFFF" }}>
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="광고 끊으면 사라집니다, AI 검색은 다릅니다 — 자세히 보기">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-sm font-bold tracking-widets mb-2" style={{ color: "#2563EB" }}>
              WHY AEOLAB
            </p>
            <p className="text-sm text-gray-500 mb-2 break-keep">
              지금 네이버 광고만 하고 있다면 — 이 차이를 확인하세요
            </p>
            <h2
              className="text-2xl md:text-3xl font-black tracking-tight break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              광고 끊으면 사라집니다,{" "}
              <span style={{
                background: "linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>AI 검색은 다릅니다</span>
            </h2>
            <p className="text-sm md:text-base mt-2 break-keep max-w-xl mx-auto" style={{ color: "#475569" }}>
              네이버 광고는 돈 내는 동안만, AI 검색(브리핑·AI탭)은 조건을 갖추면 광고 없이 지속될 수 있습니다
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {/* Before */}
            <div
              className="card-hover slide-left fade-up bg-white rounded-xl p-5 md:p-6 border"
              style={{ borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
            >
              <span
                className="inline-flex items-center text-sm font-bold px-2.5 py-0.5 rounded-full mb-3"
                style={{ background: "#FEF2F2", color: "#9F1239" }}
              >
                네이버 광고만 의존 시
              </span>
              <h3 className="text-base md:text-lg font-bold mb-0.5 break-keep" style={{ color: "#0F172A" }}>
                광고 끊으면 즉시 사라짐
              </h3>
              <p className="text-sm mb-3" style={{ color: "#64748B" }}>
                월 30만~100만원 추정 (업종·경쟁도에 따라) · AI 브리핑 노출 0
              </p>
              {/* 광고비 소진 SVG */}
              <svg viewBox="0 0 300 100" className="w-full h-auto">
                <line x1="0" y1="75" x2="300" y2="75" stroke="#E2E8F0" strokeWidth="1" />
                <line x1="0" y1="45" x2="300" y2="45" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3,3" />
                {/* 광고 ON 구간 — 빨간 실선 */}
                <path d="M 0,30 L 70,27 L 140,28 L 165,27" stroke="#DC2626" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                {/* 광고 OFF 급락 */}
                <path d="M 165,27 L 172,75" stroke="#DC2626" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="4,4" />
                {/* OFF 이후 — 회색 바닥선 */}
                <path d="M 172,75 L 300,75" stroke="#CBD5E1" strokeWidth="2" fill="none" strokeLinecap="round" />
                {/* 광고비 충전 바 (ON 구간 시각화) */}
                <rect x="4" y="60" width="155" height="12" rx="3" fill="#FEE2E2" />
                <rect x="4" y="60" width="155" height="12" rx="3" fill="#DC2626" opacity="0.7" />
                <text x="82" y="70" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold">광고비 소진 중</text>
                {/* OFF 수직선 */}
                <line x1="169" y1="6" x2="169" y2="77" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="2,2" />
                <text x="65" y="12" textAnchor="middle" fill="#DC2626" fontSize="8">광고비 ON</text>
                <text x="230" y="90" textAnchor="middle" fill="#64748B" fontSize="8">OFF → 노출 0</text>
                <circle cx="169" cy="27" r="3.5" fill="#DC2626" />
              </svg>
              <ul className="mt-3 space-y-1 text-sm" style={{ color: "#475569" }}>
                <li className="flex items-start gap-2">
                  <span className="font-bold shrink-0" style={{ color: "#DC2626" }}>✕</span>
                  매달 광고비 지출 (업종·지역에 따라 수십~수백만원)
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold shrink-0" style={{ color: "#DC2626" }}>✕</span>
                  끄는 순간 검색 결과에서 사라짐
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold shrink-0" style={{ color: "#DC2626" }}>✕</span>
                  AI 검색(ChatGPT·Gemini·Google AI·네이버 AI탭·AI 브리핑)엔 전혀 효과 없음
                </li>
              </ul>
            </div>

            {/* After */}
            <div
              className="card-hover slide-right fade-up rounded-xl p-5 md:p-6 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #4F46E5 100%)", boxShadow: FLOAT_SHADOW }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(ellipse 60% 60% at 80% 10%,rgba(255,255,255,0.12) 0%,transparent 60%)" }}
                aria-hidden="true"
              />
              <div className="relative">
                <span className="inline-flex items-center text-sm font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-full mb-3">
                  AEOlab → AI 검색 준비도 체계 관리
                </span>
                <h3 className="text-base md:text-lg font-bold mb-0.5 break-keep">
                  AI 검색 노출 조건을 체계적으로 관리합니다
                </h3>
                <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.75)" }}>월 11,900원 (광고비 30만원 기준의 약 1/25) · 모든 업종</p>
                <svg viewBox="0 0 300 100" className="w-full h-auto">
                  <line x1="0" y1="75" x2="300" y2="75" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
                  <path d="M 0,70 L 50,57 L 100,50 L 150,40 L 200,30 L 250,22 L 300,15 L 300,100 L 0,100 Z" fill="rgba(255,255,255,0.08)" />
                  <path d="M 0,70 L 50,57 L 100,50 L 150,40 L 200,30 L 250,22 L 300,15" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <circle cx="100" cy="50" r="3" fill="white" />
                  <circle cx="200" cy="30" r="3" fill="white" />
                  <circle cx="300" cy="15" r="3" fill="white" />
                  <text x="150" y="10" textAnchor="middle" fill="white" fontSize="8">매달 우상향</text>
                </svg>
                <ul className="mt-3 space-y-1 text-sm" style={{ color: "rgba(255,255,255,0.88)" }}>
                  <li className="flex items-start gap-2">
                    <span className="font-bold shrink-0">✓</span>
                    네이버 AI탭·AI 브리핑 최적화 <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8em" }}>(업종별 자동 적용)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold shrink-0">✓</span>
                    ChatGPT·Gemini·Google AI 현황 정기 측정 — 모든 업종
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold shrink-0">✓</span>
                    스마트플레이스·블로그 개선 → 네이버 검색 노출 가능성도 함께 높아집니다
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold shrink-0">✓</span>
                    광고 없이도 AI 추천 조건을 쌓아드립니다
                  </li>
                </ul>
              </div>
            </div>
          </div>
          </MobileAccordion>
        </div>
      </section>

      {/* ── 3. PROOF — 신뢰 데이터 Bento Grid (#FFFFFF 연속) ── */}
      <section className="px-4 py-12 md:py-20" style={{ background: "#FFFFFF" }}>
        <div className="max-w-[1020px] mx-auto">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
              네이버 공식 발표 데이터
            </p>
            <h2
              className="text-2xl md:text-3xl font-black break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              실제로 효과가 있다는 공식 근거
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* 메인 카드 — 파랑→인디고 그라디언트 */}
            <div
              className="card-hover fade-up count-reveal delay-1 md:col-span-2 rounded-xl p-5 md:p-7 relative overflow-hidden text-white"
              style={{
                background: "linear-gradient(135deg, #1D4ED8 0%, #4F46E5 100%)",
                boxShadow: "0 8px 40px rgba(79,70,229,0.35)",
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(ellipse 80% 60% at 90% 0%,rgba(255,255,255,0.10) 0%,transparent 60%)" }}
                aria-hidden="true"
              />
              <div className="relative">
                <p className="text-sm font-bold mb-1.5" style={{ color: "rgba(255,255,255,0.95)" }}>음식점 적용 후 클릭률 변화</p>
                <p className="stat-number-xl text-white mb-1.5">
                  +27.4%
                  <span className="text-sm font-bold ml-2 px-2 py-0.5 rounded-full align-middle" style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.95)" }}>음식점 기준</span>
                </p>
                <p className="text-sm md:text-base break-keep mb-1" style={{ color: "rgba(255,255,255,0.88)" }}>
                  AI 브리핑에 노출되면 손님 클릭이 늘어납니다
                </p>
                <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.75)" }}>
                  네이버 2025년 8월 공식 발표 · 음식점 카테고리 기준
                </p>
                <a
                  href="https://www.hankyung.com/article/202508212669g"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/75 underline hover:text-white mt-0.5 block"
                >
                  한국경제 보도 원문 →
                </a>
                <p className="text-sm mt-1.5 break-keep" style={{ color: "rgba(255,255,255,0.88)" }}>
                  측정 시점·지역·업종에 따라 달라질 수 있습니다
                </p>
                <p className="text-sm mt-1.5 break-keep" style={{ color: "rgba(255,255,255,0.72)" }}>
                  ※ 플레이스형 AI 브리핑 대상은 음식점·카페·베이커리·바·숙박 업종 — 그 외 업종도 블로그·콘텐츠가 채택되면 정보형 AI 브리핑 노출이 가능하며, 네이버 AI탭·ChatGPT·Gemini 채널로도 측정·개선합니다
                </p>
              </div>
            </div>

            {/* 보조 카드 3개 */}
            <div className="fade-up flex flex-col gap-3">
              {[
                { num: "3,000만+", label: "네이버 AI 서비스 월 이용자 (전체)", sub: "뉴스·검색·플레이스 전체 합산 · 네이버 공식 발표 (2025.11)", delay: "delay-1", isAiTab: false },
                { num: "2026.04", label: "네이버 AI탭 베타 출시", sub: "2026-04-27 베타 출시 · 2026-06-25 정식 출시 · 네이버 공식", delay: "delay-2", isAiTab: false },
                { num: "59종+", label: "모든 업종 측정 가능", sub: "AI 탭·글로벌 AI 기준 · 업종별 채널 자동 분기", delay: "delay-3", isAiTab: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`card-hover count-reveal ${item.delay} rounded-xl border p-3.5 flex flex-col gap-0.5`}
                  style={{
                    background: item.isAiTab ? "#F5F3FF" : "#FFFFFF",
                    borderColor: item.isAiTab ? "#A5B4FC" : "#E2E8F0",
                    boxShadow: FLOAT_SHADOW,
                  }}
                >
                  {item.isAiTab && (
                    <p className="text-sm font-bold mb-0.5" style={{ color: "#6366F1" }}>AI탭 · 글로벌 AI</p>
                  )}
                  <p
                    className="text-2xl md:text-3xl font-black leading-none"
                    style={{
                      color: item.isAiTab ? "#4F46E5" : "#0F172A",
                      fontFamily: "var(--font-pretendard,'Pretendard Variable',sans-serif)",
                    }}
                  >
                    {item.num}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: "#1E293B" }}>{item.label}</p>
                  <p className="text-sm" style={{ color: "#64748B" }}>{item.isAiTab ? "AI 탭·글로벌 AI 기준 · 업종별 채널 자동 분기" : item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3-B. TRUST — AEOlab 서비스 신뢰 지표 (모바일 접힘, 스크롤 길이 영향 없음) ── */}
      <div className="px-4 py-10 md:p-0">
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="AEOlab이 실제로 측정하는 것 — 신뢰 지표 보기">
            <Testimonials />
          </MobileAccordion>
        </div>
      </div>

      {/* ── 1-A. AI 검색 노출 — 업종 분기 다이어그램 + 개선 방법 통합 ── */}
      <section className="px-4 py-10 md:py-16" style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="AI 검색 노출, 업종마다 채널이 다릅니다 — 업종별 채널 보기">

          {/* PART 1 — 도입 */}
          <div className="text-center mb-10">
            <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>업종별 AI 채널 안내</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight break-keep" style={{ color: "#0F172A", letterSpacing: "-0.6px" }}>
              AI 검색 노출, 업종마다 채널이 다릅니다
            </h2>
            <p className="mt-3 text-base md:text-lg break-keep max-w-xl mx-auto font-semibold" style={{ color: "#059669" }}>
              하지만 개선 방법은 모든 업종이 동일합니다
            </p>
          </div>

          {/* PART 2 — 업종 분기 다이어그램 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">

            {/* 그룹 A */}
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-base font-black text-gray-800 break-keep">음식점·카페·베이커리·바·숙박</p>
                </div>
                <span className="flex-shrink-0 ml-3 px-3 py-1 rounded-full text-sm font-bold bg-emerald-600 text-white whitespace-nowrap">3채널 전부</span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-3 rounded-xl bg-white border border-emerald-100 px-4 py-3">
                  <span className="text-emerald-500 text-base font-bold mt-0.5 flex-shrink-0">✅</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">네이버 AI 브리핑</p>
                    <p className="text-sm text-gray-500">검색 결과 상단에 자동 노출되는 AI 추천 박스</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-white border border-emerald-100 px-4 py-3">
                  <span className="text-emerald-500 text-base font-bold mt-0.5 flex-shrink-0">✅</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">네이버 AI탭 답변</p>
                    <p className="text-sm text-gray-500">검색결과 &apos;AI&apos; 탭 클릭 시 등장하는 AI 답변</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-white border border-emerald-100 px-4 py-3">
                  <span className="text-emerald-500 text-base font-bold mt-0.5 flex-shrink-0">✅</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">ChatGPT·Gemini·Google AI 답변</p>
                    <p className="text-sm text-gray-500">글로벌 AI 인용 여부를 측정합니다 (노출 보장 아님)</p>
                    <p className="text-sm text-gray-500 mt-0.5">AI 학습 데이터 기반 · 실시간 웹 검색과 다를 수 있음</p>
                  </div>
                </div>
              </div>

            </div>

            {/* 그룹 B */}
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-base font-black text-gray-800 break-keep">학원·병원·법무사·부동산·쇼핑 등</p>
                </div>
                <span className="flex-shrink-0 ml-3 px-3 py-1 rounded-full text-sm font-bold bg-blue-600 text-white whitespace-nowrap">3채널</span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-3 rounded-xl bg-white border border-blue-100 px-4 py-3">
                  <span className="text-blue-500 text-base font-bold mt-0.5 flex-shrink-0">✅</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">네이버 AI 브리핑 (정보형)</p>
                    <p className="text-sm text-gray-500">블로그·콘텐츠가 출처로 채택되면 지금도 노출 가능</p>
                    <p className="text-sm text-gray-500 mt-0.5">플레이스형(가게 카드 요약)은 연내 두 자릿수 업종 확대 예정 (네이버 공식)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-white border border-blue-100 px-4 py-3">
                  <span className="text-blue-500 text-base font-bold mt-0.5 flex-shrink-0">✅</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">네이버 AI탭 답변</p>
                    <p className="text-sm text-gray-500">검색결과 &apos;AI&apos; 탭 클릭 시 등장하는 AI 답변</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-white border border-blue-100 px-4 py-3">
                  <span className="text-blue-500 text-base font-bold mt-0.5 flex-shrink-0">✅</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">ChatGPT·Gemini·Google AI 답변</p>
                    <p className="text-sm text-gray-500">글로벌 AI 인용 여부를 측정합니다 (노출 보장 아님)</p>
                    <p className="text-sm text-gray-500 mt-0.5">AI 학습 데이터 기반 · 실시간 웹 검색과 다를 수 있음</p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-blue-700 bg-blue-100 rounded-lg px-3 py-2 font-medium">
                모든 업종의 AI 노출 준비도를 진단합니다
              </p>
            </div>
          </div>

          {/* PART 3 — 개선 방법은 동일 */}
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 md:p-8">
            <h3 className="text-lg md:text-xl font-black text-gray-900 text-center mb-2">
              개선 방법은 업종 관계없이 같습니다
            </h3>
            <p className="text-sm text-gray-500 text-center mb-4">스마트플레이스 설정부터 시작하면, AI 채널이 자동으로 커버됩니다</p>

            {/* SEO + AI 연결 메시지 */}
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 mb-4 text-center">
              <p className="text-sm font-semibold text-green-800 break-keep">
                스마트플레이스·블로그를 잘 관리하면 <strong>네이버 검색 상위노출</strong>에도 효과가 있습니다
              </p>
              <p className="text-sm text-green-700 mt-1 break-keep">
                스마트플레이스 → 네이버 플레이스 탭 순위 상승 / 블로그 → VIEW탭 상위 노출 → AI 브리핑·AI탭 노출 가능성도 함께 높아집니다
              </p>
              <p className="text-sm text-green-600 mt-1.5">네이버 검색 순위는 네이버 알고리즘이 결정하며 보장되지 않습니다</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl bg-white border border-blue-200 px-5 py-4">
              <p className="text-sm md:text-base font-bold text-gray-800 break-keep text-center sm:text-left">
                AEOlab이 4가지를 자동 점검하고 개선 순서를 알려드립니다
              </p>
              <Link
                href="/trial"
                className="flex-shrink-0 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors hover:bg-[#1D4ED8] whitespace-nowrap"
                style={{ background: "#2563EB" }}
              >
                무료 진단 시작 →
              </Link>
            </div>
          </div>

          </MobileAccordion>
        </div>
      </section>

      {/* ── 1-A2. 메커니즘 — 점검→개선→AI노출 인과관계 ── */}
      <section className="px-4 py-10 md:py-14" style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}>
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="AI가 내 가게를 추천하는 4가지 기준 — 작동 원리 보기">
          <div className="text-center mb-10">
            <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>AEOlab 작동 원리</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight break-keep" style={{ color: "#0F172A", letterSpacing: "-0.6px" }}>
              AI가 내 가게를 추천하는 기준은<br className="hidden md:block" /> 4가지입니다
            </h2>
            <p className="mt-3 text-sm md:text-base break-keep max-w-xl mx-auto" style={{ color: "#475569" }}>
              스마트플레이스 완성도·리뷰·키워드·블로그 콘텐츠 — 이 4가지가 충실할수록 AI가 신뢰할 수 있는 가게로 인식하고 추천합니다.
            </p>
          </div>

          {/* 3단계 흐름 */}
          <div className="relative">
            {/* 연결선 (PC) */}
            <div className="hidden md:block absolute top-[52px] left-[calc(16.66%+16px)] right-[calc(16.66%+16px)] h-0.5" style={{ background: "linear-gradient(90deg, #BFDBFE 0%, #A5B4FC 50%, #BFDBFE 100%)" }} aria-hidden="true" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
              {/* ① AI 기준 */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-[104px] h-[104px] rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-md" style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)", border: "2px solid #BFDBFE" }}>
                    <span className="text-2xl">📋</span>
                    <span className="text-sm font-bold text-blue-700">스마트플레이스</span>
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-sm font-black text-white" style={{ background: "#2563EB" }}>①</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">AI는 4가지 기준으로 가게를 판단합니다</h3>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 w-full text-left">
                  <p className="text-sm font-semibold text-blue-700 mb-1.5">AI 추천 4대 기준</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "① 스마트플레이스", desc: "소개글·사진·소식·예약 연동 완성도" },
                      { label: "② 리뷰", desc: "리뷰 수 + 사장님 답변율" },
                      { label: "③ 키워드", desc: "업종 관련 키워드 소개글·소식 포함 여부" },
                      { label: "④ 블로그·외부 콘텐츠", desc: "네이버 블로그·SNS 등 온라인 언급량" },
                    ].map(({ label, desc }) => (
                      <div key={label} className="flex items-start gap-1.5">
                        <span className="text-blue-600 text-sm font-bold flex-shrink-0 mt-0.5">{label}</span>
                        <span className="text-sm text-gray-600 break-keep">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ② AEOlab 점검 */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-[104px] h-[104px] rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-md" style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", border: "2px solid #A5B4FC" }}>
                    <span className="text-2xl">🔍</span>
                    <span className="text-sm font-bold text-indigo-700">AEOlab 진단</span>
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-sm font-black text-white" style={{ background: "#6366F1" }}>②</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">AEOlab이 내 가게를 자동 점검합니다</h3>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 w-full text-left">
                  <p className="text-sm font-semibold text-indigo-700 mb-1.5">자동 진단 내용</p>
                  <div className="space-y-1">
                    {["항목별 노출 상태 진단 (양호·보통·주의)", "경쟁사 대비 부족한 부분 파악", "ChatGPT·Gemini 실제 언급 횟수", "키워드 노출 현황 분석", "개선 우선순위 자동 제시"].map(item => (
                      <div key={item} className="flex items-center gap-1.5">
                        <span className="text-indigo-400 text-sm flex-shrink-0">▸</span>
                        <span className="text-sm text-gray-700 break-keep">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ③ AI 노출 증가 */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-[104px] h-[104px] rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-md" style={{ background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)", border: "2px solid #6EE7B7" }}>
                    <span className="text-2xl">📈</span>
                    <span className="text-sm font-bold text-green-700">AI 노출 증가</span>
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-sm font-black text-white" style={{ background: "#059669" }}>③</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">개선하면 AI 추천 가능성이 높아집니다</h3>
                <div className="rounded-xl border border-green-100 bg-green-50 p-3 w-full text-left">
                  <p className="text-sm font-semibold text-green-700 mb-1.5">개선 후 결과</p>
                  <div className="space-y-1">
                    {["네이버 AI 브리핑 상단 노출 (음식점·카페 등)", "네이버 AI탭 답변에 내 가게 등장", "ChatGPT·Gemini 현황 정기 모니터링", "매주 자동 점검으로 노출 지속 유지", "경쟁사 대비 AI 노출 준비도 우위 확보"].map(item => (
                      <div key={item} className="flex items-center gap-1.5">
                        <span className="text-green-500 text-sm flex-shrink-0">✓</span>
                        <span className="text-sm text-gray-700 break-keep">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 요약 + CTA */}
          <div className="mt-8 rounded-2xl p-5 md:p-6 text-center" style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #4F46E5 100%)" }}>
            <p className="text-base md:text-lg font-black text-white mb-1 break-keep">
              스마트플레이스·리뷰·키워드·블로그를 함께 관리하면 AI 추천 가능성이 높아집니다
            </p>
            <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.75)" }}>
              AEOlab이 4가지 기준을 자동 점검하고 개선 순서를 알려드립니다 — 1분 무료 진단
            </p>
            <a
              href="/trial"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-blue-700 bg-white hover:bg-blue-50 transition-colors"
            >
              무료 진단 시작 →
            </a>
          </div>
          </MobileAccordion>
        </div>
      </section>

      {/* ── 4. HOW CUSTOMERS — AI 브리핑 3단계 (#F8FAFC) ── */}
      <section className="px-4 py-12 md:py-20" style={{ background: "#F8FAFC" }}>
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="요즘 손님은 네이버 AI 추천 목록을 봅니다 — 자세히 보기">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <span className="inline-flex items-center gap-2 mb-3">
              <span className="text-sm font-bold tracking-widest" style={{ color: "#2563EB" }}>네이버 AI 브리핑 상세</span>
              <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">음식점·카페·베이커리·바·숙박 전용</span>
            </span>
            <h2
              className="text-2xl md:text-3xl font-black tracking-tight break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              요즘 손님은 네이버 AI 추천 목록을 봅니다
            </h2>
            <p className="text-sm mt-2 break-keep max-w-xl mx-auto" style={{ color: "#475569" }}>
              네이버 검색 상단에 자동으로 노출되는 AI 추천 박스 — 음식점·카페·베이커리·바·숙박 전용
            </p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold" style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
              <span>📈</span>
              <span>AI 브리핑 도입 후 조건이 담긴 자세한 검색(롱테일 쿼리) <strong>약 2배 증가</strong> — 네이버 공식 발표 (2026-01-09, 머니투데이)</span>
            </div>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-5">
            {/* PC 전용 카드 사이 화살표 */}
            <div
              className="hidden md:flex absolute top-[44px] left-[calc(33.33%+2px)] items-center justify-center z-10"
              style={{ width: "calc(33.33% - 4px)" }}
              aria-hidden="true"
            >
              <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
                <path d="M 0 8 L 32 8" stroke="#BFDBFE" strokeWidth="2" />
                <path d="M 28 4 L 36 8 L 28 12" stroke="#BFDBFE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <div
              className="hidden md:flex absolute top-[44px] left-[calc(66.66%+2px)] items-center justify-center z-10"
              style={{ width: "calc(33.33% - 4px)" }}
              aria-hidden="true"
            >
              <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
                <path d="M 0 8 L 32 8" stroke="#BFDBFE" strokeWidth="2" />
                <path d="M 28 4 L 36 8 L 28 12" stroke="#BFDBFE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>

            {/* ① 손님 검색 */}
            <div
              className="card-hover fade-up bg-white rounded-xl p-4 border"
              style={{ borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
            >
              <p className="text-sm font-bold mb-2" style={{ color: "#64748B" }}>
                ① 손님이 네이버에서 검색
              </p>
              <div className="rounded-xl p-3 border mb-2" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
                <div className="flex items-center gap-2 bg-white border rounded-lg px-2.5 py-1.5" style={{ borderColor: "#E2E8F0" }}>
                  <span className="text-green-600 font-black text-sm shrink-0">N</span>
                  <span className="text-sm flex-1 truncate" style={{ color: "#1E293B" }}>"강남 분위기 좋은 카페"</span>
                  <span className="text-sm shrink-0" style={{ color: "#64748B" }}>예시</span>
                </div>
              </div>
              <p className="text-sm" style={{ color: "#64748B" }}>매일 수백만 건의 지역 검색 발생</p>
            </div>

            {/* ② AI 브리핑 노출 */}
            <div
              className="card-hover fade-up bg-white rounded-xl p-4 border"
              style={{ borderColor: "#BFDBFE", boxShadow: FLOAT_SHADOW }}
            >
              <p className="text-sm font-bold mb-2" style={{ color: "#2563EB" }}>
                ② 네이버 AI 브리핑에 노출
              </p>
              <div className="rounded-xl p-3 border mb-2" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
                <p className="text-sm font-bold mb-1.5" style={{ color: "#2563EB" }}>
                  AI 추천 카페{" "}
                  <span className="text-sm font-normal" style={{ color: "#475569" }}>예시</span>
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-white rounded-lg px-2.5 py-1.5" style={{ background: "#2563EB" }}>
                    <span className="font-bold shrink-0">1</span>
                    <span className="font-bold">○○카페</span>
                    <span className="ml-auto shrink-0" style={{ color: "rgba(255,255,255,0.7)" }}>분위기 최고</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm px-2 py-0.5" style={{ color: "#64748B" }}>
                    <span>2</span><span>△△커피</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm px-2 py-0.5" style={{ color: "#64748B" }}>
                    <span>3</span><span>□□라운지</span>
                  </div>
                </div>
              </div>
              <p className="text-sm font-bold" style={{ color: "#2563EB" }}>1위 노출 시 클릭 +27.4%</p>
              <p className="text-sm" style={{ color: "#64748B" }}>네이버 공식 발표 · 음식점 기준 · 업종·지역에 따라 다를 수 있음</p>
            </div>

            {/* ③ 손님 방문 */}
            <div
              className="card-hover fade-up bg-white rounded-xl p-4 border"
              style={{ borderColor: "#6EE7B7", boxShadow: FLOAT_SHADOW }}
            >
              <p className="text-sm font-bold mb-2" style={{ color: "#059669" }}>
                ③ 광고 없이 손님 방문
              </p>
              <div className="rounded-xl p-3 border mb-2 text-center py-4" style={{ background: "#ECFDF5", borderColor: "#6EE7B7" }}>
                <svg className="w-8 h-8 mx-auto mb-1.5" fill="none" stroke="#059669" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <p className="text-sm font-black" style={{ color: "#065F46" }}>우리 가게 선택!</p>
                <p className="text-sm mt-0.5" style={{ color: "#059669" }}>AI 추천 → 신뢰 → 방문</p>
              </div>
              <p className="text-sm" style={{ color: "#64748B" }}>신뢰 있는 가게일수록 AI 추천 가능성이 높아집니다</p>
            </div>
          </div>

          <p className="text-center text-sm fade-up break-keep" style={{ color: "#64748B" }}>
            음식점·카페·베이커리·바·숙박업 등 플레이스형 네이버 AI 브리핑 대상 업종 기준 ·{" "}
            <strong style={{ color: "#6366F1" }}>그 외 업종도 블로그·콘텐츠 채택 시 정보형 AI 브리핑 노출 가능 + AI탭(업종 제한 발표 없음, 2026-06-25 정식 출시) + ChatGPT·Gemini·Google AI 가이드 자동 제공</strong>
          </p>
          <p className="text-center text-sm mt-2 fade-up break-keep" style={{ color: "#94A3B8" }}>
            AI 브리핑 노출은 네이버 알고리즘 기준으로 보장되지 않으며, 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
          </p>
          </MobileAccordion>
        </div>
      </section>

      {/* ── 4-B. AI탭 — 모든 업종 가능 (#FFFFFF) ──
            AI 브리핑(§4)이 업종 제한이 있어 비대상 업종 방문자가 이탈하는 문제를 보완하는 섹션.
            네이버 AI 브리핑과 네이버 AI탭은 다른 노출 경로임을 명확히 안내. */}
      <section className="px-4 py-12 md:py-16" style={{ background: "#FFFFFF" }}>
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="네이버 AI탭이란? 모든 업종 노출 가능 — 자세히 보기">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#6366F1" }}>
              네이버 AI탭 (검색결과 새 탭)
            </p>
            <h2
              className="text-2xl md:text-3xl font-black tracking-tight break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              업종 제한 발표 없음, 2026-06-25 정식 출시 — AI 브리핑과 다른 경로
            </h2>
            <p className="text-sm mt-2 break-keep max-w-2xl mx-auto" style={{ color: "#475569" }}>
              2026-04-27 베타 출시 · 2026-06-25 정식 출시 (네이버 공식)
            </p>
          </div>

          {/* 비대상 업종 안심 callout — 학원·병원·미용실 등 방문자 이탈 방지 */}
          <div
            className="rounded-xl p-4 md:p-5 border mb-5 fade-up"
            style={{ borderColor: "#A5B4FC", background: "#EEF2FF" }}
          >
            <p className="text-sm md:text-base font-bold break-keep text-center" style={{ color: "#3730A3" }}>
              학원·병원·미용실·헬스장·법무사 등 — 플레이스형 AI 브리핑 비대상이어도 정보형 AI 브리핑과 <span style={{ color: "#6366F1" }}>AI탭</span> 노출을 준비할 수 있습니다
            </p>
          </div>

          {/* AI 브리핑 vs AI탭 상세 비교 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">

            {/* ── AI 브리핑 카드 ── */}
            <div className="rounded-xl border-2 fade-up overflow-hidden" style={{ borderColor: "#BFDBFE", boxShadow: FLOAT_SHADOW }}>
              {/* 헤더 */}
              <div className="px-5 py-4" style={{ background: "#1D4ED8" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔵</span>
                  <h3 className="text-base font-black text-white">네이버 AI 브리핑</h3>
                </div>
                <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                  검색하면 상단에 자동으로 뜨는 AI 추천 박스
                </p>
              </div>

              <div className="p-5" style={{ background: "#EFF6FF" }}>
                {/* 노출 대상 업종 */}
                <div className="mb-4">
                  <p className="text-sm font-bold text-blue-700 mb-2 uppercase tracking-wide">노출 대상 업종</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: "🍽️", label: "음식점" },
                      { icon: "☕", label: "카페" },
                      { icon: "🥐", label: "베이커리" },
                      { icon: "🍺", label: "바·주점" },
                      { icon: "🏨", label: "숙박" },
                    ].map(({ icon, label }) => (
                      <span key={label} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold" style={{ background: "#DBEAFE", color: "#1E40AF" }}>
                        {icon} {label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-sm px-2 py-0.5 rounded-full font-semibold" style={{ background: "#FEE2E2", color: "#9F1239" }}>✕ 프랜차이즈 가맹점 제외</span>
                    <span className="text-sm text-gray-500">(네이버 공식 정책)</span>
                  </div>
                </div>

                {/* 특징 */}
                <div>
                  <p className="text-sm font-bold text-blue-700 mb-2 uppercase tracking-wide">채널 특징</p>
                  <div className="space-y-2">
                    {[
                      { icon: "📍", text: "검색 결과 최상단 — 광고 영역 위에 자동 표시" },
                      { icon: "🚫", text: "광고비 없이 지속 노출 (알고리즘 기반)" },
                      { icon: "📝", text: "핵심 조건: 소개글·소식·리뷰 확보 (임계값 네이버 비공개)" },
                    ].map(({ icon, text }) => (
                      <div key={text} className="flex items-start gap-2">
                        <span className="flex-shrink-0 text-sm">{icon}</span>
                        <span className="text-sm text-gray-700 break-keep">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── AI탭 카드 ── */}
            <div className="rounded-xl border-2 fade-up overflow-hidden" style={{ borderColor: "#A5B4FC", boxShadow: FLOAT_SHADOW }}>
              {/* 헤더 */}
              <div className="px-5 py-4" style={{ background: "#4F46E5" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🟣</span>
                  <h3 className="text-base font-black text-white">네이버 AI탭</h3>
                  <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}>정식 출시</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                  검색 탭에서 &apos;AI&apos;를 클릭하면 나오는 AI 답변
                </p>
              </div>

              <div className="p-5" style={{ background: "#EEF2FF" }}>
                {/* 노출 대상 업종 */}
                <div className="mb-4">
                  <p className="text-sm font-bold text-indigo-700 mb-2 uppercase tracking-wide">노출 대상 업종</p>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: "#E0E7FF" }}>
                    <p className="text-sm font-black text-indigo-800">🏢 업종 제한 발표 없음 · 정식 출시</p>
                    <p className="text-sm text-indigo-600 mt-0.5">장소 기반 모든 업종 가능 · 베타 첫 달 이용자 300만 달성(2026.05) · 2026-06-25 정식 출시</p>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-sm px-2 py-0.5 rounded-full font-semibold" style={{ background: "#D1FAE5", color: "#065F46" }}>✓ 프랜차이즈 가맹점도 가능</span>
                  </div>
                </div>

                {/* 특징 */}
                <div>
                  <p className="text-sm font-bold text-indigo-700 mb-2 uppercase tracking-wide">채널 특징</p>
                  <div className="space-y-2">
                    {[
                      { icon: "👆", text: "검색 결과 탭에서 'AI' 클릭 시 답변에 내 가게 등장" },
                      { icon: "🌐", text: "업종 제한 발표 없음 — 장소 기반 모든 업종 가능" },
                      { icon: "📝", text: "노출 기준: 소개글, 사진, 예약 연동, 블로그 UGC" },
                    ].map(({ icon, text }) => (
                      <div key={text} className="flex items-start gap-2">
                        <span className="flex-shrink-0 text-sm">{icon}</span>
                        <span className="text-sm text-gray-700 break-keep">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 안내 박스: AEOlab은 두 경로 모두 측정·가이드 */}
          <div
            className="rounded-xl p-4 md:p-5 border text-center fade-up"
            style={{ borderColor: "#C7D2FE", background: "#EEF2FF" }}
          >
            <p className="text-sm md:text-base font-bold mb-2" style={{ color: "#3730A3" }}>
              AEOlab은 내 업종에 맞는 채널을 자동으로 파악해 가이드합니다
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm">
              <span className="rounded-full px-3 py-1 font-semibold" style={{ background: "#BFDBFE", color: "#1E40AF" }}>
                AI 브리핑 대상 업종 → AI 브리핑 5단계 가이드
              </span>
              <span className="hidden sm:inline text-gray-500">|</span>
              <span className="rounded-full px-3 py-1 font-semibold" style={{ background: "#C7D2FE", color: "#3730A3" }}>
                그 외 업종 → AI탭 + ChatGPT·Gemini·Google AI 가이드
              </span>
            </div>
          </div>

          <p className="text-center text-sm mt-4 fade-up break-keep" style={{ color: "#94A3B8" }}>
            AI 브리핑·AI탭 노출은 네이버 알고리즘 기준이며 보장되지 않습니다. 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
          </p>
          </MobileAccordion>
        </div>
      </section>

      {/* ── 1-B. INLINE KEYWORD WIDGET — 가입 없이 즉시 체험 ── */}
      <InlineKeywordWidget />

      {/* ── 5. HOW AEOLAB — 대시보드 스크롤 연동 (#FFFFFF) ── */}
      <div className="px-4 py-10 md:p-0">
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="AEOlab이 실제로 어떻게 작동하는지 — 자세히 보기">
            <HowAeolabIntegrated />
          </MobileAccordion>
        </div>
      </div>

      {/* ── 5-A. 서비스 기능 명시 — AEOlab이 제공하는 것 ── */}
      <section className="px-4 py-10 md:py-14" style={{ background: "#F8FAFC", borderTop: "1px solid #E2E8F0" }}>
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="구독하면 이런 기능을 사용할 수 있습니다 — 9가지 기능 보기">
          <div className="text-center mb-8">
            <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>AEOlab 제공 기능</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight break-keep" style={{ color: "#0F172A", letterSpacing: "-0.6px" }}>
              구독하면 이런 기능을 사용할 수 있습니다
            </h2>
            <p className="mt-2 text-sm md:text-base text-gray-500 break-keep">
              진단·경쟁사 비교·소개글 생성·블로그 진단·리뷰 답변·성장 리포트·알림까지 — AI 검색 노출에 필요한 모든 것
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[
              {
                icon: "🔍",
                title: "AI 노출 자동 스캔",
                desc: "네이버 AI·ChatGPT·Gemini·Google AI 4개 채널에서 내 가게가 실제로 몇 번 언급되는지 자동 측정",
                badge: "핵심",
                badgeColor: "#2563EB",
              },
              {
                icon: "📊",
                title: "AI 노출 진단 & 추세",
                desc: "스마트플레이스·리뷰·키워드·콘텐츠를 종합 진단. 양호·보통·주의 단계로 상태 파악, 30일 추세 그래프로 변화 추적",
                badge: null,
                badgeColor: "",
              },
              {
                icon: "🏆",
                title: "경쟁사 비교 분석",
                desc: "인근 경쟁 가게들의 AI 노출 상태와 내 가게를 비교. 내가 어느 위치인지 순위로 확인",
                badge: null,
                badgeColor: "",
              },
              {
                icon: "📝",
                title: "AI 맞춤 개선 가이드",
                desc: "내 가게 노출 진단과 경쟁사 분석을 바탕으로 AI가 우선순위 높은 개선 항목을 순서대로 안내",
                badge: "인기",
                badgeColor: "#7C3AED",
              },
              {
                icon: "✍️",
                title: "소개글 · 콘텐츠 자동 생성",
                desc: "AI가 내 업종에 맞는 스마트플레이스 소개글 초안을 자동 작성. 검색 태그·FAQ·소식 콘텐츠도 생성",
                badge: "Basic+",
                badgeColor: "#059669",
              },
              {
                icon: "📰",
                title: "블로그 진단",
                desc: "내 블로그 포스트가 네이버 AI 브리핑에 실제로 인용되고 있는지 포스트 단위로 확인. 4채널 인용 현황·경쟁사 비교로 개선 방향 제시",
                badge: null,
                badgeColor: "",
              },
              {
                icon: "💬",
                title: "리뷰 답변 초안 자동 생성",
                desc: "손님 리뷰에 AI가 자동으로 맞춤 답변 초안 작성. 리뷰 키워드 분석 및 감정 파악 포함",
                badge: "Basic+",
                badgeColor: "#059669",
              },
              {
                icon: "📈",
                title: "성장 리포트",
                desc: "월간 AI 노출 성장 추이 분석. 행동-결과 타임라인으로 어떤 개선이 노출에 영향을 미쳤는지 확인",
                badge: null,
                badgeColor: "",
              },
              {
                icon: "🔑",
                title: "키워드 순위 추적",
                desc: "설정한 키워드가 네이버에서 몇 위에 노출되는지 자동 측정. 주 1회 업데이트",
                badge: null,
                badgeColor: "",
              },
              {
                icon: "🔔",
                title: "카카오 노출 변화 알림",
                desc: "노출 상태가 변화하면 카카오톡으로 즉시 알림. 경쟁사 변화도 감지해 알려드림",
                badge: null,
                badgeColor: "",
              },
              {
                icon: "🛡️",
                title: "AI 광고 대비",
                desc: "AI 검색 광고 환경 변화 대응 전략 가이드. 광고 없이도 AI 추천 상위에 오를 수 있는 방법 분석",
                badge: "Pro+",
                badgeColor: "#7C3AED",
              },
            ].map(({ icon, title, desc, badge, badgeColor }) => (
              <div key={title} className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <span className="text-xl sm:text-2xl">{icon}</span>
                  {badge && (
                    <span className="text-sm font-bold px-2 py-0.5 rounded-full text-white" style={{ background: badgeColor }}>
                      {badge}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-snug break-keep line-clamp-3 sm:line-clamp-none">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm font-semibold text-blue-800 break-keep">
              Basic 첫 달 5,950원부터 시작 · 7일 이내 미사용 시 100% 환불
            </p>
            <a href="/signup" className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors" style={{ background: "#2563EB" }}>
              지금 시작 →
            </a>
          </div>
          </MobileAccordion>
        </div>
      </section>

      {/* ── 5-B. DASHBOARD PREVIEW — 구독 가치 미리보기 (#F8FAFC) ── */}
      <section className="py-12 md:py-16 px-4" style={{ background: "#F8FAFC" }}>
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="대시보드 미리보기 — 예시 화면 보기">
          <div className="text-center mb-7 fade-up">
            <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
              대시보드 미리보기
            </p>
            <h2
              className="text-2xl md:text-3xl font-black tracking-tight break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              구독하면 매주 이런 인사이트를 받게 됩니다
            </h2>
            <p className="text-sm mt-2 break-keep" style={{ color: "#475569" }}>
              자동 측정 · 카카오 알림 · AI 개선 가이드 — 한 번 설정하면 알아서 관리
            </p>
          </div>
          <DashboardPreview />
          </MobileAccordion>
        </div>
      </section>

      {/* ── 6. WHY NOT DIY — ChatGPT 직접 vs AEOlab (#F8FAFC) ── */}
      <div className="px-4 py-10 md:p-0" style={{ background: "#F8FAFC" }}>
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="무료 AI로 직접 하면 되지 않나요? — 비교 보기">
            <ChatGPTCompareSection />
          </MobileAccordion>
        </div>
      </div>

      {/* ── 7. vs OTHERS — AEO vs 기존 방법 비교 (#FFFFFF) ── */}
      <div className="px-4 py-10 md:p-0">
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="AEOlab만의 기능 — 기존 방법과 비교 보기">
            <AEOCompareSection />
          </MobileAccordion>
        </div>
      </div>

      {/* ── 8-B. FREE TOOLS — 가입 없이 체험 (#F0FDF4) ── */}
      <FreeToolsSection />

      {/* ── 1-C. AD COST CALCULATOR SECTION ── */}
      <section className="px-4 py-8 md:py-12" style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
        <div className="max-w-[1020px] mx-auto">
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5 md:p-7 flex flex-col md:flex-row items-center md:items-start gap-5 md:gap-8">
            {/* 좌측: 텍스트 */}
            <div className="flex-1 text-center md:text-left">
              <p className="text-sm font-bold tracking-widest mb-1" style={{ color: "#2563EB" }}>
                광고비 vs AEOlab
              </p>
              <h2
                className="text-xl md:text-2xl font-black break-keep mb-2"
                style={{ color: "#0F172A", letterSpacing: "-0.4px" }}
              >
                월 광고비 30만원의 30%를 AEOlab으로 대체 시
              </h2>
              <p className="text-base md:text-lg font-black break-keep mb-1" style={{ color: "#059669" }}>
                연 <span style={{ fontSize: "1.4em" }}>약 96만원</span> 절감 예상
              </p>
              <p className="text-sm" style={{ color: "#64748B" }}>
                광고비 30만원 × 30% × 12개월 − AEOlab 연 118,800원 기준 추정
              </p>
              <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
                계산 기준: 광고비의 30%를 AI 노출로 대체 가능하다고 가정 · 실제 효과는 업종·지역·경쟁 강도에 따라 다릅니다
              </p>
            </div>

            {/* 우측: CTA */}
            <div className="flex flex-col items-center md:items-start gap-3 shrink-0">
              <Link
                href="/tools/ad-cost-calculator"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
                style={{ background: "#2563EB" }}
              >
                직접 계산해보기 →
              </Link>
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                내 광고비로 계산
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. FAQ (#F8FAFC) ── */}
      <div style={{ background: "#F8FAFC" }}>
        <FAQSection />
      </div>
      {/* FAQ 하단 소프트 CTA */}
      <div className="text-center py-5 px-4 fade-up" style={{ background: "#F8FAFC", borderTop: "1px solid #E2E8F0" }}>
        <p className="text-sm" style={{ color: "#475569" }}>
          아직 망설이고 있다면,{" "}
          <a href="/trial" className="font-bold underline" style={{ color: "#7C3AED" }}>
            1분 무료 진단
          </a>
          은 회원가입 없이 바로 가능합니다
        </p>
      </div>

      {/* ── 8. PRICE — 가격 앵커 (#EFF6FF) ── */}
      <section className="py-12 md:py-20 px-4" style={{ background: "#EFF6FF", borderTop: "1px solid #BFDBFE" }}>
        <PricingAnchorTracker />
        <div className="max-w-[1020px] mx-auto">
          <div className="grid grid-cols-2 gap-3 md:gap-6 items-center">
            <div
              className="text-center border-r pr-3 md:pr-6"
              style={{ borderColor: "#BFDBFE" }}
            >
              <p className="text-sm mb-0.5 font-medium" style={{ color: "#94A3B8" }}>네이버 광고</p>
              <p
                className="text-2xl md:text-3xl lg:text-4xl font-black line-through break-keep"
                style={{
                  color: "#94A3B8",
                  fontFamily: "var(--font-pretendard,'Pretendard Variable',sans-serif)",
                }}
              >
                월 30~<br className="sm:hidden" />100만원+
              </p>
              <p className="text-sm mt-0.5" style={{ color: "#94A3B8" }}>끊으면 사라짐</p>
            </div>
            <div className="text-center pl-3 md:pl-6">
              <p className="text-sm font-bold mb-0.5 tracking-wider" style={{ color: "#2563EB" }}>AEOlab</p>
              <p
                className="text-2xl md:text-3xl lg:text-4xl font-black"
                style={{
                  color: "#0F172A",
                  letterSpacing: "-1px",
                  fontFamily: "var(--font-pretendard,'Pretendard Variable',sans-serif)",
                }}
              >
                월 11,900원
              </p>
              <span
                className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full mt-1"
                style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #6EE7B7" }}
              >
                ✓ 첫 달 5,950원
              </span>
              <p className="text-sm mt-2" style={{ color: "#475569" }}>광고 없이<br className="sm:hidden" /> AI 노출 시작</p>
              <div className="flex items-center gap-1 mt-2 flex-wrap justify-center">
                <span
                  className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full border"
                  style={{ color: "#065F46", background: "#ECFDF5", borderColor: "#6EE7B7" }}
                >
                  <Check size={10} strokeWidth={2.5} />7일 내 환불 가능
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/pricing"
              className="inline-block text-white text-base font-bold px-7 py-3 rounded-xl transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                boxShadow: "0 4px 20px rgba(124,58,237,0.30)",
              }}
            >
              요금제 보기 →
            </Link>
            <p className="text-sm mt-1.5" style={{ color: "#475569" }}>
              Basic 첫 달 5,950원 · 7일 이내 미사용 시 100% 환불
            </p>
          </div>
        </div>
      </section>

      {/* ── 9-C. AGENCY SERVICE — 대행 서비스 (#FFFBEB) ── */}
      <div className="px-4 py-10 md:p-0">
        <div className="max-w-[1020px] mx-auto">
          <MobileAccordion label="직접 할 시간이 없다면 — 전문가 대행 서비스 보기">
            <AgencyServiceSection />
          </MobileAccordion>
        </div>
      </div>

      {/* ── 10. FINAL CTA — 다크+그라디언트 ── */}
      <section
        className="py-14 md:py-20 px-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #080D1A 0%, #0F1F5C 50%, #1D4ED8 100%)" }}
      >
        {/* 배경 오브 */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div style={{ position: "absolute", width: "500px", height: "400px", top: "-80px", right: "-60px", background: "radial-gradient(ellipse at center, rgba(124,58,237,0.35) 0%, transparent 70%)", filter: "blur(60px)" }} />
          <div style={{ position: "absolute", width: "300px", height: "300px", bottom: "-40px", left: "10%", background: "radial-gradient(ellipse at center, rgba(37,99,235,0.25) 0%, transparent 70%)", filter: "blur(50px)" }} />
        </div>
        <div className="max-w-[680px] mx-auto text-center fade-up relative">
          <p className="text-sm font-bold tracking-widest mb-3" style={{ color: "#93C5FD" }}>
            지금 시작하세요
          </p>
          <h2
            className="text-2xl md:text-3xl font-black tracking-tight mb-4 leading-tight break-keep"
            style={{ color: "#FFFFFF", letterSpacing: "-0.8px" }}
          >
            손님이 우리 가게를<br />먼저 찾게 만들기
          </h2>
          {/* 배지 3개 — 아이콘 + 텍스트 */}
          <div className="flex items-center justify-center gap-4 flex-wrap mb-8">
            {[
              { icon: Lock, text: "가입 불필요" },
              { icon: CreditCard, text: "카드 없이" },
              { icon: Clock, text: "1분 소요" },
            ].map(({ icon: Icon, text }) => (
              <span
                key={text}
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                <Icon size={14} strokeWidth={2} />
                {text}
              </span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <TrackedCTA
              href="/trial"
              location="final"
              label="trial_start"
              className="inline-flex items-center gap-2 text-sm md:text-base font-bold px-8 py-3.5 rounded-xl transition-all hover:scale-105 hover:shadow-lg"
              style={{ background: "#FFFFFF", color: "#0F172A", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
            >
              1분 무료 진단 시작
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </TrackedCTA>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-sm font-medium px-6 py-3.5 rounded-xl border transition-colors hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.88)", borderColor: "rgba(255,255,255,0.20)" }}
            >
              요금제 보기
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />

      {/* 모바일 전용 FAQ floating 버튼 (랜딩 페이지 한정) */}
      <HelpFAQFloat />
    </main>
  );
}
