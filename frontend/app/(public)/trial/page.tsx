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

// 업종별 관련 검색 키워드 (손님이 실제로 검색하는 방식)
const RELATED_KEYWORDS: Record<string, string[]> = {
  food:          ["맛집", "점심 맛집", "저녁 맛집", "혼밥", "가족 식사"],
  cafe:          ["카페", "분위기 좋은 카페", "작업하기 좋은 카페", "디저트 카페"],
  health:        ["병원", "내과", "피부과 추천", "한의원"],
  beauty:        ["미용실 추천", "헤어샵", "네일샵", "왁싱샵"],
  education:     ["학원", "영어학원", "수학학원", "코딩학원"],
  professional:  ["세무사", "법무사", "공인중개사", "컨설팅"],
  shopping:      ["쇼핑", "옷가게", "편집샵"],
  living:        ["인테리어", "이사업체", "청소업체"],
  culture:       ["사진관", "스튜디오", "웨딩촬영", "돌잔치 촬영"],
  accommodation: ["펜션", "게스트하우스", "숙박"],
};

// 스마트플레이스 정보 완성도 체크리스트 (손님이 클릭 후 확인하는 항목)
const SMART_PLACE_CHECKLIST = [
  { item: "대표 사진 5장 이상",           impact: "high",   reason: "첫인상 결정 — 사진 없으면 클릭 즉시 이탈" },
  { item: "영업시간 (오늘 운영 여부)",     impact: "high",   reason: "\"지금 문 열었나?\" — 미등록 시 경쟁 가게로 이동" },
  { item: "메뉴·가격 정보",               impact: "high",   reason: "\"얼마야?\" — 가격 모르면 방문 결정 못 함" },
  { item: "전화번호·예약 방법",           impact: "medium", reason: "바로 전화/예약 가능해야 선택 확정" },
  { item: "주소·주차 안내",               impact: "medium", reason: "\"어떻게 가나?\" — 네이버 지도 연동 필수" },
  { item: "가게 소개 (키워드 포함)",      impact: "medium", reason: "AI·검색엔진이 이 글을 읽고 추천 여부 결정" },
  { item: "최근 리뷰 답글",              impact: "low",    reason: "사업주 활동성 신호 — AI가 운영 중으로 인식" },
];

const SCAN_STEPS = [
  "손님이 쓰는 검색어 만드는 중",
  "AI에 내 가게 물어보는 중",
  "AI 답변 분석 중",
  "경쟁 가게와 비교 중",
  "점수 계산 중",
];

type Step = "category" | "tags" | "info" | "scanning" | "result";

const TRIAL_LS_KEY    = "aeolab_trial_v2";   // {count, resetAt}
const TRIAL_DAY_MS    = 24 * 60 * 60 * 1000; // 24시간 윈도우
const TRIAL_DAY_LIMIT = 3;                   // 하루 무료 체험 한도

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
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState<"location_based" | "non_location">("location_based");
  const [form, setForm] = useState({
    business_name: "",
    region: "",
    extra_keyword: "",
    email: "",
  });
  // v3.0 스마트플레이스 체크박스 (Track 1 점수에 즉시 반영)
  const [hasFaq, setHasFaq]               = useState(false);
  const [hasRecentPost, setHasRecentPost] = useState(false);
  const [hasIntro, setHasIntro]           = useState(false);
  const [reviewText, setReviewText]       = useState("");
  const [copied, setCopied]               = useState(false);
  const [isStartupMode, setIsStartupMode] = useState(false);

  // 마운트 시 쿨다운 확인
  useEffect(() => {
    setCooldownMs(getTrialCooldownRemaining());
  }, []);

  // 쿨다운 카운트다운 (1분마다 갱신)
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
    // 클라이언트 쿨다운 체크
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
        email: form.email || undefined,
        business_type: businessType,
        has_faq: hasFaq,
        has_recent_post: hasRecentPost,
        has_intro: hasIntro,
        review_text: reviewText || undefined,
      });
      clearInterval(stepInterval);
      setScanStep(SCAN_STEPS.length - 1);
      // 성공 시 횟수 기록
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
    setBusinessType("location_based");
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                    <span className="text-base font-semibold text-gray-800 leading-tight">{cat.label}</span>
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
                  상위 경쟁자 점수·부족 키워드·진입 난이도를 확인하세요.
                </p>
              </div>
            )}

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

            {/* 사업 형태 선택 */}
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
                  내 가게만의 특징 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 주차 가능, 예약 운영, 단체 주문 가능"
                  value={form.extra_keyword}
                  onChange={(e) => setForm({ ...form, extra_keyword: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-base text-gray-400 mt-1">
                  가게만의 특징을 입력하면 더 정확한 분석이 가능합니다
                </p>
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

              {/* v3.0 스마트플레이스 체크박스 (Track 1 점수에 즉시 반영) */}
              {businessType === "location_based" && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-base font-semibold text-green-800 mb-1">
                    📍 네이버 스마트플레이스 현황 <span className="font-normal text-green-600">(선택 — 체크할수록 정확해요)</span>
                  </p>
                  <p className="text-base text-green-700 mb-3">
                    체크한 항목은 네이버 AI 브리핑 점수에 즉시 반영됩니다.
                  </p>
                  <div className="space-y-2.5">
                    {[
                      {
                        id: "has_faq",
                        checked: hasFaq,
                        onChange: setHasFaq,
                        label: "Q&A(FAQ) 탭에 질문을 등록했어요",
                        badge: "+30점",
                        desc: "AI 브리핑에서 가장 직접 인용되는 항목",
                      },
                      {
                        id: "has_recent_post",
                        checked: hasRecentPost,
                        onChange: setHasRecentPost,
                        label: "최근 7일 내 '소식'을 업데이트했어요",
                        badge: "+20점",
                        desc: "AI가 '지금 운영 중'으로 인식하는 최신성 신호",
                      },
                      {
                        id: "has_intro",
                        checked: hasIntro,
                        onChange: setHasIntro,
                        label: "가게 소개글을 작성했어요",
                        badge: "+10점",
                        desc: "키워드 기반 영구 랭킹 신호",
                      },
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
                            <span className="text-base text-gray-800 group-hover:text-green-700 transition-colors">
                              {item.label}
                            </span>
                            <span className="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-base text-gray-400 mt-0.5">{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 리뷰 텍스트 입력 (선택, skip 가능) */}
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
                <p className="text-base text-gray-400 mt-1">
                  없으면 업종 평균으로 추정합니다. 리뷰가 있으면 더 정확한 키워드 갭 분석이 가능합니다.
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
                AI 노출 진단 시작 (무료)
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
              AI가 내 가게를 추천하는지 확인하고 있습니다.
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
          const isSmartPlace = naver?.is_smart_place ?? false;
          const isOnKakao    = kakao?.is_on_kakao ?? false;

          // 소비자 선택 가능성 종합 진단
          const selectionScore = (() => {
            let s = 0;
            if (mentioned)           s += 25; // AI 답변에 등장
            if (naverRank !== null)  s += 25; // 네이버 지역 검색 상위
            if (isOnKakao)           s += 20; // 카카오맵 등록
            if (blogCount > 5)       s += 20; // 블로그 후기 충분
            else if (blogCount > 0)  s += 10;
            if (isSmartPlace)        s += 10; // 스마트플레이스 정보 등록
            return s;
          })();

          // 업종별 관련 키워드 제안
          const relatedKws = RELATED_KEYWORDS[result.score?.breakdown ? selectedCategory : ""] ?? [];

          return (
          <div className="space-y-4">

            {/* ── 분석 기준 안내 (갭 ①) ─────────────────────────── */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <span className="text-blue-400 shrink-0 mt-0.5">ℹ</span>
              <div className="text-sm text-blue-700 leading-relaxed">
                <strong>Gemini AI 10회 샘플링 기반 추정치입니다.</strong>
                정밀 분석(7개 AI × 100회)은 회원가입 후 이용 가능합니다.
                {isEstimated && <span className="block mt-0.5 text-blue-600">• 키워드 갭은 리뷰 미입력으로 업종 평균으로 추정되었습니다</span>}
              </div>
            </div>

            {/* ── v3.0 듀얼트랙 카드 ────────────────────────────── */}
            <DualTrackCard
              track1Score={track1}
              track2Score={track2}
              naverWeight={naverW}
              globalWeight={globalW}
              unifiedScore={unified}
              category={selectedCategory}
              growthStage={gsCode}
              growthStageLabel={gsLabel}
              isKeywordEstimated={isEstimated}
              topMissingKeywords={missingKws}
            />

            {/* ── 인라인 회원가입 전환 배너 ──────────────────────── */}
            <div className="mt-1 p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <p className="text-sm text-blue-700 font-medium mb-2">
                이 분석을 매일 자동으로 받고, 경쟁사와 비교하려면?
              </p>
              <a
                href="/signup"
                className="inline-block bg-blue-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                무료로 시작하기 →
              </a>
              <p className="text-xs text-blue-500 mt-1">신용카드 없이 · 30초 가입</p>
            </div>

            {/* ── 선점 키워드 ──────────────────────────────────── */}
            {pioneerKws.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-emerald-800 mb-2">
                  ✨ 선점 기회 키워드 — 경쟁 가게도 아직 없습니다
                </p>
                <div className="flex flex-wrap gap-2">
                  {pioneerKws.map((kw) => (
                    <span key={kw} className="bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-full px-3 py-1 border border-emerald-300">
                      🚩 {kw}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-emerald-600 mt-2">
                  지금 FAQ에 등록하면 이 키워드 조건 검색에서 1등으로 노출될 수 있습니다.
                </p>
              </div>
            )}

            {/* ── FAQ 즉시 복사 (5분 실행) ────────────────────── */}
            {faqText && missingKws.length > 0 && (
              <div className="bg-white border-2 border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">
                  💡 지금 바로 할 수 있는 것 — 5분
                </p>
                <p className="text-sm text-gray-500 mb-3">
                  스마트플레이스 {'>'} Q&amp;A 탭에 아래 질문·답변을 등록하세요.
                  AI 브리핑이 이 FAQ를 직접 인용합니다.
                </p>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 whitespace-pre-line mb-3 border border-gray-200">
                  {faqText}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(faqText).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  className="w-full py-2.5 rounded-lg border-2 border-blue-400 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors"
                >
                  {copied ? "✓ 복사됐습니다!" : "📋 FAQ 문구 복사하기"}
                </button>
              </div>
            )}

            {/* ── CTA ──────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl p-5 text-white text-center">
              <p className="font-bold text-lg mb-1 leading-snug">이걸 매주 자동으로 추적하고 개선방법 알려드립니다</p>
              <p className="text-sm text-indigo-100 mb-4 leading-relaxed">
                Gemini 100회 정밀 스캔 · 경쟁사 비교 · 매주 키워드 갭 분석 자동화
              </p>
              <a
                href="/pricing"
                className="inline-block bg-white text-indigo-700 font-bold px-6 py-3.5 rounded-xl hover:bg-indigo-50 transition-colors text-base"
              >
                월 9,900원으로 시작하기 →
              </a>
            </div>

            {/* ── 헤더: 핵심 메시지 ──────────────────────────────── */}
            <div className={`rounded-2xl px-5 py-5 ${
              selectionScore >= 70 ? "bg-green-600" :
              selectionScore >= 40 ? "bg-blue-600" : "bg-gray-800"
            }`}>
              <p className="text-white/70 text-sm mb-1">{form.business_name} · {form.region}</p>
              <p className="text-white font-bold text-lg leading-snug mb-3">
                {selectionScore >= 70
                  ? "손님이 검색했을 때 내 가게를 찾을 수 있습니다"
                  : selectionScore >= 40
                  ? "손님에게 일부는 보이지만 경쟁 가게에 밀리고 있습니다"
                  : "지금 손님이 검색해도 내 가게를 찾기 어렵습니다"}
              </p>
              {/* 소비자 여정 체크 */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "AI 검색 노출",   ok: mentioned,          desc: mentioned ? "AI 답변에 등장" : "AI가 추천 안 함" },
                  { label: "네이버 지도",     ok: naverRank !== null, desc: naverRank ? `지역 검색 ${naverRank}위` : "네이버 미노출" },
                  { label: "카카오맵",        ok: isOnKakao,          desc: isOnKakao ? (kakaoRank ? `카카오 ${kakaoRank}위` : "카카오 등록") : "카카오 미노출" },
                  { label: "블로그 후기",     ok: blogCount > 5,      desc: blogCount > 0 ? `${blogCount.toLocaleString()}건` : "후기 없음" },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl px-3 py-2.5 flex items-center gap-2 ${
                    item.ok ? "bg-white/20" : "bg-black/20"
                  }`}>
                    <span className={`text-base shrink-0 ${item.ok ? "text-white" : "text-white/40"}`}>
                      {item.ok ? "✓" : "✕"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white/90 leading-tight">{item.label}</p>
                      <p className={`text-sm leading-tight mt-0.5 ${item.ok ? "text-white/70" : "text-white/40"}`}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 손님의 검색 여정 ────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">손님이 가게를 찾는 과정</p>
                <p className="text-base text-gray-400 mt-0.5">
                  &ldquo;{naver?.search_query ?? result.query}&rdquo; 로 검색했을 때 실제 상황
                </p>
              </div>

              {/* STEP 1: 네이버 지역 검색 결과 */}
              <div className="px-5 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-sm font-semibold text-gray-700">네이버 지도·플레이스에서 가게 목록을 봅니다</p>
                </div>
                {naver && naver.naver_competitors.length > 0 ? (
                  <div className="space-y-1.5 ml-7">
                    {naver.naver_competitors.map((comp) => {
                      const isMe = naverRank === comp.rank;
                      return (
                        <div key={comp.rank} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${
                          isMe ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
                        }`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                            comp.rank === 1 ? "bg-yellow-300 text-yellow-900" :
                            comp.rank === 2 ? "bg-gray-300 text-gray-700" :
                            comp.rank === 3 ? "bg-orange-200 text-orange-800" :
                            "bg-white text-gray-400 border border-gray-200"
                          }`}>{comp.rank}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-sm font-medium ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                                {comp.name}
                              </span>
                              {isMe && <span className="text-sm bg-blue-600 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                            </div>
                            {comp.address && <p className="text-sm text-gray-400 truncate">{comp.address}</p>}
                          </div>
                        </div>
                      );
                    })}
                    {!naverRank && (
                      <div className="bg-red-50 rounded-xl px-3 py-2 text-sm text-red-600 ml-0">
                        <strong>{form.business_name}</strong>은(는) 이 키워드 상위 노출 가게에 없습니다.
                        스마트플레이스 등록 및 키워드 최적화가 필요합니다.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ml-7 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-500">
                    {naver ? "네이버 지역 검색 결과를 가져오지 못했습니다." : "네이버 API 연결 후 확인 가능합니다."}
                  </div>
                )}
              </div>

              {/* 카카오맵 결과 (네이버 아래) */}
              {kakao && kakao.kakao_competitors.length > 0 && (
                <div className="px-5 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-1.5 mb-2 ml-7">
                    <span className="text-sm font-semibold text-gray-600">카카오맵에서도 같은 키워드로 검색하면:</span>
                  </div>
                  <div className="space-y-1.5 ml-7">
                    {kakao.kakao_competitors.map((comp) => {
                      const isMe = kakaoRank === comp.rank;
                      return (
                        <div key={comp.rank} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${
                          isMe ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"
                        }`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                            comp.rank === 1 ? "bg-yellow-300 text-yellow-900" :
                            comp.rank === 2 ? "bg-gray-300 text-gray-700" :
                            comp.rank === 3 ? "bg-orange-200 text-orange-800" :
                            "bg-white text-gray-400 border border-gray-200"
                          }`}>{comp.rank}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-sm font-medium ${isMe ? "text-yellow-800" : "text-gray-800"}`}>
                                {comp.name}
                              </span>
                              {isMe && <span className="text-sm bg-yellow-500 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                              {comp.url && (
                                <a href={comp.url} target="_blank" rel="noopener noreferrer"
                                  className="text-sm text-blue-400 hover:text-blue-600">↗</a>
                              )}
                            </div>
                            {comp.address && <p className="text-sm text-gray-400 truncate">{comp.address}</p>}
                          </div>
                        </div>
                      );
                    })}
                    {!isOnKakao && (
                      <div className="bg-orange-50 rounded-xl px-3 py-2 text-sm text-orange-600">
                        카카오맵에 미등록 상태입니다. 카카오맵 사용자에게 노출되지 않습니다.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: 블로그 후기로 선택 */}
              <div className="px-5 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-sm font-semibold text-gray-700">블로그 후기를 보고 어느 가게를 갈지 결정합니다</p>
                </div>
                <div className="ml-7">
                  {/* 경쟁사와 블로그 건수 비교 */}
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
                          {isBehind
                            ? `손님은 후기가 더 많은 경쟁 가게를 선택할 가능성이 높습니다`
                            : `내 가게 블로그 후기가 경쟁 1위보다 많습니다`}
                        </p>
                        {/* 내 가게 */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-blue-700 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                              내 가게
                            </span>
                            <span className="text-sm font-bold text-blue-700">{myCount.toLocaleString()}건</span>
                          </div>
                          <div className="w-full bg-white rounded-full h-2.5">
                            <div
                              className="h-2.5 rounded-full bg-blue-500 transition-all"
                              style={{ width: `${myPct}%` }}
                            />
                          </div>
                        </div>
                        {/* 경쟁 1위 */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-500 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                              {naver.top_competitor_name} <span className="font-normal text-gray-400">(네이버 1위)</span>
                            </span>
                            <span className="text-sm font-bold text-gray-600">{compCount.toLocaleString()}건</span>
                          </div>
                          <div className="w-full bg-white rounded-full h-2.5">
                            <div
                              className="h-2.5 rounded-full bg-gray-400 transition-all"
                              style={{ width: `${compPct}%` }}
                            />
                          </div>
                        </div>
                        {isBehind && compCount > myCount && (
                          <div className="mt-3 pt-3 border-t border-red-100 flex items-center justify-between">
                            <p className="text-sm text-red-500">
                              경쟁 1위보다 {(compCount - myCount).toLocaleString()}건 적습니다.
                            </p>
                            <Link
                              href="/signup"
                              className="text-sm font-semibold text-red-600 underline hover:text-red-700 shrink-0 ml-2"
                            >
                              좁히는 방법 →
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className={`rounded-xl px-3 py-2 mb-2 ${blogCount > 5 ? "bg-green-50" : blogCount > 0 ? "bg-yellow-50" : "bg-red-50"}`}>
                      <p className={`text-sm font-bold ${blogCount > 5 ? "text-green-700" : blogCount > 0 ? "text-yellow-700" : "text-red-600"}`}>
                        블로그 후기 {blogCount.toLocaleString()}건
                      </p>
                      <p className={`text-sm mt-0.5 ${blogCount > 5 ? "text-green-600" : blogCount > 0 ? "text-yellow-600" : "text-red-500"}`}>
                        {blogCount === 0 ? "후기가 없어 손님이 가게를 신뢰하기 어렵습니다"
                          : blogCount <= 5 ? "후기가 적어 경쟁 가게보다 선택받기 어렵습니다"
                          : "블로그 후기가 있어 손님의 신뢰를 얻을 수 있습니다"}
                      </p>
                    </div>
                  )}

                  {/* 최근 블로그 포스트 */}
                  {naver && naver.top_blogs.length > 0 ? (
                    <div className="space-y-1.5">
                      {naver.top_blogs.map((blog, i) => {
                        // 날짜를 "X일 전 / X개월 전" 으로 변환
                        const dateLabel = (() => {
                          const d = blog.postdate; // "20250112" 형식
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
                          return Date.now() - posted.getTime() > 180 * 86400000; // 6개월 이상
                        })();
                        return (
                          <a
                            key={i}
                            href={blog.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5 hover:bg-gray-100 transition-colors group"
                          >
                            <span className="text-base text-gray-400 mt-0.5 shrink-0 font-medium">후기</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 line-clamp-1 group-hover:text-blue-600">{blog.title}</p>
                              {blog.description && <p className="text-sm text-gray-400 line-clamp-1 mt-0.5">{blog.description}</p>}
                              {blog.postdate && (
                                <p className={`text-sm mt-0.5 font-medium ${isOld ? "text-orange-400" : "text-gray-300"}`}>
                                  {dateLabel}
                                  {isOld && " · 오래된 후기"}
                                </p>
                              )}
                            </div>
                            <span className="text-sm text-blue-400 shrink-0 group-hover:text-blue-600">↗</span>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      {blogCount > 0
                        ? "최근 블로그 포스트를 가져오지 못했습니다."
                        : "블로그 체험단·이벤트를 통해 후기를 늘리면 선택률이 올라갑니다."}
                    </p>
                  )}
                </div>
              </div>

              {/* STEP 3: AI 검색으로 최종 확인 */}
              <div className="px-5 py-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <p className="text-sm font-semibold text-gray-700">ChatGPT·Gemini에 &ldquo;어디 좋아?&rdquo; 라고 물어봅니다</p>
                </div>
                <div className="ml-7">
                  {mentioned ? (
                    <div>
                      <div className="bg-green-50 rounded-xl px-3 py-2.5 border-l-4 border-green-400 mb-2">
                        <p className="text-sm font-semibold text-green-700 mb-1">
                          ✓ AI가 &ldquo;{form.business_name}&rdquo; 을(를) 추천했습니다
                        </p>
                        {excerpt && (
                          <p className="text-sm text-gray-600 leading-relaxed">
                            &ldquo;{excerpt.slice(0, 100)}{excerpt.length > 100 ? "..." : ""}&rdquo;
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        이번 1회 검색 결과입니다. 구독하면 100회 중 몇 번 나오는지 확률(%)로 측정합니다.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="bg-red-50 rounded-xl px-3 py-2.5 border-l-4 border-red-300 mb-2">
                        <p className="text-sm font-semibold text-red-600 mb-1">
                          ✕ AI가 {form.business_name} 대신 다른 가게를 추천했습니다
                        </p>
                        {result.competitors.length > 0 && (
                          <p className="text-sm text-gray-500">
                            대신 추천된 가게: {result.competitors.slice(0, 3).join(", ")}
                            {result.competitors.length > 3 ? ` 외 ${result.competitors.length - 3}개` : ""}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        1회 미노출이어도 100회 중 일부는 나올 수 있습니다. 정확한 수치는 구독 후 확인됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── 종합 점수 ────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-700">AI 노출 종합 점수</p>
                <p className="text-sm text-gray-400">100점 만점</p>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <span className={`text-5xl font-black ${gradeColor(grade)}`}>{grade}</span>
                <span className="text-3xl font-bold text-gray-900 mb-1">{score}점</span>
                <span className="text-sm text-gray-400 mb-1.5">
                  {score >= 80 ? "경쟁사보다 유리한 위치입니다" :
                   score >= 60 ? "평균 수준이며 개선 여지가 있습니다" :
                   score >= 40 ? "노출이 낮아 손님이 경쟁 가게를 선택합니다" :
                                 "손님이 검색해도 내 가게를 찾기 어렵습니다"}
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

            {/* ── 채널 분리 점수 미리보기 ────────────────────────────── */}
            {(() => {
              const naverCh = result.score.naver_channel_score;
              return (
                <div className="grid grid-cols-2 gap-3">
                  {/* 네이버 채널 — 실제 점수 표시 */}
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
                    <p className="text-sm font-semibold text-gray-600 mb-0.5">네이버 AI 채널</p>
                    <p className="text-sm text-gray-400 mb-3">네이버 브리핑 · 카카오맵</p>
                    {naverCh !== undefined ? (
                      <>
                        <div className={`text-3xl font-black mb-1 ${
                          naverCh >= 70 ? "text-green-500" : naverCh >= 40 ? "text-amber-500" : "text-red-400"
                        }`}>
                          {Math.round(naverCh)}점
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                          <div
                            className={`h-2 rounded-full ${naverCh >= 70 ? "bg-green-500" : naverCh >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                            style={{ width: `${Math.min(100, naverCh)}%` }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className={isSmartPlace ? "text-green-500" : "text-gray-300"}>
                              {isSmartPlace ? "✓" : "○"}
                            </span>
                            <span className={isSmartPlace ? "text-gray-600" : "text-gray-400"}>스마트플레이스</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className={isOnKakao ? "text-green-500" : "text-gray-300"}>
                              {isOnKakao ? "✓" : "○"}
                            </span>
                            <span className={isOnKakao ? "text-gray-600" : "text-gray-400"}>카카오맵</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-2xl font-black text-gray-300">—</div>
                    )}
                  </div>

                  {/* 글로벌 AI 채널 — 잠금 처리 */}
                  <div className="bg-white rounded-2xl shadow-sm px-4 py-4 relative overflow-hidden">
                    <p className="text-sm font-semibold text-gray-600 mb-0.5">글로벌 AI 채널</p>
                    <p className="text-sm text-gray-400 mb-3">ChatGPT · Perplexity · Google</p>
                    {/* 블러 처리된 가짜 데이터 */}
                    <div className="select-none pointer-events-none blur-sm">
                      <div className="text-3xl font-black text-blue-500 mb-1">??점</div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                        <div className="h-2 rounded-full bg-blue-400" style={{ width: "45%" }} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-300">○</span>
                          <span className="text-gray-400">ChatGPT 노출</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-300">○</span>
                          <span className="text-gray-400">Google AI Overview</span>
                        </div>
                      </div>
                    </div>
                    {/* 잠금 오버레이 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[1px]">
                      <span className="text-xl mb-1">🔒</span>
                      <Link
                        href="/signup"
                        className="text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl px-3 py-2 transition-colors text-center"
                      >
                        회원가입 후 확인
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 채널 설명 교육 배너 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-base font-semibold text-amber-800 mb-1">
                네이버만 잘 관리해도 ChatGPT에서 노출되지 않는 이유
              </p>
              <p className="text-base text-amber-700 leading-relaxed">
                <strong>네이버는 ChatGPT·Gemini·Perplexity의 크롤링을 차단</strong>하고 있습니다.
                글로벌 AI 채널에서 인용되려면 독립 웹사이트 + Google 비즈니스 프로필이 필요합니다.
                구독 후 두 채널의 정확한 점수와 개선 방법을 확인하세요.
              </p>
            </div>

            {/* ── 지금 당장 할 수 있는 1가지 (미노출 3개+ 일 때) ─────── */}
            {(() => {
              const misses = [!mentioned, !naverRank, !isOnKakao, blogCount === 0].filter(Boolean).length;
              if (misses < 3) return null;
              // 우선순위: 스마트플레이스 미등록 > 카카오 미등록 > 블로그 없음
              const action = !isSmartPlace
                ? { label: "네이버 스마트플레이스 무료 등록", sub: "등록 즉시 네이버 지도 검색에 노출됩니다", href: "https://smartplace.naver.com", external: true }
                : !isOnKakao
                ? { label: "카카오맵 사업장 무료 등록", sub: "카카오맵 사용자에게 노출됩니다", href: "https://place.map.kakao.com", external: true }
                : { label: "블로그 후기 1건 요청하기", sub: "단골 손님 1명에게 블로그 후기를 부탁하세요", href: "/signup", external: false };
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                  <p className="text-sm font-bold text-amber-700 mb-1">지금 당장 무료로 할 수 있는 1가지</p>
                  <p className="text-sm font-bold text-gray-900 mb-0.5">{action.label}</p>
                  <p className="text-sm text-gray-500 mb-3">{action.sub}</p>
                  {action.external ? (
                    <a href={action.href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between bg-amber-500 text-white rounded-xl px-4 py-2.5 hover:bg-amber-600 transition-colors">
                      <span className="text-sm font-bold">{action.label} →</span>
                      <span className="text-sm opacity-80">무료</span>
                    </a>
                  ) : (
                    <Link href={action.href}
                      className="flex items-center justify-between bg-amber-500 text-white rounded-xl px-4 py-2.5 hover:bg-amber-600 transition-colors">
                      <span className="text-sm font-bold">{action.label} →</span>
                      <span className="text-sm opacity-80">무료</span>
                    </Link>
                  )}
                </div>
              );
            })()}

            {/* ── 현재 성장 단계 ───────────────────────────────── */}
            {result.growth_stage && (() => {
              const gs: GrowthStage = result.growth_stage!;
              const stageColor: Record<string, string> = {
                survival:  'bg-red-50 border-red-200 text-red-800',
                stability: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                growth:    'bg-blue-50 border-blue-200 text-blue-800',
                dominance: 'bg-green-50 border-green-200 text-green-800',
              };
              const colorClass = stageColor[gs.stage] ?? 'bg-gray-50 border-gray-200 text-gray-800';
              return (
                <div className={`rounded-2xl border p-5 ${colorClass}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📈</span>
                      <span className="text-sm font-semibold">현재 단계: {gs.stage_label}</span>
                    </div>
                    <span className="text-sm opacity-70">{gs.score_range}</span>
                  </div>
                  <p className="text-sm mb-3 leading-relaxed">{gs.focus_message}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-white bg-opacity-60 rounded-xl p-3">
                      <div className="text-sm font-semibold mb-1">이번 주 집중할 것</div>
                      <p className="text-sm leading-relaxed">{gs.this_week_action}</p>
                    </div>
                    <div className="bg-white bg-opacity-40 rounded-xl p-3">
                      <div className="text-sm font-semibold mb-1 opacity-70">지금 하지 말아야 할 것</div>
                      <p className="text-sm leading-relaxed opacity-80">{gs.do_not_do}</p>
                    </div>
                  </div>
                  {gs.estimated_weeks_to_next && (
                    <p className="text-sm opacity-60 mt-2">다음 단계까지 약 {gs.estimated_weeks_to_next}주 예상 · 구독 시 실제 데이터 기반으로 측정</p>
                  )}
                </div>
              );
            })()}

            {/* ── 항목별 분석 (소상공인 언어) ─────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">항목별 점수 분석</p>
                <p className="text-base text-gray-400 mt-0.5">각 항목이 왜 이 점수인지 설명합니다</p>
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
                      <p className="text-sm text-gray-500 leading-relaxed">{info.what}</p>
                      <p className={`text-sm mt-1 font-medium ${isLow ? "text-red-500" : "text-green-600"}`}>
                        {isLow ? `⚠ ${info.low}` : `✓ ${info.high}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 구독하면 무엇이 달라지나 (잠금) ─────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">구독하면 이런 정보를 드립니다</p>
              </div>

              {/* 무료 vs 구독 비교표 */}
              <div className="px-5 pt-4 pb-2">
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
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
                      <li>· AI 7개 동시 분석</li>
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
                  <p className="text-sm font-bold text-gray-700 text-center px-2">
                    {selectionScore < 40
                      ? "경쟁 가게는 이미 이 방법을 쓰고 있습니다"
                      : "더 자주 선택받는 방법이 여기 있습니다"}
                  </p>
                  <p className="text-base text-gray-500 text-center mt-1 px-4">월 9,900원 · 언제든 해지 가능</p>
                </div>
                <div className="space-y-3 p-4 opacity-20 select-none pointer-events-none">
                  {Object.entries(BREAKDOWN_INFO).map(([key, info]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span>{info.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{info.label} 개선 방법</p>
                        <p className="text-sm text-gray-500">{info.tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 어떻게 개선하나요? */}
              <div className="mx-5 mb-5 bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-sm font-bold text-blue-800 mb-2">어떻게 개선하나요?</p>
                <div className="space-y-1.5 text-sm text-blue-700">
                  <p>🗺️ <strong>네이버 스마트플레이스 최적화</strong> — 지역 검색 상위 노출을 위한 키워드·사진·정보를 가이드로 알려드립니다.</p>
                  <p>✍️ <strong>블로그 후기 늘리기</strong> — 어떤 키워드로 후기를 유도해야 AI가 더 자주 추천하는지 알려드립니다.</p>
                  <p>🤖 <strong>AI 추천 확률 높이기</strong> — 100회 반복 검색으로 실제 노출 확률(%)을 측정하고 매일 추적합니다.</p>
                  <p>📈 <strong>개선 전·후 비교</strong> — 변경 후 점수 변화를 수치로 확인할 수 있습니다.</p>
                </div>
              </div>
            </div>

            {/* ── 스마트플레이스 정보 체크리스트 ─────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">
                  손님이 클릭했을 때 보이는 정보 체크리스트
                </p>
                <p className="text-base text-gray-400 mt-0.5">
                  {isSmartPlace
                    ? "스마트플레이스에 이 정보들이 모두 등록되어 있어야 선택받을 수 있습니다"
                    : "스마트플레이스 미등록 — 아래 정보를 등록할 수 없는 상태입니다"}
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {SMART_PLACE_CHECKLIST.map((item, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      isSmartPlace
                        ? "bg-gray-100 text-gray-400"   // 등록됐다면 직접 확인 필요
                        : "bg-red-100 text-red-400"
                    }`}>
                      {isSmartPlace ? "?" : "✕"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">{item.item}</span>
                        <span className={`text-sm px-1.5 py-0.5 rounded-full font-medium ${
                          item.impact === "high"   ? "bg-red-100 text-red-600" :
                          item.impact === "medium" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          {item.impact === "high" ? "필수" : item.impact === "medium" ? "중요" : "권장"}
                        </span>
                      </div>
                      <p className="text-base text-gray-400 mt-0.5">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
              {isSmartPlace ? (
                <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
                  <p className="text-sm text-blue-700">
                    구독하면 위 항목들이 실제로 등록되어 있는지 자동으로 점검하고 빠진 항목을 알려드립니다.
                  </p>
                </div>
              ) : (
                <div className="px-5 py-3 bg-red-50 border-t border-red-100">
                  <p className="text-sm text-red-600 font-medium">
                    스마트플레이스 미등록 → 네이버 지역 검색에서 보이지 않고, 위 정보를 손님에게 보여줄 수 없습니다.
                  </p>
                  <a
                    href="https://smartplace.naver.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 underline mt-1 inline-block"
                  >
                    네이버 스마트플레이스 무료 등록하기 →
                  </a>
                </div>
              )}
            </div>

            {/* ── 다양한 키워드로 검색하는 손님들 ────────────────────── */}
            {relatedKws.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">손님들이 이런 키워드로도 검색합니다</p>
                  <p className="text-base text-gray-400 mt-0.5">
                    이번 분석은 <strong>&ldquo;{naver?.search_query ?? result.query}&rdquo;</strong> 1개 키워드만 확인했습니다
                  </p>
                </div>
                <div className="px-5 py-3">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {relatedKws.map((kw) => (
                      <span key={kw} className="bg-gray-100 text-gray-600 text-sm px-2.5 py-1 rounded-full">
                        {form.region.split(" ")[0]} {kw}
                      </span>
                    ))}
                  </div>
                  <div className="bg-blue-50 rounded-xl px-3 py-2.5">
                    <p className="text-sm text-blue-700">
                      구독하면 여러 키워드에서 동시에 추적하고 어느 키워드에서 몇 위로 노출되는지 매일 확인할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── CTA ─────────────────────────────────────────────── */}
            <div className={`rounded-2xl overflow-hidden ${selectionScore >= 50 ? "bg-blue-600" : "bg-gray-900"}`}>
              {/* 메인 메시지 */}
              <div className="px-5 pt-5 pb-4">
                <p className="font-bold text-white text-lg leading-snug mb-1">
                  {selectionScore >= 70
                    ? "경쟁 가게보다 한 발 더 앞서갈 수 있습니다"
                    : selectionScore >= 40
                    ? "지금 경쟁 가게에 손님을 빼앗기고 있습니다"
                    : "지금 이 순간에도 손님이 경쟁 가게로 가고 있습니다"}
                </p>
                <p className="text-sm text-white/75 mb-4">
                  {selectionScore >= 70
                    ? "7개 AI + 매일 100회 자동 측정으로 정확한 순위를 확인하고, 1등 자리를 지키세요."
                    : selectionScore >= 40
                    ? "정확한 원인을 찾아 네이버·카카오·ChatGPT 전 채널 노출을 한 번에 끌어올리세요."
                    : "정확한 원인을 파악하고 경쟁 가게보다 먼저 AI 검색에 노출되세요."}
                </p>
                <Link
                  href="/signup"
                  className="block w-full bg-white text-gray-900 rounded-xl py-3.5 font-bold text-center hover:bg-gray-100 transition-colors text-sm"
                >
                  1분 무료 회원가입
                </Link>
                <p className="text-sm text-white/50 text-center mt-2">가입 후 Full 스캔 1회 무료 · 이후 월 9,900원 · 언제든 해지</p>
              </div>

              {/* 구독 후 흐름 안내 */}
              <div className="bg-black/20 px-5 py-4">
                <p className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wide">가입 후 이렇게 진행됩니다</p>
                <div className="space-y-2.5">
                  {[
                    { step: "1", label: "1분 회원가입",         desc: "이메일 인증만으로 즉시 시작" },
                    { step: "2", label: "가게 등록",             desc: "방금 입력한 정보 그대로 사용" },
                    { step: "3", label: "7개 AI + 100회 자동 분석", desc: "Gemini·ChatGPT·Perplexity 등 동시 측정" },
                    { step: "4", label: "매일 카카오톡 알림",    desc: "순위 변화·경쟁사 동향 자동 발송" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
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
