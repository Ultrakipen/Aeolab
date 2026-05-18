import Link from "next/link";
import { Check, Lock, CreditCard, Clock } from "lucide-react";
import HeroSection from "@/components/landing/HeroSection";
import ChatGPTCompareSection from "@/components/landing/ChatGPTCompareSection";
import AEOCompareSection from "@/components/landing/AEOCompareSection";
import DashboardPreview from "@/components/landing/DashboardPreview";
import TrackedCTA from "@/components/analytics/TrackedCTA";
import PricingAnchorTracker from "@/components/analytics/PricingAnchorTracker";
import FAQSection from "@/components/landing/FAQSection";
import FreeToolsSection from "@/components/landing/FreeToolsSection";
import AgencyServiceSection from "@/components/landing/AgencyServiceSection";
import InlineKeywordWidget from "@/components/landing/InlineKeywordWidget";
import { HowAeolabIntegrated } from "@/components/landing/HowAeolabIntegrated";
import { createClient } from "@/lib/supabase/server";
import { LandingLogout } from "./LandingLogout";
import { SiteFooter } from "@/components/common/SiteFooter";
import LandingScrollAnimation from "@/components/landing/LandingScrollAnimation";
import ChannelDifferentiationCard from "@/components/common/ChannelDifferentiationCard";

const FLOAT_SHADOW = "var(--aeo-shadow-float)";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
          <div className="flex items-center gap-1">
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
              className="hidden sm:flex items-center text-sm ml-2 px-2 py-0.5 rounded-full font-medium"
              style={{ color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE" }}
            >
              AI 노출 관리
            </span>
          </div>

          {/* 네비게이션 */}
          <nav className="flex items-center gap-0.5">
            <Link
              href="/how-it-works"
              className="hidden lg:inline-block text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50"
              style={{ color: "#475569" }}
            >
              서비스 안내
            </Link>
            <Link
              href="/pricing"
              className="hidden md:inline-block text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50"
              style={{ color: "#475569" }}
            >
              요금제
            </Link>
            <Link
              href="/faq"
              className="hidden md:inline-block text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50"
              style={{ color: "#475569" }}
            >
              FAQ
            </Link>
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50"
                  style={{ color: "#475569" }}
                >
                  대시보드
                </Link>
                <LandingLogout email={user.email ?? ""} />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-block text-sm font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50"
                  style={{ color: "#475569" }}
                >
                  로그인
                </Link>
                <Link
                  href="/trial"
                  className="ml-1.5 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors hover:bg-[#1D4ED8]"
                  style={{ background: "#2563EB" }}
                >
                  무료 진단
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── 1. HERO ── */}
      <HeroSection />

      {/* ── 1-A. CHANNEL DIFFERENTIATION — 이탈 방지 (비로그인 방문자) ── */}
      <section className="px-4 py-8 md:py-12" style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}>
        <div className="max-w-[1020px] mx-auto">
          <ChannelDifferentiationCard variant="landing" />
        </div>
      </section>

      {/* ── 1-B. INLINE KEYWORD WIDGET — 가입 없이 즉시 체험 ── */}
      <InlineKeywordWidget />

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
                월 광고비 30만원 → AEOlab 월 9,900원으로 대체 시
              </h2>
              <p className="text-base md:text-lg font-black break-keep mb-1" style={{ color: "#059669" }}>
                연 <span style={{ fontSize: "1.4em" }}>347만원</span> 절감 예상
              </p>
              <p className="text-sm" style={{ color: "#64748B" }}>
                광고비 30만원 × 30% × 12개월 − AEOlab 연 118,800원 기준 추정
              </p>
              <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
                절감 효과는 업종·지역·경쟁 강도에 따라 다릅니다
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

      {/* ── 2. WHY — Before / After (#FFFFFF) ── */}
      <section className="px-4 py-12 md:py-20" style={{ background: "#FFFFFF" }}>
        <div className="max-w-[1020px] mx-auto">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
              WHY AEOLAB
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
              }}>AI 브리핑은 다릅니다</span>
            </h2>
            <p className="text-sm md:text-base mt-2 break-keep max-w-xl mx-auto" style={{ color: "#475569" }}>
              네이버 광고는 돈 내는 동안만, AI 브리핑은 한 번 올라가면 광고 없이 유지됩니다
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
                  ChatGPT·Gemini에는 영향 없음
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
                  AEOlab → 네이버 AI 브리핑 등록
                </span>
                <h3 className="text-base md:text-lg font-bold mb-0.5 break-keep">
                  AI 브리핑에서 꾸준히 추천됨
                </h3>
                <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.75)" }}>월 9,900원 (광고비의 약 1/90)</p>
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
                    네이버 AI 브리핑 상위 노출 최적화
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold shrink-0">✓</span>
                    ChatGPT·Gemini·Google AI 동시 관리
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold shrink-0">✓</span>
                    광고 끊어도 AI 추천은 유지됩니다
                  </li>
                </ul>
              </div>
            </div>
          </div>
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
                <p className="text-sm font-bold mb-1.5" style={{ color: "rgba(255,255,255,0.75)" }}>음식점 적용 후 클릭률 변화</p>
                <p className="stat-number-xl text-white mb-1.5">+27.4%</p>
                <p className="text-sm md:text-base break-keep mb-1" style={{ color: "rgba(255,255,255,0.88)" }}>
                  AI 브리핑에 노출되면 손님 클릭이 늘어납니다
                </p>
                <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.75)" }}>
                  네이버 2026년 4월 공식 발표 · 음식점 카테고리 기준
                </p>
                <a
                  href="https://www.mt.co.kr/tech/2026/04/07/2026040709261836765"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/75 underline hover:text-white mt-0.5 block"
                >
                  머니투데이 보도 원문 →
                </a>
                <p className="text-sm mt-1.5 break-keep" style={{ color: "rgba(255,255,255,0.88)" }}>
                  측정 시점·지역·업종에 따라 달라질 수 있습니다
                </p>
              </div>
            </div>

            {/* 보조 카드 3개 */}
            <div className="fade-up flex flex-col gap-3">
              {[
                { num: "3,000만+", label: "AI 브리핑을 본 사람", sub: "네이버 공식 발표 2025-2026", delay: "delay-1" },
                { num: "15,000+", label: "네이버 AI 브리핑 적용 숙박업체", sub: "2026년 기준 · 네이버 공식 발표", delay: "delay-2" },
                { num: "25종+", label: "모든 업종 측정 가능", sub: "AI 탭·글로벌 AI 기준 · 업종별 채널 자동 분기", delay: "delay-3" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`card-hover count-reveal ${item.delay} bg-white rounded-xl border p-3.5 flex flex-col gap-0.5`}
                  style={{ borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
                >
                  <p
                    className="text-2xl md:text-3xl font-black leading-none"
                    style={{
                      color: "#0F172A",
                      fontFamily: "var(--font-pretendard,'Pretendard Variable',sans-serif)",
                    }}
                  >
                    {item.num}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: "#1E293B" }}>{item.label}</p>
                  <p className="text-sm" style={{ color: "#64748B" }}>{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. HOW CUSTOMERS — AI 브리핑 3단계 (#F8FAFC) ── */}
      <section className="px-4 py-12 md:py-20" style={{ background: "#F8FAFC" }}>
        <div className="max-w-[1020px] mx-auto">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
              네이버 AI 브리핑
            </p>
            <h2
              className="text-2xl md:text-3xl font-black tracking-tight break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              요즘 손님은 네이버 AI 추천 목록을 봅니다
            </h2>
            <p className="text-sm mt-2 break-keep max-w-xl mx-auto" style={{ color: "#475569" }}>
              네이버 검색 상단 AI 자동 추천 —{" "}
              <strong style={{ color: "#0F172A" }}>3,000만 명+</strong>이 매달 이용 중 (네이버 공식 발표)
            </p>
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
                  <span className="text-green-600 font-black text-xs shrink-0">N</span>
                  <span className="text-sm flex-1 truncate" style={{ color: "#1E293B" }}>"강남 분위기 좋은 카페"</span>
                  <span className="text-xs shrink-0" style={{ color: "#64748B" }}>예시</span>
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
                  <span className="text-xs font-normal" style={{ color: "#475569" }}>예시</span>
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
              <p className="text-sm" style={{ color: "#64748B" }}>광고비 없이 꾸준히 추천됩니다</p>
            </div>
          </div>

          <p className="text-center text-sm fade-up break-keep" style={{ color: "#64748B" }}>
            음식점·카페·베이커리·바·숙박업 등 네이버 AI 브리핑 대상 업종 기준 · 그 외 업종은 ChatGPT·Gemini·Google AI 노출 진단 제공
          </p>
          <p className="text-center text-sm mt-2 fade-up break-keep" style={{ color: "#94A3B8" }}>
            AI 브리핑 노출은 네이버 알고리즘 기준으로 보장되지 않으며, 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
          </p>
        </div>
      </section>

      {/* ── 4-B. AI탭 — 모든 업종 가능 (#FFFFFF) ──
            AI 브리핑(§4)이 업종 제한이 있어 비대상 업종 방문자가 이탈하는 문제를 보완하는 섹션.
            네이버 AI 브리핑과 네이버 AI탭은 다른 노출 경로임을 명확히 안내. */}
      <section className="px-4 py-12 md:py-16" style={{ background: "#FFFFFF" }}>
        <div className="max-w-[1020px] mx-auto">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#6366F1" }}>
              네이버 AI탭 (검색결과 새 탭)
            </p>
            <h2
              className="text-2xl md:text-3xl font-black tracking-tight break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              모든 업종 노출 가능 — AI 브리핑과 다른 경로
            </h2>
            <p className="text-sm mt-2 break-keep max-w-2xl mx-auto" style={{ color: "#475569" }}>
              2026-04-27 베타 출시 · 네이버플러스 구독자 우선 · 상반기 전체 확대 예정 ·{" "}
              <strong style={{ color: "#0F172A" }}>업종·프랜차이즈 제한 없음</strong>
            </p>
          </div>

          {/* 침투율·광고화 시의성 카피 — 자연 노출 선점 동기 부여 (출처: 네이트 2025-12, Daum 2026-04-30) */}
          <div
            className="rounded-xl p-4 md:p-5 border mb-6 fade-up"
            style={{ borderColor: "#FCD34D", background: "#FFFBEB" }}
          >
            <p className="text-sm md:text-base font-bold leading-relaxed break-keep text-center" style={{ color: "#92400E" }}>
              AI 브리핑은 이미 <span style={{ color: "#B45309" }}>네이버 검색 5건 중 1건</span> (2025-12 약 20% · 미디어 보도 기준).
              {" "}<span style={{ color: "#B45309" }}>2026 Q2 광고화 예정</span> — 자연 노출 자리 선점이 유리한 시점입니다.
            </p>
            <p className="text-sm mt-2 break-keep text-center" style={{ color: "#A16207" }}>
              출처: 네이트 2025-12 · Daum 2026-04-30 미디어 보도 · 네이버 공식 발표 아님 · 시점·기기에 따라 달라질 수 있음
            </p>
          </div>

          {/* AI 브리핑 vs AI탭 비교 표 — 데스크톱 2-컬럼, 모바일 세로 적층 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
            {/* 좌측: AI 브리핑 */}
            <div
              className="rounded-xl p-5 md:p-6 border fade-up"
              style={{ borderColor: "#BFDBFE", background: "#EFF6FF", boxShadow: FLOAT_SHADOW }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-black"
                  style={{ background: "#2563EB", color: "#fff" }}
                  aria-hidden="true"
                >
                  A
                </span>
                <h3 className="text-base md:text-lg font-bold" style={{ color: "#1E40AF" }}>
                  네이버 AI 브리핑
                </h3>
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: "#1E40AF" }}>
                검색 결과 상단 AI 자동 추천 박스
              </p>
              <ul className="space-y-1.5 text-sm leading-relaxed" style={{ color: "#475569" }}>
                <li>• 음식점·카페·베이커리·바·숙박 (확대 중)</li>
                <li>• 프랜차이즈 가맹점 제외 (네이버 공식)</li>
                <li>• 핵심: C-rank·D.I.A.·리뷰 10건+·소식·소개글</li>
                <li>• 2025.08 정식 출시</li>
              </ul>
            </div>

            {/* 우측: AI탭 */}
            <div
              className="rounded-xl p-5 md:p-6 border fade-up"
              style={{ borderColor: "#C7D2FE", background: "#EEF2FF", boxShadow: FLOAT_SHADOW }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-black"
                  style={{ background: "#6366F1", color: "#fff" }}
                  aria-hidden="true"
                >
                  T
                </span>
                <h3 className="text-base md:text-lg font-bold" style={{ color: "#4338CA" }}>
                  네이버 AI탭
                </h3>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ background: "#6366F1", color: "#fff" }}
                >
                  Beta
                </span>
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: "#4338CA" }}>
                검색 결과 상단 &quot;AI&quot; 탭 메뉴
              </p>
              <ul className="space-y-1.5 text-sm leading-relaxed" style={{ color: "#475569" }}>
                <li>• <strong>모든 업종 노출 가능</strong> (프랜차이즈 포함)</li>
                <li>• 네이버플러스 구독자 우선 베타</li>
                <li>• 핵심: 소개글 200자·사진 10장·예약 연동·블로그 UGC</li>
                <li>• 2026-04-27 베타 → 상반기 전체 확대 예정</li>
              </ul>
            </div>
          </div>

          {/* 안내 박스: AEOlab은 두 경로 모두 측정·가이드 */}
          <div
            className="rounded-xl p-4 md:p-5 border text-center fade-up"
            style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}
          >
            <p className="text-sm md:text-base font-bold mb-1" style={{ color: "#0F172A" }}>
              AEOlab은 두 경로를 모두 자동 측정합니다
            </p>
            <p className="text-sm break-keep" style={{ color: "#475569" }}>
              내 업종이 AI 브리핑 대상이면 5단계 가이드 · 비대상이면 AI탭 + ChatGPT·Gemini 가이드를 자동으로 분기합니다.
            </p>
          </div>

          <p className="text-center text-sm mt-4 fade-up break-keep" style={{ color: "#94A3B8" }}>
            AI 브리핑·AI탭 노출은 네이버 알고리즘 기준이며 보장되지 않습니다. 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
          </p>
        </div>
      </section>

      {/* ── 5. HOW AEOLAB — 대시보드 스크롤 연동 (#FFFFFF) ── */}
      <HowAeolabIntegrated />

      {/* ── 5-B. DASHBOARD PREVIEW — 구독 가치 미리보기 (#F8FAFC) ── */}
      <section className="py-12 md:py-16 px-4" style={{ background: "#F8FAFC" }}>
        <div className="max-w-[1020px] mx-auto">
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
        </div>
      </section>

      {/* ── 6. WHY NOT DIY — ChatGPT 직접 vs AEOlab (#F8FAFC) ── */}
      <div style={{ background: "#F8FAFC" }}>
        <ChatGPTCompareSection />
      </div>

      {/* ── 7. vs OTHERS — AEO vs 기존 방법 비교 (#FFFFFF) ── */}
      <AEOCompareSection />

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
                월 9,900원
              </p>
              <span
                className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full mt-1"
                style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #6EE7B7" }}
              >
                ✓ 첫 달 4,950원
              </span>
              <p className="text-sm mt-2" style={{ color: "#475569" }}>광고 없이<br className="sm:hidden" /> AI 노출 시작</p>
              <div className="flex items-center gap-1 mt-2 flex-wrap justify-center">
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
                  style={{ color: "#065F46", background: "#ECFDF5", borderColor: "#6EE7B7" }}
                >
                  <Check size={10} strokeWidth={2.5} />언제든 해지
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
              Basic 첫 달 4,950원 · 언제든 해지 가능
            </p>
          </div>
        </div>
      </section>

      {/* ── 8-B. FREE TOOLS — 가입 없이 체험 (#F0FDF4) ── */}
      <FreeToolsSection />

      {/* ── 8-C. AGENCY SERVICE — 대행 서비스 (#FFFBEB) ── */}
      <AgencyServiceSection />

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
    </main>
  );
}
