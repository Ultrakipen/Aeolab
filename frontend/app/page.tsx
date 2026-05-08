import Link from "next/link";
import { Check } from "lucide-react";
import HeroSection from "@/components/landing/HeroSection";
import ChatGPTCompareSection from "@/components/landing/ChatGPTCompareSection";
import AEOCompareSection from "@/components/landing/AEOCompareSection";
import DashboardPreview from "@/components/landing/DashboardPreview";
import TrackedCTA from "@/components/analytics/TrackedCTA";
import PricingAnchorTracker from "@/components/analytics/PricingAnchorTracker";
import ServiceMechanismSection from "@/components/landing/ServiceMechanismSection";
import FAQSection from "@/components/landing/FAQSection";
import { createClient } from "@/lib/supabase/server";
import { LandingLogout } from "./LandingLogout";
import { SiteFooter } from "@/components/common/SiteFooter";
import LandingScrollAnimation from "@/components/landing/LandingScrollAnimation";

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
              style={{ color: "#0F172A", fontFamily: "Outfit, sans-serif", letterSpacing: "-0.8px" }}
            >
              AEO
            </span>
            <span
              className="text-lg font-black"
              style={{ color: "#2563EB", fontFamily: "Outfit, sans-serif" }}
            >
              lab
            </span>
            <span
              className="hidden sm:flex items-center text-xs ml-2 px-2 py-0.5 rounded-full font-medium"
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

      {/* ── 1. HERO — 다크 배경 (HeroSection 자체 처리) ── */}
      <HeroSection />

      {/* ── 2. WHY — Before / After (#FFFFFF) ── */}
      <section className="px-4 py-8 md:py-12" style={{ background: "#FFFFFF" }}>
        <div className="max-w-[1020px] mx-auto">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
              WHY AEOLAB
            </p>
            <h2
              className="text-xl md:text-2xl font-black tracking-tight break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              광고 끊으면 사라집니다,{" "}
              <span style={{
                background: "linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%)",
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
              className="card-hover fade-up bg-white rounded-2xl p-5 md:p-6 border"
              style={{ borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
            >
              <span
                className="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full mb-3"
                style={{ background: "#FEF2F2", color: "#9F1239" }}
              >
                네이버 광고만 의존 시
              </span>
              <h3 className="text-base md:text-lg font-bold mb-0.5 break-keep" style={{ color: "#0F172A" }}>
                광고 끊으면 즉시 사라짐
              </h3>
              <p className="text-xs mb-3" style={{ color: "#64748B" }}>
                월 30만~100만원 (업종·경쟁도에 따라) · AI 브리핑 노출 0
              </p>
              <svg viewBox="0 0 300 100" className="w-full h-auto">
                <line x1="0" y1="75" x2="300" y2="75" stroke="#E2E8F0" strokeWidth="1" />
                <line x1="0" y1="45" x2="300" y2="45" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3,3" />
                <path d="M 0,30 L 70,27 L 140,28 L 165,27" stroke="#DC2626" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M 165,27 L 172,75" stroke="#DC2626" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="4,4" />
                <path d="M 172,75 L 300,75" stroke="#CBD5E1" strokeWidth="2" fill="none" strokeLinecap="round" />
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
              className="card-hover fade-up rounded-2xl p-5 md:p-6 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)", boxShadow: FLOAT_SHADOW }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(ellipse 60% 60% at 80% 10%,rgba(255,255,255,0.12) 0%,transparent 60%)" }}
                aria-hidden="true"
              />
              <div className="relative">
                <span className="inline-flex items-center text-xs font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-full mb-3">
                  AEOlab → 네이버 AI 브리핑 등록
                </span>
                <h3 className="text-base md:text-lg font-bold mb-0.5 break-keep">
                  AI 브리핑에서 꾸준히 추천됨
                </h3>
                <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.72)" }}>월 9,900원 (광고비의 약 1/90)</p>
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
                    <span className="font-bold shrink-0" style={{ color: "#FFFFFF" }}>✓</span>
                    네이버 AI 브리핑 상위 노출 최적화
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold shrink-0" style={{ color: "#FFFFFF" }}>✓</span>
                    ChatGPT·Gemini·Google AI 동시 관리
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold shrink-0" style={{ color: "#FFFFFF" }}>✓</span>
                    광고 끊어도 AI 추천은 유지됩니다
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. AI 브리핑 작동 원리 3단계 (#FFFFFF 연속) ── */}
      <section className="px-4 py-8 md:py-12" style={{ background: "#FFFFFF" }}>
        <div className="max-w-[1020px] mx-auto">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
              네이버 AI 브리핑
            </p>
            <h2
              className="text-xl md:text-2xl font-black tracking-tight break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              요즘 손님은 네이버 AI 추천 목록을 봅니다
            </h2>
            <p className="text-sm mt-2 break-keep max-w-xl mx-auto" style={{ color: "#475569" }}>
              네이버 검색 상단 AI 자동 추천 —{" "}
              <strong style={{ color: "#0F172A" }}>3,000만 명+</strong>이 매달 이용 중 (네이버 공식 발표)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-5">
            {/* ① 손님 검색 */}
            <div
              className="card-hover fade-up bg-white rounded-2xl p-4 border"
              style={{ borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
            >
              <p className="text-xs font-bold mb-2" style={{ color: "#64748B" }}>
                ① 손님이 네이버에서 검색
              </p>
              <div className="rounded-xl p-3 border mb-2" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
                <div className="flex items-center gap-2 bg-white border rounded-lg px-2.5 py-1.5" style={{ borderColor: "#E2E8F0" }}>
                  <span className="text-green-600 font-black text-xs shrink-0">N</span>
                  <span className="text-xs flex-1 truncate" style={{ color: "#1E293B" }}>"강남 분위기 좋은 카페"</span>
                  <span className="text-xs shrink-0" style={{ color: "#64748B" }}>예시</span>
                </div>
              </div>
              <p className="text-xs" style={{ color: "#64748B" }}>매일 수백만 건의 지역 검색 발생</p>
            </div>

            {/* ② AI 브리핑 노출 */}
            <div
              className="card-hover fade-up bg-white rounded-2xl p-4 border"
              style={{ borderColor: "#BFDBFE", boxShadow: FLOAT_SHADOW }}
            >
              <p className="text-xs font-bold mb-2" style={{ color: "#2563EB" }}>
                ② 네이버 AI 브리핑에 노출
              </p>
              <div className="rounded-xl p-3 border mb-2" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
                <p className="text-xs font-bold mb-1.5" style={{ color: "#2563EB" }}>
                  AI 추천 카페{" "}
                  <span className="text-xs font-normal" style={{ color: "#475569" }}>예시</span>
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-white rounded-lg px-2.5 py-1.5" style={{ background: "#2563EB" }}>
                    <span className="font-bold shrink-0">1</span>
                    <span className="font-bold">○○카페</span>
                    <span className="ml-auto shrink-0" style={{ color: "rgba(255,255,255,0.7)" }}>분위기 최고</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs px-2 py-0.5" style={{ color: "#64748B" }}>
                    <span>2</span><span>△△커피</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs px-2 py-0.5" style={{ color: "#64748B" }}>
                    <span>3</span><span>□□라운지</span>
                  </div>
                </div>
              </div>
              <p className="text-xs font-bold" style={{ color: "#2563EB" }}>1위 노출 시 클릭 +27.4%</p>
              <p className="text-xs" style={{ color: "#64748B" }}>네이버 공식 발표 · 음식점 기준</p>
            </div>

            {/* ③ 손님 방문 */}
            <div
              className="card-hover fade-up bg-white rounded-2xl p-4 border"
              style={{ borderColor: "#6EE7B7", boxShadow: FLOAT_SHADOW }}
            >
              <p className="text-xs font-bold mb-2" style={{ color: "#059669" }}>
                ③ 광고 없이 손님 방문
              </p>
              <div className="rounded-xl p-3 border mb-2 text-center py-4" style={{ background: "#ECFDF5", borderColor: "#6EE7B7" }}>
                <svg className="w-8 h-8 mx-auto mb-1.5" fill="none" stroke="#059669" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <p className="text-sm font-black" style={{ color: "#065F46" }}>우리 가게 선택!</p>
                <p className="text-xs mt-0.5" style={{ color: "#059669" }}>AI 추천 → 신뢰 → 방문</p>
              </div>
              <p className="text-xs" style={{ color: "#64748B" }}>광고비 없이 꾸준히 추천됩니다</p>
            </div>
          </div>

          <p className="text-center text-xs fade-up break-keep" style={{ color: "#64748B" }}>
            음식점·카페·베이커리·숙박업 등 네이버 AI 브리핑 대상 업종 기준 · 그 외 업종은 ChatGPT·Gemini·Google AI 노출 진단 제공
          </p>
        </div>
      </section>

      {/* ── 4. ChatGPT 직접 vs AEOlab 자동 비교 (#F8FAFC) ── */}
      <div style={{ background: "#F8FAFC" }}>
        <ChatGPTCompareSection />
      </div>

      {/* ── 5. AEO vs 기존 방법 비교 (#FFFFFF) ── */}
      <AEOCompareSection />

      {/* ── 6. HOW — 3단계 (#FFFFFF 연속) ── */}
      <section id="how" className="px-4 py-8 md:py-12" style={{ background: "#FFFFFF" }}>
        <div className="max-w-[1020px] mx-auto">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
              HOW IT WORKS
            </p>
            <h2
              className="text-xl md:text-2xl font-black tracking-tight break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              1분 진단, <span style={{
                background: "linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>7일 변화</span>
            </h2>
            <p className="text-sm mt-2 break-keep" style={{ color: "#475569" }}>
              복잡한 설정 없이 3단계로 시작합니다 · <span style={{ color: "#64748B" }}>7일 가이드 실행 기준, 지역·업종별 차이 있음</span>
            </p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-4 md:gap-5">
            {/* PC 전용 단계 연결선 */}
            <div
              className="hidden md:block absolute top-[52px] left-[calc(33.33%+8px)] right-[calc(33.33%+8px)] h-px"
              style={{ background: "#BFDBFE", zIndex: 0 }}
              aria-hidden="true"
            />
            {/* Step 01 */}
            <div className="fade-up text-center">
              <div
                className="card-hover bg-white rounded-xl border p-4 mb-3 text-left"
                style={{ borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-black shrink-0"
                    style={{ background: "#2563EB" }}
                  >
                    1
                  </div>
                  <span className="text-xs font-bold tracking-wider" style={{ color: "#2563EB" }}>STEP 01</span>
                </div>
                <p className="text-sm md:text-base font-bold mb-3" style={{ color: "#0F172A" }}>
                  우리 가게 입력
                </p>
                <div className="space-y-1.5">
                  {[["업종", "카페"], ["가게 이름", "○○카페"], ["동네", "강남구"]].map(([label, val]) => (
                    <div key={label} className="rounded-lg p-2.5 border" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
                      <p className="text-xs mb-0.5" style={{ color: "#64748B" }}>{label}</p>
                      <p className="text-sm font-bold" style={{ color: "#0F172A" }}>{val}</p>
                    </div>
                  ))}
                </div>
                <div
                  className="w-full text-white text-xs font-bold py-2.5 rounded-lg mt-3 text-center"
                  style={{ background: "#2563EB" }}
                >
                  진단 시작
                </div>
                <p className="text-center text-xs mt-1.5" style={{ color: "#64748B" }}>
                  1분 소요 · 가입 불필요 · 예시
                </p>
              </div>
              <h3 className="text-sm md:text-base font-bold mb-1 break-keep" style={{ color: "#0F172A" }}>
                1분 무료 진단
              </h3>
              <p className="text-xs md:text-sm leading-relaxed break-keep" style={{ color: "#475569" }}>
                업종·가게 이름만 입력하면 네이버 AI 브리핑 노출 현황부터 ChatGPT·Gemini·Google AI까지 한번에 분석합니다
              </p>
            </div>

            {/* Step 02 */}
            <div className="fade-up text-center">
              <div
                className="card-hover bg-white rounded-xl border p-4 mb-3 text-left"
                style={{ borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-black shrink-0"
                    style={{ background: "#2563EB" }}
                  >
                    2
                  </div>
                  <span className="text-xs font-bold tracking-wider" style={{ color: "#2563EB" }}>STEP 02</span>
                </div>
                <p className="text-sm md:text-base font-bold mb-3" style={{ color: "#0F172A" }}>
                  노출 현황 분석 + 개선 방향
                </p>
                <div
                  className="rounded-lg p-3 border mb-2 text-center"
                  style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
                >
                  <p className="text-xs font-bold mb-0.5" style={{ color: "#2563EB" }}>
                    네이버 AI 브리핑 노출 현황 · 예시
                  </p>
                  <p className="text-4xl font-black leading-none mb-0.5" style={{ color: "#2563EB" }}>62</p>
                  <p className="text-xs" style={{ color: "#475569" }}>100 기준 · 개선 여지 있음</p>
                </div>
                <div className="rounded-lg p-2.5 mb-1.5 border" style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
                  <p className="text-xs font-bold mb-0.5" style={{ color: "#92400E" }}>빠진 키워드 · 예시</p>
                  <p className="text-xs" style={{ color: "#92400E" }}>강남 디저트 외 2개</p>
                </div>
                <div className="rounded-lg p-2.5 border" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
                  <p className="text-xs mb-0.5" style={{ color: "#64748B" }}>이외 추가 진단</p>
                  <p className="text-xs font-bold" style={{ color: "#1E293B" }}>ChatGPT · Gemini · Google AI</p>
                </div>
              </div>
              <h3 className="text-sm md:text-base font-bold mb-1 break-keep" style={{ color: "#0F172A" }}>
                노출 현황 분석 + 개선 가이드
              </h3>
              <p className="text-xs md:text-sm leading-relaxed break-keep" style={{ color: "#475569" }}>
                네이버 AI 브리핑 노출 현황·빠진 키워드 안내 · ChatGPT·Gemini·Google AI 분석도 함께 제공
              </p>
            </div>

            {/* Step 03 */}
            <div className="fade-up text-center">
              <div
                className="card-hover bg-white rounded-xl border p-4 mb-3 text-left"
                style={{ borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-black shrink-0"
                    style={{ background: "#2563EB" }}
                  >
                    3
                  </div>
                  <span className="text-xs font-bold tracking-wider" style={{ color: "#2563EB" }}>STEP 03</span>
                </div>
                <p className="text-sm md:text-base font-bold mb-3" style={{ color: "#0F172A" }}>
                  매주 자동 점검
                </p>
                <div
                  className="rounded-lg p-3 border mb-2 text-center"
                  style={{ background: "#ECFDF5", borderColor: "#6EE7B7" }}
                >
                  <p className="text-4xl font-black leading-none mb-0.5" style={{ color: "#059669" }}>+8</p>
                  <p className="text-xs" style={{ color: "#475569" }}>한 달 전보다 · 예시</p>
                </div>
                <div className="rounded-lg p-3 border mb-2" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
                  <p className="text-xs mb-1.5" style={{ color: "#475569" }}>한 달 추세</p>
                  <svg viewBox="0 0 100 28" className="w-full h-auto">
                    <path d="M 0,23 L 20,20 L 40,16 L 60,13 L 80,9 L 100,6" stroke="#059669" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="rounded-lg p-2.5 border" style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
                  <p className="text-xs font-bold" style={{ color: "#92400E" }}>카카오 알림톡</p>
                  <p className="text-xs" style={{ color: "#92400E" }}>노출 변화 시 자동 알림</p>
                </div>
              </div>
              <h3 className="text-sm md:text-base font-bold mb-1 break-keep" style={{ color: "#0F172A" }}>
                매주 자동 점검
              </h3>
              <p className="text-xs md:text-sm leading-relaxed break-keep" style={{ color: "#475569" }}>
                매주 자동 재측정. 노출 변화를 카카오 알림톡으로 받습니다
              </p>
            </div>
          </div>

          <div className="text-center mt-8 fade-up">
            <TrackedCTA
              href="/trial"
              location="how"
              label="trial_start"
              className="inline-flex items-center gap-2 text-white text-sm font-bold px-6 py-3 rounded-xl transition-colors hover:bg-[#1D4ED8]"
              style={{ background: "#2563EB" }}
            >
              지금 무료로 시작
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </TrackedCTA>
          </div>
        </div>
      </section>

      {/* ── 7. 대시보드 미리보기 (#F8FAFC) ── */}
      <div style={{ background: "#F8FAFC" }}>
        <DashboardPreview />
      </div>

      {/* ── 8. 서비스 동작 원리 (#F8FAFC 이어지는 회색) ── */}
      <div style={{ background: "#F8FAFC" }}>
        <ServiceMechanismSection />
      </div>

      {/* ── 9. 신뢰 데이터 — Bento Grid (#FFFFFF) ── */}
      <section className="px-4 py-8 md:py-12" style={{ background: "#FFFFFF" }}>
        <div className="max-w-[1020px] mx-auto">
          <div className="text-center mb-6 md:mb-8 fade-up">
            <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
              네이버 공식 발표 데이터
            </p>
            <h2
              className="text-xl md:text-2xl font-black break-keep"
              style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
            >
              실제로 효과가 있다는 공식 근거
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* 메인 카드 — 단색 파랑 (그라디언트는 Final CTA 전용) */}
            <div
              className="card-hover fade-up md:col-span-2 rounded-2xl p-5 md:p-7 relative overflow-hidden text-white"
              style={{ background: "#1D4ED8", boxShadow: "0 8px 40px rgba(29,78,216,0.35)" }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(ellipse 80% 60% at 90% 0%,rgba(255,255,255,0.10) 0%,transparent 60%)" }}
                aria-hidden="true"
              />
              <div className="relative">
                <p className="text-xs font-bold mb-1.5" style={{ color: "rgba(255,255,255,0.75)" }}>음식점 적용 후 클릭률 변화</p>
                <p
                  className="stat-number-xl text-white mb-1.5"
                >
                  +27.4%
                </p>
                <p className="text-sm md:text-base break-keep mb-1" style={{ color: "rgba(255,255,255,0.88)" }}>
                  AI 브리핑에 노출되면 손님 클릭이 늘어납니다
                </p>
                <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.75)" }}>
                  네이버 2026년 4월 공식 발표 · 음식점 카테고리 기준
                </p>
                <a
                  href="https://www.mt.co.kr/tech/2026/04/07/2026040709261836765"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/70 underline hover:text-white mt-0.5 block"
                >
                  머니투데이 보도 원문 →
                </a>
                <p className="text-xs mt-1.5 break-keep" style={{ color: "rgba(255,255,255,0.82)" }}>
                  측정 시점·지역·업종에 따라 달라질 수 있습니다
                </p>
              </div>
            </div>

            {/* 보조 카드 3개 */}
            <div className="fade-up flex flex-col gap-3">
              {[
                { num: "3,000만+", label: "AI 브리핑을 본 사람", sub: "네이버 공식 발표 2025-2026" },
                { num: "15,000+", label: "네이버 AI 브리핑 적용 숙박업체", sub: "2026년 기준 · 네이버 공식 발표" },
                { num: "25종", label: "지원 업종 수", sub: "음식점부터 전문직까지" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="card-hover bg-white rounded-xl border p-3.5 flex flex-col gap-0.5"
                  style={{ borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
                >
                  <p
                    className="text-2xl md:text-3xl font-black leading-none"
                    style={{ color: "#0F172A", fontFamily: "Outfit, sans-serif" }}
                  >
                    {item.num}
                  </p>
                  <p className="text-xs font-semibold" style={{ color: "#1E293B" }}>{item.label}</p>
                  <p className="text-xs" style={{ color: "#64748B" }}>{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 10. 가격 앵커 (#EFF6FF 연파랑) ── */}
      <section className="py-8 md:py-12 px-4" style={{ background: "#EFF6FF", borderTop: "1px solid #BFDBFE" }}>
        <PricingAnchorTracker />
        <div className="max-w-[1020px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6 items-center">
            <div
              className="text-center sm:text-right border-b sm:border-b-0 sm:border-r pb-4 sm:pb-0 sm:pr-6"
              style={{ borderColor: "#BFDBFE" }}
            >
              <p className="text-sm mb-0.5 font-medium" style={{ color: "#94A3B8" }}>네이버 광고</p>
              <p className="text-2xl md:text-3xl font-bold line-through" style={{ color: "#94A3B8" }}>월 30~100만원+</p>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>광고 끄면 즉시 사라짐</p>
            </div>
            <div className="text-center sm:text-left sm:pl-6">
              <p className="text-sm font-bold mb-0.5 tracking-wider" style={{ color: "#2563EB" }}>AEOlab</p>
              <p className="text-3xl md:text-4xl font-black" style={{ color: "#0F172A", letterSpacing: "-1px", fontFamily: "Outfit, sans-serif" }}>
                월 9,900원
              </p>
              <span
                className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full mt-1"
                style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #6EE7B7" }}
              >
                ✓ 첫 달 4,950원
              </span>
              <p className="text-sm mt-2" style={{ color: "#475569" }}>광고 없이 AI 검색 노출 시작</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center sm:justify-start">
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
                  style={{ color: "#065F46", background: "#ECFDF5", borderColor: "#6EE7B7" }}
                >
                  <Check size={12} strokeWidth={2.5} />언제든 해지 가능
                </span>
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border"
                  style={{ color: "#065F46", background: "#ECFDF5", borderColor: "#6EE7B7" }}
                >
                  <Check size={12} strokeWidth={2.5} />결제·해지 문의 지원
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/pricing"
              className="inline-block text-white text-base font-bold px-7 py-3 rounded-xl transition-colors hover:bg-[#1D4ED8]"
              style={{ background: "#2563EB" }}
            >
              요금제 보기 →
            </Link>
            <p className="text-xs mt-1.5" style={{ color: "#475569" }}>
              Basic 첫 달 4,950원 · 언제든 해지 가능
            </p>
          </div>
        </div>
      </section>

      {/* ── 11. FAQ (#F8FAFC) ── */}
      <div style={{ background: "#F8FAFC" }}>
        <FAQSection />
      </div>

      {/* ── 12. Final CTA — 다크+그라디언트 (유일한 그라디언트, 오브 포함) ── */}
      <section
        className="py-14 md:py-20 px-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #080D1A 0%, #0F1F5C 50%, #1D4ED8 100%)" }}
      >
        {/* 배경 오브 */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div style={{ position: "absolute", width: "500px", height: "400px", top: "-80px", right: "-60px", background: "radial-gradient(ellipse at center, rgba(99,102,241,0.3) 0%, transparent 70%)", filter: "blur(60px)" }} />
          <div style={{ position: "absolute", width: "300px", height: "300px", bottom: "-40px", left: "10%", background: "radial-gradient(ellipse at center, rgba(37,99,235,0.25) 0%, transparent 70%)", filter: "blur(50px)" }} />
        </div>
        <div className="max-w-[680px] mx-auto text-center fade-up relative">
          <p className="text-xs font-bold tracking-widest mb-3" style={{ color: "#93C5FD" }}>
            지금 시작하세요
          </p>
          <h2
            className="text-2xl md:text-3xl font-black tracking-tight mb-4 leading-tight break-keep"
            style={{ color: "#FFFFFF", letterSpacing: "-0.8px" }}
          >
            손님이 우리 가게를<br />먼저 찾게 만들기
          </h2>
          {/* 서브텍스트 — 배지 3개 */}
          <div className="flex items-center justify-center gap-3 flex-wrap mb-8">
            {["가입 불필요", "카드 등록 없음", "1분 소요"].map((t) => (
              <span
                key={t}
                className="text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.70)" }}
              >
                ✓ {t}
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
              style={{ color: "rgba(255,255,255,0.85)", borderColor: "rgba(255,255,255,0.20)" }}
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
