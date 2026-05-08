"use client";

import { useState, useRef, useEffect } from "react";
import {
  TILE_DEFINITIONS,
  INDUSTRY_DATA,
  BRIEFING_STATUS_CONFIG,
} from "@/lib/industryData";
import type { IndustryData } from "@/lib/industryData";

type PanelState = "idle" | "loading" | "result";

export default function HeroSection() {
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const [regionError, setRegionError] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [result, setResult] = useState<IndustryData | null>(null);
  const [trialCount, setTrialCount] = useState<number | null>(null);
  const regionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/scan/trial-count")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && typeof data.count === "number" && data.count > 0) {
          setTrialCount(data.count);
        }
      })
      .catch(() => {});
  }, []);

  const handleTileClick = (key: string) => {
    setSelectedIndustry(key);
    setPanelState("idle");
    setResult(null);
  };

  const handleDiagnose = () => {
    if (!region.trim()) {
      setRegionError(true);
      regionRef.current?.focus();
      setTimeout(() => setRegionError(false), 1200);
      return;
    }
    const industryKey = selectedIndustry || "restaurant";
    if (!selectedIndustry) setSelectedIndustry("restaurant");
    setPanelState("loading");
    setTimeout(() => {
      setResult(INDUSTRY_DATA[industryKey] ?? INDUSTRY_DATA["other"]);
      setPanelState("result");
    }, 3100);
  };

  return (
    <section
      className="border-b py-10 px-4 md:px-7 md:py-14 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #080D1A 0%, #0D1526 50%, #15113A 100%)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      {/* 배경 오브 — 빛 번짐 효과 */}
      <div
        className="hero-orb"
        style={{
          width: "600px", height: "400px",
          top: "-100px", right: "-80px",
          background: "radial-gradient(ellipse at center, rgba(37,99,235,0.25) 0%, transparent 70%)",
          animation: "float-slow 8s ease-in-out infinite",
        }}
      />
      <div
        className="hero-orb"
        style={{
          width: "400px", height: "300px",
          bottom: "0px", left: "-60px",
          background: "radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 70%)",
          animation: "float-slow 10s ease-in-out infinite 2s",
        }}
      />
      <div
        className="hero-orb"
        style={{
          width: "250px", height: "250px",
          top: "40%", left: "35%",
          background: "radial-gradient(ellipse at center, rgba(14,165,233,0.12) 0%, transparent 70%)",
          animation: "pulse-glow 6s ease-in-out infinite",
        }}
      />

      {/* 미세 노이즈 오버레이 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
          opacity: 0.4,
        }}
      />

      <div className="max-w-[1020px] mx-auto relative">
        {/* PC: 2열 그리드 / 모바일: 단열 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 lg:gap-14 items-start">
          {/* ── 왼쪽 영역 ── */}
          <div>
            {/* Eyebrow 배지 */}
            <div className="inline-flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-full mb-5"
              style={{ background: "rgba(37,99,235,0.25)", color: "#93C5FD", border: "1px solid rgba(37,99,235,0.35)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#60A5FA" }} />
              네이버 AI 브리핑 노출 진단 서비스
            </div>

            {/* 메인 타이틀 */}
            <h1
              className="hero-headline mb-4 break-keep"
            >
              네이버·ChatGPT가<br />
              <span style={{
                background: "linear-gradient(90deg, #60A5FA 0%, #93C5FD 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>먼저 추천하는 가게</span>,<br />
              누구일까요?
            </h1>

            {/* 서브텍스트 */}
            <p className="text-sm md:text-base leading-relaxed mb-6 max-w-md break-keep" style={{ color: "#94A3B8" }}>
              <strong style={{ color: "#F8FAFC" }}>3,000만 명</strong>이 보는 네이버 AI 브리핑 —
              우리 가게가 거기 있는지, 1분 무료로 확인하세요.
            </p>

            {/* 업종 타일 */}
            <div className="mb-6">
              <p className="text-xs font-bold mb-2.5 tracking-wider" style={{ color: "#94A3B8" }}>
                업종을 선택하면 예시를 확인할 수 있습니다
              </p>
              <div className="flex flex-wrap gap-2">
                {TILE_DEFINITIONS.map(({ key, label, emoji }) => {
                  const industryInfo = INDUSTRY_DATA[key];
                  const statusConfig = industryInfo
                    ? BRIEFING_STATUS_CONFIG[industryInfo.btype]
                    : null;
                  const isSelected = selectedIndustry === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTileClick(key)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 hover:scale-105"
                      style={
                        isSelected
                          ? { background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "#FFFFFF", borderColor: "transparent", boxShadow: "0 0 16px rgba(37,99,235,0.5)" }
                          : { background: "rgba(255,255,255,0.06)", color: "#CBD5E1", borderColor: "rgba(255,255,255,0.12)" }
                      }
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                      {statusConfig && !isSelected && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: statusConfig.dot }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 실시간 체험 카운터 */}
            {trialCount !== null && trialCount >= 10 && (
              <div className="flex items-center gap-1.5 mb-4">
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(37,99,235,0.2)", color: "#93C5FD", border: "1px solid rgba(37,99,235,0.3)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#60A5FA" }} />
                  지금까지 {trialCount.toLocaleString()}개 가게 분석 완료
                </span>
              </div>
            )}

            {/* KPI 지표 */}
            <div className="flex items-center gap-6 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
              {[
                { num: "+27.4%", label: "AI브리핑 후 클릭률", highlight: true },
                { num: "+8%", label: "AI브리핑 후 예약 전환 증가", highlight: false },
                { num: "9,900원", label: "월 최저 요금", highlight: false },
              ].map(({ num, label, highlight }, i) => (
                <div
                  key={i}
                  className={`flex-1 ${i > 0 ? "pl-6 border-l" : ""}`}
                  style={i > 0 ? { borderColor: "rgba(255,255,255,0.10)" } : {}}
                >
                  <p
                    className="text-2xl md:text-3xl font-black"
                    style={{
                      color: highlight ? "#60A5FA" : "#F8FAFC",
                      letterSpacing: "-0.5px",
                      fontFamily: "Outfit, sans-serif",
                    }}
                  >
                    {num}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 오른쪽: 진단폼 + 결과패널 ── */}
          <div className="lg:sticky lg:top-[64px]">
            {/* 진단 입력 카드 — 글래스모피즘 */}
            <div
              className="glass-card rounded-2xl p-5 mb-3"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold" style={{ color: "#F8FAFC" }}>무료 AI 노출 진단</p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#ECFDF5", color: "#065F46" }}
                >
                  무료
                </span>
              </div>

              {/* 업종 + 지역 2열 */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>업종</label>
                  <div
                    className="border rounded-lg px-3 py-2 text-sm"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      borderColor: selectedIndustry ? "#2563EB" : "rgba(255,255,255,0.12)",
                      color: selectedIndustry ? "#F8FAFC" : "#94A3B8",
                    }}
                  >
                    {selectedIndustry
                      ? TILE_DEFINITIONS.find((t) => t.key === selectedIndustry)?.label ?? "선택됨"
                      : "위에서 선택"}
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#94A3B8" }}>지역</label>
                  <input
                    ref={regionRef}
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDiagnose()}
                    placeholder="예: 강남구"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      borderColor: regionError ? "#DC2626" : "rgba(255,255,255,0.12)",
                      color: "#F8FAFC",
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleDiagnose}
                disabled={panelState === "loading"}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60"
                style={{ background: panelState === "loading" ? "#475569" : "#2563EB" }}
              >
                {panelState === "loading" ? "분석 중..." : "AI 노출 현황 진단하기 →"}
              </button>

              <p className="text-center text-xs mt-2" style={{ color: "#94A3B8" }}>
                가입 없이 · 카드 없이 · 즉시 결과
              </p>
            </div>

            {/* 패널 상태별 렌더링 */}
            {panelState === "idle" && (
              <PanelIdle hasIndustry={!!selectedIndustry} />
            )}
            {panelState === "loading" && <PanelLoading />}
            {panelState === "result" && result && (
              <PanelResult
                data={result}
                industry={selectedIndustry || "restaurant"}
                region={region}
              />
            )}
          </div>
        </div>
      </div>

      {/* 다크 → 흰색 페이드 전환 */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: "30px", background: "linear-gradient(to bottom, transparent, #FFFFFF)" }}
        aria-hidden="true"
      />
    </section>
  );
}

/* ── PanelIdle ── */
function PanelIdle({ hasIndustry }: { hasIndustry: boolean }) {
  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{ border: "1.5px dashed rgba(37,99,235,0.4)", background: "rgba(17,24,39,0.8)" }}
    >
      {/* 흐릿한 대시보드 미리보기 */}
      <div className="p-4 pointer-events-none select-none" style={{ opacity: 0.35 }}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-xl p-3" style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#93C5FD" }}>Track 1 · 네이버</p>
            <p className="text-2xl font-black" style={{ color: "#60A5FA", fontFamily: "Outfit, sans-serif" }}>--</p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>AI 브리핑 노출도</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#94A3B8" }}>Track 2 · 글로벌 AI</p>
            <p className="text-2xl font-black" style={{ color: "#CBD5E1", fontFamily: "Outfit, sans-serif" }}>--</p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>ChatGPT/Gemini</p>
          </div>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
          <p className="text-xs font-bold mb-1.5" style={{ color: "#94A3B8" }}>키워드 분석</p>
          <div className="flex gap-1 flex-wrap">
            {["키워드 ①", "키워드 ②"].map((k) => (
              <span key={k} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#FFFBEB", color: "#92400E" }}>✗ {k}</span>
            ))}
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#ECFDF5", color: "#065F46" }}>✓ 키워드 ③</span>
          </div>
        </div>
      </div>
      {/* 오버레이 텍스트 */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
        style={{ background: "rgba(10,15,30,0.75)", backdropFilter: "blur(2px)" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center mb-2"
          style={{ background: "rgba(37,99,235,0.25)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="#60A5FA" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-bold mb-0.5 break-keep" style={{ color: "#F8FAFC" }}>
          {hasIndustry ? "지역을 입력하고 진단하기를 누르세요" : "업종을 선택하면 결과를 볼 수 있습니다"}
        </p>
        <p className="text-xs break-keep" style={{ color: "#94A3B8" }}>
          AI 노출 점수 · 키워드 갭 · 경쟁사 비교
        </p>
      </div>
    </div>
  );
}

/* ── PanelLoading ── */
const LOADING_STEPS = [
  "네이버 AI 브리핑 스캔",
  "ChatGPT 노출 확인",
  "경쟁 가게 비교 분석",
  "키워드 갭 도출",
];

function PanelLoading() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = LOADING_STEPS.map((_, i) =>
      setTimeout(() => setStep(i + 1), 680 * (i + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="border rounded-2xl p-5"
      style={{ background: "#111827", borderColor: "rgba(255,255,255,0.10)" }}
    >
      <p className="text-xs font-bold mb-4 tracking-wider" style={{ color: "#94A3B8" }}>
        분석 중...
      </p>
      <div className="space-y-3">
        {LOADING_STEPS.map((label, i) => {
          const isDone = i < step;
          const isActive = i === step;
          return (
            <div
              key={i}
              className="flex items-center gap-3 text-sm transition-colors"
              style={{
                color: isDone ? "#059669" : isActive ? "#60A5FA" : "#94A3B8",
              }}
            >
              <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                {isDone ? (
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: "#2563EB" }}
                  >
                    ✓
                  </span>
                ) : isActive ? (
                  <span
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "#2563EB", borderTopColor: "transparent" }}
                  />
                ) : (
                  <span
                    className="w-4 h-4 rounded-full border-2"
                    style={{ borderColor: "rgba(255,255,255,0.15)" }}
                  />
                )}
              </span>
              <span
                className={
                  isDone ? "font-semibold" : isActive ? "font-semibold" : "font-normal"
                }
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── PanelResult ── */
function PanelResult({
  data,
  industry,
  region,
}: {
  data: IndustryData;
  industry: string;
  region: string;
}) {
  const statusCfg = BRIEFING_STATUS_CONFIG[data.btype];
  const industryLabel =
    TILE_DEFINITIONS.find((t) => t.key === industry)?.label ?? industry;

  return (
    <div
      className="border rounded-2xl overflow-hidden"
      style={{ background: "#111827", borderColor: "rgba(255,255,255,0.10)" }}
    >
      {/* 헤더 */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: "linear-gradient(90deg, #1E3A8A 0%, #2563EB 100%)" }}
      >
        <div>
          <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.72)" }}>
            AI 노출 진단 결과 · 예시
          </p>
          <p className="text-sm font-bold text-white">
            {industryLabel} · {region}
          </p>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: statusCfg.bannerBg, color: statusCfg.bannerText }}
        >
          {data.badge}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* DualTrack 점수 2열 */}
        <div className="grid grid-cols-2 gap-2">
          {/* Track 1 */}
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.35)" }}
          >
            <p
              className="text-xs font-bold uppercase tracking-[0.5px] mb-1"
              style={{ color: "#93C5FD" }}
            >
              Track 1 · 네이버
            </p>
            <p
              className="text-2xl font-black"
              style={{
                color: data.t1 > 0 ? "#60A5FA" : "#94A3B8",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              {data.t1 > 0 ? data.t1 : "N/A"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              AI 브리핑 노출도
            </p>
            <span
              className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
              style={{ background: "rgba(37,99,235,0.3)", color: "#93C5FD" }}
            >
              {data.r1}
            </span>
          </div>
          {/* Track 2 */}
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <p
              className="text-xs font-bold uppercase tracking-[0.5px] mb-1"
              style={{ color: "#94A3B8" }}
            >
              Track 2 · 글로벌 AI
            </p>
            <p
              className="text-2xl font-black"
              style={{ color: "#F8FAFC", fontFamily: "Outfit, sans-serif" }}
            >
              {data.t2}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              ChatGPT/Gemini
            </p>
            <span
              className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
              style={{ background: "rgba(255,255,255,0.08)", color: "#94A3B8" }}
            >
              {data.r2}
            </span>
          </div>
        </div>

        {/* 성장 단계 */}
        <div
          className="rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{data.growth}</span>
            <span className="text-sm font-bold" style={{ color: "#F8FAFC" }}>
              {data.gtxt}
            </span>
          </div>
          <p className="text-xs break-keep" style={{ color: "#94A3B8" }}>
            {data.gsub}
          </p>
        </div>

        {/* 키워드 갭 */}
        <div>
          <p
            className="text-xs font-bold mb-1.5 uppercase tracking-wider"
            style={{ color: "#94A3B8" }}
          >
            키워드 분석
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.missingKws.map((kw) => (
              <span
                key={kw}
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "#FFFBEB", color: "#92400E" }}
              >
                ✗ {kw}
              </span>
            ))}
            {data.ownedKws.map((kw) => (
              <span
                key={kw}
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "#ECFDF5", color: "#065F46" }}
              >
                ✓ {kw}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-1 space-y-2">
          <a
            href={`/trial?industry=${industry}&region=${encodeURIComponent(region)}`}
            className="block w-full py-3 rounded-xl text-sm font-bold text-white text-center transition-colors hover:bg-[#1D4ED8]"
            style={{ background: "#2563EB" }}
          >
            실제 내 가게 진단하기 →
          </a>
          <p className="text-center text-xs" style={{ color: "#94A3B8" }}>
            이 결과는 예시입니다 · 실제 분석은 가게 이름 입력 필요
          </p>
        </div>
      </div>
    </div>
  );
}
