"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import { trialScan, searchTrialBusiness, ApiError } from "@/lib/api";
import { mapNaverCategory } from "@/lib/categories";
import { getBriefingEligibility } from "@/lib/userGroup";
import { useBriefingCategories } from "@/lib/useBriefingCategories";
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

// ── 모듈 레벨 상수 ────────────────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ── 결과 캐시 (sessionStorage + localStorage fallback) ────────────────
const RESULT_CACHE_KEY = "trial_result_cache";
const RESULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

interface TrialResultCache {
  result: TrialScanResult;
  selectedCategory: string;
  selectedTags: string[];
  form: TrialFormState;
  businessType: BusinessType;
  hasFaq: boolean;
  hasRecentPost: boolean;
  hasIntro: boolean;
  cachedAt: number;
}

function saveResultCache(payload: Omit<TrialResultCache, "cachedAt">): void {
  if (typeof window === "undefined") return;
  const cache: TrialResultCache = { ...payload, cachedAt: Date.now() };
  const json = JSON.stringify(cache);
  try { sessionStorage.setItem(RESULT_CACHE_KEY, json); } catch { /* 무시 */ }
  try { localStorage.setItem(RESULT_CACHE_KEY, json); } catch { /* 무시 */ }
}

function loadResultCache(): TrialResultCache | null {
  if (typeof window === "undefined") return null;
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const raw = storage.getItem(RESULT_CACHE_KEY);
      if (!raw) continue;
      const cache: TrialResultCache = JSON.parse(raw);
      if (Date.now() - cache.cachedAt > RESULT_CACHE_TTL_MS) {
        storage.removeItem(RESULT_CACHE_KEY);
        continue;
      }
      return cache;
    } catch { /* 무시 */ }
  }
  return null;
}

function clearResultCache(): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(RESULT_CACHE_KEY); } catch { /* 무시 */ }
  try { localStorage.removeItem(RESULT_CACHE_KEY); } catch { /* 무시 */ }
}

// ── 상수 ───────────────────────────────────────────────────────────────
const SCAN_STEPS_LOCATION = [
  "네이버 AI 브리핑 검색 중...",
  "ChatGPT에서 가게명 확인 중...",
  "업종 키워드 분석 중...",
  "경쟁 가게 평균과 비교 중...",
  "AI 노출 현황 분석 중...",
];

const SCAN_STEPS_NON_LOCATION = [
  "웹사이트 SEO 분석 중...",
  "ChatGPT에서 가게명 확인 중...",
  "업종 키워드 분석 중...",
  "경쟁 가게 평균과 비교 중...",
  "AI 노출 현황 분석 중...",
];

const TRIAL_LS_KEY = "aeolab_trial_v2";
const TRIAL_DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAY_LIMIT = 999; // 개발 중 무제한

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
  const briefingCats = useBriefingCategories();

  // ── 핵심 state ──────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("category");
  const [result, setResult] = useState<TrialScanResult | null>(null);
  const [error, setError] = useState("");
  const [isRestored, setIsRestored] = useState(false);
  // 복원 배너: null=확인 전, true=복원 가능, false=복원 배너 닫힘/불필요
  const [restoreBanner, setRestoreBanner] = useState<null | "available" | "hidden">(null);
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
  const [hasFaq, setHasFaq] = useState<boolean | undefined>(undefined);
  const [hasRecentPost, setHasRecentPost] = useState<boolean | undefined>(undefined);
  const [hasIntro, setHasIntro] = useState<boolean | undefined>(undefined);
  const [reviewText, setReviewText] = useState("");
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isStartupMode, setIsStartupMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [primaryKeyword, setPrimaryKeyword] = useState("");

  // ── 검색 후보 state ─────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<TrialBusinessCandidate[]>([]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(
    null,
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // ── 인라인 스마트플레이스 검색 state ──────────────────────────────────
  const [inlineSearchResults, setInlineSearchResults] = useState<TrialBusinessCandidate[]>([]);
  const [inlineSearchLoading, setInlineSearchLoading] = useState(false);
  const [inlineSelectedCandidate, setInlineSelectedCandidate] = useState<TrialBusinessCandidate | null>(null);
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
    fallback?: string;
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

  // tags → info 이동 시 primaryKeyword 자동 설정
  const handleMoveToInfo = () => {
    setPrimaryKeyword((prev) => prev || selectedTags[0] || "");
    setStep("info");
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

  // ── URL params 초기화 (industry, category, region, naver_place_id 모두 받음) ──
  useEffect(() => {
    const paramCategory = searchParams.get("category") || searchParams.get("industry");
    const paramName = searchParams.get("business_name");
    const paramRegion = searchParams.get("region");
    const paramPlaceId = searchParams.get("naver_place_id");

    // naver_place_id 있으면: 이름/지역 채우고 info 단계로 바로 이동
    if (paramPlaceId && paramName) {
      setForm((prev) => ({
        ...prev,
        business_name: paramName,
        ...(paramRegion ? { region: paramRegion } : {}),
      }));
      if (!paramCategory) setSelectedCategory("restaurant"); // 기본값
      else setSelectedCategory(paramCategory);
      setStep("info");
      return;
    }

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

  // ── 쿨다운·세션 초기화 + 캐시 복원 감지 ────────────────────────────
  useEffect(() => {
    setCooldownMs(getTrialCooldownRemaining());
    getSafeSession().then((session) => {
      setIsLoggedIn(!!session);
    });
    // sessionStorage 캐시 확인 — URL 파라미터 없으면 자동 복원
    const paramCategory = searchParams.get("category") || searchParams.get("industry");
    const paramPlaceId = searchParams.get("naver_place_id");
    if (!paramCategory && !paramPlaceId) {
      const cached = loadResultCache();
      if (cached) {
        setResult(cached.result);
        setSelectedCategory(cached.selectedCategory);
        setSelectedTags(cached.selectedTags);
        setForm(cached.form);
        setBusinessType(cached.businessType);
        setHasFaq(cached.hasFaq);
        setHasRecentPost(cached.hasRecentPost);
        setHasIntro(cached.hasIntro);
        setIsRestored(true);
        setRestoreBanner("hidden");
        setStep("result");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 벤치마크 API 호출 ───────────────────────────────────────────────
  useEffect(() => {
    if (!result) return;
    const cat = selectedCategory;
    if (!cat) return;
    const reg = form.region || "전국";
    fetch(
      `${BACKEND_URL}/api/report/benchmark/${encodeURIComponent(cat)}/${encodeURIComponent(reg)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.avg_score) setApiBenchmark(d);
        else setApiBenchmark(null);
      })
      .catch(() => { setApiBenchmark(null); });
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

  // ── 인라인 SmartPlace 검색 (가게명 입력 디바운스) ──────────────────────
  useEffect(() => {
    if (step !== "info" || businessType !== "location_based" || isStartupMode) {
      setInlineSearchResults([]);
      setInlineSearchLoading(false);
      return;
    }
    const name = form.business_name.trim();
    if (name.length < 2) {
      setInlineSearchResults([]);
      setInlineSearchLoading(false);
      return;
    }
    if (inlineSelectedCandidate && inlineSelectedCandidate.title === name) return;
    setInlineSelectedCandidate(null);
    const timer = setTimeout(async () => {
      setInlineSearchLoading(true);
      try {
        const data = await searchTrialBusiness(name, form.region || undefined);
        setInlineSearchResults((data.results || []).slice(0, 4));
      } catch {
        setInlineSearchResults([]);
      } finally {
        setInlineSearchLoading(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.business_name, step, businessType, isStartupMode]);

  const handleInlinePlaceSelect = (candidate: TrialBusinessCandidate) => {
    setInlineSelectedCandidate(candidate);
    const addrParts = (candidate.address || "").split(" ");
    const autoRegion = addrParts.slice(0, 2).join(" ");

    // 네이버 카테고리 자동 매핑
    const mappedCategory = mapNaverCategory(candidate.category);

    setForm((prev) => ({
      ...prev,
      business_name: candidate.title,
      is_smart_place: true,
      ...(!prev.region?.trim() && autoRegion ? { region: autoRegion } : {}),
    }));

    // 유효한 카테고리면 자동 세팅 (other는 사용자가 직접 선택하도록 유지)
    if (mappedCategory && mappedCategory !== "other") {
      setSelectedCategory(mappedCategory);
    }

    setHasIntro(undefined);
    setHasRecentPost(undefined);
    setHasFaq(undefined);
    setInlineSearchResults([]);
  };

  const handleInlinePlaceClear = () => {
    setInlineSelectedCandidate(null);
    setInlineSearchResults([]);
    setForm((prev) => ({ ...prev, is_smart_place: undefined }));
    setHasIntro(undefined);
    setHasRecentPost(undefined);
    setHasFaq(undefined);
  };

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
      !form.business_name.trim() ||
      !!inlineSelectedCandidate;

    if (skipSearch) {
      if (inlineSelectedCandidate) {
        const realId = (inlineSelectedCandidate.naver_place_id || "").trim();
        await runScan(realId || null, inlineSelectedCandidate.title, inlineSelectedCandidate);
      } else {
        await runScan(null);
      }
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    setCandidates([]);
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
        "네이버 검색 결과를 불러오지 못했습니다. 입력하신 정보로 바로 진단할 수 있습니다.",
      );
      setStep("search");
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePlaceSelect = async (candidate: TrialBusinessCandidate) => {
    const realId = (candidate.naver_place_id || "").trim();
    setSelectedCandidateKey(getCandidateKey(candidate));
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
    setRestoreBanner("hidden");
    setScanStep(0);

    const stepInterval = setInterval(() => {
      setScanStep((prev) => {
        if (prev < SCAN_STEPS_LOCATION.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 2000);

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
        keywords: (() => {
          const effectiveKeywords = primaryKeyword
            ? [primaryKeyword, ...selectedTags.filter(t => t !== primaryKeyword)]
            : selectedTags;
          return effectiveKeywords.length > 0 ? effectiveKeywords : undefined;
        })(),
        email: form.email || undefined,
        business_type: businessType,
        has_faq: hasFaq ?? false,
        has_recent_post: hasRecentPost ?? false,
        has_intro: hasIntro ?? false,
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
      setScanStep(SCAN_STEPS_LOCATION.length - 1);
      recordTrialUse();
      setResult(data);
      setIsRestored(false);
      // sessionStorage + localStorage 양쪽에 결과 캐시 저장 (탭 닫아도 1시간 내 복원)
      saveResultCache({
        result: data,
        selectedCategory,
        selectedTags,
        form,
        businessType,
        hasFaq: hasFaq ?? false,
        hasRecentPost: hasRecentPost ?? false,
        hasIntro: hasIntro ?? false,
      });
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
    clearResultCache();
    setIsRestored(false);
    setRestoreBanner("hidden");
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
    setSearchLoading(false);
    setSearchError("");
    setForceManualEntry(false);
    setInlineSearchResults([]);
    setInlineSearchLoading(false);
    setInlineSelectedCandidate(null);
  };

  // 캐시에서 결과 복원
  const restoreFromCache = () => {
    const cached = loadResultCache();
    if (!cached) return;
    setResult(cached.result);
    setSelectedCategory(cached.selectedCategory);
    setSelectedTags(cached.selectedTags);
    setForm(cached.form);
    setBusinessType(cached.businessType);
    setHasFaq(cached.hasFaq);
    setHasRecentPost(cached.hasRecentPost);
    setHasIntro(cached.hasIntro);
    setIsRestored(true);
    setRestoreBanner("hidden");
    setStep("result");
  };

  const handleNaverBriefingCheck = async () => {
    if (!result || naverCheckState !== "idle") return;
    setNaverCheckState("loading");
    setNaverCheckError("");

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

      // 백엔드가 SSE(text/event-stream) 스트림으로 응답하므로 line-by-line 파싱
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let finalResult: NaverBriefingCheckResult | null = null;
      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "result") {
                finalResult = event as NaverBriefingCheckResult;
              } else if (event.type === "error") {
                setNaverCheckError(event.message || "확인 중 오류가 발생했습니다.");
                setNaverCheckState("error");
                return;
              }
            } catch { /* 불완전 라인 무시 */ }
          }
        }
      }
      if (finalResult) {
        setNaverCheckResult(finalResult);
        setNaverCheckState("done");
      } else {
        setNaverCheckError("결과를 받지 못했습니다. 잠시 후 다시 시도해주세요.");
        setNaverCheckState("error");
      }
    } catch {
      setNaverCheckError(
        "확인 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
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
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-sm text-gray-500">무료 AI 노출 진단</span>
            <AuthNavControlClient />
          </div>
        </div>
      </header>

      {/* 이전 결과 복원 배너 */}
      {restoreBanner === "available" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-sm text-amber-900 font-medium">
              이전 스캔 결과가 저장되어 있습니다. 이어서 보시겠어요?
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={restoreFromCache}
                className="text-sm font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-200 transition-colors"
              >
                이전 결과 보기
              </button>
              <button
                onClick={() => {
                  clearResultCache();
                  setRestoreBanner("hidden");
                }}
                className="text-sm text-amber-700 hover:text-amber-900 px-2 py-1.5 transition-colors"
              >
                새로 스캔
              </button>
            </div>
          </div>
        </div>
      )}

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
          primaryKeyword={primaryKeyword}
          setPrimaryKeyword={setPrimaryKeyword}
          onMoveToInfo={handleMoveToInfo}
          inlineSearchResults={inlineSearchResults}
          inlineSearchLoading={inlineSearchLoading}
          inlineSelectedCandidate={inlineSelectedCandidate}
          onInlinePlaceSelect={handleInlinePlaceSelect}
          onInlinePlaceClear={handleInlinePlaceClear}
        />
      )}

      {/* 스캐닝 단계 */}
      {step === "scanning" && (
        <div className="max-w-2xl mx-auto px-4 py-10">
          <TrialScanningStep
            scanStep={scanStep}
            scanSteps={businessType === "non_location" ? SCAN_STEPS_NON_LOCATION : SCAN_STEPS_LOCATION}
            selectedTag={selectedTags[0] ?? ""}
            region={form.region}
            briefingCategory={getBriefingEligibility(selectedCategory, false, briefingCats?.active, briefingCats?.likely)}
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
          hasFaq={hasFaq ?? false}
          hasRecentPost={hasRecentPost ?? false}
          hasIntro={hasIntro ?? false}
          isLoggedIn={isLoggedIn}
          apiBenchmark={apiBenchmark}
          naverCheckState={naverCheckState}
          naverCheckResult={naverCheckResult}
          naverCheckError={naverCheckError}
          onNaverBriefingCheck={handleNaverBriefingCheck}
          onNaverCheckReset={handleNaverCheckReset}
          onSaveTrialData={saveTrialData}
          onReset={reset}
          isRestored={isRestored}
          onRescan={reset}
        />
      )}
      <SiteFooter />
    </main>
  );
}
