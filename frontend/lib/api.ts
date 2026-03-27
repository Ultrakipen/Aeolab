import {
  TrialScanRequest, TrialScanResult, BenchmarkData, AdDefenseGuide,
  StartupReportRequest, StartupReport, StartupMarket,
  TeamMember, ApiKey, CompetitorSearchResult, CompetitorSuggestion,
  SharePageData, MentionContext, BadgeData,
} from "@/types";

export const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const BACKEND_URL = apiBase;

// API 에러 코드별 사용자 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  PLAN_REQUIRED:    "이 기능은 유료 플랜에서 이용할 수 있습니다.",
  SCAN_LIMIT:       "이번 달 무료 스캔 횟수(3회)를 모두 사용했습니다.",
  SCAN_IN_PROGRESS: "이미 스캔이 진행 중입니다. 잠시 후 다시 시도해주세요.",
  AI_UNAVAILABLE:   "일부 AI 서비스가 일시적으로 이용 불가합니다.",
  PAYMENT_FAILED:   "결제에 실패했습니다. 카드 정보를 확인해주세요.",
  SERVER_ERROR:     "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
};

export class ApiError extends Error {
  constructor(
    public code: string,
    public detail: Record<string, unknown> = {},
  ) {
    super(ERROR_MESSAGES[code] || ERROR_MESSAGES["SERVER_ERROR"]);
    this.name = "ApiError";
  }
}

export async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const code = (err?.detail?.code as string) || "SERVER_ERROR";
    throw new ApiError(code, err?.detail || {});
  }
  return res.json();
}

export async function trialScan(req: TrialScanRequest): Promise<TrialScanResult> {
  return apiCall<TrialScanResult>(`${BACKEND_URL}/api/scan/trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
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

export async function getScore(bizId: string) {
  return apiCall(`${BACKEND_URL}/api/report/score/${bizId}`);
}

export async function getHistory(bizId: string) {
  return apiCall(`${BACKEND_URL}/api/report/history/${bizId}`);
}

export async function getCompetitors(bizId: string) {
  return apiCall(`${BACKEND_URL}/api/report/competitors/${bizId}`);
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
}) {
  return apiCall(`${BACKEND_URL}/api/schema/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    name: string; category: string; region: string;
    address?: string; phone?: string; website_url?: string; keywords?: string[];
  },
  userId: string,
) {
  return apiCall(`${BACKEND_URL}/api/businesses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify(data),
  });
}

export async function getMyBusinesses(userId: string) {
  return apiCall(`${BACKEND_URL}/api/businesses/me`, {
    headers: { "X-User-Id": userId },
  });
}

// ── 경쟁사 ──────────────────────────────────────────────
export async function addCompetitor(
  data: { business_id: string; name: string; address?: string },
  userId: string,
) {
  return apiCall(`${BACKEND_URL}/api/competitors`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify(data),
  });
}

export async function removeCompetitor(competitorId: string, userId: string) {
  return apiCall(`${BACKEND_URL}/api/competitors/${competitorId}`, {
    method: "DELETE",
    headers: { "X-User-Id": userId },
  });
}

export async function listCompetitors(bizId: string) {
  return apiCall(`${BACKEND_URL}/api/competitors/${bizId}`);
}

// ── 리포트 ──────────────────────────────────────────────
export async function getBeforeAfter(bizId: string) {
  return apiCall(`${BACKEND_URL}/api/report/before-after/${bizId}`);
}

export async function getIndustryRanking(category: string, region: string) {
  return apiCall(`${BACKEND_URL}/api/report/ranking/${category}/${region}`);
}

// ── 설정·구독 ─────────────────────────────────────────────
export async function getMySettings(userId: string) {
  return apiCall(`${BACKEND_URL}/api/settings/me`, {
    headers: { "X-User-Id": userId },
  });
}

export async function cancelSubscription(userId: string) {
  return apiCall(`${BACKEND_URL}/api/settings/cancel`, {
    method: "POST",
    headers: { "X-User-Id": userId },
  });
}

export async function updatePhone(phone: string, userId: string) {
  return apiCall(`${BACKEND_URL}/api/settings/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify({ phone }),
  });
}

export async function exportReport(bizId: string, userId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/report/export/${bizId}`, {
    headers: { "X-User-Id": userId },
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

export async function exportPdfReport(bizId: string, userId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/report/pdf/${bizId}`, {
    headers: { "X-User-Id": userId },
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

// ② PDF 리포트 다운로드 (Bearer 토큰 방식)
export async function downloadPdfReport(bizId: string, token: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/report/pdf/${bizId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError("SERVER_ERROR");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aeolab_report_${bizId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ③ ChatGPT 광고 대응 가이드
export async function generateAdDefenseGuide(bizId: string, userId: string): Promise<AdDefenseGuide> {
  return apiCall<AdDefenseGuide>(`${BACKEND_URL}/api/guide/ad-defense/${bizId}`, {
    method: "POST",
    headers: { "X-User-Id": userId },
  });
}

// ④ 창업 시장 분석 리포트
export async function generateStartupReport(req: StartupReportRequest, userId: string): Promise<StartupReport> {
  return apiCall<StartupReport>(`${BACKEND_URL}/api/startup/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
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
export async function getTeamMembers(userId: string): Promise<TeamMember[]> {
  return apiCall<TeamMember[]>(`${BACKEND_URL}/api/teams/members`, {
    headers: { "X-User-Id": userId },
  });
}

// ⑦ 팀원 초대
export async function inviteTeamMember(email: string, role: string, userId: string): Promise<void> {
  return apiCall<void>(`${BACKEND_URL}/api/teams/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify({ email, role }),
  });
}

// ⑧ API 키 목록
export async function getApiKeys(userId: string): Promise<ApiKey[]> {
  return apiCall<ApiKey[]>(`${BACKEND_URL}/api/v1/keys`, {
    headers: { "X-User-Id": userId },
  });
}

// ⑨ API 키 발급
export async function createApiKey(name: string, userId: string): Promise<ApiKey> {
  return apiCall<ApiKey>(`${BACKEND_URL}/api/v1/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify({ name }),
  });
}

// ⑩ API 키 폐기
export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  return apiCall<void>(`${BACKEND_URL}/api/v1/keys/${keyId}`, {
    method: "DELETE",
    headers: { "X-User-Id": userId },
  });
}

// ⑪ 경쟁사 지역 검색 (네이버)
export async function searchCompetitors(query: string, region: string): Promise<CompetitorSearchResult[]> {
  return apiCall<CompetitorSearchResult[]>(
    `${BACKEND_URL}/api/competitors/search?query=${encodeURIComponent(query)}&region=${encodeURIComponent(region)}`,
  );
}

// ⑫ AEOlab 내 동종업계 추천
export async function getSuggestedCompetitors(bizId: string, userId: string): Promise<CompetitorSuggestion[]> {
  return apiCall<CompetitorSuggestion[]>(`${BACKEND_URL}/api/competitors/suggest/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify({ biz_id: bizId }),
  });
}

// ── 공유 카드 ──────────────────────────────────────────────
export async function getSharePageData(bizId: string): Promise<SharePageData> {
  return apiCall<SharePageData>(`${BACKEND_URL}/api/report/share/${bizId}`);
}

// ── 언급 맥락 분석 (Pro+) ────────────────────────────────────
export async function getMentionContext(bizId: string, userId: string): Promise<{ platforms: MentionContext[]; summary: Record<string, unknown> }> {
  return apiCall(`${BACKEND_URL}/api/report/mention-context/${bizId}`, {
    headers: { "X-User-Id": userId },
  });
}

// ── AEO 인증 배지 ──────────────────────────────────────────
export async function getBadge(bizId: string): Promise<BadgeData> {
  return apiCall<BadgeData>(`${BACKEND_URL}/api/report/badge/${bizId}`);
}
