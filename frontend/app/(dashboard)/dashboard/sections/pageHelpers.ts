import type { MissingItem } from "@/types/diagnosis";
import type { WebsiteCheckResult } from "@/types";

// ── 스캔 일일 한도 ──────────────────────────────────────────────
export const SCAN_DAILY_LIMITS: Record<string, number> = {
  free: 0, basic: 2, pro: 5, startup: 3, biz: 999,
};

// ── 점수 항목별 개선 액션 ─────────────────────────────────────
export const BREAKDOWN_ACTIONS: Record<string, { action: string; link: string }> = {
  exposure_freq:            { action: "스마트플레이스 대표 키워드를 추가·정리하세요",              link: "/schema" },
  review_quality:           { action: "단골 손님 1명에게 네이버 리뷰를 요청하세요",              link: "/guide" },
  schema_score:             { action: "스마트플레이스 소개글·영업시간·메뉴를 업데이트하세요",      link: "/schema" },
  online_mentions:          { action: "블로그 후기 1건을 요청하거나 직접 작성하세요",             link: "/schema" },
  info_completeness:        { action: "전화번호·영업시간·주소 정보를 확인하고 채워주세요",        link: "/schema" },
  content_freshness:        { action: "최근 공지나 메뉴 변경 사항을 스마트플레이스에 등록하세요",  link: "/schema" },
  keyword_gap_score:        { action: "부족한 키워드를 소개글·톡톡 채팅방 메뉴에 추가하세요",    link: "/guide" },
  smart_place_completeness: { action: "스마트플레이스 소개글에 자주 묻는 질문을 추가하세요", link: "/guide" },
  naver_exposure_confirmed: { action: "스마트플레이스 소개글 본문·키워드를 함께 보강하세요",       link: "/guide" },
};

// ── 다음 스캔 레이블 ──────────────────────────────────────────
export function nextScanLabel(plan: string | null | undefined): { label: string; desc: string } {
  const p = plan ?? "free";
  if (p === "biz")     return { label: "매일 새벽 자동 스캔", desc: "내일 새벽 2시에 전체 AI 채널 분석합니다" };
  if (p === "startup") return { label: "주 1회 자동 스캔 (월요일)", desc: "월요일 새벽 2시에 전체 AI 채널 분석합니다" };
  if (p === "pro")     return { label: "주 3회 자동 스캔 (월·수·금)", desc: "월·수·금 새벽 2시에 전체 AI 채널 분석합니다" };
  if (p === "basic")   return { label: "주 2회 자동 스캔 (월·목)", desc: "월·목 새벽 2시에 전체 AI 채널 분석합니다" };
  return { label: "자동 스캔 없음", desc: "유료 플랜으로 업그레이드하면 자동 스캔을 이용할 수 있습니다" };
}

// ── 마지막 스캔 시각 표시 ─────────────────────────────────────
export function calcLastScannedLabel(scannedAt: string | null | undefined): string | null {
  if (!scannedAt) return null;
  const scannedDate = new Date(scannedAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - scannedDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const hh = scannedDate.getHours().toString().padStart(2, "0");
    const mm = scannedDate.getMinutes().toString().padStart(2, "0");
    return `오늘 ${hh}:${mm}`;
  }
  return `${diffDays}일 전`;
}

// ── 지역명 줄이기 ─────────────────────────────────────────────
export function calcDisplayCity(region: string | null | undefined): string {
  if (!region) return "";
  return region.trim().split(" ")[0].replace(/(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$/, "");
}

// ── 오늘 할 일 텍스트 ─────────────────────────────────────────
export function calcTodayAction(
  guideTopAction: string | null,
  scoreBreakdown: Record<string, number> | null,
  hasIntro: boolean,
  hasFaq: boolean,
): string | null {
  if (guideTopAction) return guideTopAction;
  if (!scoreBreakdown) return null;
  const completedKeys = new Set<string>();
  if (hasIntro) completedKeys.add("schema_score");
  if (hasFaq) completedKeys.add("smart_place_completeness");
  const sorted = Object.entries(scoreBreakdown)
    .filter(([key]) => BREAKDOWN_ACTIONS[key] && !completedKeys.has(key))
    .sort(([, a], [, b]) => Number(a) - Number(b));
  const lowest = sorted[0];
  return lowest ? (BREAKDOWN_ACTIONS[lowest[0]]?.action ?? null) : null;
}

// ── 플랫폼 결과 맵 ──────────────────────────────────────────
export type PlatformResult = {
  mentioned: boolean;
  exposure_freq?: number;
  exposure_rate?: number;
  sample_size?: number;
  in_briefing?: boolean;
  in_ai_overview?: boolean;
  error?: string;
  // naver_ai_tab 전용 — null: 아직 실측 이력 없음(신규 사업장 등), boolean: 실측값(최근 이력 carry-forward 포함)
  _naver_ai_tab_visible?: boolean | null;
  excerpt?: string | null;
  // Gemini/ChatGPT 다중 쿼리 목록 (단일 쿼리 플랫폼은 없거나 1개)
  queries_used?: string[];
};

export function buildAllPlatformResults(
  latestScan: Record<string, unknown> | null | undefined,
): Record<string, PlatformResult> {
  if (!latestScan) return {};
  const aiTabVisible = Object.prototype.hasOwnProperty.call(latestScan, "naver_ai_tab_visible")
    ? (latestScan.naver_ai_tab_visible as boolean | null)
    : null;
  return {
    ...(latestScan.gemini_result  ? { gemini:  latestScan.gemini_result as PlatformResult  } : {}),
    ...(latestScan.chatgpt_result ? { chatgpt: latestScan.chatgpt_result as PlatformResult } : {}),
    ...(latestScan.naver_result   ? { naver:   latestScan.naver_result as PlatformResult   } : {}),
    naver_ai_tab: {
      mentioned: aiTabVisible === true,
      _naver_ai_tab_visible: aiTabVisible,
      excerpt: latestScan.naver_ai_tab_excerpt as string | null ?? null,
    },
    ...(latestScan.google_result  ? { google:  latestScan.google_result as PlatformResult  } : {}),
  };
}

// ── 독립 웹사이트 판별 ───────────────────────────────────────
// 네이버·카카오·구글 플레이스 등 플랫폼 URL은 독립 웹사이트 아님
const _PLATFORM_DOMAINS = [
  'naver.com', 'kakao.com', 'daum.net', 'google.com',
  'instagram.com', 'facebook.com', 'youtube.com',
  'tistory.com', 'blog.me',
];

export function isIndependentWebsite(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(
      url.startsWith('http') ? url : 'https://' + url,
    ).hostname.toLowerCase();
    return !_PLATFORM_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

// ── 스마트플레이스 상태 ──────────────────────────────────────
export interface SmartPlaceStatus {
  hasFaq: boolean;
  hasIntro: boolean;
  hasRecentPost: boolean | null;  // null = 차단으로 측정 불가
  hasWebsite: boolean;
  recentPostConfirmedAt?: string | null;
}

export function buildSmartPlaceStatus(
  scan: Record<string, unknown> | null | undefined,
  biz: {
    has_faq?: boolean | null;
    has_intro?: boolean | null;
    has_recent_post?: boolean | null;
    website_url?: string | null;
    checklist_overrides?: Record<string, unknown> | null;
  },
): SmartPlaceStatus {
  const spAuto = scan?.smart_place_completeness_result as Record<string, unknown> | null;
  const recentPostMeasured = spAuto?.recent_post_measured;

  // 자동 크롤링 결과 (IP 차단 시 recent_post_measured=false)
  let hasRecentPost: boolean | null =
    recentPostMeasured === false
      ? null
      : (!!(spAuto?.has_recent_post) || !!(biz.has_recent_post));

  // 수동 확인 대체 (90일 만료 체크)
  if (!hasRecentPost) {
    const overrides = biz.checklist_overrides ?? {};
    if (overrides['__recent_post_sufficient']) {
      const confirmedAt = overrides['__recent_post_confirmed_at'];
      if (confirmedAt && typeof confirmedAt === 'string') {
        const confirmed = new Date(confirmedAt);
        const diffDays = (Date.now() - confirmed.getTime()) / (1000 * 60 * 60 * 24);
        hasRecentPost = diffDays <= 90;
      } else {
        hasRecentPost = true; // 날짜 없으면 일단 true (구버전 호환)
      }
    }
  }

  const overrides = biz.checklist_overrides ?? {};
  const recentPostConfirmedAt = (overrides['__recent_post_confirmed_at'] as string | null | undefined) ?? null;

  return {
    hasFaq:       !!(spAuto?.has_faq)   || !!(biz.has_faq),
    hasIntro:     !!(spAuto?.has_intro) || !!(biz.has_intro),
    hasRecentPost,
    hasWebsite:   isIndependentWebsite(biz.website_url),
    recentPostConfirmedAt,
  };
}

// ── 웹사이트 체크 결과 캐스팅 ──────────────────────────────
export function castWebsiteCheckResult(
  raw: unknown,
): WebsiteCheckResult | null {
  return (raw ?? null) as WebsiteCheckResult | null;
}

// ── 미싱 아이템 추출 ─────────────────────────────────────────
// score_breakdown(JSONB)에 "missing" 필드로 저장됨 (scan_results에 별도 컬럼 없음).
// scan.missing 폴백은 과거 호환용 — 실제로 채워진 적은 없음.
export function extractMissingItems(scan: Record<string, unknown> | null | undefined): MissingItem[] {
  const breakdown = scan?.score_breakdown as Record<string, unknown> | null | undefined;
  const list = breakdown?.missing ?? scan?.missing;
  return Array.isArray(list) ? (list as MissingItem[]) : [];
}
