"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trialScan, ApiError } from "@/lib/api";
import type { TrialScanResult } from "@/types";

// ── 상수 ──────────────────────────────────────────────────────────────────────

const QUICK_LS_KEY   = "aeolab_trial_v2";
const TRIAL_DAY_MS   = 24 * 60 * 60 * 1000;
const TRIAL_DAY_LIMIT = 3;

interface TrialStore { count: number; resetAt: number }

function loadTrialStore(): TrialStore {
  if (typeof window === "undefined") return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
  try {
    const raw = localStorage.getItem(QUICK_LS_KEY);
    if (!raw) return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
    const store: TrialStore = JSON.parse(raw);
    if (Date.now() > store.resetAt) return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
    return store;
  } catch { return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS }; }
}

function recordTrialUse(): void {
  if (typeof window === "undefined") return;
  const store = loadTrialStore();
  store.count += 1;
  localStorage.setItem(QUICK_LS_KEY, JSON.stringify(store));
}

function getTrialCooldownRemaining(): number {
  const store = loadTrialStore();
  if (store.count < TRIAL_DAY_LIMIT) return 0;
  return Math.max(0, store.resetAt - Date.now());
}

function formatCooldown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

// 업종 드롭다운 옵션
const CATEGORIES = [
  { value: "restaurant",  label: "음식점·식당" },
  { value: "cafe",        label: "카페·디저트" },
  { value: "beauty",      label: "미용·뷰티" },
  { value: "health",      label: "병원·의원" },
  { value: "education",   label: "학원·교육" },
  { value: "fitness",     label: "운동·헬스" },
  { value: "pet",         label: "반려동물" },
  { value: "professional",label: "법률·세무·전문직" },
  { value: "shopping",    label: "쇼핑몰·온라인" },
  { value: "living",      label: "인테리어·생활" },
];

// 점수 → 색상
function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 50) return "text-yellow-500";
  if (score >= 30) return "text-orange-500";
  return "text-red-500";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-50 border-emerald-200";
  if (score >= 50) return "bg-yellow-50 border-yellow-200";
  if (score >= 30) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function scoreGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function gradeColor(grade: string): string {
  if (grade === "A") return "bg-emerald-100 text-emerald-700";
  if (grade === "B") return "bg-yellow-100 text-yellow-700";
  if (grade === "C") return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

// 진단 문제 도출
function buildIssues(result: TrialScanResult, track1: number, track2: number): Array<{ icon: string; title: string; desc: string }> {
  const issues: Array<{ icon: string; title: string; desc: string }> = [];

  const gsRaw = result.growth_stage;
  const gs = typeof gsRaw === "string" ? gsRaw : (gsRaw?.stage ?? "");

  if (track1 < 40) {
    issues.push({
      icon: "📍",
      title: "네이버 AI 브리핑 미노출",
      desc: "네이버 스마트플레이스 최적화가 필요합니다. FAQ·소식·소개글 등록으로 개선할 수 있습니다.",
    });
  }
  if (track2 < 40) {
    issues.push({
      icon: "🌐",
      title: "글로벌 AI(ChatGPT 등) 미등록",
      desc: "ChatGPT·Gemini·Claude 등 글로벌 AI에서 내 가게가 인식되지 않고 있습니다.",
    });
  }
  if (gs === "survival") {
    issues.push({
      icon: "⭐",
      title: "리뷰 키워드 다양성 부족",
      desc: "AI가 내 가게를 추천할 키워드가 충분하지 않습니다. 리뷰 유도와 키워드 포함 답변이 필요합니다.",
    });
  }

  // 부족한 키워드가 있으면 추가
  if (result.top_missing_keywords && result.top_missing_keywords.length > 0 && issues.length < 3) {
    issues.push({
      icon: "🔑",
      title: `핵심 키워드 미등록: ${result.top_missing_keywords.slice(0, 2).join(", ")}`,
      desc: "이 키워드들이 스마트플레이스·소개글에 없어서 AI 추천에서 빠지고 있습니다.",
    });
  }

  // 3개 미만이면 기본 항목 보충
  if (issues.length === 0) {
    issues.push({
      icon: "📋",
      title: "정보 완성도 개선 필요",
      desc: "영업시간·메뉴·사진 등 정보를 더 채우면 AI 노출이 높아집니다.",
    });
  }

  return issues.slice(0, 3);
}

const SCAN_STEPS = [
  "검색어 생성 중",
  "AI에 내 가게 물어보는 중",
  "결과 분석 중",
  "점수 계산 중",
];

type Step = "form" | "scanning" | "result";

// ── 컴포넌트 ───────────────────────────────────────────────────────────────────

export default function QuickPage() {
  const [step, setStep]     = useState<Step>("form");
  const [name, setName]     = useState("");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [result, setResult] = useState<TrialScanResult | null>(null);
  const [error, setError]   = useState("");
  const [scanStep, setScanStep] = useState(0);
  const [cooldownMs, setCooldownMs] = useState(0);

  useEffect(() => {
    setCooldownMs(getTrialCooldownRemaining());
  }, []);

  // 카운트다운 타이머
  useEffect(() => {
    if (cooldownMs <= 0) return;
    const id = setInterval(() => {
      const remaining = getTrialCooldownRemaining();
      setCooldownMs(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 60_000);
    return () => clearInterval(id);
  }, [cooldownMs]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) { setError("가게 이름을 입력해주세요."); return; }
    if (!region.trim()) { setError("지역을 입력해주세요."); return; }

    const remaining = getTrialCooldownRemaining();
    if (remaining > 0) {
      setCooldownMs(remaining);
      setError(`오늘 무료 체험을 이미 사용하셨습니다. ${formatCooldown(remaining)} 후 다시 이용할 수 있습니다.`);
      return;
    }

    setError("");
    setStep("scanning");
    setScanStep(0);

    const stepInterval = setInterval(() => {
      setScanStep((prev) => {
        if (prev < SCAN_STEPS.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 700);

    try {
      const data = await trialScan({
        business_name: name.trim(),
        region: region.trim(),
        category,
        keywords: [],
        business_type: "location_based",
        has_faq: false,
        has_recent_post: false,
        has_intro: false,
      });

      clearInterval(stepInterval);
      setScanStep(SCAN_STEPS.length - 1);
      recordTrialUse();

      // 회원가입 시 자동입력용 prefill 저장
      try {
        localStorage.setItem("aeolab_trial_prefill", JSON.stringify({
          name: name.trim(),
          category,
          region: region.trim(),
        }));
      } catch { /* 무시 */ }

      setResult(data);
      setStep("result");
    } catch (err: unknown) {
      clearInterval(stepInterval);
      if (err instanceof ApiError && err.code === "TRIAL_LIMIT") {
        setError("하루 무료 체험 한도(3회)에 도달했습니다. 내일 다시 시도하거나 회원가입 후 이용하세요.");
        recordTrialUse();
        setCooldownMs(TRIAL_DAY_MS);
      } else {
        setError("분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
      setStep("form");
    }
  };

  const track1 = result ? (result.track1_score ?? result.score?.track1_score ?? result.score?.total_score ?? 0) : 0;
  const track2 = result ? (result.track2_score ?? result.score?.track2_score ?? result.score?.total_score ?? 0) : 0;
  const score  = result ? Math.round(result.score?.total_score ?? 0) : 0;
  const grade  = result ? (result.score?.grade ?? scoreGrade(score)) : "D";
  const issues = result ? buildIssues(result, track1, track2) : [];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">AEOlab</Link>
          <span className="text-sm text-gray-500 font-medium">30초 간이 AI 진단</span>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 pb-10">

        {/* ── 폼 단계 ── */}
        {step === "form" && (
          <>
            {/* 서비스 설명 */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2 leading-snug break-keep">
                AI가 내 가게를 알고 있나요?
              </h1>
              <p className="text-base text-gray-500 leading-relaxed break-keep">
                가게 이름과 지역만 입력하면
                <br />
                <strong className="text-gray-700">30초 안에 AI 노출 점수</strong>를 무료로 알려드립니다.
              </p>
            </div>

            {/* 신뢰 배지 */}
            <div className="flex justify-center gap-4 mb-6">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <span className="text-green-500 font-bold">✓</span> 무료
              </span>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <span className="text-green-500 font-bold">✓</span> 회원가입 불필요
              </span>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <span className="text-green-500 font-bold">✓</span> 30초
              </span>
            </div>

            {/* 쿨다운 배너 */}
            {cooldownMs > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 mb-5 text-center">
                <p className="text-base font-semibold text-amber-800 mb-1">
                  오늘 무료 체험 3회를 모두 이용하셨습니다.
                </p>
                <p className="text-sm text-amber-700 mb-3">
                  <strong>{formatCooldown(cooldownMs)}</strong> 후 다시 이용하거나
                </p>
                <Link
                  href="/signup"
                  className="inline-block bg-amber-500 text-white font-bold text-base px-6 py-3 rounded-xl hover:bg-amber-600 transition-colors"
                >
                  회원가입하면 매일 자동 진단
                </Link>
              </div>
            )}

            {/* 입력 폼 */}
            <form onSubmit={handleScan} className="space-y-4">
              {/* 가게 이름 */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">
                  가게 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 파리바게뜨 수원점"
                  required
                  disabled={cooldownMs > 0}
                  className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* 지역 */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">
                  지역 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="예: 수원시 팔달구"
                  required
                  disabled={cooldownMs > 0}
                  className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              {/* 업종 — 선택(드롭다운) */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1.5">
                  업종 <span className="text-sm font-normal text-gray-500">(선택)</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={cooldownMs > 0}
                  className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* 오류 메시지 */}
              {error && (
                <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3 leading-relaxed">{error}</p>
              )}

              {/* 진단 버튼 */}
              <button
                type="submit"
                disabled={cooldownMs > 0}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-lg py-5 rounded-2xl transition-colors shadow-md shadow-green-100"
              >
                {cooldownMs > 0
                  ? `${formatCooldown(cooldownMs)} 후 다시 이용 가능`
                  : "AI 진단 시작"}
              </button>

              <p className="text-center text-sm text-gray-500 mt-2">
                하루 3회 무료 · 결과는 약 30초 내 표시됩니다
              </p>
            </form>

            {/* 전체 진단 안내 */}
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
              <p className="text-sm text-blue-700 font-semibold mb-1">
                더 정밀한 분석이 필요하신가요?
              </p>
              <p className="text-sm text-blue-600 mb-3">
                업종 태그 선택 + 스마트플레이스 현황 체크 + 경쟁사 비교
              </p>
              <Link
                href="/trial"
                className="inline-block text-sm font-bold text-blue-700 border border-blue-300 px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-colors"
              >
                전체 진단 받기 (무료)
              </Link>
            </div>
          </>
        )}

        {/* ── 스캔 단계 ── */}
        {step === "scanning" && (
          <div className="text-center py-16">
            {/* 스피너 */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="w-20 h-20 border-4 border-green-100 rounded-full" />
              <div className="absolute inset-0 w-20 h-20 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center text-2xl">🔍</span>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {name} 분석 중...
            </h2>
            <p className="text-base text-gray-500 mb-8">
              AI에게 &ldquo;{region} {CATEGORIES.find(c => c.value === category)?.label ?? "가게"} 추천&rdquo;을<br />물어보고 있습니다
            </p>

            {/* 진행 단계 */}
            <div className="space-y-3 text-left">
              {SCAN_STEPS.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base transition-all ${
                    i < scanStep
                      ? "bg-green-50 text-green-700"
                      : i === scanStep
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "bg-gray-50 text-gray-500"
                  }`}
                >
                  <span className="w-5 h-5 flex items-center justify-center shrink-0">
                    {i < scanStep ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i === scanStep ? (
                      <span className="w-4 h-4 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin inline-block" />
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
                    )}
                  </span>
                  {s}
                </div>
              ))}
            </div>

            {/* 진행 바 */}
            <div className="mt-8 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-700"
                style={{ width: `${((scanStep + 1) / SCAN_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── 결과 단계 ── */}
        {step === "result" && result && (
          <div className="space-y-5">
            {/* 빠른 결과 안내 배너 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
              <p className="text-sm text-amber-700 font-medium">
                빠른 체험 결과 (10회 샘플 기준) — 정밀 분석은 구독 후 100회 스캔
              </p>
            </div>

            {/* 점수 카드 */}
            <div className={`rounded-2xl border-2 p-6 ${scoreBg(score)}`}>
              <p className="text-sm font-semibold text-gray-500 mb-3">
                {name} · {region} — AI 검색 노출 점수
              </p>

              <div className="flex items-end gap-4 mb-4">
                <span className={`text-7xl font-black leading-none ${scoreColor(score)}`}>
                  {score}
                </span>
                <div className="mb-1">
                  <p className="text-xl text-gray-500 font-bold leading-none mb-2">/ 100</p>
                  <span className={`text-base font-bold px-3 py-1 rounded-full ${gradeColor(grade)}`}>
                    {grade}등급
                  </span>
                </div>
              </div>

              <p className={`text-base font-semibold mb-3 ${scoreColor(score)}`}>
                {score >= 70
                  ? "네이버 AI에 비교적 잘 노출되고 있습니다."
                  : score >= 40
                  ? "일부 키워드에서 노출되나 개선이 필요합니다."
                  : "지금 AI 검색에서 내 가게가 거의 보이지 않습니다."}
              </p>

              {/* 트랙 점수 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/70 rounded-xl p-3">
                  <p className="text-sm text-gray-500 mb-1">네이버 AI 노출</p>
                  <p className={`text-2xl font-bold ${scoreColor(Math.round(track1))}`}>
                    {Math.round(track1)}점
                  </p>
                </div>
                <div className="bg-white/70 rounded-xl p-3">
                  <p className="text-sm text-gray-500 mb-1">글로벌 AI 노출</p>
                  <p className={`text-2xl font-bold ${scoreColor(Math.round(track2))}`}>
                    {Math.round(track2)}점
                  </p>
                </div>
              </div>
            </div>

            {/* 핵심 문제 3가지 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-base font-bold text-gray-900 mb-4">
                지금 당장 개선할 항목
              </h2>
              <div className="space-y-4">
                {issues.map((issue, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-2xl shrink-0 mt-0.5">{issue.icon}</span>
                    <div>
                      <p className="text-base font-semibold text-gray-800 mb-0.5">{issue.title}</p>
                      <p className="text-sm text-gray-500 leading-relaxed">{issue.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 없는 키워드 */}
            {result.top_missing_keywords && result.top_missing_keywords.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <p className="text-base font-semibold text-amber-800 mb-3">
                  AI 추천에서 빠진 키워드
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.top_missing_keywords.map((kw) => (
                    <span key={kw} className="bg-white text-amber-700 border border-amber-300 text-sm font-medium px-3 py-1.5 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-amber-600 mt-3">
                  이 키워드를 스마트플레이스 소개글·FAQ에 추가하면 AI 노출이 개선됩니다.
                </p>
              </div>
            )}

            {/* CTA 1: 전체 분석 보기 */}
            <Link
              href="/trial"
              className="block w-full text-center bg-white border-2 border-blue-500 text-blue-600 font-bold text-base py-4 rounded-2xl hover:bg-blue-50 transition-colors"
            >
              전체 분석 받기 — 경쟁사 비교 + 스마트플레이스 체크
            </Link>

            {/* CTA 2: 회원가입 */}
            <Link
              href="/signup"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-5 rounded-2xl transition-colors shadow-md shadow-blue-100"
            >
              무료 회원가입으로 매주 자동 분석받기
            </Link>
            <p className="text-center text-sm text-gray-500">Basic 월 9,900원 · 언제든 해지 가능</p>

            {/* 다시 진단 */}
            <button
              onClick={() => {
                setStep("form");
                setResult(null);
                setError("");
              }}
              className="w-full border border-gray-300 text-gray-600 font-medium text-base py-3.5 rounded-2xl hover:bg-gray-50 transition-colors"
            >
              다시 진단하기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
