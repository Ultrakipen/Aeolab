/**
 * Trial 페이지 분해 — step 컴포넌트 간 공유 타입
 *
 * 모든 step 컴포넌트는 props로 콜백·데이터 수신.
 * State 관리는 부모 page.tsx에서 일괄 수행.
 */

import type {
  TrialScanResult,
  TrialBusinessCandidate,
} from "@/types";

export type Step = "category" | "tags" | "info" | "search" | "scanning" | "result";

export type BusinessType = "location_based" | "non_location";

export interface TrialFormState {
  business_name: string;
  region: string;
  extra_keyword: string;
  email: string;
  is_smart_place: boolean | undefined;
  is_franchise: boolean;
}

// 네이버 AI 브리핑 직접 확인 상태
export type NaverBriefingCheckState = "idle" | "loading" | "done" | "error";

export interface NaverBriefingCheckResult {
  exposed: boolean;
  in_briefing: boolean;
  briefing_text?: string;
  rank?: number;
  blog_count?: number;
}

// 결과 step에 넘겨주는 모든 데이터 (page.tsx에서 계산 후 전달)
export interface TrialResultProps {
  result: TrialScanResult;
  selectedCategory: string;
  selectedTags: string[];
  form: TrialFormState;
  businessType: BusinessType;
  hasFaq: boolean;
  hasRecentPost: boolean;
  hasIntro: boolean;
  isLoggedIn: boolean;
  apiBenchmark: { count: number; avg_score: number; top10_score: number; fallback?: string } | null;
  naverCheckState: NaverBriefingCheckState;
  naverCheckResult: NaverBriefingCheckResult | null;
  naverCheckError: string;
  onNaverBriefingCheck: () => Promise<void>;
  onNaverCheckReset: () => void;
  onSaveTrialData: () => void;
  onReset: () => void;
  /** sessionStorage에서 복원된 결과인지 여부 */
  isRestored?: boolean;
  /** 새로 스캔 시작 (캐시 삭제 후 reset) */
  onRescan?: () => void;
}

export interface TrialScanningStepProps {
  scanStep: number;
  scanSteps: string[];
  selectedTag: string;
  region: string;
  briefingCategory?: "active" | "likely" | "inactive";
}

export interface TrialInputStepProps {
  step: Step;
  setStep: (s: Step) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  toggleTag: (t: string) => void;
  businessType: BusinessType;
  setBusinessType: (t: BusinessType) => void;
  form: TrialFormState;
  setForm: React.Dispatch<React.SetStateAction<TrialFormState>>;
  hasFaq: boolean | undefined;
  setHasFaq: (v: boolean | undefined) => void;
  hasRecentPost: boolean | undefined;
  setHasRecentPost: (v: boolean | undefined) => void;
  hasIntro: boolean | undefined;
  setHasIntro: (v: boolean | undefined) => void;
  reviewText: string;
  setReviewText: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  isStartupMode: boolean;
  setIsStartupMode: (
    v: boolean | ((prev: boolean) => boolean),
  ) => void;
  candidates: TrialBusinessCandidate[];
  searchLoading: boolean;
  searchError: string;
  selectedCandidateKey: string | null;
  forceManualEntry: boolean;
  cooldownMs: number;
  error: string;
  onSearch: (e: React.FormEvent) => Promise<void>;
  onPlaceSelect: (c: TrialBusinessCandidate) => Promise<void>;
  onSkipPlaceMatch: () => Promise<void>;
  getCandidateKey: (c: TrialBusinessCandidate) => string;
  primaryKeyword: string;
  setPrimaryKeyword: (v: string) => void;
  onMoveToInfo: () => void;
  inlineSearchResults: TrialBusinessCandidate[];
  inlineSearchLoading: boolean;
  inlineSelectedCandidate: TrialBusinessCandidate | null;
  onInlinePlaceSelect: (c: TrialBusinessCandidate) => void;
  onInlinePlaceClear: () => void;
}
