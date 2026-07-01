"use client";

import { useState, useEffect } from "react";
import { mapNaverCategory } from "@/lib/categories";

interface Candidate {
  title: string;
  address?: string;
  category?: string;
  naver_place_id?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function HeroSection() {
  const [bizName, setBizName] = useState("");
  const [region, setRegion] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [trialCount, setTrialCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/scan/trial-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.count === "number" && data.count > 0) {
          setTrialCount(data.count);
        }
      })
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!bizName.trim()) return;
    setSearching(true);
    setSearchError("");
    setCandidates(null);
    try {
      const params = new URLSearchParams({ query: bizName.trim() });
      if (region.trim()) params.set("region", region.trim());
      const res = await fetch(`${BACKEND_URL}/api/scan/trial-search?${params}`);
      const data = await res.json();
      const list: Candidate[] = data?.results ?? data?.items ?? [];
      setCandidates(list);
      if (list.length === 0) {
        setSearchError(
          "검색 결과가 없습니다. 지역을 추가하거나 직접 진단을 선택하세요.",
        );
      }
    } catch {
      setSearchError("검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSearching(false);
    }
  };

  const handleCandidateSelect = (c: Candidate) => {
    const params = new URLSearchParams();
    params.set("business_name", c.title);
    if (c.naver_place_id) params.set("naver_place_id", c.naver_place_id);
    if (region.trim()) params.set("region", region.trim());
    params.set("category", mapNaverCategory(c.category));
    window.location.href = `/trial?${params.toString()}`;
  };

  const handleDirectTrial = () => {
    const params = new URLSearchParams();
    if (bizName.trim()) params.set("business_name", bizName.trim());
    if (region.trim()) params.set("region", region.trim());
    window.location.href = `/trial?${params.toString()}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <section
      className="border-b py-10 px-4 md:px-7 md:py-14 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #0C1A3A 0%, #112050 45%, #1A3272 100%)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {/* 배경 오브 */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          style={{
            position: "absolute",
            width: "620px",
            height: "520px",
            top: "-120px",
            left: "-80px",
            background:
              "radial-gradient(ellipse at center, rgba(37,99,235,0.22) 0%, transparent 65%)",
            filter: "blur(90px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "380px",
            height: "380px",
            top: "0",
            right: "-40px",
            background:
              "radial-gradient(ellipse at center, rgba(124,58,237,0.15) 0%, transparent 65%)",
            filter: "blur(100px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "200px",
            height: "200px",
            bottom: "40px",
            left: "30%",
            background:
              "radial-gradient(ellipse at center, rgba(99,102,241,0.10) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="max-w-[1120px] mx-auto relative">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 lg:gap-12 items-center">
          {/* ── 왼쪽 영역 ── */}
          <div>
            {/* Eyebrow 배지 */}
            <div
              className="inline-flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-full mb-5"
              style={{
                background: "rgba(255,255,255,0.10)",
                color: "#93C5FD",
                border: "1px solid rgba(255,255,255,0.20)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#2563EB" }}
              />
              AI 검색 준비도 진단 서비스 — AI브리핑·AI탭·SEO·ChatGPT
            </div>

            {/* 메인 타이틀 */}
            <h1 className="hero-headline mb-4 break-keep">
              내 가게는 AI 검색에
              <br />
              <span
                style={{
                  background:
                    "linear-gradient(90deg, #60A5FA 0%, #A78BFA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                나올 준비가
              </span>
              <br />
              됐나요?
            </h1>

            {/* KPI 지표 */}
            <div
              className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-4 mb-6 pb-5 border-b"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              {[
                {
                  num: "+27.4%",
                  label: "AI브리핑 후 가게 클릭",
                  highlight: true,
                  source: "네이버 플레이스 분석 기준",
                },
                {
                  num: "+10.4%",
                  label: "가게 페이지 체류시간",
                  highlight: false,
                  source: "네이버 플레이스 분석 기준",
                },
                {
                  num: "+8%",
                  label: "예약·주문 증가",
                  highlight: false,
                  source: "네이버 플레이스 분석 기준",
                },
                {
                  num: "9,900원",
                  label: "월 최저 요금",
                  highlight: false,
                  source: null,
                },
              ].map(({ num, label, highlight, source }, i) => (
                <div
                  key={i}
                  className={`sm:flex-1 ${i > 0 ? "sm:pl-4 sm:border-l" : ""}`}
                  style={
                    i > 0 ? { borderColor: "rgba(255,255,255,0.15)" } : {}
                  }
                >
                  <p
                    className="text-xl md:text-2xl font-black"
                    style={{
                      color: highlight ? "#60A5FA" : "#FFFFFF",
                      letterSpacing: "-0.5px",
                      fontFamily:
                        "var(--font-pretendard, 'Pretendard Variable', sans-serif)",
                    }}
                  >
                    {num}
                  </p>
                  <p
                    className="text-sm mt-0.5 font-medium"
                    style={{ color: "rgba(255,255,255,0.88)" }}
                  >
                    {label}
                  </p>
                  {source && (
                    <p
                      className="hidden sm:block text-sm mt-0.5"
                      style={{ color: "rgba(255,255,255,0.75)" }}
                    >
                      {source}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p
              className="text-sm mb-5 -mt-3"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              음식점 업종 기준 · 업종·지역·경쟁 환경에 따라 다를 수 있습니다
            </p>

            {/* 서브텍스트 */}
            <div className="mb-4 max-w-lg space-y-2">
              <p
                className="text-sm md:text-base leading-relaxed break-keep"
                style={{ color: "rgba(255,255,255,0.95)" }}
              >
                <span
                  className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md mr-1"
                  style={{ background: "rgba(37,99,235,0.35)", color: "#93C5FD" }}
                >
                  음식점·카페·숙박업 등
                </span>
                검색 상단에 자동으로 뜨는{" "}
                &apos;플레이스형&apos; <strong style={{ color: "#FFFFFF" }}>네이버 AI 브리핑</strong>에
                우리 가게가 나오는지 확인하세요.
              </p>
              <p
                className="text-sm leading-relaxed break-keep"
                style={{ color: "rgba(255,255,255,0.80)" }}
              >
                <strong style={{ color: "#A5F3FC" }}>네이버 AI탭</strong>·
                <strong style={{ color: "#A5F3FC" }}>&apos;정보형&apos; AI 브리핑</strong> 준비도와{" "}
                <strong style={{ color: "#A5F3FC" }}>일반 검색 상위 노출</strong> 최적화 진단 —
                모든 업종 대상 · 가입 없이 1분
              </p>
            </div>

            {/* 진단 채널 배지 */}
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                { label: "네이버 AI브리핑", color: "#22C55E" },
                { label: "네이버 AI탭", color: "#22C55E" },
                { label: "네이버 검색 노출", color: "#22C55E" },
                { label: "ChatGPT", color: "#60A5FA" },
                { label: "Gemini", color: "#60A5FA" },
              ].map(({ label, color }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  {label}
                </span>
              ))}
            </div>

            {/* 실시간 체험 카운터 */}
            {trialCount !== null && trialCount >= 10 && (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(96,165,250,0.18)",
                    color: "#93C5FD",
                    border: "1px solid rgba(96,165,250,0.30)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#2563EB" }}
                  />
                  지금까지 {trialCount.toLocaleString()}개 가게 분석 완료
                </span>
              </div>
            )}
          </div>

          {/* ── 오른쪽: 진단 폼 ── */}
          <div className="lg:sticky lg:top-[64px]">
            {/* 입력 카드 — 글래스모피즘 v3 */}
            <div
              className="rounded-xl relative overflow-hidden"
              style={{
                background: "rgba(10,22,58,0.88)",
                border: "1px solid rgba(255,255,255,0.22)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow:
                  "0 0 0 1px rgba(37,99,235,0.25), 0 20px 60px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              {/* 상단 액센트 바 */}
              <div
                className="absolute top-0 left-0 right-0 pointer-events-none"
                style={{
                  height: "3px",
                  background:
                    "linear-gradient(90deg, #1D4ED8 0%, #818CF8 50%, #1D4ED8 100%)",
                }}
                aria-hidden="true"
              />

              {/* 카드 내부 우상단 빛 번짐 */}
              <div
                className="absolute pointer-events-none"
                style={{
                  width: "200px",
                  height: "200px",
                  top: "-60px",
                  right: "-40px",
                  background:
                    "radial-gradient(ellipse at center, rgba(99,102,241,0.18) 0%, transparent 70%)",
                  filter: "blur(20px)",
                }}
                aria-hidden="true"
              />

              {/* 헤더 영역 */}
              <div
                className="px-6 pt-6 pb-5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p
                      className="text-lg font-bold leading-tight"
                      style={{ color: "#FFFFFF" }}
                    >
                      무료 AI 노출 진단
                    </p>
                    <p
                      className="text-sm mt-1"
                      style={{ color: "rgba(255,255,255,0.58)" }}
                    >
                      1분 · 가입 불필요 · 즉시 결과
                    </p>
                  </div>
                  <span
                    className="text-sm font-bold px-3 py-1.5 rounded-full mt-0.5 shrink-0"
                    style={{
                      background: "rgba(34,197,94,0.18)",
                      color: "#4ADE80",
                      border: "1px solid rgba(34,197,94,0.35)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    무료
                  </span>
                </div>
              </div>

              {/* 폼 영역 */}
              <div className="px-6 py-5">
                {/* 가게 이름 입력 */}
                <div className="mb-4">
                  <label
                    className="text-sm font-semibold mb-2 block"
                    style={{ color: "rgba(255,255,255,0.92)" }}
                  >
                    가게 이름
                  </label>
                  <input
                    type="text"
                    value={bizName}
                    onChange={(e) => {
                      setBizName(e.target.value);
                      setCandidates(null);
                      setSearchError("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="예: 홍길동 칼국수"
                    className="hero-form-input w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.25)",
                      color: "#FFFFFF",
                      minHeight: "48px",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#60A5FA";
                      e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(96,165,250,0.18)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* 지역 입력 */}
                <div className="mb-5">
                  <label
                    className="text-sm font-semibold mb-2 block"
                    style={{ color: "rgba(255,255,255,0.92)" }}
                  >
                    지역{" "}
                    <span
                      className="font-normal"
                      style={{ color: "rgba(255,255,255,0.42)" }}
                    >
                      (선택)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="예: 강남구, 홍대"
                    className="hero-form-input w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.25)",
                      color: "#FFFFFF",
                      minHeight: "48px",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#60A5FA";
                      e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(96,165,250,0.18)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* CTA 버튼 */}
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching || !bizName.trim()}
                  className="w-full rounded-xl font-bold text-white transition-all"
                  style={{
                    background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
                    minHeight: "54px",
                    fontSize: "15px",
                    letterSpacing: "0.01em",
                    boxShadow: "0 6px 22px rgba(37,99,235,0.55)",
                    opacity: searching || !bizName.trim() ? 0.55 : 1,
                    cursor: searching || !bizName.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {searching ? "찾는 중…" : "내 가게 찾기 →"}
                </button>

                {/* 신뢰 배지 */}
                <div className="flex items-center justify-center gap-4 mt-4">
                  {["가입 없음", "카드 없음", "즉시 결과"].map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1.5 text-sm"
                      style={{ color: "rgba(255,255,255,0.60)" }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="#4ADE80"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 후보 목록 */}
            {(candidates !== null || searchError) && (
              <div
                className="mt-3 rounded-xl overflow-hidden"
                style={{
                  background: "rgba(10,22,58,0.88)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.50)",
                }}
              >
                {/* 검색 에러 */}
                {searchError && (
                  <div className="p-4">
                    <p
                      className="text-sm font-medium mb-2"
                      style={{ color: "#FCA5A5" }}
                    >
                      {searchError}
                    </p>
                    <button
                      type="button"
                      onClick={handleDirectTrial}
                      className="text-sm font-semibold underline"
                      style={{ color: "#93C5FD" }}
                    >
                      직접 진단 시작 →
                    </button>
                  </div>
                )}

                {/* 후보 목록 정상 */}
                {candidates !== null && candidates.length > 0 && (
                  <>
                    <div
                      className="px-4 py-3"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}
                    >
                      <p
                        className="text-sm font-bold"
                        style={{ color: "rgba(255,255,255,0.90)" }}
                      >
                        이 가게가 맞나요?
                      </p>
                    </div>
                    <div className="p-3 space-y-2">
                      {candidates.slice(0, 5).map((c, idx) => (
                        <button
                          key={
                            c.naver_place_id
                              ? `id:${c.naver_place_id}`
                              : `fb:${idx}:${c.title}`
                          }
                          type="button"
                          onClick={() => handleCandidateSelect(c)}
                          disabled={searching}
                          className="w-full text-left px-3 py-2.5 rounded-xl transition-all disabled:opacity-50"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.12)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(96,165,250,0.15)";
                            e.currentTarget.style.borderColor = "rgba(96,165,250,0.40)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                          }}
                        >
                          <p
                            className="text-sm font-semibold truncate"
                            style={{ color: "#FFFFFF" }}
                          >
                            {c.title}
                          </p>
                          {(c.address || c.category) && (
                            <p
                              className="text-sm mt-0.5 truncate"
                              style={{ color: "rgba(255,255,255,0.55)" }}
                            >
                              {[c.category, c.address]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </button>
                      ))}

                      {/* 직접 진단 링크 */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleDirectTrial}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.18)",
                            color: "rgba(255,255,255,0.65)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                            e.currentTarget.style.color = "rgba(255,255,255,0.90)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "rgba(255,255,255,0.65)";
                          }}
                        >
                          내 가게가 없어요 → 직접 진단
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 다크→화이트 페이드 전환 */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: "64px",
          background: "linear-gradient(to bottom, transparent, #FFFFFF)",
        }}
        aria-hidden="true"
      />
    </section>
  );
}
