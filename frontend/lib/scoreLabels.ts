/**
 * 점수·채널 상태 레이블 단일 소스 (demo·trial 공용)
 *
 * ⚠️ 이 파일은 components/dashboard/DashboardHeroCard.tsx 의
 *    getStage(25–30행) + 채널카드 분기(80–125행)를 **값 복제**한 것이다.
 *    대시보드를 import하지 않고 동일 어휘·색을 재현해 무료(demo)·비로그인(trial)
 *    화면을 대시보드 결과 포맷과 정합시키기 위함.
 *    → DashboardHeroCard 의 레이블/색이 바뀌면 이 파일도 같이 갱신해야 한다(드리프트 주의).
 *
 * 점수 숫자는 노출하지 않는다(텍스트 레이블 전용 원칙). 여기 함수들은 모두 텍스트만 반환.
 */

import type { BriefingEligibility } from "./userGroup";

// ── 성장 단계 이름 단일 소스 (2026-10-28) ─────────────────────────────────────
// backend/services/stage_names.py STAGE_NAME 과 같아야 한다(backend/tests/test_stage_names.py 가 검사).
// 점수가 재는 것(AI 검색 준비도)에 이름을 맞춘다 — "지역 1등"처럼 순위를 주장하거나 "생존기"처럼 낮게 단정하는 이름은 쓰지 않는다.
export const STAGE_NAME = {
  survival: "시작 전",
  stability: "보강 단계",
  growth: "개선 중",
  dominance: "양호",
} as const;
export type StageCode = keyof typeof STAGE_NAME;
export const READINESS_PREFIX = "AI 검색 준비도 · ";

/** 점수(track1 기준, 75/55/30) → 단계 코드 */
export function stageCodeForScore(score: number): StageCode {
  if (score >= 75) return "dominance";
  if (score >= 55) return "growth";
  if (score >= 30) return "stability";
  return "survival";
}

export function stageNameForScore(score: number): string {
  return STAGE_NAME[stageCodeForScore(score)];
}

// DB·AI 텍스트에 이미 저장된 옛 라벨 → 코드 (새 화면에 쓰지 말 것)
const LEGACY_STAGE_LABELS: Record<string, StageCode> = {
  "시작 단계": "survival", "성장 중": "stability", "빠른 성장": "growth", "지역 1등": "dominance",
  "생존기": "survival", "안정기": "stability", "성장기": "growth", "지배기": "dominance", "선도기": "dominance",
  "성장 준비 중": "stability", "성장 진행 중": "growth", "안정 궤도": "dominance",
};

/** 화면에 보일 단계 이름 — 코드가 있으면 코드 기준, 없으면 옛 라벨을 새 이름으로, 그 외는 그대로 */
export function normalizeStageLabel(label?: string | null, code?: string | null): string {
  if (code && code in STAGE_NAME) return STAGE_NAME[code as StageCode];
  if (!label) return "";
  if ((Object.values(STAGE_NAME) as string[]).includes(label)) return label;
  const legacy = LEGACY_STAGE_LABELS[label];
  return legacy ? STAGE_NAME[legacy] : label;
}

// ── 종합 성장단계 레이블 (DashboardHeroCard getStage + INACTIVE headerView 복제) ──
export interface StageView {
  label: string;
  labelColor: string;
  bg: string;
  cardBorder: string;
  sub: string | null;
}

export function getStageView(
  score: number,
  opts: { inactive?: boolean; isFranchise?: boolean } = {},
): StageView {
  const { inactive = false, isFranchise = false } = opts;

  // INACTIVE/프랜차이즈 — 부정 점수 레이블 대신 네이버 검색·플레이스 긍정 리드
  if (inactive || isFranchise) {
    return {
      label: "네이버 검색·플레이스가 핵심 무기",
      labelColor: "text-green-800",
      bg: "bg-green-50",
      cardBorder: "border-green-300",
      sub: isFranchise
        ? "프랜차이즈는 '플레이스형' AI 브리핑 비대상 — 정보형 AI 브리핑·AI탭·검색·ChatGPT·Gemini는 가능"
        : "'플레이스형' AI 브리핑 비대상 업종 — 블로그·콘텐츠로 '정보형 AI 브리핑' 노출 가능, 검색·플레이스·AI탭도 함께 개선합니다",
    };
  }

  // DashboardHeroCard.getStage()와 동일 문구 — 점수가 재는 것(AI 검색 준비도)에 이름을 맞추고 "미흡" 등급 표현은 쓰지 않는다
  if (score >= 75) return { label: `${READINESS_PREFIX}${STAGE_NAME.dominance}`,      labelColor: "text-emerald-700", bg: "bg-emerald-50", cardBorder: "border-emerald-300", sub: null };
  if (score >= 55) return { label: `${READINESS_PREFIX}${STAGE_NAME.growth}`,   labelColor: "text-blue-700",    bg: "bg-blue-50",    cardBorder: "border-blue-300",    sub: null };
  if (score >= 30) return { label: `${READINESS_PREFIX}${STAGE_NAME.stability}`, labelColor: "text-amber-700",   bg: "bg-amber-50",   cardBorder: "border-amber-300",   sub: null };
  return                   { label: `${READINESS_PREFIX}${STAGE_NAME.survival}`,   labelColor: "text-slate-600",   bg: "bg-slate-50",   cardBorder: "border-slate-300",   sub: null };
}

/** 컴팩트 점수 텍스트 레이블 — 숫자 대신 표시 (표·카드 등 좁은 공간용) */
export function getScoreTextLabel(score: number): string {
  if (score >= 75) return "양호";
  if (score >= 55) return "보통";
  if (score >= 30) return "주의 필요";
  return "시작 전";
}

// ── 채널 상태 타일 (DashboardHeroCard 채널카드 복제) ───────────────────────────
export interface ChannelTile {
  id: string;
  platform: string;
  icon: string;
  iconClass: string;
  status: string;
  statusClass: string;
  detail: string;
}

/** 상태 프리셋 — 아이콘/색 단일 소스 (DashboardHeroCard 색과 동일) */
const PRESET = {
  good:    { icon: "✓", iconClass: "bg-emerald-700 text-white", statusClass: "text-emerald-700" },
  warn:    { icon: "!", iconClass: "bg-amber-700 text-white",   statusClass: "text-amber-700" },
  expand:  { icon: "△", iconClass: "bg-yellow-400 text-yellow-900",  statusClass: "text-yellow-700" },
  pending: { icon: "–", iconClass: "bg-gray-200 text-gray-600", statusClass: "text-gray-600" },
  unknown: { icon: "?", iconClass: "bg-gray-200 text-gray-600", statusClass: "text-gray-600" },
} as const;

type PresetKey = keyof typeof PRESET;

/** 범용 타일 빌더 — 프리셋 색/아이콘 + 임의 platform/status/detail (demo 커스텀 케이스용) */
export function makeTile(
  id: string,
  platform: string,
  preset: PresetKey,
  status: string,
  detail: string,
  iconOverride?: string,
): ChannelTile {
  const p = PRESET[preset];
  return { id, platform, icon: iconOverride ?? p.icon, iconClass: p.iconClass, status, statusClass: p.statusClass, detail };
}

/** 네이버 검색 타일 — keyword coverage 기반 (DashboardHeroCard naverSeoCard) */
export function naverSeoTile(args: {
  captchaBlocked?: boolean;
  adOnly?: boolean;
  missingKeywordCount: number;
}): ChannelTile {
  const { captchaBlocked, adOnly, missingKeywordCount } = args;
  if (captchaBlocked) return makeTile("naver-seo", "네이버 검색", "unknown", "확인 전", "아직 결과 없음");
  if (adOnly)         return makeTile("naver-seo", "네이버 검색", "warn", "광고만 노출", "유료광고 결과만 노출");
  if (missingKeywordCount === 0) return makeTile("naver-seo", "네이버 검색", "good", "노출 양호", "경쟁가게보다 키워드 풍부");
  return makeTile("naver-seo", "네이버 검색", "warn", "키워드 보강 필요", `${missingKeywordCount}개 없음 · 경쟁가게가 먼저 추천`);
}

/** 네이버 AI탭 타일 (DashboardHeroCard naverAiTabCard) */
export function aiTabTile(visible: boolean | null | undefined): ChannelTile {
  if (visible === true)  return makeTile("naver-aitab", "네이버 AI탭", "good", "노출 중", "AI탭 답변 있음");
  if (visible === false) return makeTile("naver-aitab", "네이버 AI탭", "warn", "미노출", "이번 측정 결과");
  return makeTile("naver-aitab", "네이버 AI탭", "pending", "준비 가능", "가이드로 설정하기");
}

/** AI 브리핑 타일 (DashboardHeroCard naverBriefingCard) */
export function briefingTile(args: {
  captchaBlocked?: boolean;
  eligibility: BriefingEligibility;
  isFranchise?: boolean;
  inBriefing?: boolean | null;
}): ChannelTile {
  const { captchaBlocked, eligibility, isFranchise, inBriefing } = args;
  if (captchaBlocked) return makeTile("naver-briefing", "AI 브리핑", "unknown", "확인 전", "아직 결과 없음");
  if (eligibility === "inactive" || isFranchise) {
    if (inBriefing)
      return makeTile("naver-briefing", "AI 브리핑", "good", "정보형 노출 중", "블로그·콘텐츠 기반 정보형 AI 브리핑에 노출 중");
    return makeTile("naver-briefing", "AI 브리핑", "pending", "플레이스형 해당 없음", "블로그·콘텐츠로 정보형 AI 브리핑·검색·AI탭 노출 가능");
  }
  if (eligibility === "likely") {
    if (inBriefing)
      return makeTile("naver-briefing", "AI 브리핑", "good", "정보형 노출 중", "블로그·콘텐츠 기반 정보형 AI 브리핑에 노출 중");
    return makeTile("naver-briefing", "AI 브리핑", "expand", "확대 예정", "지금 준비 중");
  }
  if (inBriefing)
    return makeTile("naver-briefing", "AI 브리핑", "good", "노출 중", "검색 첫화면에 내 가게 추천 중");
  return makeTile("naver-briefing", "AI 브리핑", "warn", "미노출", "이번 측정 결과");
}

/** 경쟁 순위 타일 — INACTIVE 그룹에서 AI 브리핑 대신 노출 (DashboardHeroCard rankCard) */
export function rankTile(args: { myRank?: number | null; totalCompetitors?: number | null }): ChannelTile {
  const { myRank, totalCompetitors } = args;
  if (myRank && totalCompetitors && totalCompetitors > 1) {
    if (myRank === 1) return makeTile("naver-rank", "경쟁 순위", "good", "동네 1위", `경쟁 ${totalCompetitors}곳 중 1위`, "1");
    return makeTile("naver-rank", "경쟁 순위", "warn", `${myRank}위`, `경쟁 ${totalCompetitors}곳 중 ${myRank}위`, String(myRank));
  }
  return makeTile("naver-rank", "경쟁 순위", "pending", "비교 준비 중", "경쟁사 등록 후 표시");
}
