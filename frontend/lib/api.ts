import {
  TrialScanRequest, TrialScanResult, BenchmarkData, AdDefenseGuide,
  StartupReportRequest, StartupReport, StartupMarket,
  TeamMember, ApiKey, CompetitorSearchResult, CompetitorSuggestion,
  SharePageData, MentionContext, BadgeData, BusinessSearchResult,
  KeywordVolume, IndustryTrend, ConversionTipsResponse,
  TrialBusinessSearchResponse,
} from "@/types";
import type { GapAnalysis } from "@/types/gap";
import type { ActionPlan } from "@/types/action";
import type { MarketLandscape } from "@/types/market";

export const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const BACKEND_URL = apiBase;

// API 에러 코드별 사용자 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  TRIAL_LIMIT:      "하루 무료 체험 한도(3회)에 도달했습니다. 내일 다시 시도하거나 회원가입 후 이용하세요.",
  PLAN_REQUIRED:    "이 기능은 유료 플랜에서 이용할 수 있습니다.",
  SCAN_LIMIT:       "이번 달 무료 스캔 횟수(3회)를 모두 사용했습니다.",
  SCAN_IN_PROGRESS: "이미 스캔이 진행 중입니다. 잠시 후 다시 시도해주세요.",
  AI_UNAVAILABLE:   "일부 AI 서비스가 일시적으로 이용 불가합니다.",
  PAYMENT_FAILED:   "결제에 실패했습니다. 카드 정보를 확인해주세요.",
  SERVER_ERROR:     "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
};

export class ApiError extends Error {
  public status?: number;
  constructor(
    public code: string,
    public detail: Record<string, unknown> = {},
    status?: number,
  ) {
    super(ERROR_MESSAGES[code] || ERROR_MESSAGES["SERVER_ERROR"]);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const code = (err?.detail?.code as string) || "SERVER_ERROR";
    throw new ApiError(code, err?.detail || {}, res.status);
  }
  // 204 No Content 등 본문 없는 응답 처리
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  if (!text) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as unknown as T;
  }
}

export async function trialScan(req: TrialScanRequest, adminKey?: string): Promise<TrialScanResult> {
  return apiCall<TrialScanResult>(`${BACKEND_URL}/api/scan/trial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(adminKey ? { "X-Admin-Key": adminKey } : {}),
    },
    body: JSON.stringify(req),
  });
}

/**
 * 신뢰도 강화 1라운드 — 네이버 지역검색으로 후보 5개 조회
 * 비로그인 호출 가능 (trial 플로우에서만 사용)
 * 백엔드 응답 키가 `results` 또는 `items`로 들어올 수 있어 둘 다 수용
 */
export async function searchTrialBusiness(
  query: string,
  region?: string,
): Promise<TrialBusinessSearchResponse> {
  const params = new URLSearchParams({ query });
  if (region) params.set("region", region);
  const raw = await apiCall<{
    results?: TrialBusinessSearchResponse["results"];
    items?: TrialBusinessSearchResponse["results"];
    fallback_to_manual?: boolean;
  }>(`${BACKEND_URL}/api/scan/trial-search?${params.toString()}`);
  return {
    results: raw?.results ?? raw?.items ?? [],
    fallback_to_manual: !!raw?.fallback_to_manual,
  };
}

/**
 * SSE 스트리밍: 2단계 인증 방식
 * 1단계: POST /stream/prepare (Bearer 토큰) → stream_token 발급 (60초 유효)
 * 2단계: EventSource /stream?stream_token=... 연결
 */
export async function prepareStreamToken(bizId: string, authToken: string): Promise<string> {
  const res = await fetch(
    `${BACKEND_URL}/api/scan/stream/prepare?biz_id=${encodeURIComponent(bizId)}`,
    { method: "POST", headers: { Authorization: `Bearer ${authToken}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError((err?.detail?.code as string) || "SERVER_ERROR", err?.detail || {});
  }
  const data = await res.json();
  return data.stream_token as string;
}

export async function streamScan(bizId: string, authToken: string): Promise<EventSource> {
  const streamToken = await prepareStreamToken(bizId, authToken);
  return new EventSource(`${BACKEND_URL}/api/scan/stream?stream_token=${encodeURIComponent(streamToken)}`);
}

export async function getScore(bizId: string, authToken?: string) {
  return apiCall(`${BACKEND_URL}/api/report/score/${bizId}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
}

export async function getHistory(bizId: string, authToken?: string) {
  return apiCall(`${BACKEND_URL}/api/report/history/${bizId}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
}

export async function getCompetitors(bizId: string, authToken?: string) {
  return apiCall(`${BACKEND_URL}/api/report/competitors/${bizId}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
}

export async function generateSchema(req: {
  business_name: string;
  category: string;
  region: string;
  address?: string;
  phone?: string;
  website_url?: string;
  opening_hours?: string;
  description?: string;
}, userId?: string) {
  return apiCall(`${BACKEND_URL}/api/schema/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "X-User-Id": userId } : {}),
    },
    body: JSON.stringify(req),
  });
}

export async function generateGuide(req: { business_id: string; scan_id: string }) {
  return apiCall(`${BACKEND_URL}/api/guide/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

export async function issueBilling(body: {
  authKey: string;
  customerKey: string;
  plan: string;
  amount: number;
}) {
  return apiCall(`${BACKEND_URL}/api/webhook/toss/billing/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── 사업장 ──────────────────────────────────────────────
export async function createBusiness(
  data: {
    name: string; category: string; region?: string;
    address?: string; phone?: string; website_url?: string; blog_url?: string; keywords?: string[];
    naver_place_id?: string; naver_place_url?: string;
    google_place_id?: string; kakao_place_id?: string;
    business_type?: string;
  },
  userId: string,
  token?: string,
) {
  return apiCall(`${BACKEND_URL}/api/businesses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
}

export async function getMyBusinesses(userId: string, token?: string) {
  return apiCall(`${BACKEND_URL}/api/businesses/me`, {
    headers: {
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ── 사업장 검색 (네이버/카카오 자동완성) ─────────────────────
export async function searchBusiness(query: string, region: string): Promise<BusinessSearchResult[]> {
  try {
    const params = new URLSearchParams({ query, region });
    const res = await fetch(`${BACKEND_URL}/api/businesses/search?${params}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ── 경쟁사 ──────────────────────────────────────────────
export async function addCompetitor(
  data: {
    business_id: string;
    name: string;
    address?: string;
    naver_place_id?: string;
    kakao_place_id?: string;
    lat?: number;
    lng?: number;
  },
  userId: string,
  token?: string,
) {
  return apiCall(`${BACKEND_URL}/api/competitors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
}

export async function removeCompetitor(competitorId: string, userId: string, token?: string) {
  return apiCall(`${BACKEND_URL}/api/competitors/${competitorId}`, {
    method: "DELETE",
    headers: {
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function listCompetitors(bizId: string, authToken?: string) {
  return apiCall(`${BACKEND_URL}/api/competitors/${bizId}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
}

// ── 리포트 ──────────────────────────────────────────────
export async function getBeforeAfter(bizId: string, authToken?: string) {
  return apiCall(`${BACKEND_URL}/api/report/before-after/${bizId}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
}

export async function getIndustryRanking(category: string, region: string) {
  return apiCall(`${BACKEND_URL}/api/report/ranking/${category}/${region}`);
}

// ── 설정·구독 ─────────────────────────────────────────────
export async function getMySettings(token: string) {
  return apiCall(`${BACKEND_URL}/api/settings/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function cancelSubscription(token: string) {
  return apiCall(`${BACKEND_URL}/api/settings/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updatePhone(phone: string, token: string) {
  return apiCall(`${BACKEND_URL}/api/settings/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ phone }),
  });
}

export async function exportReport(bizId: string, userId: string, authToken?: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/report/export/${bizId}`, {
    headers: {
      "X-User-Id": userId,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError((err?.detail?.code as string) || "SERVER_ERROR", err?.detail || {});
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aeolab_report.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportPdfReport(bizId: string, userId: string, authToken?: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/report/pdf/${bizId}`, {
    headers: {
      "X-User-Id": userId,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError((err?.detail?.code as string) || "SERVER_ERROR", err?.detail || {});
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aeolab_report.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 누락 함수 12종 추가 ──────────────────────────────────────

// ① 업종 벤치마크 조회
export async function getBenchmark(category: string, region: string): Promise<BenchmarkData> {
  return apiCall<BenchmarkData>(
    `${BACKEND_URL}/api/report/benchmark/${encodeURIComponent(category)}/${encodeURIComponent(region)}`,
  );
}

// ② PDF 리포트 다운로드 — exportPdfReport 사용 (통합됨)

// ③ ChatGPT 광고 대응 가이드
export async function generateAdDefenseGuide(bizId: string, userId: string, token?: string): Promise<AdDefenseGuide> {
  return apiCall<AdDefenseGuide>(`${BACKEND_URL}/api/guide/ad-defense/${bizId}`, {
    method: "POST",
    headers: {
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ④ 창업 시장 분석 리포트
export async function generateStartupReport(req: StartupReportRequest, userId: string, token?: string): Promise<StartupReport> {
  return apiCall<StartupReport>(`${BACKEND_URL}/api/startup/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
  });
}

// ⑤ 창업 시장 현황 (공개)
export async function getStartupMarket(category: string, region: string): Promise<StartupMarket> {
  return apiCall<StartupMarket>(
    `${BACKEND_URL}/api/startup/market/${encodeURIComponent(category)}/${encodeURIComponent(region)}`,
  );
}

// ⑥ 팀 멤버 목록
export async function getTeamMembers(userId: string, token?: string): Promise<TeamMember[]> {
  return apiCall<TeamMember[]>(`${BACKEND_URL}/api/teams/members`, {
    headers: {
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ⑦ 팀원 초대
export async function inviteTeamMember(email: string, role: string, userId: string, token?: string): Promise<void> {
  return apiCall<void>(`${BACKEND_URL}/api/teams/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ email, role }),
  });
}

// ⑧ API 키 목록
export async function getApiKeys(userId: string, token?: string): Promise<ApiKey[]> {
  return apiCall<ApiKey[]>(`${BACKEND_URL}/api/v1/keys`, {
    headers: {
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ⑨ API 키 발급
export async function createApiKey(name: string, userId: string, token?: string): Promise<ApiKey> {
  return apiCall<ApiKey>(`${BACKEND_URL}/api/v1/keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name }),
  });
}

// ⑩ API 키 폐기
export async function revokeApiKey(keyId: string, userId: string, token?: string): Promise<void> {
  return apiCall<void>(`${BACKEND_URL}/api/v1/keys/${keyId}`, {
    method: "DELETE",
    headers: {
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ⑪ 경쟁사 지역 검색 (네이버)
export async function searchCompetitors(query: string, region: string, token?: string): Promise<CompetitorSearchResult[]> {
  return apiCall<CompetitorSearchResult[]>(
    `${BACKEND_URL}/api/competitors/search?query=${encodeURIComponent(query)}&region=${encodeURIComponent(region)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
}

// ⑫ AEOlab 내 동종업계 추천
export async function getSuggestedCompetitors(
  bizId: string,
  category: string,
  region: string,
  token?: string,
): Promise<CompetitorSuggestion[]> {
  return apiCall<CompetitorSuggestion[]>(
    `${BACKEND_URL}/api/competitors/suggest/list?business_id=${encodeURIComponent(bizId)}&category=${encodeURIComponent(category)}&region=${encodeURIComponent(region)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
}

// ── 공유 카드 ──────────────────────────────────────────────
export async function getSharePageData(bizId: string): Promise<SharePageData> {
  return apiCall<SharePageData>(`${BACKEND_URL}/api/report/share/${bizId}`);
}

// ── 언급 맥락 분석 (Pro+) ────────────────────────────────────
export async function getMentionContext(bizId: string, userId: string, token?: string): Promise<{ platforms: MentionContext[]; summary: Record<string, unknown> }> {
  return apiCall(`${BACKEND_URL}/api/report/mention-context/${bizId}`, {
    headers: {
      "X-User-Id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ── AEO 인증 배지 ──────────────────────────────────────────
export async function getBadge(bizId: string): Promise<BadgeData> {
  return apiCall<BadgeData>(`${BACKEND_URL}/api/report/badge/${bizId}`);
}

// ── 도메인 모델 v2.1 — 4개 도메인 API ────────────────────────

// Domain 2: MarketLandscape 통합 조회 (Basic+)
export async function getMarket(bizId: string, authToken: string): Promise<MarketLandscape> {
  return apiCall<MarketLandscape>(`${BACKEND_URL}/api/report/market/${bizId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

// Domain 3: GapAnalysis 조회 (Basic+)
export async function getGapAnalysis(bizId: string, authToken: string): Promise<GapAnalysis> {
  return apiCall<GapAnalysis>(`${BACKEND_URL}/api/report/gap/${bizId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

export async function getConversionTips(
  bizId: string,
  authToken: string,
): Promise<ConversionTipsResponse> {
  return apiCall<ConversionTipsResponse>(
    `${BACKEND_URL}/api/report/conversion-tips/${bizId}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
}

// Domain 4: ActionPlan 최신 가이드 조회 (ActionTools 포함)
export async function getLatestActionPlan(bizId: string, authToken: string): Promise<ActionPlan | null> {
  try {
    return await apiCall<ActionPlan>(`${BACKEND_URL}/api/guide/${bizId}/latest`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    return null;
  }
}

// 갭 카드 PNG URL (이미지 src로 직접 사용)
export function getGapCardUrl(bizId: string): string {
  return `${BACKEND_URL}/api/report/gap-card/${bizId}`;
}

// ── 공지사항 ─────────────────────────────────────────────────
export async function getNotices(
  page = 1,
  category?: string,
): Promise<{ items: import("@/types").Notice[]; total: number; page: number }> {
  const params = new URLSearchParams({ page: String(page) });
  if (category) params.set("category", category);
  return apiCall(`${BACKEND_URL}/api/notices?${params.toString()}`);
}

export async function getNotice(id: number): Promise<import("@/types").Notice> {
  return apiCall(`${BACKEND_URL}/api/notices/${id}`);
}

// ── FAQ ──────────────────────────────────────────────────────
export async function getFAQs(
  category?: string,
): Promise<{ items: import("@/types").FAQ[] }> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const qs = params.toString();
  return apiCall(`${BACKEND_URL}/api/faq${qs ? "?" + qs : ""}`);
}


// ── 문의하기 ─────────────────────────────────────────────────
export async function submitInquiry(data: {
  name: string;
  email: string;
  subject: string;
  content: string;
}): Promise<{ id: number; message: string }> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return apiCall<{ id: number; message: string }>(`${BACKEND_URL}/api/inquiry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
}

export async function getMyInquiries(): Promise<{ items: import("@/types").Inquiry[] }> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return apiCall<{ items: import("@/types").Inquiry[] }>(`${BACKEND_URL}/api/inquiry/me`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ── 카카오맵 체크리스트 ──────────────────────────────────────────

export interface KakaoScoreResult {
  biz_id: string;
  score: number;
  checklist: Record<string, boolean>;
  kakao_registered: boolean;
  updated_at?: string;
}

/** 카카오맵 체크리스트 점수 조회 */
export async function getKakaoScore(bizId: string, token?: string): Promise<KakaoScoreResult | null> {
  try {
    return await apiCall<KakaoScoreResult>(`${BACKEND_URL}/api/kakao/checklist/${bizId}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    return null;
  }
}

/** 카카오맵 체크리스트 저장 */
export async function saveKakaoChecklist(
  bizId: string,
  checklist: Record<string, boolean>,
  score: number,
  token?: string,
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`${BACKEND_URL}/api/kakao/checklist/${bizId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ checklist, score }),
  });
}

/** 카카오맵 등록 여부 확인 (kakao_place_id 보유 여부 기반) */
export async function checkKakaoRegistration(bizId: string, token?: string): Promise<{ registered: boolean; kakao_place_id?: string }> {
  try {
    return await apiCall<{ registered: boolean; kakao_place_id?: string }>(
      `${BACKEND_URL}/api/kakao/check/${bizId}`,
      { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
    );
  } catch {
    return { registered: false };
  }
}

// ── 네이버 데이터 연동 ───────────────────────────────────────────

// 키워드 검색량 조회 (네이버 데이터랩)
export async function getKeywordVolumes(bizId: string): Promise<Record<string, KeywordVolume>> {
  try {
    return await apiCall<Record<string, KeywordVolume>>(
      `${BACKEND_URL}/api/report/keyword-volumes/${bizId}`,
    );
  } catch {
    return {};
  }
}

// 업종 트렌드 조회 (네이버 데이터랩)
export async function getIndustryTrend(category: string, region?: string): Promise<IndustryTrend | null> {
  try {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiCall<IndustryTrend>(
      `${BACKEND_URL}/api/report/industry-trend/${encodeURIComponent(category)}${qs}`,
    );
  } catch {
    return null;
  }
}

// 경쟁사 정보 수정 (naver_place_id 등)
export async function updateCompetitor(
  competitorId: string,
  data: { naver_place_id?: string; kakao_place_id?: string; name?: string; address?: string },
  token: string,
): Promise<Record<string, unknown>> {
  return apiCall<Record<string, unknown>>(`${BACKEND_URL}/api/competitors/${competitorId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// 경쟁사 플레이스 수동 동기화
export async function syncCompetitorPlace(competitorId: string, token?: string): Promise<void> {
  await apiCall<void>(`${BACKEND_URL}/api/competitors/${competitorId}/sync-place`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ── 블로그 진단 ───────────────────────────────────────────────────────────────

export async function analyzeBlog(
  businessId: string,
  blogUrl: string,
  token: string,
): Promise<unknown> {
  return apiCall<unknown>(`${BACKEND_URL}/api/blog/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ business_id: businessId, blog_url: blogUrl }),
  });
}

export async function getBlogResult(businessId: string, token?: string): Promise<{
  blog_url?: string;
  blog_analyzed_at?: string;
  blog_keyword_coverage?: number;
} | null> {
  try {
    return await apiCall<{
      blog_url?: string;
      blog_analyzed_at?: string;
      blog_keyword_coverage?: number;
    }>(`${BACKEND_URL}/api/blog/result/${businessId}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    return null;
  }
}

// ── 카드 변경 ─────────────────────────────────────────────────
export async function updateBillingCard(
  authKey: string,
  customerKey: string,
  token: string,
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`${BACKEND_URL}/api/settings/card/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ authKey, customerKey }),
  });
}

// ── 행동 완료 기록 / 결과 조회 ───────────────────────────────────────────────

export async function completeAction(data: {
  business_id: string
  action_type: string
  keyword: string
  action_text: string
}, token: string): Promise<{ id: string }> {
  return apiCall<{ id: string }>(`${BACKEND_URL}/api/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
}

export async function getActionResults(bizId: string, token: string): Promise<ActionCompletion[]> {
  try {
    return await apiCall<ActionCompletion[]>(`${BACKEND_URL}/api/actions/biz/${bizId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return []
  }
}

export async function getCompetitorChanges(bizId: string, token: string): Promise<CompetitorChange[]> {
  try {
    return await apiCall<CompetitorChange[]>(`${BACKEND_URL}/api/competitors/${bizId}/changes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return []
  }
}

export interface ActionCompletion {
  id: string
  action_type: string
  keyword: string
  completed_at: string
  rescan_done: boolean
  before_mentioned: boolean | null
  after_mentioned: boolean | null
  before_score: number | null
  after_score: number | null
  result_summary: string | null
}

export interface CompetitorChange {
  id: string
  name: string
  change_summary: string
  change_detected_at: string
}

export async function generateSmartplaceFAQ(bizId: string, token: string): Promise<{ faqs: Array<{ question: string; answer: string }>; used: number; limit: number }> {
  const res = await fetch(`${BACKEND_URL}/api/guide/${bizId}/smartplace-faq`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail || 'FAQ 생성 실패')
  }
  return res.json()
}

// ── 리뷰 답변 AI 생성 ────────────────────────────────────────────────────────

export interface ReviewReplyResult {
  id: string
  tone: string
  draft_response: string
  keywords_used: string[]
  created_at: string
}

export async function generateReviewReply(
  bizId: string,
  reviewText: string,
  token: string,
): Promise<ReviewReplyResult & { used: number; limit: number }> {
  return apiCall<ReviewReplyResult & { used: number; limit: number }>(
    `${BACKEND_URL}/api/guide/review-reply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ business_id: bizId, review_text: reviewText }),
    },
  )
}

export async function getReviewReplies(bizId: string, token: string): Promise<ReviewReplyResult[]> {
  try {
    return await apiCall<ReviewReplyResult[]>(
      `${BACKEND_URL}/api/guide/${bizId}/review-replies`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
  } catch {
    return []
  }
}

export async function deleteReviewReply(bizId: string, replyId: string, token: string): Promise<void> {
  await apiCall<void>(
    `${BACKEND_URL}/api/guide/${bizId}/review-replies/${replyId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  )
}

// ── 무료 Basic 1회 체험 ─────────────────────────────────────────────

export interface BasicTrialStatus {
  used: boolean;
  used_at: string | null;
  can_use: boolean;
  has_active_subscription: boolean;
}

export async function getBasicTrialStatus(token: string): Promise<BasicTrialStatus> {
  return apiCall<BasicTrialStatus>(`${BACKEND_URL}/api/scan/basic-trial/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function runBasicTrial(
  token: string,
  business_id: string,
): Promise<{ scan_id: string; business_id: string; message: string }> {
  return apiCall<{ scan_id: string; business_id: string; message: string }>(
    `${BACKEND_URL}/api/scan/basic-trial`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ business_id }),
    },
  );
}

export async function getMultiBizSummary(token: string): Promise<{ items: Array<{ id: string; name: string; category: string; region: string; unified_score: number; track1_score: number; track2_score: number; competitor_count: number; last_scanned_at: string | null }> }> {
  try {
    return await apiCall(`${BACKEND_URL}/api/report/multi-biz-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return { items: [] }
  }
}

// ── 사용자 맞춤 키워드 관리 ───────────────────────────────────────────────
export interface UserKeywords {
  custom: string[];
  excluded: string[];
  taxonomy_count: number;
}

export async function getUserKeywords(bizId: string, token: string): Promise<UserKeywords> {
  return apiCall<UserKeywords>(`${BACKEND_URL}/api/businesses/${bizId}/keywords`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function addExcludedKeyword(bizId: string, keyword: string, token: string) {
  return apiCall<{ message?: string; excluded?: string[] }>(
    `${BACKEND_URL}/api/businesses/${bizId}/keywords/exclude`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keyword }),
    },
  );
}

export async function removeExcludedKeyword(bizId: string, keyword: string, token: string) {
  return apiCall<{ message?: string; excluded?: string[] }>(
    `${BACKEND_URL}/api/businesses/${bizId}/keywords/exclude/${encodeURIComponent(keyword)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export async function addCustomKeyword(bizId: string, keyword: string, token: string) {
  return apiCall<{ message?: string; custom?: string[] }>(
    `${BACKEND_URL}/api/businesses/${bizId}/keywords/custom`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keyword }),
    },
  );
}

export async function removeCustomKeyword(bizId: string, keyword: string, token: string) {
  return apiCall<{ message?: string; custom?: string[] }>(
    `${BACKEND_URL}/api/businesses/${bizId}/keywords/custom/${encodeURIComponent(keyword)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}
