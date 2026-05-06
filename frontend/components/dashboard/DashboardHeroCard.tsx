"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface DashboardHeroCardProps {
  businessName: string;
  unifiedScore: number;
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

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-50 border-emerald-200";
  if (score >= 40) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export default function DashboardHeroCard({
  businessName,
  unifiedScore,
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
}: DashboardHeroCardProps) {
  const showActionResult =
    recentActionLabel !== null &&
    recentActionScoreGain !== null &&
    recentActionScoreGain > 0;

  const actionLabel =
    ACTION_TYPE_LABEL[recentActionLabel ?? ""] ?? recentActionLabel;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5">
      {/* 상단: 점수 + 변화 */}
      <div className={`px-5 pt-5 pb-4 border-b border-gray-100 flex items-center gap-4 ${scoreBg(unifiedScore)}`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 mb-0.5 truncate">{businessName}</p>
          <div className="flex items-end gap-2 flex-wrap">
            <span className={`text-4xl md:text-5xl font-black leading-none ${scoreColor(unifiedScore)}`}>
              {unifiedScore}점
            </span>
            {scoreChangeDiff !== null && (
              <span
                className={`text-base font-bold mb-0.5 ${
                  scoreChangeDiff > 0
                    ? "text-emerald-600"
                    : scoreChangeDiff < 0
                    ? "text-red-500"
                    : "text-gray-400"
                }`}
              >
                {scoreChangeDiff > 0
                  ? `↑ +${scoreChangeDiff}점`
                  : scoreChangeDiff < 0
                  ? `↓ ${scoreChangeDiff}점`
                  : "변화 없음"}
                <span className="text-sm font-normal text-gray-400 ml-1">지난 스캔 대비</span>
              </span>
            )}
          </div>
          <Link
            href="/score-guide"
            className="text-sm text-blue-500 hover:text-blue-700 hover:underline mt-1 inline-flex items-center gap-0.5"
          >
            점수 계산 방식 보기 →
          </Link>
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
                : naverInBriefing
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            {naverCaptchaBlocked ? "?" : naverInBriefing ? "✓" : "✗"}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {naverCaptchaBlocked
                ? "AI 노출 확인 불가"
                : naverInBriefing
                ? "AI 노출 중"
                : "AI 미노출"}
            </p>
            <p className="text-sm text-gray-500">네이버 AI 브리핑</p>
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
            <p className="text-sm font-semibold text-gray-800 leading-tight">
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
                : `AI 키워드 ${topMissingKeywordCount}개 미확보`}
            </p>
            <p className="text-sm text-gray-500">업종별 조건검색 기준</p>
            {topMissingKeywordCount > 0 && topMissingKeyword && (
              <p className="text-sm text-orange-600 font-medium mt-0.5">
                예: &apos;{topMissingKeyword}&apos; 등
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
            지난주 <span className="font-bold">{actionLabel}</span> 후 점수{" "}
            <span className="font-black text-emerald-700">+{recentActionScoreGain}점</span> 상승
          </p>
        </div>
      )}
    </div>
  );
}
