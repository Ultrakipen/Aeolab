"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";
import { trialScan, searchTrialBusiness, ApiError } from "@/lib/api";
import { getSafeSession } from "@/lib/supabase/client";
import type {
  TrialScanResult,
  TrialBusinessCandidate,
} from "@/types";
import TrialInputStep from "./components/TrialInputStep";
import TrialScanningStep from "./components/TrialScanningStep";
import TrialResultStep from "./components/TrialResultStep";
import type {
  Step,
  BusinessType,
  TrialFormState,
  NaverBriefingCheckState,
  NaverBriefingCheckResult,
} from "./components/TrialSharedTypes";

// ── 상수 ───────────────────────────────────────────────────────────────
const SCAN_STEPS = [
  "네이버 AI 브리핑 검색 중...",
  "ChatGPT에서 가게명 확인 중...",
  "업종 키워드 분석 중...",
  "경쟁 가게 평균과 비교 중...",
  "점수 계산 중...",
];

const TRIAL_LS_KEY = "aeolab_trial_v2";
const TRIAL_DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAY_LIMIT = 3;

// ── 무료 체험 횟수 관리 ────────────────────────────────────────────────
interface TrialStore {
  count: number;
  resetAt: number;
}

function loadTrialStore(): TrialStore {
  if (typeof window === "undefined")
    return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
  try {
    const raw = localStorage.getItem(TRIAL_LS_KEY);
    if (!raw) return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
    const store: TrialStore = JSON.parse(raw);
    if (Date.now() > store.resetAt)
      return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
    return store;
  } catch {
    return { count: 0, resetAt: Date.now() + TRIAL_DAY_MS };
  }
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

// ── 메인 페이지 ────────────────────────────────────────────────────────
export default function TrialPage() {
  const searchParams = useSearchParams();

  // ── 핵심 state ──────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("category");
  const [result, setResult] = useState<TrialScanResult | null>(null);
  const [error, setError] = useState("");
  const [scanStep, setScanStep] = useState(0);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState<BusinessType>("location_based");
  const [form, setForm] = useState<TrialFormState>({
    business_name: "",
    region: "",
    extra_keyword: "",
    email: "",
    is_smart_place: undefined,
  });
  const [hasFaq, setHasFaq] = useState(false);
  const [hasRecentPost, setHasRecentPost] = useState(false);
  const [hasIntro, setHasIntro] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isStartupMode, setIsStartupMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ── 검색 후보 state ─────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<TrialBusinessCandidate[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedNaverPlaceId, setSelectedNaverPlaceId] = useState<string | null>(
    null,
  );
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(
    null,
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [forceManualEntry, setForceManualEntry] = useState(false);

  // ── 네이버 AI 브리핑 직접 확인 state ─────────────────────────────────
  const [naverCheckState, setNaverCheckState] =
    useState<NaverBriefingCheckState>("idle");
  const [naverCheckResult, setNaverCheckResult] =
    useState<NaverBriefingCheckResult | null>(null);
  const [naverCheckError, setNaverCheckError] = useState("");
  const [apiBenchmark, setApiBenchmark] = useState<{
    count: number;
    avg_score: number;
    top10_score: number;
  } | null>(null);

  // ── 헬퍼 ────────────────────────────────────────────────────────────
  const getCandidateKey = (c: TrialBusinessCandidate): string => {
    const id = (c.naver_place_id || "").trim();
    if (id) return `id:${id}`;
    return `fb:${c.title}|${c.address || ""}|${c.mapx || ""},${c.mapy || ""}`;
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const buildKeyword = () => {
    const tags = selectedTags.slice(0, 3).join(" ");
    return form.extra_keyword
      ? `${tags} ${form.extra_keyword}`.trim()
      : tags;
  };

  const saveTrialData = () => {
    try {
      localStorage.setItem(
        "aeolab_trial_prefill",
        JSON.stringify({
          name: form.business_name,
          category: selectedCategory,
          region: form.region,
        }),
      );
    } catch {
      // localStorage 접근 실패 시 무시
    }
  };

  // ── URL params 초기화 (industry, category, region 모두 받음) ──────────
  useEffect(() => {
    const paramCategory = searchParams.get("category") || searchParams.get("industry");
    const paramName = searchParams.get("business_name");
    const paramRegion = searchParams.get("region");
    if (paramCategory) {
      setSelectedCategory(paramCategory);
      if (paramName) {
        setForm((prev) => ({
          ...prev,
          business_name: paramName,
          ...(paramRegion ? { region: paramRegion } : {}),
        }));
        setStep("info");
      } else {
        setStep("tags");
      }
    } else if (paramName) {
      setForm((prev) => ({
        ...prev,
        business_name: paramName,
        ...(paramRegion ? { region: paramRegion } : {}),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 쿨다운·세션 초기화 ─────────────────────────────────────────────
  useEffect(() => {
    setCooldownMs(getTrialCooldownRemaining());
    getSafeSession().then((session) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  // ── 벤치마크 API 호출 ───────────────────────────────────────────────
  useEffect(() => {
    if (!result) return;
    const cat = selectedCategory;
    if (!cat) return;
    const reg = form.region || "전국";
    const BACKEND_URL =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    fetch(
      `${BACKEND_URL}/api/report/benchmark/${encodeURIComponent(cat)}/${encodeURIComponent(reg)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setApiBenchmark(d))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // ── 쿨다운 인터벌 ───────────────────────────────────────────────────
  useEffect(() => {
    if (cooldownMs <= 0) return;
    const id = setInterval(() => {
      const remaining = getTrialCooldownRemaining();
      setCooldownMs(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 60_000);
    return () => clearInterval(id);
  }, [cooldownMs]);

  // ── 검색 핸들러 ─────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const remaining = getTrialCooldownRemaining();
    if (remaining > 0) {
      setCooldownMs(remaining);
      setError(
        `오늘 무료 체험을 이미 사용하셨습니다. ${formatCooldown(remaining)} 후 다시 이용하거나 회원가입 후 전체 분석을 이용하세요.`,
      );
      return;
    }
    setError("");

    const skipSearch =
      isStartupMode ||
      businessType !== "location_based" ||
      forceManualEntry ||
      !form.business_name.trim();

    if (skipSearch) {
      await runScan(null);
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    setCandidates([]);
    setSelectedNaverPlaceId(null);
    setSelectedCandidateKey(null);
    try {
      const data = await searchTrialBusiness(
        form.business_name.trim(),
        form.region || undefined,
      );
      setCandidates(data.results || []);
      setStep("search");
    } catch {
      setSearchError(
        "검색 중 오류가 발생했습니다. 직접 입력 정보로 진단을 진행할 수 있습니다.",
      );
      setStep("search");
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePlaceSelect = async (candidate: TrialBusinessCandidate) => {
    const realId = (candidate.naver_place_id || "").trim();
    setSelectedCandidateKey(getCandidateKey(candidate));
    setSelectedNaverPlaceId(realId || null);
    setForm((prev) => ({ ...prev, business_name: candidate.title }));
    await runScan(realId || null, candidate.title, candidate);
  };

  const handleSkipPlaceMatch = async () => {
    await runScan(null);
  };

  const runScan = async (
    naverPlaceId: string | null,
    candidateTitle?: string,
    selectedCandidate?: TrialBusinessCandidate,
  ) => {
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
      const businessNameOverride = candidateTitle || form.business_name;
      const data = await trialScan({
        business_name:
          isStartupMode && !businessNameOverride
            ? `[${selectedCategory}] 예비창업`
            : businessNameOverride,
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
        naver_place_id: naverPlaceId || undefined,
        place_match: selectedCandidate
          ? {
              title: selectedCandidate.title,
              address: selectedCandidate.address,
              phone: selectedCandidate.phone,
              naver_place_id: selectedCandidate.naver_place_id,
              naver_place_url: selectedCandidate.naver_place_url,
              category: selectedCandidate.category,
              mapx: selectedCandidate.mapx,
              mapy: selectedCandidate.mapy,
            }
          : undefined,
      });
      clearInterval(stepInterval);
      setScanStep(SCAN_STEPS.length - 1);
      recordTrialUse();
      setResult(data);
      try {
        localStorage.setItem(
          "aeolab_trial_result",
          JSON.stringify({
            result: data,
            timestamp: Date.now(),
            business_name: form.business_name,
          }),
        );
      } catch {
        // localStorage 접근 실패 시 무시
      }
      setStep("result");
    } catch (err: unknown) {
      clearInterval(stepInterval);
      if (err instanceof ApiError && err.code === "TRIAL_LIMIT") {
        setError(
          "하루 무료 체험 한도(3회)에 도달했습니다. 내일 다시 시도하거나 회원가입 후 전체 분석을 이용하세요.",
        );
        recordTrialUse();
        setCooldownMs(TRIAL_DAY_MS);
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
    setForm({
      business_name: "",
      region: "",
      extra_keyword: "",
      email: "",
      is_smart_place: undefined,
    });
    setScanStep(0);
    setNaverCheckState("idle");
    setNaverCheckResult(null);
    setNaverCheckError("");
    setCandidates([]);
    setSelectedNaverPlaceId(null);
    setSearchLoading(false);
    setSearchError("");
    setForceManualEntry(false);
  };

  const handleNaverBriefingCheck = async () => {
    if (!result || naverCheckState !== "idle") return;
    setNaverCheckState("loading");
    setNaverCheckError("");

    const BACKEND_URL =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    try {
      const keyword = buildKeyword();
      const res = await fetch(`${BACKEND_URL}/api/scan/trial/naver-briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: form.business_name,
          region: form.region || undefined,
          keyword: keyword || undefined,
        }),
      });

      if (res.status === 429) {
        setNaverCheckError("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
        setNaverCheckState("error");
        return;
      }
      if (!res.ok) {
        setNaverCheckError(
          "확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        );
        setNaverCheckState("error");
        return;
      }

      const data: NaverBriefingCheckResult = await res.json();
      setNaverCheckResult(data);
      setNaverCheckState("done");
    } catch {
      setNaverCheckError(
        "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.",
      );
      setNaverCheckState("error");
    }
  };

  const handleNaverCheckReset = () => {
    setNaverCheckState("idle");
    setNaverCheckError("");
  };

  // ── 렌더 ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">
            AEOlab
          </Link>
          <span className="text-sm text-gray-500">무료 AI 노출 진단</span>
        </div>
      </header>

      {/* 입력 단계 (category / tags / info / search) */}
      {step !== "result" && step !== "scanning" && (
        <TrialInputStep
          step={step}
          setStep={setStep}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          toggleTag={toggleTag}
          businessType={businessType}
          setBusinessType={setBusinessType}
          form={form}
          setForm={setForm}
          hasFaq={hasFaq}
          setHasFaq={setHasFaq}
          hasRecentPost={hasRecentPost}
          setHasRecentPost={setHasRecentPost}
          hasIntro={hasIntro}
          setHasIntro={setHasIntro}
          reviewText={reviewText}
          setReviewText={setReviewText}
          description={description}
          setDescription={setDescription}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          isStartupMode={isStartupMode}
          setIsStartupMode={setIsStartupMode}
          candidates={candidates}
          searchLoading={searchLoading}
          searchError={searchError}
          selectedCandidateKey={selectedCandidateKey}
          forceManualEntry={forceManualEntry}
          cooldownMs={cooldownMs}
          error={error}
          onSearch={handleSearch}
          onPlaceSelect={handlePlaceSelect}
          onSkipPlaceMatch={handleSkipPlaceMatch}
          getCandidateKey={getCandidateKey}
        />
      )}

      {/* 스캐닝 단계 */}
      {step === "scanning" && (
        <div className="max-w-2xl mx-auto px-4 py-10">
          <TrialScanningStep
            scanStep={scanStep}
            scanSteps={SCAN_STEPS}
            selectedTag={selectedTags[0] ?? ""}
            region={form.region}
          />
        </div>
      )}

      {/* 결과 단계 */}
      {step === "result" && result && (
        <TrialResultStep
          result={result}
          selectedCategory={selectedCategory}
          selectedTags={selectedTags}
          form={form}
          businessType={businessType}
          hasFaq={hasFaq}
          hasRecentPost={hasRecentPost}
          hasIntro={hasIntro}
          isLoggedIn={isLoggedIn}
          apiBenchmark={apiBenchmark}
          naverCheckState={naverCheckState}
          naverCheckResult={naverCheckResult}
          naverCheckError={naverCheckError}
          onNaverBriefingCheck={handleNaverBriefingCheck}
          onNaverCheckReset={handleNaverCheckReset}
          onSaveTrialData={saveTrialData}
          onReset={reset}
        />
      )}
      <SiteFooter />
    </main>
  );
}
