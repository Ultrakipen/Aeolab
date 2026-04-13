"use client";

import { useState, useEffect } from "react";
import { trialScan } from "@/lib/api";
import { TrialScanResult, KakaoVisibilityData, GrowthStage } from "@/types";
import Link from "next/link";
import { CATEGORY_GROUPS, CATEGORY_MAP } from "@/lib/categories";
import { CATEGORY_ICON_MAP } from "@/lib/categoryIcons";
import { ApiError } from "@/lib/api";
import { ChevronLeft } from "lucide-react";
import DualTrackCard from "@/components/dashboard/DualTrackCard";
import { createClient } from "@/lib/supabase/client";

// ── Sticky 하단 회원가입 배너 (결과 화면에서만 표시) ──
function StickySignupBanner({
  isLoggedIn,
  onSave,
}: {
  isLoggedIn: boolean;
  onSave: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("aeolab_trial_banner_dismissed") === "1") {
        setDismissed(true);
      }
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }, []);

  if (isLoggedIn || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("aeolab_trial_banner_dismissed", "1");
    } catch {
      // 무시
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white px-4 py-4 z-50 shadow-2xl">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm md:text-base font-semibold leading-snug">
            이 분석을 저장하고 매주 자동 진단 받으려면?
          </p>
          <p className="text-xs md:text-sm text-blue-200 mt-0.5">
            경쟁사 변화 · 7개 AI 전체 스캔 · 개선 가이드 — 월 9,900원
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/signup"
            onClick={onSave}
            className="bg-white text-blue-700 font-bold text-sm md:text-base px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap shadow-md"
          >
            회원가입하기 (1분)
          </Link>
          <button
            onClick={handleDismiss}
            aria-label="배너 닫기"
            className="text-blue-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-blue-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// 소상공인 친화적 항목 설명
const BREAKDOWN_INFO: Record<string, {
  label: string;
  icon: string;
  what: string;
  low: string;
  high: string;
  tip: string;
  improve: string;
  trialNote?: string;   // 체험 스캔에서 측정 불가 항목용 안내 (low 대신 표시)
}> = {
  exposure_freq: {
    label: "AI 검색 노출",
    icon: "🔍",
    what: "ChatGPT·Gemini 등 AI에 \"추천해줘\"라고 물으면 내 가게 이름이 나오는지 확인합니다.",
    low:  "이번 테스트에서 AI가 내 가게를 언급하지 않았습니다. 아직 AI가 내 가게를 모를 수 있습니다.",
    high: "이번 테스트에서 AI가 내 가게를 언급했습니다.",
    tip:  "Basic 플랜에서 100회 반복 테스트로 정확한 노출 확률을 측정합니다.",
    improve: "네이버 스마트플레이스 FAQ 등록 + 리뷰 답변 키워드 삽입",
  },
  review_quality: {
    label: "리뷰 평판",
    icon: "⭐",
    what: "네이버·카카오맵 등에 등록된 리뷰 수와 평점입니다. AI는 리뷰가 많고 평점이 높은 가게를 더 자주 추천합니다.",
    low:  "리뷰 수가 적거나 평점이 낮아 AI가 신뢰도 있는 가게로 인식하기 어렵습니다.",
    high: "리뷰와 평점이 충분해 AI가 신뢰할 수 있는 가게로 인식합니다.",
    tip:  "리뷰 키워드 분석으로 어떤 단어가 AI 추천에 영향을 주는지 확인합니다.",
    improve: "리뷰 수 늘리기 + 키워드 포함 답변 달기",
    trialNote: "체험 스캔에서는 실제 리뷰 수·평점을 직접 수집하지 않습니다. 정식 스캔에서 실제 데이터로 정확히 측정됩니다.",
  },
  schema_score: {
    label: "온라인 정보 정리",
    icon: "📋",
    what: "내 가게의 영업시간·전화번호·위치·메뉴가 인터넷에 얼마나 잘 정리돼 있는지입니다. AI는 정리가 잘 된 가게를 더 자주 추천합니다.",
    low:  "가게 정보가 인터넷에 충분히 등록되지 않아 AI가 정확한 정보를 파악하기 어렵습니다.",
    high: "가게 기본 정보가 잘 정리돼 있어 AI가 쉽게 인식합니다.",
    tip:  "홈페이지·네이버플레이스·카카오맵에 빠진 정보를 자동으로 찾아드립니다.",
    improve: "AI 검색 최적화 정보 + Open Graph 태그 추가",
    trialNote: "체험 스캔에서는 온라인 정보 완성도를 완전히 측정하기 어렵습니다. 정식 스캔에서 네이버플레이스·웹사이트 데이터를 기반으로 측정됩니다.",
  },
  online_mentions: {
    label: "온라인 언급 수",
    icon: "📢",
    what: "네이버 블로그에서 내 가게 후기가 몇 건인지입니다. 후기가 많을수록 손님이 더 신뢰하고 AI도 더 자주 추천합니다.",
    low:  "블로그 후기가 적어 손님이 검색할 때 경쟁 가게 후기가 먼저 보입니다.",
    high: "블로그 후기가 충분해 손님이 검색할 때 내 가게를 발견하기 쉽습니다.",
    tip:  "Basic에서 경쟁사 대비 블로그 후기 격차와 키워드별 분석을 제공합니다.",
    improve: "블로그 포스팅 + 소식 업데이트 주 1회",
  },
  info_completeness: {
    label: "기본 정보 완성도",
    icon: "📍",
    what: "전화번호·주소·영업시간·메뉴판 등 기본 정보가 얼마나 등록되어 있는지입니다.",
    low:  "전화번호·영업시간 등 기본 정보가 일부 누락되어 있습니다.",
    high: "기본 정보가 모두 잘 등록되어 있습니다.",
    tip:  "어떤 정보가 빠져 있는지 항목별로 체크리스트를 제공합니다.",
    improve: "사업장 정보 완성도 100% 채우기",
    trialNote: "체험 스캔에서 입력하지 않은 항목은 측정되지 않습니다. 사업장 등록 후 정확한 완성도를 확인하세요.",
  },
  content_freshness: {
    label: "최근 활동",
    icon: "🗓️",
    what: "최근에 새 리뷰나 소식이 올라오면 AI가 현재 운영 중인 가게로 인식합니다.",
    low:  "최근 활동이 없으면 AI가 가게가 문을 닫은 것으로 판단할 수 있습니다.",
    high: "최근 활동이 확인되어 AI가 현재 운영 중인 가게로 인식합니다.",
    tip:  "리뷰 요청 타이밍과 콘텐츠 업데이트 주기를 가이드로 제공합니다.",
    improve: "월 2회 이상 업데이트로 최신성 유지",
  },
};

// 업종별 벤치마크 기본값
const CATEGORY_BENCHMARKS: Record<string, { avg: number; top30: number }> = {
  food:          { avg: 52, top30: 68 },
  cafe:          { avg: 48, top30: 65 },
  health:        { avg: 58, top30: 75 },
  beauty:        { avg: 55, top30: 72 },
  education:     { avg: 53, top30: 70 },
  professional:  { avg: 50, top30: 67 },
  shopping:      { avg: 44, top30: 61 },
  living:        { avg: 47, top30: 63 },
  culture:       { avg: 45, top30: 62 },
  accommodation: { avg: 51, top30: 68 },
};

const SCAN_STEPS = [
  "손님이 쓰는 검색어 만드는 중",
  "AI에 내 가게 물어보는 중",
  "AI 답변 분석 중",
  "경쟁 가게와 비교 중",
  "점수 계산 중",
];

type Step = "category" | "tags" | "info" | "scanning" | "result";

const TRIAL_LS_KEY    = "aeolab_trial_v2";
const TRIAL_DAY_MS    = 24 * 60 * 60 * 1000;
const TRIAL_DAY_LIMIT = 20;

interface TrialStore { count: number; resetAt: number }

function loadTrialStore(): TrialStore {
  if (typeof window === "undefined") return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
  try {
    const raw = localStorage.getItem(TRIAL_LS_KEY);
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
  localStorage.setItem(TRIAL_LS_KEY, JSON.stringify(store));
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

export default function TrialPage() {
  const [step, setStep] = useState<Step>("category");
  const [result, setResult] = useState<TrialScanResult | null>(null);
  const [error, setError] = useState("");
  const [scanStep, setScanStep] = useState(0);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState<"location_based" | "non_location">("location_based");
  const [form, setForm] = useState({
    business_name: "",
    region: "",
    extra_keyword: "",
    email: "",
    is_smart_place: undefined as boolean | undefined,
  });
  const [hasFaq, setHasFaq]               = useState(false);
  const [hasRecentPost, setHasRecentPost] = useState(false);
  const [hasIntro, setHasIntro]           = useState(false);
  const [reviewText, setReviewText]       = useState("");
  const [description, setDescription]     = useState("");
  const [copied, setCopied]               = useState(false);
  const [isStartupMode, setIsStartupMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn]       = useState(false);

  // 2단계: 네이버 AI 브리핑 실시간 확인 state
  const [naverBriefingLoading, setNaverBriefingLoading]   = useState(false);
  const [naverBriefingProgress, setNaverBriefingProgress] = useState(0);
  const [naverBriefingMessage, setNaverBriefingMessage]   = useState("");
  const [naverBriefingResult, setNaverBriefingResult]     = useState<{
    exposed: boolean;
    in_briefing: boolean;
    rank: number | null;
    competitor_count: number;
    improvement_hint: string;
    query: string;
  } | null>(null);
  const [naverBriefingError, setNaverBriefingError]       = useState<string | null>(null);

  // 회원가입 전 체험 데이터를 localStorage에 저장 — onboarding에서 자동 입력됨
  const saveTrialData = () => {
    try {
      localStorage.setItem("aeolab_trial_prefill", JSON.stringify({
        name: form.business_name,
        category: selectedCategory,
        region: form.region,
      }));
    } catch {
      // localStorage 접근 실패 시 무시
    }
  };

  useEffect(() => {
    setCooldownMs(getTrialCooldownRemaining());
    // 세션 확인 — sticky CTA 표시 여부 결정
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  useEffect(() => {
    if (cooldownMs <= 0) return;
    const id = setInterval(() => {
      const remaining = getTrialCooldownRemaining();
      setCooldownMs(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 60_000);
    return () => clearInterval(id);
  }, [cooldownMs]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const buildKeyword = () => {
    const tags = selectedTags.slice(0, 3).join(" ");
    return form.extra_keyword
      ? `${tags} ${form.extra_keyword}`.trim()
      : tags;
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const remaining = getTrialCooldownRemaining();
    if (remaining > 0) {
      setCooldownMs(remaining);
      setError(`오늘 무료 체험을 이미 사용하셨습니다. ${formatCooldown(remaining)} 후 다시 이용하거나 회원가입 후 전체 분석을 이용하세요.`);
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
    }, 600);

    try {
      const keyword = buildKeyword();
      const data = await trialScan({
        business_name: isStartupMode && !form.business_name ? `[${selectedCategory}] 예비창업` : form.business_name,
        category: selectedCategory,
        region: form.region || undefined,
        keyword: keyword || undefined,
        keywords: selectedTags.length > 0 ? selectedTags : undefined,
        email: form.email || undefined,
        business_type: businessType,
        has_faq: hasFaq,
        has_recent_post: hasRecentPost,
        has_intro: hasIntro,
        is_smart_place: form.is_smart_place,
        review_text: reviewText || undefined,
        description: description || undefined,
      });
      clearInterval(stepInterval);
      setScanStep(SCAN_STEPS.length - 1);
      recordTrialUse();
      setResult(data);
      setStep("result");
    } catch (err: unknown) {
      clearInterval(stepInterval);
      if (err instanceof ApiError && err.code === "TRIAL_LIMIT") {
        setError("하루 무료 체험 한도(3회)에 도달했습니다. 내일 다시 시도하거나 회원가입 후 전체 분석을 이용하세요.");
        recordTrialUse();
      } else {
        setError("스캔 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
      setStep("info");
    }
  };

  const reset = () => {
    setStep("category");
    setResult(null);
    setSelectedCategory("");
    setSelectedTags([]);
    setBusinessType("location_based");
    setForm({ business_name: "", region: "", extra_keyword: "", email: "", is_smart_place: undefined });
    setScanStep(0);
    setNaverBriefingLoading(false);
    setNaverBriefingProgress(0);
    setNaverBriefingMessage("");
    setNaverBriefingResult(null);
    setNaverBriefingError(null);
  };

  async function handleNaverBriefingCheck() {
    if (!result) return;
    setNaverBriefingLoading(true);
    setNaverBriefingProgress(5);
    setNaverBriefingMessage("네이버 검색 준비 중...");
    setNaverBriefingError(null);

    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://aeolab.co.kr";
      const res = await fetch(`${BACKEND_URL}/api/scan/trial/naver-briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: form.business_name || `[${selectedCategory}] 예비창업`,
          region: form.region || "",
          category: selectedCategory || "",
          keyword: buildKeyword() || selectedTags[0] || "",
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("서버 연결 실패");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") {
              setNaverBriefingProgress(data.pct);
              setNaverBriefingMessage(data.message);
            } else if (data.type === "result") {
              setNaverBriefingResult(data);
              setNaverBriefingProgress(100);
              setNaverBriefingLoading(false);
            } else if (data.type === "error") {
              setNaverBriefingError(data.message);
              setNaverBriefingLoading(false);
            }
          } catch {
            // JSON 파싱 실패 시 무시
          }
        }
      }
    } catch (e: unknown) {
      setNaverBriefingError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      setNaverBriefingLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">AEOlab</Link>
          <span className="text-sm text-gray-500">무료 AI 노출 진단</span>
        </div>
      </header>

      {/* ── 입력 단계 (단일 컬럼) ── */}
      {step !== "result" && (
        <div className="max-w-2xl mx-auto py-10 px-4">

          {step !== "scanning" && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {[
                { key: "category", label: "업종" },
                { key: "tags", label: "서비스" },
                { key: "info", label: "정보 입력" },
              ].map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${
                    step === s.key
                      ? "bg-blue-600 text-white"
                      : ["category", "tags", "info"].indexOf(step) > i
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <span>{i + 1}</span>
                    <span>{s.label}</span>
                  </div>
                  {i < 2 && <div className="w-4 h-px bg-gray-300" />}
                </div>
              ))}
            </div>
          )}

          {/* 1단계: 업종 선택 */}
          {step === "category" && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">
                어떤 업종인가요?
              </h1>
              <p className="text-gray-500 text-center text-sm mb-6">
                가장 가까운 업종을 선택하세요
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {CATEGORY_GROUPS.map((cat) => {
                  const cfg = CATEGORY_ICON_MAP[cat.value];
                  const Icon = cfg?.Icon;
                  const selected = selectedCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => {
                        setSelectedCategory(cat.value);
                        setSelectedTags([]);
                        setStep("tags");
                      }}
                      className={`
                        flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 cursor-pointer
                        transition-all duration-150 hover:scale-105 hover:shadow-md
                        ${selected
                          ? `${cfg?.bg ?? "bg-blue-50"} ${cfg?.border ?? "border-blue-300"} shadow-sm`
                          : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                        }
                      `}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? (cfg?.bg ?? "bg-blue-100") : (cfg?.bg ?? "bg-gray-100")}`}>
                        {Icon
                          ? <Icon className={`w-5 h-5 ${cfg?.text ?? "text-gray-500"}`} strokeWidth={1.8} />
                          : <span className="text-xl">{cat.emoji}</span>
                        }
                      </div>
                      <span className={`text-xs font-semibold text-center leading-tight ${selected ? (cfg?.text ?? "text-blue-600") : "text-gray-600"}`}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2단계: 서비스 태그 선택 */}
          {step === "tags" && selectedCategory && (
            <div>
              <button
                onClick={() => setStep("category")}
                className="text-base text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> 업종 다시 선택
              </button>
              {(() => {
                const cfg = CATEGORY_ICON_MAP[selectedCategory];
                const Icon = cfg?.Icon;
                return (
                  <div className="flex items-center gap-2.5 mb-1">
                    {Icon && (
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-5 h-5 ${cfg.text}`} strokeWidth={1.8} />
                      </div>
                    )}
                    <h2 className="text-xl font-bold text-gray-900">
                      {CATEGORY_MAP[selectedCategory]?.label}
                    </h2>
                  </div>
                );
              })()}
              <p className="text-base text-gray-500 mb-4">
                해당하는 서비스를 모두 선택하세요 <span className="text-blue-500">(복수 선택 가능)</span>
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {CATEGORY_MAP[selectedCategory]?.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      selectedTags.includes(tag)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-700">
                  선택한 서비스: <strong>{selectedTags.join(", ")}</strong>
                </div>
              )}
              <button
                onClick={() => setStep("info")}
                disabled={selectedTags.length === 0}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음 →
              </button>
              <p className="text-sm text-center text-gray-400 mt-2">서비스를 1개 이상 선택하세요</p>
            </div>
          )}

          {/* 3단계: 정보 입력 */}
          {step === "info" && (
            <div>
              <button
                onClick={() => setStep("tags")}
                className="text-base text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> 서비스 다시 선택
              </button>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {isStartupMode ? "경쟁 환경 분석" : "사업장 정보를 입력하세요"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsStartupMode((v) => !v);
                    if (!isStartupMode) setForm((f) => ({ ...f, business_name: "" }));
                  }}
                  className={`text-sm px-3 py-1.5 rounded-full border-2 font-medium transition-all ${
                    isStartupMode
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-400 hover:border-amber-400 hover:text-amber-600"
                  }`}
                >
                  {isStartupMode ? "🚀 예비 창업자 모드" : "아직 가게가 없어요"}
                </button>
              </div>
              {isStartupMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                  <p className="text-base font-semibold text-amber-800 mb-1">🚀 예비 창업자 모드</p>
                  <p className="text-base text-amber-700">
                    가게 이름 없이 업종·지역의 <strong>경쟁 환경</strong>을 분석합니다.
                  </p>
                </div>
              )}

              {(() => {
                const cfg = CATEGORY_ICON_MAP[selectedCategory];
                const Icon = cfg?.Icon;
                return (
                  <div className={`rounded-xl p-3 mb-4 flex items-center gap-3 ${cfg?.bg ?? 'bg-gray-50'}`}>
                    {Icon && (
                      <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                        <Icon className={`w-4 h-4 ${cfg?.text ?? 'text-gray-600'}`} strokeWidth={1.8} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${cfg?.text ?? 'text-gray-600'}`}>{CATEGORY_MAP[selectedCategory]?.label}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedTags.map((t) => (
                          <span key={t} className="bg-white/70 text-gray-700 text-sm px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setBusinessType("location_based")}
                  className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    businessType === "location_based"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  🏪 오프라인 매장
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessType("non_location")}
                  className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    businessType === "non_location"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  💻 배달·온라인·전문직
                </button>
              </div>

              <form onSubmit={handleScan} className="space-y-4">
                {!isStartupMode && (
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">사업장 이름 *</label>
                    <input
                      type="text"
                      required={!isStartupMode}
                      placeholder="사업장 이름을 입력하세요"
                      value={form.business_name}
                      onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* 가게 소개 한 줄 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    가게 소개 한 줄 <span className="text-gray-400 font-normal">(선택)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="예: 20년 전통 손칼국수 전문점"
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-400 mt-1">가게의 핵심 강점을 한 문장으로 표현해주세요 — AI 분석 시 가게를 더 정확하게 파악합니다</p>
                </div>

                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1">
                    지역{businessType === "location_based" ? " *" : <span className="text-gray-400 font-normal ml-1">(선택)</span>}
                  </label>
                  <input
                    type="text"
                    required={businessType === "location_based"}
                    placeholder={businessType === "location_based" ? "시·구·동 단위로 입력 (예: 수원시 팔달구)" : "서울 강남 등 (비워두면 전국 검색)"}
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1">
                    추가 키워드 <span className="text-gray-400 font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="예: 주차 가능, 예약 운영, 포장 가능"
                    value={form.extra_keyword}
                    onChange={(e) => setForm({ ...form, extra_keyword: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-sm text-gray-400 mt-1">운영 방식이나 서비스 특징을 쉼표로 구분해 입력해주세요</p>
                </div>

                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1">
                    이메일 <span className="text-gray-400 font-normal">(결과를 이메일로 받기, 선택)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {businessType === "location_based" && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-base font-semibold text-green-800 mb-1">
                      📍 네이버 스마트플레이스 현황 <span className="font-normal text-green-600">(선택 — 체크할수록 정확해요)</span>
                    </p>
                    <p className="text-sm text-green-700 mb-3">
                      체크한 항목은 네이버 AI 브리핑 점수에 즉시 반영됩니다.
                    </p>
                    <div className="space-y-2.5">
                      {/* 스마트플레이스 등록 여부 — API 결과보다 우선 적용 */}
                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-green-400 transition-colors">
                        <input
                          type="checkbox"
                          checked={form.is_smart_place ?? false}
                          onChange={(e) => setForm(prev => ({ ...prev, is_smart_place: e.target.checked }))}
                          className="w-5 h-5 rounded accent-green-500"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">네이버 스마트플레이스에 등록되어 있습니다</p>
                          <p className="text-xs text-gray-500">네이버 지도·플레이스에 가게 정보가 등록된 경우 체크</p>
                        </div>
                      </label>
                      {[
                        { id: "has_faq", checked: hasFaq, onChange: setHasFaq, label: "Q&A(FAQ) 탭에 질문을 등록했어요", badge: "+30점", desc: "AI 브리핑에서 가장 직접 인용되는 항목" },
                        { id: "has_recent_post", checked: hasRecentPost, onChange: setHasRecentPost, label: "최근 7일 내 '소식'을 업데이트했어요", badge: "+20점", desc: "AI가 '지금 운영 중'으로 인식하는 최신성 신호" },
                        { id: "has_intro", checked: hasIntro, onChange: setHasIntro, label: "가게 소개글을 작성했어요", badge: "+10점", desc: "키워드 기반 영구 랭킹 신호" },
                      ].map((item) => (
                        <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => item.onChange(e.target.checked)}
                            className="mt-0.5 w-4 h-4 accent-green-600 cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base text-gray-800 group-hover:text-green-700 transition-colors">{item.label}</span>
                              <span className="text-sm font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">{item.badge}</span>
                            </div>
                            <p className="text-sm text-gray-400 mt-0.5">{item.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-base font-medium text-gray-700 mb-1">
                    손님 리뷰 1~3개 붙여넣기{" "}
                    <span className="text-gray-400 font-normal">(선택 — 건너뛰어도 됩니다)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder={"리뷰를 붙여넣으면 어떤 키워드가 부족한지 정확하게 알 수 있습니다.\n예) 분위기 좋고 음식도 맛있어요. 주차공간이 넓어서 좋았습니다."}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <p className="text-sm text-gray-400 mt-1">
                    없으면 업종 평균으로 추정합니다.
                  </p>
                </div>

                {cooldownMs > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                    오늘 무료 체험 횟수를 모두 사용했습니다.{" "}
                    <strong>{formatCooldown(cooldownMs)}</strong> 후 다시 이용하거나{" "}
                    <a href="/signup" className="underline font-medium">회원가입</a>하면 매일 자동 스캔이 가능합니다.
                  </div>
                )}
                {error && !cooldownMs && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors"
                >
                  내 가게 온라인 현황 무료 진단 (무료)
                </button>
              </form>
            </div>
          )}

          {/* 스캔 단계 */}
          {step === "scanning" && (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h2 className="text-xl font-semibold text-gray-900 mb-1">내 가게 분석 중...</h2>
              <p className="text-gray-500 text-sm mb-8">
                손님이 &ldquo;{form.region} {selectedTags[0]} 추천&rdquo; 이라고 물어봤을 때<br />
                AI에 내 가게가 노출되는지 진단하고 있습니다.
              </p>
              <div className="max-w-xs mx-auto space-y-2">
                {SCAN_STEPS.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg transition-all ${
                      i < scanStep ? "text-green-600 bg-green-50"
                        : i === scanStep ? "text-blue-600 bg-blue-50 font-medium"
                        : "text-gray-300"
                    }`}
                  >
                    {i < scanStep ? <span>✓</span>
                      : i === scanStep ? <span className="w-3 h-3 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin inline-block" />
                      : <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />}
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 결과 페이지: PC 2컬럼 / 모바일 단일 ── */}
      {step === "result" && result && (() => {
        const track1      = result.track1_score ?? result.score.track1_score ?? result.score.naver_channel_score ?? Math.round(result.score.total_score);
        const track2      = result.track2_score ?? result.score.track2_score ?? result.score.global_channel_score ?? Math.round(result.score.total_score);
        const naverW      = result.naver_weight ?? result.score.naver_weight ?? 0.65;
        const globalW     = result.global_weight ?? result.score.global_weight ?? 0.35;
        const unified     = result.score.unified_score ?? result.score.total_score;
        const gs          = result.growth_stage;
        const gsLabel     = result.growth_stage_label ?? gs?.stage_label ?? "성장 중";
        const gsCode      = gs?.stage ?? "stability";
        const isEstimated = result.is_keyword_estimated ?? false;
        const missingKws  = result.top_missing_keywords ?? [];
        const pioneerKws  = result.pioneer_keywords ?? [];
        const faqText     = result.faq_copy_text ?? null;

        const mentioned   = result.result.gemini?.mentioned ?? false;
        const excerpt     = result.result.gemini?.excerpt ?? "";
        const score       = Math.round(result.score.total_score);
        const grade       = result.score.grade;
        const naver        = result.naver;
        const kakao        = result.kakao;
        const naverRank    = naver?.my_rank ?? null;
        const kakaoRank    = kakao?.my_rank ?? null;
        const blogCount    = naver?.blog_mentions ?? 0;
        // 우선순위: 1) 사용자 직접 체크 2) API 결과(확인된 경우만) 3) null(불명확)
        const smartPlaceStatus: boolean | null =
          form.is_smart_place === true ? true :
          form.is_smart_place === false ? null :
          (naver?.is_smart_place === true ? true : null);
        const isSmartPlace = smartPlaceStatus === true;
        const isOnKakao    = kakao?.is_on_kakao ?? false;
        const naverCh      = result.score.naver_channel_score;
        const naverAIResult = result.result?.naver;
        const inBriefing   = naverAIResult?.in_briefing ?? null;
        const hasCompetitorsInBriefing = naver?.naver_competitors && naver.naver_competitors.length > 0;

        // 업종 벤치마크
        const benchmarkData = CATEGORY_BENCHMARKS[selectedCategory] ?? { avg: 50, top30: 65 };
        const apiResult = result as TrialScanResult & { benchmark?: { avg: number; top30: number } };
        const benchmarkAvg  = apiResult.benchmark?.avg ?? benchmarkData.avg;
        const benchmarkTop  = apiResult.benchmark?.top30 ?? benchmarkData.top30;
        const isAboveAvg    = score >= benchmarkAvg;

        // 가장 약한 항목
        const breakdownEntries = result.score.breakdown
          ? Object.entries(result.score.breakdown)
              .map(([key, val]) => ({ key, val: Math.round(Number(val)), info: BREAKDOWN_INFO[key] }))
              .filter((e) => e.info)
          : [];
        const weakestItem = breakdownEntries.length > 0
          ? breakdownEntries.reduce((a, b) => a.val < b.val ? a : b)
          : null;

        // 소비자 선택 가능성
        const selectionScore = (() => {
          let s = 0;
          if (mentioned)           s += 25;
          if (naverRank !== null)  s += 25;
          if (isOnKakao)           s += 20;
          if (blogCount > 5)       s += 20;
          else if (blogCount > 0)  s += 10;
          if (isSmartPlace)        s += 10;
          return s;
        })();

        return (
          <>
            {/* ── Sticky CTA: 비로그인 사용자 전용 (상단) ── */}
            {!isLoggedIn && (
              <div
                className="sticky top-0 z-40 bg-blue-600 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-md"
              >
                <p className="text-sm font-medium leading-tight">
                  전체 결과 + 경쟁사 비교는 무료 회원가입하면 전체 보기
                </p>
                <Link
                  href="/signup"
                  onClick={saveTrialData}
                  className="shrink-0 bg-white text-blue-600 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  회원가입
                </Link>
              </div>
            )}

            {/* ── Sticky 하단 배너: 비로그인 + 결과 화면 전용 ── */}
            <StickySignupBanner isLoggedIn={isLoggedIn} onSave={saveTrialData} />

          <div className="max-w-5xl mx-auto py-6 px-4 pb-28">

            {/* ── 히어로: 경쟁사 vs 내 가게 ── */}
            {naver && naver.top_competitor_name && (
              <div className="bg-white rounded-2xl border-2 border-red-100 p-5 md:p-6 mb-4">
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                  지금 &ldquo;{naver.search_query}&rdquo; 검색하면
                </p>
                {/* 1위 경쟁사 */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gray-800 text-white text-sm font-bold flex items-center justify-center">1</span>
                    <span className="font-bold text-gray-800 text-base">{naver.top_competitor_name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{(naver.top_competitor_blog_count ?? 0).toLocaleString()}건 후기</span>
                </div>
                {/* 내 가게 */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                      {naver.my_rank ?? "?"}
                    </span>
                    <span className="font-bold text-blue-700 text-base">
                      {form.business_name}{" "}
                      <span className="text-xs font-normal text-blue-400">내 가게</span>
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-blue-700">{(naver.blog_mentions ?? 0).toLocaleString()}건 후기</span>
                </div>
                {/* 격차 메시지 */}
                {(naver.top_competitor_blog_count ?? 0) > (naver.blog_mentions ?? 0) && (
                  <div className="mt-3 bg-red-50 rounded-xl px-4 py-3 text-sm text-red-700">
                    <span className="font-bold">손님 10명이 후기를 검색하면 {naver.top_competitor_name}를 먼저 봅니다.</span>
                    <br />격차{" "}
                    <strong>{((naver.top_competitor_blog_count ?? 0) - (naver.blog_mentions ?? 0)).toLocaleString()}건</strong>{" "}
                    — 리뷰 답변에 키워드를 넣으면 좁힐 수 있습니다.
                  </div>
                )}
                {(naver.my_rank === 1) && (
                  <div className="mt-3 bg-green-50 rounded-xl px-4 py-3 text-sm text-green-700 font-semibold">
                    이 키워드에서 지역 1위입니다. 지금 상태를 유지하는 것이 중요합니다.
                  </div>
                )}
              </div>
            )}

            {/* ── AI 브리핑 준비 체크리스트 (히어로) ── */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📋</span>
                <h2 className="text-lg font-bold text-gray-900">
                  {form.business_name || "내 가게"} — 손님이 내 가게를 찾을 수 있는지 확인
                </h2>
              </div>

              <div className="bg-white rounded-2xl border-2 border-blue-100 overflow-hidden divide-y divide-gray-100">

                {/* 1. 스마트플레이스 */}
                <div className="flex items-start gap-3 px-5 py-4">
                  <span className="text-xl shrink-0 mt-0.5">{isSmartPlace ? "✅" : "❓"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900">
                      스마트플레이스 {isSmartPlace ? "등록됨" : "확인 필요"}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {isSmartPlace
                        ? "네이버 지도·플레이스에서 손님이 가게를 찾을 수 있습니다"
                        : "등록 여부를 위 체크박스로 알려주시면 정확도가 높아집니다"}
                    </p>
                  </div>
                  {isSmartPlace && (
                    <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">확인됨</span>
                  )}
                </div>

                {/* 2. 네이버 지역 순위 */}
                <div className="flex items-start gap-3 px-5 py-4">
                  <span className="text-xl shrink-0 mt-0.5">
                    {naverRank ? (naverRank <= 5 ? "✅" : "⚠️") : "❌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold text-gray-900">
                        네이버 지역 검색 {naverRank ? `${naverRank}위` : "미노출"}
                      </p>
                      {naverRank && naverRank <= 3 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">상위 노출</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      &ldquo;{naver?.search_query ?? `${form.region} ${selectedTags[0] ?? ""}`}&rdquo; 기준
                    </p>
                    <a
                      href={`https://search.naver.com/search.naver?query=${encodeURIComponent(naver?.search_query ?? `${form.region} ${selectedTags[0] ?? ""}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 underline mt-1 inline-block"
                    >
                      네이버에서 직접 확인 →
                    </a>
                    {naver?.keyword_ranks && naver.keyword_ranks.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {naver.keyword_ranks.slice(0, 2).map((kr, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              kr.exposed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {kr.exposed ? `${kr.rank}위` : '미노출'}
                            </span>
                            <span className="text-gray-600">&ldquo;{kr.query}&rdquo; 검색</span>
                          </div>
                        ))}
                        {naver.keyword_ranks.length > 2 && (
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                            <span>🔒</span>
                            <span>+{naver.keyword_ranks.length - 2}개 키워드 순위 — 가입하면 전체 보기</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <span className={`text-2xl font-black shrink-0 self-center ${
                    naverRank === 1 ? "text-yellow-500" :
                    naverRank ? "text-green-500" : "text-red-400"
                  }`}>
                    {naverRank ? `${naverRank}위` : "—"}
                  </span>
                </div>

                {/* 3. 블로그 언급 */}
                <div className="flex items-start gap-3 px-5 py-4">
                  <span className="text-xl shrink-0 mt-0.5">
                    {blogCount >= 100 ? "✅" : blogCount >= 10 ? "⚠️" : "❌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold text-gray-900">
                        블로그 언급 {blogCount.toLocaleString()}건
                      </p>
                      {naver?.top_competitor_blog_count != null && naver.top_competitor_blog_count > blogCount && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          경쟁 1위 대비 {(naver.top_competitor_blog_count - blogCount).toLocaleString()}건 적음
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      네이버 블로그 &ldquo;{form.region ? `${form.region.split(" ")[0]} ` : ""}{form.business_name}&rdquo; 언급 횟수
                    </p>
                    <a
                      href={`https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(form.business_name || "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 underline mt-1 inline-block"
                    >
                      블로그 직접 확인 →
                    </a>
                  </div>
                  <span className={`text-2xl font-black shrink-0 self-center ${
                    blogCount >= 100 ? "text-blue-500" :
                    blogCount >= 10 ? "text-amber-500" : "text-gray-400"
                  }`}>
                    {blogCount > 0 ? blogCount.toLocaleString() : "0"}
                  </span>
                </div>

                {/* 4. FAQ 등록 */}
                <div className={`flex items-start gap-3 px-5 py-4 ${!hasFaq ? "bg-amber-50" : ""}`}>
                  <span className="text-xl shrink-0 mt-0.5">{hasFaq ? "✅" : "❌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900">
                      스마트플레이스 FAQ {hasFaq ? "등록됨" : "미등록"}
                    </p>
                    <p className={`text-sm mt-0.5 ${hasFaq ? "text-gray-500" : "text-amber-700"}`}>
                      {hasFaq
                        ? "AI 브리핑이 FAQ를 직접 인용합니다"
                        : "AI 브리핑에 가장 직접 인용되는 항목 — 오늘 등록하면 빠르면 1주 내 노출 가능"}
                    </p>
                  </div>
                  {!hasFaq && (
                    <span className="shrink-0 text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded-full font-bold self-center">즉시 가능</span>
                  )}
                </div>

                {/* 5. 네이버 AI가 내 가게를 추천하는지 */}
                <div className="flex items-start gap-3 px-5 py-4 bg-gray-50">
                  <span className="text-xl shrink-0 mt-0.5">
                    {naverBriefingResult
                      ? (naverBriefingResult.in_briefing ? "✅" : "❌")
                      : "❓"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900">
                      네이버 AI가 내 가게를 추천하는지{" "}
                      {naverBriefingResult && (
                        <span className={`text-sm font-bold ${naverBriefingResult.in_briefing ? "text-green-600" : "text-red-500"}`}>
                          — {naverBriefingResult.in_briefing ? "노출 중 ✓" : "미노출"}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {naverBriefingResult
                        ? (naverBriefingResult.in_briefing
                            ? "지금 손님이 AI에 물으면 내 가게가 추천됩니다"
                            : "FAQ 등록 후 1~2주 뒤 재확인하세요")
                        : naverBriefingLoading
                          ? `${naverBriefingMessage || "확인 중..."}`
                          : "지금 AI가 내 가게를 추천하는지 실제로 확인합니다 — 약 30초"}
                    </p>
                  </div>
                  {!naverBriefingResult && businessType === "location_based" && (
                    naverBriefingLoading ? (
                      <div className="shrink-0 flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="w-3 h-3 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin" />
                        {naverBriefingProgress}%
                      </div>
                    ) : (
                      <button
                        onClick={handleNaverBriefingCheck}
                        className="shrink-0 text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-lg transition-colors self-center"
                      >
                        확인하기 →
                      </button>
                    )
                  )}
                </div>

              </div>

              {/* 경쟁사 블로그 비교 바 */}
              {naver?.top_competitor_name && (
                <div className="mt-3 bg-white rounded-2xl border border-gray-200 p-4">
                  <p className="text-sm font-bold text-gray-800 mb-3">
                    경쟁 1위와 블로그 비교
                  </p>
                  {[
                    { name: naver.top_competitor_name, count: naver.top_competitor_blog_count ?? 0, isMe: false },
                    { name: form.business_name || "내 가게", count: blogCount, isMe: true },
                  ].map((item) => {
                    const maxCount = Math.max(naver.top_competitor_blog_count ?? 0, blogCount, 1);
                    const pct = Math.round((item.count / maxCount) * 100);
                    return (
                      <div key={item.name} className="mb-2.5 last:mb-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-sm font-medium truncate mr-2 ${item.isMe ? "text-blue-700" : "text-gray-600"}`}>
                            {item.name}
                            {item.isMe && <span className="ml-1.5 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">내 가게</span>}
                          </span>
                          <span className={`text-sm font-bold shrink-0 ${item.isMe ? "text-blue-600" : "text-gray-600"}`}>
                            {item.count.toLocaleString()}건
                          </span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full">
                          <div
                            className={`h-2.5 rounded-full transition-all ${item.isMe ? "bg-blue-500" : "bg-gray-300"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-500 mt-2">
                    {blogCount < (naver.top_competitor_blog_count ?? 0)
                      ? `격차 ${((naver.top_competitor_blog_count ?? 0) - blogCount).toLocaleString()}건 → 리뷰 답변 키워드 삽입으로 좁힐 수 있습니다`
                      : "블로그 언급이 경쟁 1위보다 많습니다 ✓"}
                  </p>
                  {/* 키워드별 블로그 비교 */}
                  {result.keyword_blog_comparison && result.keyword_blog_comparison.length > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-3">키워드별 블로그 언급 비교</p>
                      <div className="space-y-3">
                        {result.keyword_blog_comparison.slice(0, 2).map((kbc, i) => {
                          const maxCount = Math.max(kbc.my_count, kbc.competitor_count, 1);
                          const myPct   = Math.round((kbc.my_count / maxCount) * 100);
                          const compPct = Math.round((kbc.competitor_count / maxCount) * 100);
                          return (
                            <div key={i}>
                              <p className="text-xs font-medium text-gray-700 mb-1.5">
                                &ldquo;<span className="text-blue-600">{kbc.keyword}</span>&rdquo; 키워드
                              </p>
                              {/* 경쟁사 바 */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500 w-20 shrink-0 truncate">
                                  {kbc.competitor_name || "경쟁사"}
                                </span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-gray-400 h-2 rounded-full transition-all"
                                    style={{ width: `${compPct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600 w-12 shrink-0 text-right">
                                  {kbc.competitor_count.toLocaleString()}건
                                </span>
                              </div>
                              {/* 내 가게 바 */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-blue-700 w-20 shrink-0 truncate">
                                  {form.business_name || "내 가게"}
                                </span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      kbc.my_count >= kbc.competitor_count
                                        ? "bg-green-500"
                                        : "bg-blue-500"
                                    }`}
                                    style={{ width: `${myPct}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-blue-700 w-12 shrink-0 text-right">
                                  {kbc.my_count.toLocaleString()}건
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {result.keyword_blog_comparison.length > 2 && (
                          <div className="mt-2 p-2 rounded bg-gray-50 border border-dashed border-gray-200 text-center">
                            <span className="text-xs text-gray-400">🔒 나머지 {result.keyword_blog_comparison.length - 2}개 키워드 비교는 가입하면 전체 보기</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 경쟁사 순위 목록 */}
              {naver?.naver_competitors && naver.naver_competitors.length > 0 && (
                <div className="mt-3 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-900">
                      &ldquo;{naver.search_query}&rdquo; 검색 결과 상위 가게
                    </p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {naver.naver_competitors.slice(0, 2).map((comp) => {
                      const bizClean = (form.business_name || '').toLowerCase().replace(/[\s\-_·&]/g, '');
                      const compClean = (comp.name || '').toLowerCase().replace(/[\s\-_·&]/g, '');
                      const isMe = bizClean.length > 0 && (compClean.includes(bizClean) || bizClean.includes(compClean));
                      return (
                        <div key={comp.rank} className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-blue-50" : ""}`}>
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            comp.rank === 1 ? "bg-yellow-400 text-white" :
                            comp.rank === 2 ? "bg-gray-300 text-gray-700" :
                            comp.rank === 3 ? "bg-orange-200 text-orange-800" : "bg-gray-100 text-gray-500"
                          }`}>{comp.rank}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-sm font-semibold ${isMe ? "text-blue-700" : "text-gray-800"}`}>{comp.name}</span>
                              {isMe && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                            </div>
                            {comp.address && <p className="text-xs text-gray-400 truncate">{comp.address}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {naver.naver_competitors.length > 2 && (
                    <div className="text-center py-2 rounded-b bg-gray-50 border-t border-dashed border-gray-200">
                      <span className="text-xs text-gray-400">🔒 상위 {naver.naver_competitors.length - 2}개 더 — 가입하면 전체 보기</span>
                    </div>
                  )}
                </div>
              )}

              {/* 오늘 바로 할 일 — FAQ 등록 */}
              {!hasFaq && faqText && (
                <div className="mt-3 bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base font-bold text-blue-900">📌 오늘 바로 할 일 — 5분</span>
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">AI 브리핑 노출 핵심</span>
                  </div>
                  <p className="text-sm text-blue-700 mb-3">
                    스마트플레이스 &gt; Q&amp;A 탭에 아래 문구를 등록하세요. AI가 이 FAQ를 직접 인용합니다.
                  </p>
                  {missingKws.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {missingKws.slice(0, 2).map((kw) => (
                        <span key={kw} className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full font-semibold">
                          없는 키워드: {kw}
                        </span>
                      ))}
                      {missingKws.length > 2 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-dashed border-gray-300">
                          🔒 +{missingKws.length - 2}개 더
                        </span>
                      )}
                    </div>
                  )}
                  {pioneerKws.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {pioneerKws.slice(0, 2).map((kw) => (
                        <span key={kw} className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded-full font-semibold">
                          🚩 선점 기회: {kw}
                        </span>
                      ))}
                      {pioneerKws.length > 2 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-dashed border-gray-300">
                          🔒 +{pioneerKws.length - 2}개 더
                        </span>
                      )}
                    </div>
                  )}
                  <div className="bg-white rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-line mb-3 border border-blue-200">
                    {faqText}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(faqText).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors"
                  >
                    {copied ? "✓ 복사됐습니다!" : "📋 FAQ 문구 복사하기"}
                  </button>
                  <p className="text-sm text-blue-600 mt-2">
                    👆 스마트플레이스 Q&amp;A 탭에 이 질문을 그대로 붙여넣으면 네이버 AI 브리핑에 직접 인용됩니다
                  </p>
                  <a
                    href="https://smartplace.naver.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 underline mt-1 block"
                  >
                    스마트플레이스 Q&amp;A 탭 바로가기 →
                  </a>
                </div>
              )}

              {/* 잠금 항목 통합 안내 */}
              {!isLoggedIn && (
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                  <p className="text-sm font-semibold text-blue-800 mb-1">
                    🔓 나머지 항목을 모두 보려면?
                  </p>
                  <p className="text-xs text-blue-600 mb-2">
                    키워드 전체 · 블로그 목록 · 경쟁사 분석 · 매일 자동 스캔
                  </p>
                  <a href="/signup" className="inline-block px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-full hover:bg-blue-700">
                    무료 가입하기 →
                  </a>
                </div>
              )}
            </div>

            {/* PC 2컬럼 그리드 */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

              {/* ── 왼쪽 메인 ── */}
              <div className="space-y-5 order-2 lg:order-1">

                {/* ── 2단계: 네이버 AI 브리핑 실제 확인 ── */}
                {businessType === "location_based" && (
                  <div className="space-y-4">

                    {/* 2단계 버튼 */}
                    {!naverBriefingResult && !naverBriefingLoading && !naverBriefingError && (
                      <div className="border-2 border-dashed border-green-300 rounded-xl p-5 bg-green-50 text-center space-y-3">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xl">🔍</span>
                          <p className="text-base font-bold text-green-800">
                            지금 실제로 네이버 AI 브리핑에 노출되고 있나요?
                          </p>
                        </div>
                        <p className="text-sm text-green-700">
                          소요 시간 약 30초 · 실제 네이버 검색 기준 · 1일 2회 무료
                        </p>
                        <button
                          onClick={handleNaverBriefingCheck}
                          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl px-6 py-3 transition-colors"
                        >
                          <span>네이버 AI 브리핑 실제 확인하기 →</span>
                        </button>
                      </div>
                    )}

                    {/* 재시도 오류 상태 */}
                    {naverBriefingError && !naverBriefingLoading && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                        <p className="text-sm font-semibold text-red-700">네이버 AI 브리핑 확인 중 오류가 발생했습니다.</p>
                        <p className="text-sm text-red-600">{naverBriefingError}</p>
                        <button
                          onClick={() => {
                            setNaverBriefingError(null);
                            setNaverBriefingProgress(0);
                            setNaverBriefingMessage("");
                          }}
                          className="text-sm text-red-600 underline"
                        >
                          다시 시도하기
                        </button>
                      </div>
                    )}

                    {/* SSE 진행바 */}
                    {naverBriefingLoading && (
                      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-green-400 border-t-green-600 rounded-full animate-spin inline-block shrink-0" />
                          <span className="text-sm font-semibold text-gray-700">네이버 AI 브리핑 실시간 확인 중...</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${naverBriefingProgress}%` }}
                          />
                        </div>
                        <p className="text-sm text-gray-500">{naverBriefingMessage}</p>
                      </div>
                    )}

                    {/* 최종 결과 카드 */}
                    {naverBriefingResult && (
                      <div className={`rounded-xl p-5 space-y-4 border-2 ${
                        naverBriefingResult.in_briefing
                          ? "bg-green-50 border-green-300"
                          : naverBriefingResult.exposed
                            ? "bg-blue-50 border-blue-200"
                            : "bg-red-50 border-red-300"
                      }`}>
                        {/* 핵심 결과 */}
                        <div className="flex items-start gap-3">
                          <span className="text-3xl shrink-0">
                            {naverBriefingResult.in_briefing ? "🟢" : naverBriefingResult.exposed ? "🔵" : "🔴"}
                          </span>
                          <div>
                            <p className="text-base font-bold text-gray-900">
                              {naverBriefingResult.in_briefing
                                ? "네이버 AI 브리핑에 노출 중!"
                                : naverBriefingResult.exposed
                                  ? `네이버 플레이스 ${naverBriefingResult.rank}위 노출 중`
                                  : "현재 네이버 AI 브리핑에 미노출"}
                            </p>
                            <p className="text-sm text-gray-600 mt-0.5">
                              검색어: &ldquo;{naverBriefingResult.query}&rdquo;
                            </p>
                          </div>
                        </div>

                        {/* 경쟁사 현황 (숫자만 공개, 상세는 잠금) */}
                        {naverBriefingResult.competitor_count > 0 && (
                          <div className="bg-white/80 rounded-lg p-3 space-y-2">
                            <p className="text-sm font-semibold text-gray-700">
                              {naverBriefingResult.in_briefing
                                ? `같은 검색에서 경쟁사 ${naverBriefingResult.competitor_count}곳도 함께 노출 중`
                                : `경쟁사 ${naverBriefingResult.competitor_count}곳이 이 검색에서 노출 중`}
                            </p>
                            {/* 경쟁사 상세는 잠금 */}
                            <div className="relative rounded-lg overflow-hidden border border-dashed border-gray-300">
                              <div className="blur-[3px] pointer-events-none select-none p-3 space-y-1.5">
                                {[...Array(3)].map((_, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className="h-3 bg-gray-300 rounded" style={{ width: `${60 + i * 10}%` }} />
                                    <div className="h-3 bg-gray-200 rounded w-12" />
                                  </div>
                                ))}
                              </div>
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/70">
                                <span className="text-xs font-semibold text-gray-600">🔒 어느 경쟁사가 노출 중인지</span>
                                <span className="text-xs text-gray-500">Basic 가입하면 확인 가능 가능</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 개선 힌트 1개 */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-700 mb-1">💡 개선 포인트</p>
                          <p className="text-sm text-amber-800">{naverBriefingResult.improvement_hint}</p>
                        </div>

                        {/* Basic CTA */}
                        <div className="bg-blue-600 rounded-xl p-4 text-white text-center space-y-2">
                          <p className="text-sm font-bold">
                            {naverBriefingResult.in_briefing
                              ? "더 많은 키워드로 노출 확장 + 경쟁사 추적"
                              : "매주 자동 추적 + 경쟁사 상세 분석 시작"}
                          </p>
                          <p className="text-xs opacity-80">월 9,900원 · 언제든 해지 가능</p>
                          <Link
                            href="/signup?plan=basic"
                            onClick={saveTrialData}
                            className="inline-flex items-center gap-1.5 bg-white text-blue-600 text-sm font-bold rounded-lg px-5 py-2.5 hover:bg-blue-50 transition-colors"
                          >
                            Basic 시작하기 →
                          </Link>
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* ── 손님의 검색 여정 ── */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">손님이 가게를 찾는 과정</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      &ldquo;{naver?.search_query ?? result.query}&rdquo; 로 검색했을 때 실제 상황
                    </p>
                  </div>

                  {/* STEP 1: 네이버 */}
                  <div className="px-5 py-3 border-b border-gray-50">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                      <p className="text-sm font-semibold text-gray-700">네이버 지도·플레이스에서 가게 목록을 봅니다</p>
                    </div>
                    {naver && naver.naver_competitors.length > 0 ? (
                      <div className="space-y-1.5 ml-7">
                        {naver.naver_competitors.slice(0, 2).map((comp) => {
                          const bizClean = (form.business_name || '').toLowerCase().replace(/[\s\-_·&]/g, '');
                      const compClean = (comp.name || '').toLowerCase().replace(/[\s\-_·&]/g, '');
                      const isMe = bizClean.length > 0 && (compClean.includes(bizClean) || bizClean.includes(compClean));
                          return (
                            <div key={comp.rank} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${isMe ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                                comp.rank === 1 ? "bg-yellow-300 text-yellow-900" :
                                comp.rank === 2 ? "bg-gray-300 text-gray-700" :
                                comp.rank === 3 ? "bg-orange-200 text-orange-800" :
                                "bg-white text-gray-400 border border-gray-200"
                              }`}>{comp.rank}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-sm font-medium ${isMe ? "text-blue-700" : "text-gray-800"}`}>{comp.name}</span>
                                  {isMe && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                                </div>
                                {comp.address && <p className="text-sm text-gray-400 truncate">{comp.address}</p>}
                              </div>
                            </div>
                          );
                        })}
                        {naver.naver_competitors.length > 2 && (
                          <div className="text-center py-2 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                            <span className="text-xs text-gray-400">🔒 상위 {naver.naver_competitors.length - 2}개 더 — 가입하면 전체 보기</span>
                          </div>
                        )}
                        {!naverRank && (
                          <div className="bg-red-50 rounded-xl px-3 py-2 text-sm text-red-600">
                            <strong>{form.business_name}</strong>은(는) 이 키워드 상위 노출 가게에 없습니다.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="ml-7 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-500">
                        {naver ? "네이버 지역 검색 결과를 가져오지 못했습니다." : "네이버 API 연결 후 확인 가능합니다."}
                      </div>
                    )}
                  </div>

                  {/* 카카오맵 */}
                  {kakao && kakao.kakao_competitors.length > 0 && (
                    <div className="px-5 py-3 border-b border-gray-50">
                      <div className="flex items-center gap-1.5 mb-2 ml-7">
                        <span className="text-sm font-semibold text-gray-600">카카오맵에서도 같은 키워드로 검색하면:</span>
                      </div>
                      <div className="space-y-1.5 ml-7">
                        {kakao.kakao_competitors.map((comp) => {
                          const bizClean = (form.business_name || '').toLowerCase().replace(/[\s\-_·&]/g, '');
                          const compClean = (comp.name || '').toLowerCase().replace(/[\s\-_·&]/g, '');
                          const isMe = bizClean.length > 0 && (compClean.includes(bizClean) || bizClean.includes(compClean));
                          return (
                            <div key={comp.rank} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${isMe ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}>
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                                comp.rank === 1 ? "bg-yellow-300 text-yellow-900" :
                                comp.rank === 2 ? "bg-gray-300 text-gray-700" :
                                comp.rank === 3 ? "bg-orange-200 text-orange-800" :
                                "bg-white text-gray-400 border border-gray-200"
                              }`}>{comp.rank}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-sm font-medium ${isMe ? "text-yellow-800" : "text-gray-800"}`}>{comp.name}</span>
                                  {isMe && <span className="text-xs bg-yellow-500 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                                </div>
                                {comp.address && <p className="text-sm text-gray-400 truncate">{comp.address}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: 블로그 */}
                  <div className="px-5 py-3 border-b border-gray-50">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                      <p className="text-sm font-semibold text-gray-700">블로그 후기를 보고 어느 가게를 갈지 결정합니다</p>
                      {form.region && (
                        <span className="text-xs text-gray-400 ml-1">&ldquo;{form.region}&rdquo; 지역 기준</span>
                      )}
                    </div>
                    <div className="ml-7">
                      {naver && naver.top_competitor_name ? (() => {
                        const myCount   = blogCount;
                        const compCount = naver.top_competitor_blog_count;
                        const maxCount  = Math.max(myCount, compCount, 1);
                        const myPct     = Math.round((myCount / maxCount) * 100);
                        const compPct   = Math.round((compCount / maxCount) * 100);
                        const isBehind  = myCount < compCount;
                        return (
                          <div className={`rounded-xl px-3 py-3 mb-3 ${isBehind ? "bg-red-50 border border-red-100" : "bg-green-50 border border-green-100"}`}>
                            <p className={`text-sm font-bold mb-2.5 ${isBehind ? "text-red-700" : "text-green-700"}`}>
                              {isBehind ? "손님은 후기가 더 많은 경쟁 가게를 선택할 가능성이 높습니다" : "내 가게 블로그 후기가 경쟁 1위보다 많습니다"}
                            </p>
                            <div className="mb-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-blue-700">내 가게</span>
                                <span className="text-sm font-bold text-blue-700">{myCount.toLocaleString()}건</span>
                              </div>
                              <div className="w-full bg-white rounded-full h-2.5">
                                <div className="h-2.5 rounded-full bg-blue-500 transition-all" style={{ width: `${myPct}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-gray-500">{naver.top_competitor_name} (1위)</span>
                                <span className="text-sm font-bold text-gray-600">{compCount.toLocaleString()}건</span>
                              </div>
                              <div className="w-full bg-white rounded-full h-2.5">
                                <div className="h-2.5 rounded-full bg-gray-400 transition-all" style={{ width: `${compPct}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })() : (
                        <div className={`rounded-xl px-3 py-2 mb-2 ${blogCount > 5 ? "bg-green-50" : blogCount > 0 ? "bg-yellow-50" : "bg-red-50"}`}>
                          <p className={`text-sm font-bold ${blogCount > 5 ? "text-green-700" : blogCount > 0 ? "text-yellow-700" : "text-red-600"}`}>
                            블로그 후기 {blogCount.toLocaleString()}건
                          </p>
                        </div>
                      )}
                      {naver && naver.top_blogs.length > 0 && (
                        <div className="space-y-1.5">
                          {naver.top_blogs.slice(0, 2).map((blog, i) => {
                            const dateLabel = (() => {
                              const d = blog.postdate;
                              if (!d || d.length < 8) return blog.postdate;
                              const posted = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`);
                              const diffDays = Math.floor((Date.now() - posted.getTime()) / 86400000);
                              if (diffDays < 1)   return "오늘";
                              if (diffDays < 7)   return `${diffDays}일 전`;
                              if (diffDays < 30)  return `${Math.floor(diffDays / 7)}주 전`;
                              if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
                              return `${Math.floor(diffDays / 365)}년 전`;
                            })();
                            const isOld = (() => {
                              const d = blog.postdate;
                              if (!d || d.length < 8) return false;
                              const posted = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`);
                              return Date.now() - posted.getTime() > 180 * 86400000;
                            })();
                            return (
                              <a key={i} href={blog.link} target="_blank" rel="noopener noreferrer"
                                className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5 hover:bg-gray-100 transition-colors group">
                                <span className="text-sm text-gray-400 mt-0.5 shrink-0">후기</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 line-clamp-1 group-hover:text-blue-600">{blog.title}</p>
                                  {blog.description && <p className="text-sm text-gray-400 line-clamp-1 mt-0.5">{blog.description}</p>}
                                  {blog.postdate && (
                                    <p className={`text-sm mt-0.5 font-medium ${isOld ? "text-orange-400" : "text-gray-300"}`}>
                                      {dateLabel}{isOld && " · 오래된 후기"}
                                    </p>
                                  )}
                                </div>
                                <span className="text-sm text-blue-400 shrink-0 group-hover:text-blue-600">↗</span>
                              </a>
                            );
                          })}
                          {naver.top_blogs.length > 2 && (
                            <div className="mt-2 text-center py-2 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                              <span className="text-xs text-gray-400">🔒 블로그 후기 더 보기 — 가입하면 전체 보기</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STEP 3: AI */}
                  <div className="px-5 py-3">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                      <p className="text-sm font-semibold text-gray-700">ChatGPT·Gemini에 &ldquo;어디 좋아?&rdquo; 라고 물어봅니다</p>
                    </div>
                    <div className="ml-7">
                      {mentioned ? (
                        <div className="bg-green-50 rounded-xl px-3 py-2.5 border-l-4 border-green-400">
                          <p className="text-sm font-semibold text-green-700 mb-1">✓ AI가 &ldquo;{form.business_name}&rdquo; 을(를) 추천했습니다</p>
                          {excerpt && (
                            <p className="text-sm text-gray-600 leading-relaxed">
                              &ldquo;{excerpt.slice(0, 100)}{excerpt.length > 100 ? "..." : ""}&rdquo;
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-red-50 rounded-xl px-3 py-2.5 border-l-4 border-red-300">
                          <p className="text-sm font-semibold text-red-600 mb-1">
                            ✕ AI가 {form.business_name} 대신 다른 가게를 추천했습니다
                          </p>
                          {result.competitors.length > 0 && (
                            <p className="text-sm text-gray-500">
                              대신 추천된 가게: {result.competitors.slice(0, 3).join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── 섹션 E: AI 노출 솔직한 고지 ── */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-base font-bold text-gray-900 mb-1">AI 검색에서의 노출 여부</h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                    <p className="text-sm text-amber-800">
                      ⚡ 이 항목은 Gemini AI에게 1회 질문한 결과입니다.
                      소규모 지역 가게는 AI가 모를 수 있으며, 1회 테스트는 통계적 신뢰도가 낮습니다.{" "}
                      <strong>구독하면 100회 반복 측정으로 정확한 수치를 제공합니다.</strong>
                    </p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "Gemini (1회 테스트)", mentioned: mentioned, locked: false },
                      { name: "ChatGPT", mentioned: false, locked: true },
                      { name: "Perplexity", mentioned: false, locked: true },
                      { name: "네이버 AI 브리핑", mentioned: false, locked: true },
                    ].map((ai) => (
                      <div key={ai.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <span className="text-sm font-medium text-gray-700">{ai.name}</span>
                        {ai.locked ? (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            🔒 가입하면 확인 가능
                          </span>
                        ) : (
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            ai.mentioned
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-500"
                          }`}>
                            {ai.mentioned ? "✓ 언급됨" : "미언급"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI 채널 분리 점수 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
                    <p className="text-sm font-semibold text-gray-600 mb-0.5">네이버 AI</p>
                    <p className="text-sm text-gray-400 mb-3">네이버 브리핑 · 카카오맵</p>
                    {naverCh !== undefined ? (
                      <>
                        <div className={`text-3xl font-black mb-1 ${naverCh >= 70 ? "text-green-500" : naverCh >= 40 ? "text-amber-500" : "text-red-400"}`}>
                          {Math.round(naverCh)}점
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                          <div className={`h-2 rounded-full ${naverCh >= 70 ? "bg-green-500" : naverCh >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                            style={{ width: `${Math.min(100, naverCh)}%` }} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className={isSmartPlace ? "text-green-500" : "text-gray-300"}>{isSmartPlace ? "✓" : "○"}</span>
                            <span className={isSmartPlace ? "text-gray-600" : "text-gray-400"}>스마트플레이스</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className={isOnKakao ? "text-green-500" : "text-gray-300"}>{isOnKakao ? "✓" : "○"}</span>
                            <span className={isOnKakao ? "text-gray-600" : "text-gray-400"}>카카오맵</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-2xl font-black text-gray-300">—</div>
                    )}
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-4 relative overflow-hidden">
                    <p className="text-sm font-semibold text-gray-600 mb-0.5">해외 AI (ChatGPT 등)</p>
                    <p className="text-sm text-gray-400 mb-3">ChatGPT · Perplexity · Google</p>
                    <div className="select-none pointer-events-none blur-sm">
                      <div className="text-3xl font-black text-blue-500 mb-1">??점</div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                        <div className="h-2 rounded-full bg-blue-400" style={{ width: "45%" }} />
                      </div>
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[1px]">
                      <span className="text-xl mb-1">🔒</span>
                      <Link href="/signup" onClick={saveTrialData} className="text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl px-3 py-2 transition-colors text-center">
                        회원가입하면 전체 보기
                      </Link>
                    </div>
                  </div>
                </div>

                {/* 항목별 점수 분석 */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">항목별 점수 분석</p>
                    <p className="text-sm text-gray-400 mt-0.5">각 항목이 왜 이 점수인지 설명합니다</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {result.score.breakdown && Object.entries(result.score.breakdown).map(([key, rawVal]) => {
                      const val  = Math.round(Number(rawVal));
                      const info = BREAKDOWN_INFO[key];
                      if (!info) return null;
                      const isLow = val < 40;
                      // trialNote가 있고 점수가 낮으면 → 측정 불가 안내 표시 (부정적 단정 금지)
                      const showTrialNote = !!info.trialNote;  // trialNote 있으면 점수 무관하게 항상 중립 안내 표시
                      return (
                        <div key={key} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{info.icon}</span>
                              <span className="text-sm font-medium text-gray-800">{info.label}</span>
                            </div>
                            <span className={`text-sm font-bold ${val >= 70 ? "text-green-600" : val >= 40 ? "text-yellow-600" : "text-red-500"}`}>{val}점</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                            <div className={`h-1.5 rounded-full ${val >= 70 ? "bg-green-500" : val >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                              style={{ width: `${val}%` }} />
                          </div>
                          <p className="text-sm text-gray-500 leading-relaxed">{info.what}</p>
                          <p className={`text-sm mt-1 font-medium ${
                            showTrialNote ? "text-gray-400 italic" : isLow ? "text-red-500" : "text-green-600"
                          }`}>
                            {showTrialNote
                              ? `ℹ ${info.trialNote}`
                              : isLow
                                ? `⚠ ${info.low}`
                                : `✓ ${info.high}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 성장 단계 */}
                {result.growth_stage && (() => {
                  const stageGS: GrowthStage = result.growth_stage!;
                  const stageColor: Record<string, string> = {
                    survival:  "bg-red-50 border-red-200 text-red-800",
                    stability: "bg-yellow-50 border-yellow-200 text-yellow-800",
                    growth:    "bg-blue-50 border-blue-200 text-blue-800",
                    dominance: "bg-green-50 border-green-200 text-green-800",
                  };
                  const colorClass = stageColor[stageGS.stage] ?? "bg-gray-50 border-gray-200 text-gray-800";
                  return (
                    <div className={`rounded-2xl border p-5 ${colorClass}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">📈</span>
                          <span className="text-sm font-semibold">현재 단계: {stageGS.stage_label}</span>
                        </div>
                        <span className="text-sm opacity-70">{stageGS.score_range}</span>
                      </div>
                      <p className="text-sm mb-3 leading-relaxed">{stageGS.focus_message}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-white bg-opacity-60 rounded-xl p-3">
                          <div className="text-sm font-semibold mb-1">이번 주 집중할 것</div>
                          <p className="text-sm leading-relaxed">{stageGS.this_week_action}</p>
                        </div>
                        <div className="bg-white bg-opacity-40 rounded-xl p-3">
                          <div className="text-sm font-semibold mb-1 opacity-70">지금 하지 말아야 할 것</div>
                          <p className="text-sm leading-relaxed opacity-80">{stageGS.do_not_do}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 구독하면 달라지는 것 — 강화 버전 */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-base font-semibold text-gray-800">구독하면 이런 정보를 드립니다</p>
                  </div>
                  <div className="px-5 pt-4 pb-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-4">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="font-bold text-gray-500 mb-2">지금 (무료 체험)</p>
                        <ul className="space-y-1.5 text-gray-500">
                          <li>· AI 1개 (Gemini만)</li>
                          <li>· 검색 10회 추정</li>
                          <li>· 노출 여부만 확인</li>
                          <li>· 점수 추이 없음</li>
                        </ul>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                        <p className="font-bold text-blue-700 mb-2">구독 후 (월 9,900원)</p>
                        <ul className="space-y-1.5 text-blue-700">
                          <li>· AI 7개 동시 분석</li>
                          <li>· 100회 반복 → 확률(%)</li>
                          <li>· 경쟁사 순위 비교</li>
                          <li>· 매일 자동 스캔</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="relative mx-5 mb-2 rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl px-4">
                      <span className="text-2xl mb-2">🔒</span>
                      <p className="text-sm font-bold text-gray-700 text-center mb-1">
                        {selectionScore < 40 ? "경쟁 가게는 이미 이 방법을 쓰고 있습니다" : "더 자주 선택받는 방법이 여기 있습니다"}
                      </p>
                      <Link
                        href="/signup"
                        onClick={saveTrialData}
                        className="mt-2 inline-block bg-blue-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm"
                      >
                        9,900원으로 잠금 해제 →
                      </Link>
                      <p className="text-xs text-gray-400 mt-1.5">신용카드 불필요 · 언제든 해지</p>
                    </div>
                    <div className="space-y-3 p-4 opacity-20 select-none pointer-events-none">
                      {[
                        { icon: "🔍", label: "3채널 노출 신호 측정", tip: "네이버 AI 브리핑·카카오맵·ChatGPT 3채널 → 정확한 노출 현황" },
                        { icon: "📊", label: "경쟁사 6개 차원 갭 분석", tip: "1위 경쟁사 대비 어느 항목이 몇 점 뒤처지는지 정확히 보여줍니다." },
                        { icon: "🗺️", label: "지역 업종 순위", tip: "내 가게가 지역 업종 내 몇 위인지, 상위 몇 %인지 수치로 확인합니다." },
                        { icon: "📋", label: "스마트플레이스 소개글 자동 생성", tip: "AI 최적화 소개글 자동 생성 — 복사 후 붙여넣기만 하면 됩니다." },
                        { icon: "📢", label: "리뷰 키워드 갭 분석", tip: "부족한 키워드를 찾아 리뷰 유도 QR 문구를 자동 생성합니다." },
                        { icon: "📱", label: "매일 카카오톡 알림", tip: "순위 변화·경쟁사 동향을 매일 자동 발송합니다." },
                        { icon: "📈", label: "Before/After 스크린샷 비교", tip: "개선 전·후 점수 변화를 시각적으로 확인합니다." },
                        { icon: "✅", label: "Claude AI 맞춤 개선 가이드", tip: "내 가게 상황에 맞춘 구체적 실행 계획을 Claude가 작성합니다." },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span>{item.icon}</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">{item.label}</p>
                            <p className="text-sm text-gray-500">{item.tip}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-4" />
                </div>

                {/* 구독 후 6단계 흐름 */}
                <div className="bg-gray-900 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10">
                    <p className="text-sm font-bold text-white/60 uppercase tracking-wide">가입 후 이렇게 진행됩니다</p>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    {[
                      { step: "1", label: "회원가입 (무료)",              desc: "이메일 인증만으로 30초 즉시 시작" },
                      { step: "2", label: "내 가게 등록",                 desc: "방금 입력한 정보 그대로 사용" },
                      { step: "3", label: "3채널 AI 전체 스캔",            desc: "네이버 AI 브리핑·카카오맵·ChatGPT 첫 달 무료" },
                      { step: "4", label: "경쟁사 6개 차원 갭 분석",     desc: "1위와의 정확한 격차를 수치로 확인" },
                      { step: "5", label: "Claude AI 맞춤 개선 가이드",  desc: "내 가게만을 위한 실행 계획 자동 생성" },
                      { step: "6", label: "매일 자동 스캔 + 카카오톡 알림", desc: "순위 변화·경쟁사 동향 자동 발송" },
                    ].map((s) => (
                      <div key={s.step} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {s.step}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white/90">{s.label}</p>
                          <p className="text-sm text-white/50">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 최종 CTA */}
                <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-6 text-center">
                  <p className="font-bold text-white text-xl leading-snug mb-2">
                    지금 이 순간에도 손님이 경쟁 가게로 가고 있습니다
                  </p>
                  <p className="text-sm text-white/70 mb-5 leading-relaxed">
                    3채널 AI가 매일 자동으로 추적하고 개선 방법을 알려드립니다
                  </p>
                  <Link
                    href="/signup"
                    onClick={saveTrialData}
                    className="inline-block bg-white text-gray-900 font-bold px-8 py-4 rounded-xl hover:bg-gray-100 transition-colors text-base"
                  >
                    무료로 시작하기 (신용카드 불필요)
                  </Link>
                  <p className="text-sm text-white/70 mt-3 font-medium">경쟁 가게 순위가 바뀌면 카카오톡으로 알려드립니다</p>
                  <p className="text-xs text-white/40 mt-1">가입 후 Full 스캔 1회 무료 · 이후 월 9,900원 · 언제든 해지</p>
                </div>

                <button
                  onClick={reset}
                  className="w-full border border-gray-200 text-gray-500 py-3 rounded-xl hover:bg-gray-50 text-sm"
                >
                  다른 사업장 진단하기
                </button>
              </div>

              {/* ── 오른쪽 사이드바 (PC sticky) ── */}
              <div className="order-1 lg:order-2 space-y-4 lg:sticky lg:top-6 lg:self-start">

                {/* 실시간 검색 현황 */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">실시간 검색 현황</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">네이버 순위</span>
                      <span className={`font-bold text-sm ${naverRank ? "text-green-600" : "text-red-500"}`}>
                        {naverRank ? `${naverRank}위` : "미노출"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">블로그 언급</span>
                      <span className={`font-bold text-sm ${blogCount > 0 ? "text-blue-600" : "text-gray-400"}`}>
                        {blogCount > 0 ? `${blogCount.toLocaleString()}건` : "수집 중"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">카카오맵</span>
                      <span className={`font-bold text-sm ${kakaoRank ? "text-yellow-600" : "text-gray-400"}`}>
                        {kakaoRank ? `${kakaoRank}위` : "미노출"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">스마트플레이스</span>
                      <span className={`font-bold text-sm ${smartPlaceStatus === true ? "text-green-600" : "text-gray-400"}`}>
                        {smartPlaceStatus === true ? "등록됨" : "확인 필요"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">네이버·카카오 API 실시간 데이터</p>
                  </div>
                </div>

                {/* 지금 바꾸면 바로 효과 있는 것 */}
                {weakestItem && (
                  <div className="bg-white rounded-2xl shadow-sm px-5 py-4 border-l-4 border-red-400">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">🔴</span>
                      <p className="text-sm font-bold text-red-700">지금 바꾸면 바로 효과 있는 것</p>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{weakestItem.info.icon}</span>
                        <span className="text-sm font-semibold text-gray-800">{weakestItem.info.label}</span>
                      </div>
                      <span className="text-base font-black text-red-500">{weakestItem.val}점</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
                      <div className="h-2.5 rounded-full bg-red-400" style={{ width: `${weakestItem.val}%` }} />
                    </div>
                    <p className="text-sm text-gray-500 mb-2 leading-relaxed">
                      오늘 당장 바꿀 수 있고, 바꾸면 손님이 더 잘 찾아오는 항목입니다.
                    </p>
                    <div className="bg-red-50 rounded-xl px-3 py-2 text-sm text-red-700 font-medium mb-3">
                      개선 방법: {weakestItem.info.improve}
                    </div>
                    <Link
                      href="/signup"
                      onClick={saveTrialData}
                      className="block w-full text-center bg-red-500 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-red-600 transition-colors"
                    >
                      개선 방법 보기 →
                    </Link>
                  </div>
                )}

                {/* 사이드바 CTA */}
                <div className="bg-blue-600 rounded-2xl p-5 text-center">
                  <p className="text-white font-bold text-base mb-1">지금 무료로 시작하기</p>
                  <p className="text-blue-200 text-sm mb-4">
                    3채널 AI 전체 스캔 · 경쟁사 비교 · 매일 자동 추적
                  </p>
                  <Link
                    href="/signup"
                    onClick={saveTrialData}
                    className="block w-full bg-white text-blue-700 font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors text-sm"
                  >
                    회원가입 → 무료 시작
                  </Link>
                  <p className="text-blue-300 text-xs mt-2">신용카드 없이 · 30초 가입</p>
                </div>
              </div>
            </div>
          </div>
          </>
        );
      })()}
    </main>
  );
}
