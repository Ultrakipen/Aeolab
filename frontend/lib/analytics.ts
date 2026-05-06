/**
 * GA4 이벤트 트래킹 헬퍼
 *
 * - window.gtag 안전 호출 (정의되지 않은 환경에서도 에러 없음)
 * - SSR 환경에서도 안전 (window 가드)
 * - GA4_ID가 없으면 gtag 자체가 미정의 → 자동 no-op
 */

type GtagFn = (
  command: "event" | "config" | "set" | "consent" | "js",
  ...args: unknown[]
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

/**
 * 임의의 GA4 이벤트 발송
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params ?? {});
    }
  } catch {
    // GA4 미설치 환경 또는 차단 시 무시
  }
}

/**
 * CTA 클릭 — location: 'hero' | 'final' | 'header' 등 위치 식별
 * extra: 헤드라인 인덱스 등 추가 컨텍스트
 */
export function trackCTA(location: string, label: string, extra?: Record<string, unknown>): void {
  trackEvent("cta_click", { location, label, ...(extra ?? {}) });
}

/**
 * 무료 진단 시작 — industry: 업종 키 (restaurant, cafe 등) 또는 'unknown'
 */
export function trackTrialStart(industry?: string): void {
  trackEvent("trial_start", { industry: industry ?? "unknown" });
}

/**
 * 플랜 추천 라디오 선택 → 추천 플랜 표시
 */
export function trackPlanRecommend(plan: string): void {
  trackEvent("plan_recommend_select", { plan });
}

/**
 * Trial → Claim → Signup → Attach 전환 깔때기
 * - gate_shown   : ClaimGate 노출
 * - submitted    : 이메일 제출 (POST /api/scan/trial-claim 호출 직전)
 * - success      : trial-claim 200 OK
 * - attached     : 가입 콜백에서 trial-attach 200 OK (trial → user 연결 완료)
 */
export function trackClaimFunnel(
  stage: "gate_shown" | "submitted" | "success" | "attached",
  meta?: Record<string, unknown>,
): void {
  trackEvent(`claim_${stage}`, meta);
}

/**
 * 가입 7일 액션 카드 단계
 * - shown       : Day7ActionCard 첫 렌더 (응답 수신 후)
 * - completed   : "완료 표시" 클릭 → action_log POST 성공
 * - skipped     : "건너뛰기" 클릭
 */
export function trackOnboardingAction(
  stage: "shown" | "completed" | "skipped",
  meta?: Record<string, unknown>,
): void {
  trackEvent(`onboarding_action_${stage}`, meta);
}

// ── 모바일 전환 깔때기 (v1.1) ────────────────────────────────────────
//
// 신규 이벤트:
// - mobile_floating_cta_shown  : 모바일 하단 고정 CTA 첫 노출 (1회/세션/page)
// - mobile_floating_cta_click  : 모바일 하단 고정 CTA 탭
// - kakao_share_click          : 결과 페이지 카톡 공유 버튼 클릭
// - referral_visit             : 외부 유입 (?ref=...) 1회/세션

const SESSION_FLAG_PREFIX = "aeolab_ga_flag_";

/**
 * sessionStorage 기반 1회성 flag — SSR 안전.
 * 이미 발화된 경우 false, 새로 설정하면 true 반환.
 */
function claimSessionFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const fullKey = SESSION_FLAG_PREFIX + key;
    if (window.sessionStorage.getItem(fullKey)) return false;
    window.sessionStorage.setItem(fullKey, "1");
    return true;
  } catch {
    // sessionStorage 접근 실패 (프라이빗 브라우징 등) → 매번 발화 허용
    return true;
  }
}

/**
 * 모바일 floating CTA 노출 — page 단위로 세션당 1회만 발화.
 */
export function trackMobileFloatingCtaShown(page: string): void {
  if (!claimSessionFlag(`mobile_cta_shown_${page}`)) return;
  trackEvent("mobile_floating_cta_shown", { page });
}

/**
 * 모바일 floating CTA 클릭 — 매 클릭 발화.
 */
export function trackMobileFloatingCtaClick(page: string): void {
  trackEvent("mobile_floating_cta_click", { page });
}

/**
 * 카톡 공유 버튼 클릭 — 매 클릭 발화.
 */
export function trackKakaoShareClick(
  payload: { trial_id?: string; score?: number } = {},
): void {
  trackEvent("kakao_share_click", payload);
}

/**
 * 외부 유입 소스 기록 — ?ref=kakao_share 등 — 세션당 source별 1회만 발화.
 */
export function trackReferral(source: string): void {
  if (!source) return;
  if (!claimSessionFlag(`referral_${source}`)) return;
  trackEvent("referral_visit", { source });
}

// v3.1 키워드 측정 인프라 이벤트 (service_unification_v1.0.md §11)
export function trackKeywordInput(count: number): void {
  trackEvent("keyword_input", { count });
}

export function trackKeywordRecommendClick(source: "ai" | "fallback"): void {
  trackEvent("keyword_recommend_click", { source });
}

export function trackKeywordMeasureStart(bizId: string): void {
  trackEvent("keyword_measure_start", { biz_id: bizId });
}

export function trackKeywordMeasureComplete(
  avg_rank: number | null,
  count: number,
  has_error: boolean,
): void {
  trackEvent("keyword_measure_complete", {
    avg_rank: avg_rank ?? -1,
    count,
    has_error,
  });
}

// ── 핵심 전환 퍼널 이벤트 (P1-A) ─────────────────────────────────────

/**
 * 무료 체험 결과 화면 첫 진입 — 세션당 1회만 발화.
 */
export function trackTrialComplete(payload: {
  trial_id?: string;
  category?: string;
  score?: number;
}): void {
  if (!claimSessionFlag("trial_complete")) return;
  trackEvent("trial_complete", payload);
}

/**
 * 회원가입 이메일 발송 성공 직후 — 세션당 1회만 발화.
 */
export function trackSignupComplete(payload: {
  method?: string;
  trial_id?: string;
}): void {
  if (!claimSessionFlag("signup_complete")) return;
  trackEvent("signup_complete", payload);
}

/**
 * 결제 성공 + 구독 active 확인 직후 — 세션당 1회만 발화.
 */
export function trackSubscriptionActive(payload: {
  plan: string;
  amount: number;
  billing_cycle: string;
}): void {
  if (!claimSessionFlag("subscription_active")) return;
  trackEvent("subscription_active", payload);
}

/**
 * 랜딩 details 토글 펼치기/닫기 — 매 클릭 발화 (사용자가 추가 콘텐츠를 얼마나 깊이 보는지 측정).
 */
export function trackDetailsToggle(section: string, opened: boolean): void {
  trackEvent("details_toggle", { section, opened });
}

/**
 * 가격 앵커 섹션 노출 — 세션당 1회만 발화 (가격 인지 도달률 측정).
 */
export function trackPricingAnchorView(): void {
  if (!claimSessionFlag("pricing_anchor_view")) return;
  trackEvent("pricing_anchor_view");
}
