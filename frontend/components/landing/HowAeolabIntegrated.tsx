"use client";
import { useState } from "react";
import TrackedCTA from "@/components/analytics/TrackedCTA";

const FLOAT_SHADOW = "var(--aeo-shadow-float)";

export function HowAeolabIntegrated() {
  const [mobileOpen, setMobileOpen] = useState<number>(1);

  /* ── 대시보드 카드 컴포넌트 ── */

  /* KakaoCard: 실제 카카오톡 알림톡 채팅 화면 스타일 */
  const KakaoCard = (
    <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ boxShadow: FLOAT_SHADOW, background: "#fff" }}>
      {/* 예시 배지 */}
      <span className="absolute top-2 right-2 text-sm px-1.5 py-0.5 rounded-full z-10" style={{ background: "rgba(0,0,0,0.12)", color: "#5B4A00" }}>
        예시
      </span>

      {/* 카카오톡 헤더 */}
      <div className="flex items-center px-3 py-2.5" style={{ background: "#FAE100" }}>
        <button type="button" className="mr-2 p-0.5" aria-label="뒤로가기">
          <svg className="w-4 h-4" fill="none" stroke="#5B4A00" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}>
            A
          </div>
          <span className="text-sm font-bold" style={{ color: "#3B2800" }}>AEOlab</span>
        </div>
        <button type="button" className="p-0.5" aria-label="검색">
          <svg className="w-4 h-4" fill="none" stroke="#5B4A00" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {/* 채팅 배경 */}
      <div className="px-3 py-3" style={{ background: "#B2C4D8", minHeight: "180px" }}>
        {/* 날짜 구분선 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.5)" }} />
          <span className="text-sm px-2" style={{ color: "rgba(255,255,255,0.85)" }}>오늘</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.5)" }} />
        </div>

        {/* 메시지 영역 */}
        <div className="flex items-start gap-2">
          {/* 프로필 아이콘 */}
          <div className="shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}>
              AE
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold mb-1" style={{ color: "#3B3B3B" }}>AEOlab</p>

            {/* 메시지 버블 */}
            <div className="relative">
              {/* 왼쪽 삼각 꼬리 */}
              <div className="absolute -left-1.5 top-3 w-0 h-0" style={{
                borderTop: "5px solid transparent",
                borderBottom: "5px solid transparent",
                borderRight: "7px solid #ffffff"
              }} />
              <div className="rounded-2xl rounded-tl-sm p-3 text-sm leading-relaxed overflow-hidden" style={{ background: "#ffffff", maxWidth: "220px" }}>
                <p className="font-bold mb-1.5" style={{ color: "#0F172A" }}>
                  [AEOlab] 주간 노출 리포트
                </p>
                <div className="mb-2 pb-2 border-b" style={{ borderColor: "#E2E8F0" }}>
                  <p className="mb-0.5" style={{ color: "#475569" }}>이번 주 AI 노출 현황</p>
                  <p className="text-base font-black" style={{ color: "#2563EB" }}>
                    노출 늘었어요 ↑ <span className="text-sm text-green-600 font-bold">(양호 단계 진입)</span>
                  </p>
                </div>
                <p className="mb-0.5" style={{ color: "#475569" }}>ChatGPT 언급: <span className="font-bold text-gray-800">31회 → 38회</span></p>
                <p style={{ color: "#475569" }}>경쟁사 대비: <span className="font-bold text-indigo-600">상위 35%</span></p>
              </div>

              {/* 버튼 */}
              <div className="mt-1.5 rounded-xl overflow-hidden" style={{ maxWidth: "220px" }}>
                <button
                  type="button"
                  className="w-full py-2 text-sm font-bold text-center border-t"
                  style={{ background: "#FAE100", color: "#3B2800", borderColor: "#E5CC00" }}
                >
                  대시보드 보기 →
                </button>
              </div>
            </div>

            {/* 시간 */}
            <p className="text-right mt-1 text-sm" style={{ color: "rgba(255,255,255,0.8)", maxWidth: "220px" }}>
              오전 9:41
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const ScoreCards = (
    <div className="space-y-2">
      <div
        className="rounded-xl p-4 border"
        style={{ background: "#EFF6FF", borderColor: "#BFDBFE", boxShadow: FLOAT_SHADOW }}
      >
        <p
          className="text-sm font-bold uppercase tracking-wider mb-2"
          style={{ color: "#2563EB" }}
        >
          네이버 채널 진단
        </p>
        <p
          className="text-lg font-black mb-1"
          style={{ color: "#2563EB" }}
        >
          일부 노출 중
        </p>
        <p className="text-sm font-semibold mb-1" style={{ color: "#3B82F6" }}>
          보통 단계
        </p>
        <p className="text-sm" style={{ color: "#475569" }}>
          AI 브리핑 노출 현황 · 예시
        </p>
      </div>
      <div
        className="rounded-xl p-4 border"
        style={{ background: "#F5F3FF", borderColor: "#DDD6FE", boxShadow: FLOAT_SHADOW }}
      >
        <p
          className="text-sm font-bold uppercase tracking-wider mb-2"
          style={{ color: "#7C3AED" }}
        >
          글로벌 AI 진단
        </p>
        <p
          className="text-lg font-black mb-1"
          style={{ color: "#7C3AED" }}
        >
          인식 시작 단계
        </p>
        <p className="text-sm font-semibold mb-1" style={{ color: "#8B5CF6" }}>
          낮음 단계
        </p>
        <p className="text-sm" style={{ color: "#475569" }}>
          ChatGPT·Gemini 노출 현황 · 예시
        </p>
      </div>
    </div>
  );

  const TrendCard = (
    <div
      className="rounded-xl p-4 border"
      style={{ background: "#FFFFFF", borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold" style={{ color: "#0F172A" }}>
          키워드 갭 + 7주 추세
        </p>
        <span className="text-sm text-gray-500">(예시)</span>
      </div>
      <div className="space-y-1.5 mb-3">
        {[
          { kw: "주차 가능", type: "missing" },
          { kw: "단체석", type: "missing" },
          { kw: "포장 가능", type: "owned" },
        ].map(({ kw, type }) => (
          <span
            key={kw}
            className="inline-flex mr-1.5 text-sm font-semibold px-2 py-0.5 rounded-full"
            style={
              type === "missing"
                ? { background: "#FFFBEB", color: "#92400E" }
                : { background: "#ECFDF5", color: "#065F46" }
            }
          >
            {type === "missing" ? "✗" : "✓"} {kw}
          </span>
        ))}
      </div>
      <p className="text-sm text-center py-2" style={{ color: "#475569" }}>
        첫 스캔 후 추세가 표시됩니다
      </p>
    </div>
  );

  /* ── 스텝 데이터 ── */
  const stepContents = [
    {
      step: 1,
      color: "#2563EB",
      bg: "#EFF6FF",
      border: "#BFDBFE",
      label: "STEP 01",
      title: "우리 가게 입력",
      desc: "업종·가게 이름만 입력하면 네이버 AI 브리핑부터 ChatGPT·Gemini·Google AI까지 한번에 분석합니다",
      ui: (
        <div className="space-y-1.5 mb-3">
          {[
            ["업종", "카페"],
            ["가게 이름", "○○카페"],
            ["동네", "강남구"],
          ].map(([label, val]) => (
            <div
              key={label}
              className="rounded-lg p-2.5 border"
              style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}
            >
              <p className="text-sm mb-0.5" style={{ color: "#475569" }}>{label}</p>
              <p className="text-sm font-bold" style={{ color: "#0F172A" }}>{val}</p>
            </div>
          ))}
          <div
            className="w-full text-white text-sm font-bold py-2.5 rounded-lg text-center"
            style={{ background: "linear-gradient(135deg,#2563EB 0%,#7C3AED 100%)" }}
          >
            진단 시작 →
          </div>
          <p className="text-center text-sm" style={{ color: "#475569" }}>
            1분 소요 · 가입 불필요 · 예시
          </p>
        </div>
      ),
      dashCard: KakaoCard,
    },
    {
      step: 2,
      color: "#4F46E5",
      bg: "#EEF2FF",
      border: "#C7D2FE",
      label: "STEP 02",
      title: "노출 현황 분석 + 개선 방향",
      desc: "네이버 AI 브리핑 노출 현황·빠진 키워드 안내 · ChatGPT·Gemini·Google AI 분석도 함께 제공",
      ui: (
        <div className="space-y-2 mb-3">
          {/* AI 노출 현황 카드 */}
          <div
            className="rounded-lg p-3 border"
            style={{ background: "#EEF2FF", borderColor: "#C7D2FE" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold" style={{ color: "#4F46E5" }}>
                AI 노출 현황 · 예시
              </p>
              <span className="text-sm px-2 py-0.5 rounded-full font-bold" style={{ background: "#C7D2FE", color: "#3730A3" }}>
                개선 여지 있음
              </span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: "네이버 AI 브리핑·AI탭", status: "일부 노출 중", color: "#15803D", bg: "#DCFCE7" },
                { label: "ChatGPT 언급", status: "언급 낮음", color: "#B45309", bg: "#FEF3C7" },
                { label: "Gemini 언급", status: "인식 시작 단계", color: "#7C3AED", bg: "#EDE9FE" },
                { label: "키워드 커버리지", status: "3개 공백 있음", color: "#B91C1C", bg: "#FEE2E2" },
              ].map(({ label, status, color, bg }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#475569" }}>{label}</span>
                  <span className="text-sm font-semibold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>{status}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 빠진 키워드 */}
          <div
            className="rounded-lg p-2.5 border"
            style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}
          >
            <p className="text-sm font-bold" style={{ color: "#92400E" }}>
              빠진 키워드 3개 발견 · 예시
            </p>
          </div>
        </div>
      ),
      dashCard: ScoreCards,
    },
    {
      step: 3,
      color: "#7C3AED",
      bg: "#F5F3FF",
      border: "#DDD6FE",
      label: "STEP 03",
      title: "매주 자동 점검 + 카카오 알림",
      desc: "매주 자동 재측정. 노출 변화가 생기면 카카오 알림톡으로 바로 알려드립니다",
      ui: (
        <div className="space-y-2 mb-3">
          <div
            className="rounded-lg p-3 border text-center"
            style={{ background: "#F5F3FF", borderColor: "#DDD6FE" }}
          >
            <p className="text-xl font-black leading-none mb-0.5" style={{ color: "#7C3AED" }}>
              AI 노출 1단계 성장 ↑
            </p>
            <p className="text-sm" style={{ color: "#475569" }}>
              노출 상태 개선 · 예시
            </p>
            <p className="text-sm mt-1" style={{ color: "#475569" }}>
              실제 변화는 업종·지역에 따라 다릅니다
            </p>
          </div>
          <div
            className="rounded-lg p-2.5 border"
            style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}
          >
            <p className="text-sm font-bold" style={{ color: "#92400E" }}>
              카카오 알림톡 자동 발송
            </p>
          </div>
        </div>
      ),
      dashCard: TrendCard,
    },
  ];

  return (
    <section className="px-4 py-8 md:py-12" style={{ background: "#FFFFFF" }}>
      <div className="max-w-[1100px] mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-6 md:mb-10 fade-up">
          <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#7C3AED" }}>
            HOW IT WORKS
          </p>
          <h2
            className="text-2xl md:text-3xl font-black tracking-tight break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
          >
            1분 진단,{" "}
            <span
              style={{
                background: "linear-gradient(90deg,#2563EB 0%,#7C3AED 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              7일 추적
            </span>
          </h2>
          <p className="text-sm mt-2 break-keep" style={{ color: "#475569" }}>
            복잡한 설정 없이 3단계로 시작합니다 ·{" "}
            <span style={{ color: "#475569" }}>
              7일 가이드 실행 기준, 지역·업종별 차이 있음
            </span>
          </p>
        </div>

        {/* PC: 3열 가로 배치 */}
        <div className="hidden md:grid md:grid-cols-[1fr_40px_1fr_40px_1fr] gap-0 items-start">
          {stepContents.map(({ step, color, bg, border, label, title, desc, ui }, idx) => (
            <>
              {/* 스텝 카드 */}
              <div
                key={`card-${step}`}
                className="rounded-xl border p-4"
                style={{ borderColor: border, background: bg, boxShadow: FLOAT_SHADOW }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-full text-white text-sm font-black shrink-0"
                    style={{ background: color }}
                  >
                    {step}
                  </div>
                  <span className="text-sm font-bold tracking-wider" style={{ color }}>
                    {label}
                  </span>
                </div>
                <p className="text-sm md:text-base font-bold mb-2" style={{ color: "#0F172A" }}>
                  {title}
                </p>
                {ui}
                <p className="text-sm leading-relaxed break-keep" style={{ color: "#475569" }}>
                  {desc}
                </p>
              </div>

              {/* 화살표 — 첫 번째·두 번째 카드 뒤에만 */}
              {idx < 2 && (
                <div key={`arrow-${step}`} className="flex items-center justify-center pt-10">
                  <svg className="w-5 h-5" fill="none" stroke="#CBD5E1" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              )}
            </>
          ))}
        </div>

        {/* 모바일: 아코디언 */}
        <div className="md:hidden space-y-3">
          {stepContents.map(({ step, color, bg, border, label, title, desc, ui }) => (
            <div
              key={step}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: mobileOpen === step ? border : "#E2E8F0" }}
            >
              {/* 탭 헤더 */}
              <button
                type="button"
                onClick={() => setMobileOpen(mobileOpen === step ? 0 : step)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                style={{ background: mobileOpen === step ? bg : "#FFFFFF" }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center w-5 h-5 rounded-full text-white text-sm font-black shrink-0"
                    style={{ background: color }}
                  >
                    {step}
                  </div>
                  <span className="text-sm font-bold" style={{ color: "#0F172A" }}>
                    {label} · {title}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform ${mobileOpen === step ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="#64748B"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* 아코디언 내용 */}
              {mobileOpen === step && (
                <div className="px-4 pb-4" style={{ background: bg }}>
                  <p className="text-sm mb-3 break-keep" style={{ color: "#475569" }}>
                    {desc}
                  </p>
                  {ui}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 면책 문구 */}
        <p className="text-center text-sm mt-6" style={{ color: "#475569" }}>
          카카오 알림 카드·노출 상태 변화는 예시 데이터입니다 · 실제 수치는 내 가게 스캔 후 표시됩니다
        </p>

        {/* CTA */}
        <div className="text-center mt-4 fade-up">
          <TrackedCTA
            href="/trial"
            location="how"
            label="trial_start"
            className="inline-flex items-center gap-2 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg,#2563EB 0%,#7C3AED 100%)",
              boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
            }}
          >
            지금 무료로 시작
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </TrackedCTA>
        </div>
      </div>
    </section>
  );
}
