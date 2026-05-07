import Link from "next/link";
import { Check } from "lucide-react";
import HeroSampleCard from "@/components/landing/HeroSampleCard";
import TrackedCTA from "@/components/analytics/TrackedCTA";
import PricingAnchorTracker from "@/components/analytics/PricingAnchorTracker";
import DiagnosisCounter from "@/components/landing/DiagnosisCounter";
import ServiceMechanismSection from "@/components/landing/ServiceMechanismSection";
import FAQSection from "@/components/landing/FAQSection";
import { createClient } from "@/lib/supabase/server";
import { LandingLogout } from "./LandingLogout";
import { SiteFooter } from "@/components/common/SiteFooter";
import LandingScrollAnimation from "@/components/landing/LandingScrollAnimation";

const FLOAT_SHADOW = "0 2px 4px -1px rgba(0,0,0,0.04), 0 12px 24px -6px rgba(0,100,255,0.08)";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-white">
      <LandingScrollAnimation />

      {/* ── 헤더 ── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur"
        style={{ background: "rgba(255,255,255,0.92)", borderColor: "#f0f0ef" }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight text-blue-600">AEOlab</span>
            <span className="hidden sm:block text-xs text-gray-500">네이버·ChatGPT·Google AI 노출 관리</span>
          </div>
          <nav className="flex items-center gap-0.5">
            <Link href="/how-it-works" className="hidden lg:inline-block text-sm font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5">서비스</Link>
            <Link href="/pricing" className="hidden md:inline-block text-sm font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5">요금제</Link>
            <Link href="/faq" className="hidden md:inline-block text-sm font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5">FAQ</Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5">대시보드</Link>
                <LandingLogout email={user.email ?? ""} />
              </>
            ) : (
              <>
                <Link href="/login" className="hidden sm:inline-block text-sm font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5">로그인</Link>
                <Link
                  href="/trial"
                  className="ml-1.5 bg-blue-600 text-white text-sm font-bold px-3.5 py-1.5 rounded-full hover:bg-blue-700 transition-colors"
                >
                  무료 진단
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ══ BLOCK 1: HERO ══ */}
      <section
        className="px-4 pt-10 pb-7 md:pt-14 md:pb-10"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 80% 60% at 20% 20%, rgba(0,100,255,0.07) 0%, transparent 60%)",
            "radial-gradient(ellipse 60% 50% at 80% 80%, rgba(99,60,255,0.05) 0%, transparent 60%)",
            "radial-gradient(ellipse 50% 40% at 60% 10%, rgba(0,180,255,0.04) 0%, transparent 50%)",
          ].join(", "),
        }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest mb-3 text-blue-600">
            네이버 AI 브리핑 노출 진단 서비스
          </p>
          {/* AI 브리핑 1줄 설명 — 처음 방문자를 위한 개념 안내 */}
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-5 text-sm text-blue-800 break-keep max-w-sm mx-auto">
            <span className="text-green-600 font-black text-sm shrink-0">N</span>
            <span>네이버 검색 상단 <strong>AI 자동 추천</strong> — 광고 없이 노출되는 새로운 방식</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-gray-900 leading-tight mb-3 break-keep">
            우리 가게,<br />
            <span className="text-blue-600">네이버 AI 추천에 나오고 있나요?</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 md:mb-8 leading-relaxed break-keep max-w-lg mx-auto">
            <strong className="text-gray-900">3,000만 명</strong>이 보는 네이버 AI 브리핑 —{" "}
            1분 무료 진단
          </p>
          <TrackedCTA
            href="/trial"
            location="hero"
            label="trial_start"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm md:text-base font-bold px-5 py-3 rounded-full shadow-md hover:bg-blue-700 transition-all hover:-translate-y-0.5"
          >
            1분 무료로 우리 가게 점검받기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </TrackedCTA>

          {/* 채널 계층 배지 */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
              <span className="text-green-300 font-black">N</span>
              네이버 AI 브리핑
            </span>
            <span className="text-gray-300 text-sm font-bold" aria-hidden="true">+</span>
            <span className="inline-flex items-center text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1.5 rounded-full">ChatGPT</span>
            <span className="inline-flex items-center text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1.5 rounded-full">Gemini</span>
            <span className="inline-flex items-center text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1.5 rounded-full">Google AI</span>
          </div>

          <div className="mt-3">
            <DiagnosisCounter />
          </div>
          <div className="mt-7 animate-bounce" aria-hidden="true">
            <svg className="w-4 h-4 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ══ BLOCK 2: WHY — Before / After ══ */}
      <section className="px-4 py-5 md:py-8" style={{ background: "#f7f7f5" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-5 md:mb-7 fade-up">
            <p className="text-xs font-bold tracking-widest mb-2 text-blue-600">WHY AEOLAB</p>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-gray-900 leading-tight break-keep">
              광고 끊으면 사라집니다,{" "}
              <span className="text-blue-600">AI 브리핑은 다릅니다</span>
            </h2>
            <p className="text-sm md:text-base text-gray-600 mt-2 break-keep max-w-xl mx-auto">
              네이버 광고는 돈 내는 동안만, AI 브리핑은 한 번 올라가면 광고 없이 유지됩니다
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {/* Before */}
            <div className="fade-up bg-white rounded-2xl p-5 md:p-6 border border-gray-200" style={{ boxShadow: FLOAT_SHADOW }}>
              <span className="inline-flex items-center text-xs font-bold bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full mb-3">
                네이버 광고만 의존 시
              </span>
              <h3 className="text-base md:text-lg font-bold text-gray-900 mb-0.5 break-keep">광고 끊으면 즉시 사라짐</h3>
              <p className="text-xs text-gray-500 mb-3">월 30만~100만원 (업종·경쟁도에 따라) · AI 브리핑 노출 0</p>
              <svg viewBox="0 0 300 100" className="w-full h-auto">
                <line x1="0" y1="75" x2="300" y2="75" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="45" x2="300" y2="45" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,3" />
                <path d="M 0,30 L 70,27 L 140,28 L 165,27" stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M 165,27 L 172,75" stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="4,4" />
                <path d="M 172,75 L 300,75" stroke="#d1d5db" strokeWidth="2" fill="none" strokeLinecap="round" />
                <line x1="169" y1="6" x2="169" y2="77" stroke="#d1d5db" strokeWidth="1" strokeDasharray="2,2" />
                <text x="65" y="12" textAnchor="middle" fill="#ef4444" fontSize="8">광고비 ON</text>
                <text x="230" y="90" textAnchor="middle" fill="#9ca3af" fontSize="8">OFF → 노출 0</text>
                <circle cx="169" cy="27" r="3.5" fill="#dc2626" />
              </svg>
              <ul className="mt-3 space-y-1 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="text-red-400 font-bold shrink-0">✕</span> 매달 광고비 지출 (업종·지역에 따라 수십~수백만원)</li>
                <li className="flex items-start gap-2"><span className="text-red-400 font-bold shrink-0">✕</span> 끄는 순간 검색 결과에서 사라짐</li>
                <li className="flex items-start gap-2"><span className="text-red-400 font-bold shrink-0">✕</span> ChatGPT·Gemini에는 영향 없음</li>
              </ul>
            </div>

            {/* After */}
            <div
              className="fade-up rounded-2xl p-5 md:p-6 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg,#0064FF 0%,#003ebd 100%)", boxShadow: FLOAT_SHADOW }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse 60% 60% at 80% 10%,rgba(255,255,255,0.12) 0%,transparent 60%)" }} aria-hidden="true" />
              <div className="relative">
                <span className="inline-flex items-center text-xs font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-full mb-3">
                  AEOlab → 네이버 AI 브리핑 등록
                </span>
                <h3 className="text-base md:text-lg font-bold mb-0.5 break-keep">AI 브리핑에서 꾸준히 추천됨</h3>
                <p className="text-xs text-blue-200 mb-3">월 9,900원 (광고비의 약 1/90)</p>
                <svg viewBox="0 0 300 100" className="w-full h-auto">
                  <line x1="0" y1="75" x2="300" y2="75" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
                  <path d="M 0,70 L 50,57 L 100,50 L 150,40 L 200,30 L 250,22 L 300,15 L 300,100 L 0,100 Z" fill="rgba(255,255,255,0.08)" />
                  <path d="M 0,70 L 50,57 L 100,50 L 150,40 L 200,30 L 250,22 L 300,15" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <circle cx="100" cy="50" r="3" fill="white" />
                  <circle cx="200" cy="30" r="3" fill="white" />
                  <circle cx="300" cy="15" r="3" fill="white" />
                  <text x="150" y="10" textAnchor="middle" fill="white" fontSize="8">매달 우상향</text>
                </svg>
                <ul className="mt-3 space-y-1 text-sm text-blue-100">
                  <li className="flex items-start gap-2"><span className="text-emerald-300 font-bold shrink-0">✓</span> 네이버 AI 브리핑 상위 노출 최적화</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-300 font-bold shrink-0">✓</span> ChatGPT·Gemini·Google AI 동시 관리</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-300 font-bold shrink-0">✓</span> 광고 끊어도 AI 추천은 유지됩니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ BLOCK 1.7: 네이버 AI 브리핑이란? ══ */}
      <section className="px-4 py-5 md:py-8" style={{ background: "#eef2ff" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6 fade-up">
            <p className="text-xs font-bold tracking-widest mb-2 text-blue-600">네이버 AI 브리핑</p>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-gray-900 break-keep">
              요즘 손님은 네이버 AI 추천 목록을 봅니다<br />
              <span className="text-blue-600">우리 가게 이름, 거기 있나요?</span>
            </h2>
            <p className="text-sm md:text-base text-gray-600 mt-2 break-keep max-w-xl mx-auto">
              네이버 검색 상단 AI 자동 추천 —{" "}
              <strong className="text-gray-900">3,000만 명+</strong>이 매달 이용 중 (네이버 공식 발표)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-5">
            {/* ① 손님 검색 */}
            <div className="fade-up bg-white rounded-2xl p-4 border border-gray-100" style={{ boxShadow: FLOAT_SHADOW }}>
              <p className="text-xs font-bold text-gray-400 tracking-wider mb-2">① 손님이 네이버에서 검색</p>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 mb-2">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                  <span className="text-green-600 font-black text-xs shrink-0">N</span>
                  <span className="text-xs text-gray-700 flex-1 truncate">"강남 분위기 좋은 카페"</span>
                  <span className="text-xs text-gray-400 shrink-0">예시</span>
                </div>
              </div>
              <p className="text-xs text-gray-500">매일 수백만 건의 지역 검색 발생</p>
            </div>

            {/* ② AI 브리핑 노출 */}
            <div className="fade-up bg-white rounded-2xl p-4 border border-blue-200" style={{ boxShadow: FLOAT_SHADOW }}>
              <p className="text-xs font-bold text-blue-600 tracking-wider mb-2">② 네이버 AI 브리핑에 노출</p>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 mb-2">
                <p className="text-xs font-bold text-blue-700 mb-1.5">AI 추천 카페 <span className="text-xs text-blue-400 font-normal">예시</span></p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 bg-blue-600 text-white text-xs rounded-lg px-2.5 py-1.5">
                    <span className="font-bold shrink-0">1</span>
                    <span className="font-bold">○○카페</span>
                    <span className="text-blue-200 text-xs ml-auto shrink-0">분위기 최고</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 px-2 py-0.5">
                    <span>2</span><span>△△커피</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 px-2 py-0.5">
                    <span>3</span><span>□□라운지</span>
                  </div>
                </div>
              </div>
              <p className="text-xs font-bold text-blue-700">1위 노출 시 클릭 +27.4%</p>
              <p className="text-xs text-gray-400">네이버 공식 발표 · 음식점 기준</p>
            </div>

            {/* ③ 손님 방문 */}
            <div className="fade-up bg-white rounded-2xl p-4 border border-emerald-200" style={{ boxShadow: FLOAT_SHADOW }}>
              <p className="text-xs font-bold text-emerald-600 tracking-wider mb-2">③ 광고 없이 손님 방문</p>
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 mb-2 text-center py-4">
                <svg className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <p className="text-sm font-black text-emerald-800">우리 가게 선택!</p>
                <p className="text-xs text-emerald-600 mt-0.5">AI 추천 → 신뢰 → 방문</p>
              </div>
              <p className="text-xs text-gray-500">광고비 없이 꾸준히 추천됩니다</p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 fade-up break-keep">
            음식점·카페·베이커리·숙박업 등 네이버 AI 브리핑 대상 업종 기준 · 그 외 업종은 ChatGPT·Gemini·Google AI 노출 진단 제공
          </p>
        </div>
      </section>

      {/* ══ BLOCK 3: HOW — 3단계 카드 ══ */}
      <section id="how" className="px-4 py-5 md:py-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-5 md:mb-7 fade-up">
            <p className="text-xs font-bold tracking-widest mb-2 text-blue-600">HOW IT WORKS</p>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-gray-900 leading-tight mb-2 break-keep">
              1분 진단, <span className="text-blue-600">7일 변화</span>
            </h2>
            <p className="text-sm md:text-base text-gray-600 break-keep">복잡한 설정 없이 3단계로 시작합니다</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-5">
            {/* Step 01 */}
            <div className="fade-up text-center">
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3 text-left" style={{ boxShadow: FLOAT_SHADOW }}>
                <span className="text-xs font-bold tracking-wider text-blue-600">STEP 01</span>
                <p className="text-sm md:text-base font-bold text-gray-900 mt-1 mb-3">우리 가게 입력</p>
                <div className="space-y-1.5">
                  {[["업종", "카페"], ["가게 이름", "○○카페"], ["동네", "강남구"]].map(([label, val]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className="text-sm font-bold text-gray-800">{val}</p>
                    </div>
                  ))}
                </div>
                <div className="w-full bg-blue-600 text-white text-xs font-bold py-2.5 rounded-lg mt-3 text-center">진단 시작</div>
                <p className="text-center text-xs text-gray-400 mt-1.5">1분 소요 · 가입 불필요 · 예시</p>
              </div>
              <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1 break-keep">1분 무료 진단</h3>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed break-keep">
                업종·가게 이름만 입력하면 네이버 AI 브리핑 노출 현황부터 ChatGPT·Gemini·Google AI까지 한번에 분석합니다
              </p>
            </div>

            {/* Step 02 */}
            <div className="fade-up text-center">
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3 text-left" style={{ boxShadow: FLOAT_SHADOW }}>
                <span className="text-xs font-bold tracking-wider text-blue-600">STEP 02</span>
                <p className="text-sm md:text-base font-bold text-gray-900 mt-1 mb-3">노출 현황 분석 + 개선 방향</p>
                <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-3 border border-blue-100 mb-2 text-center">
                  <p className="text-xs font-bold text-blue-600 mb-0.5">네이버 AI 브리핑 노출 현황 · 예시</p>
                  <p className="text-4xl font-black leading-none mb-0.5 text-blue-600">62</p>
                  <p className="text-xs text-gray-500">100 기준 · 개선 여지 있음</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-1.5">
                  <p className="text-xs font-bold text-amber-900 mb-0.5">빠진 키워드 · 예시</p>
                  <p className="text-xs text-amber-800">강남 디저트 외 2개</p>
                </div>
                <div className="rounded-lg p-2.5 bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">이외 추가 진단</p>
                  <p className="text-xs font-bold text-gray-600">ChatGPT · Gemini · Google AI</p>
                </div>
              </div>
              <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1 break-keep">노출 현황 분석 + 개선 가이드</h3>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed break-keep">
                네이버 AI 브리핑 노출 현황·빠진 키워드 안내 · ChatGPT·Gemini·Google AI 분석도 함께 제공
              </p>
            </div>

            {/* Step 03 */}
            <div className="fade-up text-center">
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3 text-left" style={{ boxShadow: FLOAT_SHADOW }}>
                <span className="text-xs font-bold tracking-wider text-emerald-600">STEP 03</span>
                <p className="text-sm md:text-base font-bold text-gray-900 mt-1 mb-3">매주 자동 점검</p>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 mb-2 text-center">
                  <p className="text-4xl font-black leading-none mb-0.5 text-emerald-600">+8</p>
                  <p className="text-xs text-gray-500">한 달 전보다 · 예시</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-2">
                  <p className="text-xs text-gray-400 mb-1.5">한 달 추세</p>
                  <svg viewBox="0 0 100 28" className="w-full h-auto">
                    <path d="M 0,23 L 20,20 L 40,16 L 60,13 L 80,9 L 100,6" stroke="#10b981" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                  <p className="text-xs font-bold text-yellow-900">카카오 알림톡</p>
                  <p className="text-xs text-yellow-800">노출 변화 시 자동 알림</p>
                </div>
              </div>
              <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1 break-keep">매주 자동 점검</h3>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed break-keep">
                매주 자동 재측정. 노출 변화를 카카오 알림톡으로 받습니다
              </p>
            </div>
          </div>

          <div className="text-center mt-7 fade-up">
            <TrackedCTA
              href="/trial"
              location="how"
              label="trial_start"
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-full shadow-md hover:bg-blue-700 transition-all hover:-translate-y-0.5"
            >
              지금 무료로 시작
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </TrackedCTA>
          </div>
        </div>
      </section>

      {/* ══ BLOCK 1.5: 실제 진단 예시 (개념 이해 후 제품 데모) ══ */}
      <section className="px-4 py-8 md:py-10 bg-white">
        <div className="max-w-2xl mx-auto">
          <HeroSampleCard variant="fullwidth" />
        </div>
      </section>

      {/* ══ BLOCK 4: 서비스 동작 원리 ══ */}
      <ServiceMechanismSection />

      {/* ══ BLOCK 5: 신뢰 데이터 — Bento Grid ══ */}
      <section className="px-4 py-5 md:py-8" style={{ background: "#fafaf8" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-5 md:mb-7 fade-up">
            <p className="text-xs font-bold tracking-widest mb-2 text-blue-600">네이버 공식 발표 데이터</p>
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 break-keep">
              실제로 효과가 있다는 공식 근거
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* 메인 카드 — 2열 */}
            <div
              className="fade-up md:col-span-2 rounded-2xl p-5 md:p-7 relative overflow-hidden text-white"
              style={{ background: "linear-gradient(135deg,#0064FF 0%,#1a46d8 100%)", boxShadow: FLOAT_SHADOW }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse 70% 70% at 90% 10%,rgba(255,255,255,0.12) 0%,transparent 60%)" }} aria-hidden="true" />
              <div className="relative">
                <p className="text-xs font-bold text-blue-200 mb-1.5">음식점 적용 후 클릭률 변화</p>
                <p className="text-5xl md:text-7xl font-black text-white mb-1.5" style={{ letterSpacing: "-0.04em", lineHeight: "0.9" }}>
                  +27.4%
                </p>
                <p className="text-sm md:text-base text-blue-100 break-keep mb-1">
                  AI 브리핑에 노출되면 손님 클릭이 늘어납니다
                </p>
                <p className="text-xs text-blue-300 mt-3">
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
                <p className="text-xs text-blue-300/80 mt-1.5 break-keep">
                  측정 시점·지역·업종에 따라 달라질 수 있습니다
                </p>
              </div>
            </div>

            {/* 보조 카드 3개 */}
            <div className="fade-up flex flex-col gap-3">
              {[
                { num: "3,000만+", label: "AI 브리핑을 본 사람", sub: "네이버 공식 발표 2025-2026" },
                { num: "15,000+", label: "AI 답변에 적용된 숙박업체", sub: "2026년 기준 · 네이버 발표" },
                { num: "25종", label: "지원 업종 수", sub: "음식점부터 전문직까지" },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-3.5 flex flex-col gap-0.5" style={{ boxShadow: FLOAT_SHADOW }}>
                  <p className="text-2xl md:text-3xl font-black text-gray-900 leading-none">{item.num}</p>
                  <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ BLOCK 6: 가격 앵커 ══ */}
      <section className="bg-orange-50 border-y border-orange-200 py-5 md:py-7 px-4">
        <PricingAnchorTracker />
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5 items-center">
            <div className="text-center sm:text-right border-b sm:border-b-0 sm:border-r border-orange-200 pb-3 sm:pb-0 sm:pr-5">
              <p className="text-sm text-gray-700 mb-0.5 font-medium">네이버 광고</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-700">월 30~100만원+</p>
              <p className="text-sm text-gray-600 mt-0.5">업종·경쟁도에 따라 다름 · 광고 끄면 즉시 사라짐</p>
            </div>
            <div className="text-center sm:text-left sm:pl-5">
              <p className="text-sm text-orange-700 font-semibold mb-0.5">AEOlab</p>
              <p className="text-2xl md:text-3xl font-bold text-blue-700">
                한 달 9,900원
                <span className="block sm:inline text-base text-emerald-600 font-semibold sm:ml-1.5">
                  (첫 달 4,950원)
                </span>
              </p>
              <p className="text-sm text-gray-700 mt-0.5">감당 가능한 가격으로 AI 검색 노출 시작</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  <Check size={12} strokeWidth={2.5} />언제든 해지 가능
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  <Check size={12} strokeWidth={2.5} />30일 내 환불 보장
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/pricing"
              className="inline-block bg-blue-600 text-white text-base font-bold px-7 py-3 rounded-xl hover:bg-blue-700 transition-colors"
            >
              요금제 보기 →
            </Link>
            <p className="text-xs text-gray-500 mt-1.5">Basic 첫 달 4,950원 · 언제든 해지 가능</p>
          </div>
        </div>
      </section>

      {/* ══ BLOCK 7: FAQ ══ */}
      <FAQSection />

      {/* ══ BLOCK 8: 최종 CTA ══ */}
      <section
        className="relative text-white py-5 md:py-8 px-4 overflow-hidden"
        style={{ background: "linear-gradient(135deg,#0053e0 0%,#0064FF 45%,#2547c4 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse 70% 80% at 80% 20%, rgba(120,80,255,0.25) 0%, transparent 60%)",
              "radial-gradient(ellipse 60% 60% at 10% 80%, rgba(0,180,255,0.15) 0%, transparent 50%)",
            ].join(", "),
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.7) 1px,transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-xl mx-auto text-center fade-up">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight mb-3 leading-tight break-keep">
            손님이 우리 가게를<br />먼저 찾게 만들기
          </h2>
          <p className="text-sm md:text-base text-blue-100 mb-7 break-keep">
            가입 불필요 · 카드 등록 없음 · 1분 소요
          </p>
          <TrackedCTA
            href="/trial"
            location="final"
            label="trial_start"
            className="inline-flex items-center gap-2 bg-white text-blue-700 text-sm md:text-base font-bold px-8 py-3.5 rounded-full shadow-2xl hover:bg-blue-50 transition-all hover:-translate-y-0.5"
          >
            1분 무료 진단 시작
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </TrackedCTA>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
