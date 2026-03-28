"use client";

import { useState, useEffect } from "react";
import { trialScan } from "@/lib/api";
import { TrialScanResult } from "@/types";
import Link from "next/link";
import { CATEGORY_GROUPS, CATEGORY_MAP } from "@/lib/categories";
import { CATEGORY_ICON_MAP } from "@/lib/categoryIcons";
import { ApiError } from "@/lib/api";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// 소상공인 친화적 항목 설명
const BREAKDOWN_INFO: Record<string, {
  label: string;
  icon: string;
  what: string;             // 이 항목이 무엇인지
  low: string;              // 점수 낮을 때 이유
  high: string;             // 점수 높을 때 이유
  tip: string;              // 개선 힌트 (잠금)
}> = {
  exposure_freq: {
    label: "AI 검색 노출",
    icon: "🔍",
    what: "손님이 AI에 \"추천해줘\" 라고 물어봤을 때 내 가게가 답변에 나오는 빈도입니다.",
    low:  "이번 검색 1회에서 AI가 내 가게를 언급하지 않았습니다.",
    high: "이번 검색 1회에서 AI가 내 가게를 언급했습니다.",
    tip:  "100회 반복 검색으로 정확한 노출 확률(%)을 측정합니다.",
  },
  review_quality: {
    label: "리뷰 평판",
    icon: "⭐",
    what: "네이버·카카오맵 등에 등록된 리뷰 수와 평점입니다. AI는 리뷰가 많고 평점이 높은 가게를 더 자주 추천합니다.",
    low:  "리뷰 수가 적거나 평점이 낮아 AI가 신뢰도 있는 가게로 인식하기 어렵습니다.",
    high: "리뷰와 평점이 충분해 AI가 신뢰할 수 있는 가게로 인식합니다.",
    tip:  "리뷰 키워드 분석으로 어떤 단어가 AI 추천에 영향을 주는지 확인합니다.",
  },
  schema_score: {
    label: "온라인 정보 정리",
    icon: "📋",
    what: "내 가게의 영업시간·전화번호·위치·메뉴가 인터넷에 얼마나 잘 정리돼 있는지입니다. AI는 정리가 잘 된 가게를 더 자주 추천합니다.",
    low:  "가게 정보가 인터넷에 충분히 등록되지 않아 AI가 정확한 정보를 파악하기 어렵습니다.",
    high: "가게 기본 정보가 잘 정리돼 있어 AI가 쉽게 인식합니다.",
    tip:  "홈페이지·네이버플레이스·카카오맵에 빠진 정보를 자동으로 찾아드립니다.",
  },
  online_mentions: {
    label: "온라인 언급 수",
    icon: "📢",
    what: "블로그·SNS·카페 등에서 내 가게가 언급된 횟수입니다. 많이 언급될수록 AI가 더 자주 추천합니다.",
    low:  "온라인에서 내 가게에 대한 언급이 거의 없습니다. AI가 가게를 알 수 있는 정보가 부족합니다.",
    high: "온라인에서 언급이 충분해 AI가 내 가게를 잘 알고 있습니다.",
    tip:  "어느 플랫폼에서 언급이 많고 적은지, 경쟁사와 비교해 드립니다.",
  },
  info_completeness: {
    label: "기본 정보 완성도",
    icon: "📍",
    what: "전화번호·주소·영업시간·메뉴판 등 기본 정보가 얼마나 등록되어 있는지입니다.",
    low:  "전화번호·영업시간 등 기본 정보가 일부 누락되어 있습니다.",
    high: "기본 정보가 모두 잘 등록되어 있습니다.",
    tip:  "어떤 정보가 빠져 있는지 항목별로 체크리스트를 제공합니다.",
  },
  content_freshness: {
    label: "최근 활동",
    icon: "🗓️",
    what: "가장 최근 리뷰나 게시글이 얼마나 최근인지입니다. AI는 활발하게 운영 중인 가게를 더 신뢰합니다.",
    low:  "최근 3개월 내 새 리뷰나 콘텐츠가 없어 AI가 현재 운영 중인지 확신하기 어렵습니다.",
    high: "최근에 새 리뷰나 활동이 있어 AI가 현재 운영 중임을 인식합니다.",
    tip:  "리뷰 요청 타이밍과 콘텐츠 업데이트 주기를 가이드로 제공합니다.",
  },
};

const SCAN_STEPS = [
  "Gemini AI 접속",
  "검색어 생성",
  "AI 응답 분석",
  "노출 여부 판단",
  "점수 계산",
];

type Step = "category" | "tags" | "info" | "scanning" | "result";

const TRIAL_LS_KEY    = "aeolab_trial_v2";   // {count, resetAt}
const TRIAL_DAY_MS    = 24 * 60 * 60 * 1000; // 24시간 윈도우
const TRIAL_DAY_LIMIT = 20;                  // 개발 기간 20회 (운영 시 3으로 변경)

interface TrialStore { count: number; resetAt: number }

function loadTrialStore(): TrialStore {
  if (typeof window === "undefined") return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
  try {
    const raw = localStorage.getItem(TRIAL_LS_KEY);
    if (!raw) return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
    const store: TrialStore = JSON.parse(raw);
    // 24시간 지났으면 초기화
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
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [form, setForm] = useState({
    business_name: "",
    region: "",
    extra_keyword: "",
    email: "",
  });

  // 마운트 시 쿨다운 확인 + 로그인 상태(관리자) 확인
  useEffect(() => {
    setCooldownMs(getTrialCooldownRemaining());
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsAdmin(true); // 로그인 상태 = 개발 기간 관리자 우회
    });
  }, []);

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
    // 클라이언트 쿨다운 체크 (관리자/로그인 상태는 제외)
    if (!isAdmin) {
      const remaining = getTrialCooldownRemaining();
      if (remaining > 0) {
        setCooldownMs(remaining);
        setError(`오늘 무료 체험을 이미 사용하셨습니다. ${formatCooldown(remaining)} 후 다시 이용하거나 회원가입 후 전체 분석을 이용하세요.`);
        return;
      }
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
      const adminKey = isAdmin ? process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY : undefined;
      const data = await trialScan({
        business_name: form.business_name,
        category: selectedCategory,
        region: form.region,
        keyword: keyword || undefined,
        email: form.email || undefined,
      }, adminKey);
      clearInterval(stepInterval);
      setScanStep(SCAN_STEPS.length - 1);
      // 성공 시 횟수 기록 (관리자 제외)
      if (!isAdmin) recordTrialUse();
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

  const gradeColor = (grade: string) => {
    const map: Record<string, string> = {
      A: "text-green-500", B: "text-blue-500",
      C: "text-yellow-500", D: "text-orange-500", F: "text-red-500",
    };
    return map[grade] ?? "text-gray-500";
  };

  const reset = () => {
    setStep("category");
    setResult(null);
    setSelectedCategory("");
    setSelectedTags([]);
    setForm({ business_name: "", region: "", extra_keyword: "", email: "" });
    setScanStep(0);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">AEOlab</Link>
          <span className="text-sm text-gray-500">무료 AI 노출 진단</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto py-10 px-4">

        {/* 단계 표시 */}
        {step !== "scanning" && step !== "result" && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[
              { key: "category", label: "업종" },
              { key: "tags", label: "서비스" },
              { key: "info", label: "정보 입력" },
            ].map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
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
            <div className="grid grid-cols-2 gap-2.5">
              {CATEGORY_GROUPS.map((cat) => {
                const cfg = CATEGORY_ICON_MAP[cat.value];
                const Icon = cfg?.Icon;
                return (
                  <button
                    key={cat.value}
                    onClick={() => {
                      setSelectedCategory(cat.value);
                      setSelectedTags([]);
                      setStep("tags");
                    }}
                    className={`flex items-center gap-3 bg-white rounded-xl p-3.5 border-2 border-gray-100 hover:border-current hover:shadow-sm transition-all text-left group ${cfg?.text ?? ''}`}
                  >
                    {Icon && (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-5 h-5 ${cfg.text}`} strokeWidth={1.8} />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-gray-800 leading-tight">{cat.label}</span>
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
              className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
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
            <p className="text-sm text-gray-500 mb-4">
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
            <p className="text-xs text-center text-gray-400 mt-2">서비스를 1개 이상 선택하세요</p>
          </div>
        )}

        {/* 3단계: 정보 입력 */}
        {step === "info" && (
          <div>
            <button
              onClick={() => setStep("tags")}
              className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> 서비스 다시 선택
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              사업장 정보를 입력하세요
            </h2>

            {/* 선택 요약 */}
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
                    <p className={`text-xs font-semibold ${cfg?.text ?? 'text-gray-600'}`}>{CATEGORY_MAP[selectedCategory]?.label}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTags.map((t) => (
                        <span key={t} className="bg-white/70 text-gray-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleScan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사업장 이름 *</label>
                <input
                  type="text"
                  required
                  placeholder="사업장 이름을 입력하세요"
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
                <input
                  type="text"
                  required
                  placeholder="시·구·동 단위로 입력 (예: 수원시 팔달구)"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  추가 키워드 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 주차 가능, 예약 운영, 단체 주문 가능"
                  value={form.extra_keyword}
                  onChange={(e) => setForm({ ...form, extra_keyword: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  가게만의 특징을 입력하면 더 정확한 분석이 가능합니다
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-gray-400 font-normal">(결과 발송, 선택)</span>
                </label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors"
              >
                AI 노출 진단 시작 (무료)
              </button>
            </form>
          </div>
        )}

        {/* 스캔 단계 */}
        {step === "scanning" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-semibold text-gray-900 mb-1">AI 검색 분석 중...</h2>
            <p className="text-gray-500 text-sm mb-8">
              &ldquo;{form.region} {selectedTags[0]} 추천&rdquo; 검색어로 Gemini를 확인하고 있습니다.
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

        {/* 결과 */}
        {step === "result" && result && (() => {
          const mentioned = result.result.gemini?.mentioned ?? false;
          const excerpt   = result.result.gemini?.excerpt ?? "";
          const score     = Math.round(result.score.total_score);
          const grade     = result.score.grade;

          return (
          <div className="space-y-4">

            {/* ── 헤더 ───────────────────────────────────────────── */}
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">{form.business_name} · {form.region}</p>
              <h2 className="text-2xl font-bold text-gray-900">AI 노출 진단 결과</h2>
            </div>

            {/* ── 1. 실제 AI가 뭐라고 했나 ───────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                <p className="text-xs text-gray-500">
                  Gemini(구글 AI)에 이렇게 물어봤습니다
                </p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">
                  &ldquo;{result.query}&rdquo;
                </p>
              </div>
              <div className="px-5 py-4">
                {mentioned ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm font-bold shrink-0">✓</span>
                      <p className="text-sm font-semibold text-green-700">
                        AI 답변에 <strong>{form.business_name}</strong>이(가) 언급됐습니다
                      </p>
                    </div>
                    {excerpt && (
                      <div className="bg-green-50 rounded-xl px-4 py-3 border-l-4 border-green-400">
                        <p className="text-xs text-gray-500 mb-1">AI가 한 말 (발췌)</p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          &ldquo;{excerpt.slice(0, 120)}{excerpt.length > 120 ? "..." : ""}&rdquo;
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-3">
                      단, 이번 1회 검색에서 나온 것입니다. 100회 중 몇 번 나오는지가 실제 노출 확률입니다.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-sm font-bold shrink-0">✕</span>
                      <p className="text-sm font-semibold text-red-600">
                        이번 검색에서 AI가 <strong>{form.business_name}</strong>을(를) 추천하지 않았습니다
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-xl px-4 py-3">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        AI는 이 검색어에서 다른 가게를 추천했습니다.<br/>
                        지금 이 순간에도 손님들이 AI에 가게를 추천받고 있는데,
                        내 가게는 그 목록에 없는 상태입니다.
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      1회 미노출이라도 100회 중 일부는 나올 수 있습니다. 정확한 확률은 구독 후 측정됩니다.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── 2. 종합 점수 ────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-700">AI 노출 종합 점수</p>
                <p className="text-xs text-gray-400">100점 만점</p>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <span className={`text-5xl font-black ${gradeColor(grade)}`}>{grade}</span>
                <span className="text-3xl font-bold text-gray-900 mb-1">{score}점</span>
                <span className="text-sm text-gray-400 mb-1.5">
                  {score >= 80 ? "경쟁사보다 유리한 위치입니다" :
                   score >= 60 ? "평균 수준이며 개선 여지가 있습니다" :
                   score >= 40 ? "AI 노출이 낮아 손님이 놓치고 있습니다" :
                                 "AI 검색에서 거의 보이지 않는 상태입니다"}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-blue-500" : score >= 40 ? "bg-yellow-500" : "bg-red-400"
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* ── 3. 항목별 분석 (소상공인 언어) ─────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">점수 항목별 분석</p>
                <p className="text-xs text-gray-400 mt-0.5">각 항목이 왜 이 점수인지 설명합니다</p>
              </div>
              <div className="divide-y divide-gray-50">
                {result.score.breakdown && Object.entries(result.score.breakdown).map(([key, rawVal]) => {
                  const val  = Math.round(Number(rawVal));
                  const info = BREAKDOWN_INFO[key];
                  if (!info) return null;
                  const isLow = val < 40;
                  return (
                    <div key={key} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{info.icon}</span>
                          <span className="text-sm font-medium text-gray-800">{info.label}</span>
                        </div>
                        <span className={`text-sm font-bold ${
                          val >= 70 ? "text-green-600" : val >= 40 ? "text-yellow-600" : "text-red-500"
                        }`}>{val}점</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                        <div
                          className={`h-1.5 rounded-full ${
                            val >= 70 ? "bg-green-500" : val >= 40 ? "bg-yellow-400" : "bg-red-400"
                          }`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{info.what}</p>
                      <p className={`text-xs mt-1 font-medium ${isLow ? "text-red-500" : "text-green-600"}`}>
                        {isLow ? `⚠ ${info.low}` : `✓ ${info.high}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 4. 구독하면 무엇이 달라지나 (잠금) ─────────────── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">구독하면 이런 정보를 드립니다</p>
              </div>

              {/* 무료 vs 구독 비교표 */}
              <div className="px-5 pt-4 pb-2">
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold text-gray-500 mb-2">지금 (무료 체험)</p>
                    <ul className="space-y-1.5 text-gray-500">
                      <li>· AI 1개 (Gemini만)</li>
                      <li>· 검색 1회</li>
                      <li>· 노출 여부만 확인</li>
                      <li>· 점수 추이 없음</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                    <p className="font-bold text-blue-700 mb-2">구독 후</p>
                    <ul className="space-y-1.5 text-blue-700">
                      <li>· AI 8개 동시 분석</li>
                      <li>· 100회 반복 → 확률(%)</li>
                      <li>· 경쟁사 순위 비교</li>
                      <li>· 매일 자동 스캔</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 잠긴 항목들 */}
              <div className="relative mx-5 mb-5 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
                  <span className="text-2xl mb-1">🔒</span>
                  <p className="text-sm font-bold text-gray-700">구독 후 확인 가능</p>
                  <p className="text-xs text-gray-500 text-center mt-1 px-4">월 9,900원 · 언제든 해지 가능</p>
                </div>
                <div className="space-y-3 p-4 opacity-20 select-none pointer-events-none">
                  {Object.entries(BREAKDOWN_INFO).map(([key, info]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span>{info.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{info.label} 개선 방법</p>
                        <p className="text-xs text-gray-500">{info.tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 누가 개선하나요? */}
              <div className="mx-5 mb-5 bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-blue-800 mb-2">개선은 누가 하나요?</p>
                <div className="space-y-1.5 text-xs text-blue-700">
                  <p>📊 <strong>AEOlab이 분석합니다</strong> — 매일 자동으로 스캔하고 결과를 카카오톡으로 알려드립니다.</p>
                  <p>✏️ <strong>사업주가 직접 하거나</strong> — 가이드에서 "이 문장을 네이버플레이스 소개란에 넣으세요" 처럼 구체적으로 알려드립니다.</p>
                  <p>📈 <strong>개선 후 변화를 확인</strong> — 변경 전·후 점수를 비교해 효과를 눈으로 확인할 수 있습니다.</p>
                </div>
              </div>
            </div>

            {/* ── 5. CTA ──────────────────────────────────────────── */}
            <div className={`rounded-2xl p-5 ${mentioned ? "bg-blue-600" : "bg-gray-900"}`}>
              <p className="font-bold text-white text-lg mb-1">
                {mentioned
                  ? "노출은 됐지만, 경쟁사보다 자주 나오나요?"
                  : "지금 이 순간도 경쟁 가게에 손님을 빼앗기고 있습니다"}
              </p>
              <p className="text-sm text-white/80 mb-4">
                {mentioned
                  ? `${score}점은 100회 중 몇 번 나오는지는 알 수 없는 점수입니다. 정확한 확률과 경쟁사 순위를 확인하세요.`
                  : `AI가 답변할 때 경쟁 가게를 먼저 추천합니다. 개선 방법을 알아보세요.`}
              </p>
              <Link
                href="/signup"
                className="block w-full bg-white text-gray-900 rounded-xl py-3.5 font-bold text-center hover:bg-gray-100 transition-colors text-sm"
              >
                월 9,900원으로 전체 분석 시작하기 →
              </Link>
              <p className="text-xs text-white/60 text-center mt-2">첫 달 무료 · 언제든 해지 가능</p>
            </div>

            <button
              onClick={reset}
              className="w-full border border-gray-200 text-gray-500 py-3 rounded-xl hover:bg-gray-50 text-sm"
            >
              다른 사업장 진단하기
            </button>
          </div>
          );
        })()}
      </div>
    </main>
  );
}
