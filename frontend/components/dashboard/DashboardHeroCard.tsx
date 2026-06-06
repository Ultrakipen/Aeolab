"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface DashboardHeroCardProps {
  businessName: string;
  unifiedScore: number;
  track1Score?: number;   // GrowthStage 계산 기준 (CLAUDE.md: track1_score 기준)
  scoreChangeDiff: number | null;
  naverInBriefing: boolean;
  naverCaptchaBlocked: boolean;
  myRankInList: number;
  totalCompetitors: number;
  topMissingKeywordCount: number;
  topMissingKeyword?: string | null;
  todayAction: string | null;
  todayActionLink: string;
  estimatedGain: number | null;
  recentActionLabel: string | null;
  recentActionScoreGain: number | null;
  eligibility?: "active" | "likely" | "inactive";
  lastScannedLabel?: string | null;
}

const ACTION_TYPE_LABEL: Record<string, string> = {
  faq_registered: "소개글 Q&A 추가",
  review_requested: "리뷰 요청",
  keyword_added: "키워드 추가",
  post_published: "포스트 등록",
  intro_updated: "소개글 수정",
  schema_updated: "스마트플레이스 수정",
  website_updated: "웹사이트 개선",
};

function getStage(score: number): {
  label: string;
  tagBg: string;
  bar: string;
  bg: string;
  message: string;
} {
  if (score >= 75) return {
    label: "안정 궤도",
    tagBg: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    bg: "bg-blue-50 border-blue-100",
    message: "경쟁 가게 대비 AI 검색 노출이 잘 되어 있습니다. 이 상태를 꾸준히 유지하세요.",
  };
  if (score >= 55) return {
    label: "성장 진행 중",
    tagBg: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    bg: "bg-blue-50 border-blue-100",
    message: "기반이 갖춰져 있습니다. 아래 개선 항목 2~3가지 보완으로 노출을 더 늘릴 수 있습니다.",
  };
  if (score >= 30) return {
    label: "성장 준비 중",
    tagBg: "bg-slate-100 text-slate-600",
    bar: "bg-slate-400",
    bg: "bg-slate-50 border-slate-200",
    message: "핵심 항목 몇 가지를 보완하면 AI 검색 노출이 빠르게 늘어납니다.",
  };
  return {
    label: "시작 단계",
    tagBg: "bg-slate-100 text-slate-600",
    bar: "bg-slate-400",
    bg: "bg-slate-50 border-slate-200",
    message: "AI 검색 최적화가 아직 시작 전입니다. 지금 시작하면 경쟁 가게보다 먼저 자리 잡을 수 있습니다.",
  };
}

export default function DashboardHeroCard({
  businessName,
  unifiedScore,
  track1Score,
  scoreChangeDiff,
  naverInBriefing,
  naverCaptchaBlocked,
  myRankInList,
  totalCompetitors,
  topMissingKeywordCount,
  topMissingKeyword = null,
  todayAction,
  todayActionLink,
  estimatedGain,
  recentActionLabel,
  recentActionScoreGain,
  eligibility = "active",
  lastScannedLabel,
}: DashboardHeroCardProps) {
  const showActionResult =
    recentActionLabel !== null &&
    recentActionScoreGain !== null &&
    recentActionScoreGain > 0;

  const actionLabel =
    ACTION_TYPE_LABEL[recentActionLabel ?? ""] ?? recentActionLabel;

  const stage = getStage(track1Score ?? unifiedScore);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-5">
      {/* 상단: 성장 단계 + 점수 바 */}
      <div className={`px-5 pt-5 pb-4 border-b border-gray-100 ${stage.bg}`}>
        <p className="text-sm font-medium text-gray-500 mb-2 truncate">{businessName}</p>

        {/* 단계 태그 + 점수 변화 */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${stage.tagBg}`}>
            {stage.label}
          </span>
          <span className="text-sm text-gray-400">현재 AI 노출 단계</span>
          {scoreChangeDiff !== null && scoreChangeDiff !== 0 && (
            <span
              className={`text-sm font-semibold ml-auto shrink-0 px-2 py-0.5 rounded-full ${
                scoreChangeDiff > 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {scoreChangeDiff > 0 ? "↑ 개선됨" : "↓ 하락"}
              <span className="text-sm font-normal ml-1 opacity-75">지난 스캔 대비</span>
            </span>
          )}
        </div>

        {/* 단계 메시지 */}
        <p className="text-sm text-gray-600 leading-relaxed mb-3 break-keep">{stage.message}</p>

        {/* 점수 바 */}
        <div className="mb-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${stage.bar} transition-all duration-700`}
              style={{ width: `${Math.min(unifiedScore, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-sm text-gray-400">시작</span>
            <span className="text-sm text-gray-500 font-medium">현재 위치</span>
            <span className="text-sm text-gray-400">최적화</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <Link
            href="/score-guide"
            className="text-sm text-blue-500 hover:text-blue-700 hover:underline inline-flex items-center gap-0.5"
          >
            지수 계산 방식 보기 →
          </Link>
          {lastScannedLabel && (
            <span className="text-sm text-gray-400">마지막 측정: {lastScannedLabel}</span>
          )}
        </div>
      </div>

      {/* 3개 핵심 지표 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 border-b border-gray-100">
        {/* 지표1: AI 노출 */}
        <div className="px-5 py-3 flex items-center gap-2">
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${
              naverCaptchaBlocked
                ? "bg-gray-100 text-gray-400"
                : eligibility === "inactive"
                ? "bg-gray-100 text-gray-500"
                : eligibility === "likely"
                ? "bg-yellow-100 text-yellow-600"
                : naverInBriefing
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            {naverCaptchaBlocked
              ? "?"
              : eligibility === "inactive"
              ? "−"
              : eligibility === "likely"
              ? "△"
              : naverInBriefing
              ? "✓"
              : "✗"}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
              {naverCaptchaBlocked
                ? "AI 노출 확인 불가"
                : eligibility === "inactive"
                ? "네이버 검색 노출·AI탭 + ChatGPT·Gemini·Google AI 관리"
                : eligibility === "likely"
                ? "네이버 AI탭 가능 · ChatGPT·Gemini·Google AI — 4채널"
                : naverInBriefing
                ? "AI 브리핑 노출 중 — 5채널 모두 가능"
                : "AI 미노출 — 5채널 최적화 필요"}
            </p>
            <p className="text-sm text-gray-500">
              {eligibility === "inactive"
                ? "네이버 검색 노출·AI탭 우선 + 글로벌 AI (4채널)"
                : eligibility === "likely"
                ? "네이버 AI탭 + 글로벌 AI 3채널"
                : "네이버 AI 브리핑·AI탭 + 글로벌 AI 3채널"}
            </p>
          </div>
        </div>

        {/* 지표2: 경쟁 순위 */}
        <div className="px-5 py-3 flex items-center gap-2">
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
              totalCompetitors <= 1
                ? "bg-gray-100 text-gray-400"
                : myRankInList === 1
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {totalCompetitors <= 1 ? "-" : `${myRankInList}위`}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
              {totalCompetitors <= 1
                ? "경쟁사 없음"
                : `경쟁 ${myRankInList}위 / ${totalCompetitors}곳`}
            </p>
            <p className="text-sm text-gray-500">주변 경쟁 현황</p>
          </div>
        </div>

        {/* 지표3: 부족 키워드 */}
        <div className="px-5 py-3 flex items-center gap-2">
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
              topMissingKeywordCount === 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-orange-100 text-orange-600"
            }`}
          >
            {topMissingKeywordCount === 0 ? "✓" : topMissingKeywordCount}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {topMissingKeywordCount === 0
                ? "키워드 양호"
                : `AI 노출 보강 필요 ${topMissingKeywordCount}개`}
            </p>
            <p className="text-sm text-gray-500">소개글·Q&A 강조 부족 키워드</p>
            {topMissingKeywordCount > 0 && topMissingKeyword && (
              <p className="text-sm text-orange-600 font-medium mt-0.5">
                보강 권장: &apos;{topMissingKeyword}&apos; 등
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 오늘 할 일 */}
      {todayAction && (
        <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-100 bg-blue-50/60">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700 leading-snug break-keep">
              <span className="text-blue-600 font-bold mr-1">오늘 할 일:</span>
              {todayAction}
              {estimatedGain !== null && estimatedGain > 0 && (
                <span className="ml-1.5 text-emerald-600 font-bold">
                  (+{estimatedGain}점 예상)
                </span>
              )}
            </p>
          </div>
          <Link
            href={todayActionLink}
            className="shrink-0 flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
          >
            바로가기
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 행동→결과 (조건부) */}
      {showActionResult && (
        <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2">
          <span className="text-emerald-600 text-base font-black shrink-0">✓</span>
          <p className="text-sm text-emerald-800 font-medium break-keep">
            지난주 <span className="font-bold">{actionLabel}</span> 후 점수 ↑ 개선됨
          </p>
        </div>
      )}
    </div>
  );
}
