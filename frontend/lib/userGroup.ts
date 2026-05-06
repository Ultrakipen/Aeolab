/**
 * 사용자 그룹 분류 헬퍼 — 단일 소스
 *
 * ⚠️ 변경 시 backend/services/score_engine.py 의 아래 상수와 반드시 동기화:
 *   BRIEFING_ACTIVE_CATEGORIES, BRIEFING_LIKELY_CATEGORIES
 *
 * 그룹 판정 규칙:
 *   - 프랜차이즈 → "franchise" (별도 표시)
 *   - restaurant·cafe·bakery·bar·accommodation → "ACTIVE"
 *   - beauty·nail·pet·fitness·yoga·pharmacy → "LIKELY"  (beauty: 확대 예정, 미확정)
 *   - 그 외 → "INACTIVE"
 */

export type UserGroup = "ACTIVE" | "LIKELY" | "INACTIVE" | "franchise";

// ⚠️ backend/services/score_engine.py BRIEFING_ACTIVE_CATEGORIES와 동기화 필수
// beauty(미용): 2025.08 네이버 발표에서 "확대 예정" — 확정 아님 → LIKELY 유지
const ACTIVE_CATEGORIES = new Set([
  "restaurant", "cafe", "bakery", "bar", "accommodation",
]);

// ⚠️ backend/services/score_engine.py BRIEFING_LIKELY_CATEGORIES와 동기화 필수
// beauty: 확대 예정(미확정). nail·pet·fitness·yoga·pharmacy: 공식 발표 없음
const LIKELY_CATEGORIES = new Set([
  "beauty", "nail", "pet", "fitness", "yoga", "pharmacy",
]);

export function getUserGroup(category: string, isFranchise: boolean): UserGroup {
  if (isFranchise) return "franchise";
  if (ACTIVE_CATEGORIES.has(category)) return "ACTIVE";
  if (LIKELY_CATEGORIES.has(category)) return "LIKELY";
  return "INACTIVE";
}

// ── AI 브리핑 게이팅 단일 소스 (v4.1) ─────────────────────────────────────────
// ⚠️ backend/services/score_engine.py BRIEFING_ACTIVE_CATEGORIES와 동기화 필수
// ⚠️ 변경 시 RegisterBusinessForm.tsx, dashboard/page.tsx 양쪽 확인 필수
export const BRIEFING_ACTIVE_CATEGORIES: ReadonlyArray<string> = [
  "restaurant", "cafe", "bakery", "bar", "accommodation",
];

export type BriefingEligibility = "active" | "likely" | "inactive";

export function getBriefingEligibility(
  category: string | undefined,
  isFranchise: boolean = false,
): BriefingEligibility {
  if (isFranchise) return "inactive";
  const group = getUserGroup(category ?? "", isFranchise);
  if (group === "ACTIVE") return "active";
  if (group === "LIKELY") return "likely";
  return "inactive";
}

export interface GroupMessage {
  headline: string;
  sub: string;
  /** 뱃지 텍스트 (짧게) */
  badge: string;
  /** 뱃지 색상 클래스 (Tailwind) */
  badgeColor: string;
}

export const GROUP_MESSAGES: Record<UserGroup, GroupMessage> = {
  ACTIVE: {
    headline: "네이버 AI 브리핑·검색·지도·블로그 + ChatGPT 통합 노출 관리",
    sub: "음식점·카페·베이커리·바·숙박 사장님 전용 매뉴얼 포함",
    badge: "AI 브리핑 대상",
    badgeColor: "bg-green-100 text-green-800 border border-green-200",
  },
  LIKELY: {
    headline: "네이버 검색·지도·블로그 + ChatGPT·Gemini AI 노출 최적화",
    sub: "현재 네이버 AI 브리핑 공식 대상은 아닙니다. 네이버 지도 상위 노출과 ChatGPT·Gemini 검색 노출을 집중 개선합니다.",
    badge: "로컬 AI 노출 최적화",
    badgeColor: "bg-blue-100 text-blue-800 border border-blue-200",
  },
  INACTIVE: {
    headline: "ChatGPT·Gemini·Google AI 검색 노출 집중 관리",
    sub: "현재 네이버 AI 브리핑 대상 업종이 아닙니다. ChatGPT·Google AI에서 먼저 찾히도록 최적화합니다. 네이버 지도·블로그 관리도 함께 제공됩니다.",
    badge: "글로벌 AI 채널 집중",
    badgeColor: "bg-amber-100 text-amber-800 border border-amber-200",
  },
  franchise: {
    headline: "네이버 검색·블로그 + ChatGPT·Google AI 노출 관리",
    sub: "프랜차이즈 가맹점은 네이버 AI 브리핑 대상에서 제외됩니다(본사 정책). 네이버 일반 검색·지도·ChatGPT·Google AI 노출은 직접 관리할 수 있습니다.",
    badge: "프랜차이즈 맞춤",
    badgeColor: "bg-purple-100 text-purple-800 border border-purple-200",
  },
};
