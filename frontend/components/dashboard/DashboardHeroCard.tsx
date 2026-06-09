"use client";

interface DashboardHeroCardProps {
  businessName: string;
  unifiedScore: number;
  track1Score?: number;
  scoreChangeDiff: number | null;
  myRankInList: number;
  totalCompetitors: number;
  topMissingKeywordCount: number;
  topMissingKeyword?: string | null;
  todayAction: string | null;
  todayActionLink: string;
  recentActionLabel: string | null;
  recentActionScoreGain: number | null;
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
  bg: string;
  message: string;
} {
  if (score >= 75) return {
    label: "AI 검색 노출 양호",
    tagBg: "bg-emerald-100 text-emerald-700",
    bg: "bg-emerald-50 border-emerald-100",
    message: "네이버·ChatGPT 검색에서 경쟁 가게보다 잘 노출되고 있습니다. 꾸준히 유지하세요.",
  };
  if (score >= 55) return {
    label: "AI 검색 노출 개선 중",
    tagBg: "bg-blue-100 text-blue-700",
    bg: "bg-blue-50 border-blue-100",
    message: "기본 설정은 갖춰져 있습니다. 아래 개선 항목 2~3가지만 보완하면 노출이 더 늘어납니다.",
  };
  if (score >= 30) return {
    label: "AI 검색 노출 미흡",
    tagBg: "bg-amber-100 text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    message: "지금 AI 검색에 제대로 노출되지 않고 있습니다. 아래 '오늘 할 일'부터 시작하세요.",
  };
  return {
    label: "AI 검색 노출 시작 전",
    tagBg: "bg-slate-100 text-slate-600",
    bg: "bg-slate-50 border-slate-200",
    message: "아직 AI 검색에 노출되지 않고 있습니다. 지금 시작하면 경쟁 가게보다 먼저 자리 잡을 수 있습니다.",
  };
}

export default function DashboardHeroCard({
  businessName,
  unifiedScore,
  track1Score,
  scoreChangeDiff,
  myRankInList,
  totalCompetitors,
  topMissingKeywordCount,
  topMissingKeyword = null,
  todayAction,
  todayActionLink,
  recentActionLabel,
  recentActionScoreGain,
  lastScannedLabel,
}: DashboardHeroCardProps) {
  const showActionResult =
    recentActionLabel !== null &&
    recentActionScoreGain !== null &&
    recentActionScoreGain > 0;

  const actionLabel =
    ACTION_TYPE_LABEL[recentActionLabel ?? ""] ?? recentActionLabel;

  const stage = getStage(track1Score ?? unifiedScore);

  /* ── 경쟁사 순위 ── */
  const rankStatus = (() => {
    if (totalCompetitors <= 1) return { icon: "−", bg: "bg-gray-100 text-gray-400", label: "경쟁사 미등록", sub: "경쟁사 추가 후 비교" };
    if (myRankInList === 1) return { icon: "1위", bg: "bg-emerald-100 text-emerald-700", label: `${totalCompetitors}곳 중 1위`, sub: "경쟁사 대비 선두" };
    return { icon: `${myRankInList}위`, bg: "bg-amber-100 text-amber-700", label: `${totalCompetitors}곳 중 ${myRankInList}위`, sub: "개선 여지 있음" };
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-5">

      {/* ── 상단: 종합 결론 ── */}
      <div className={`px-5 pt-5 pb-4 border-b border-gray-100 ${stage.bg}`}>
        {/* 사업장명 + 스캔 날짜 */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-gray-700 truncate">{businessName}</p>
          {lastScannedLabel && (
            <p className="text-xs text-gray-400 shrink-0">{lastScannedLabel}</p>
          )}
        </div>

        {/* 종합 진단: stage.label */}
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="text-3xl font-black text-gray-900 leading-tight">{stage.label}</span>
          {scoreChangeDiff !== null && scoreChangeDiff !== 0 && (
            <span
              className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                scoreChangeDiff > 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {scoreChangeDiff > 0 ? "↑ 지난 스캔보다 개선됨" : "↓ 지난 스캔보다 하락"}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 leading-relaxed break-keep">{stage.message}</p>
      </div>

      {/* ── 지금 해야 할 가장 중요한 한 가지 (todayAction 있을 때) ── */}
      {todayAction && (
        <div className="border-b border-gray-100 px-4 py-3 bg-amber-50">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-amber-500 text-base font-bold shrink-0">💡</span>
            <span className="text-sm font-bold text-amber-800">지금 해야 할 가장 중요한 한 가지</span>
          </div>
          <p className="text-sm text-amber-900 leading-relaxed break-keep pl-6">{todayAction}</p>
          {todayActionLink && (
            <a
              href={todayActionLink}
              className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 mt-1.5 pl-6"
            >
              가이드 보기 <span className="text-base">→</span>
            </a>
          )}
        </div>
      )}

      {/* ── 보조 정보: 키워드 보강 + 경쟁사 순위 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1px] bg-gray-100 border-b border-gray-100">

        {/* 키워드 보강 */}
        <div className="bg-white px-4 py-3 flex items-center gap-2">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
            topMissingKeywordCount === 0
              ? "bg-emerald-100 text-emerald-700"
              : "bg-orange-100 text-orange-600"
          }`}>
            {topMissingKeywordCount === 0 ? "✓" : "부족"}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight break-keep">
              {topMissingKeywordCount === 0 ? "키워드 양호" : `키워드 ${topMissingKeywordCount}개 부족`}
            </p>
            {topMissingKeywordCount > 0 && topMissingKeyword ? (
              <p className="text-xs text-orange-600 font-medium break-keep">
                &apos;{topMissingKeyword}&apos; 먼저 추가
              </p>
            ) : (
              <p className="text-xs text-gray-500 break-keep">AI 노출 기반 완비</p>
            )}
          </div>
        </div>

        {/* 경쟁사 순위 */}
        <div className="bg-white px-4 py-3 flex items-center gap-2">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${rankStatus.bg}`}>
            {rankStatus.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight break-keep">{rankStatus.label}</p>
            <p className="text-xs text-gray-500 break-keep">{rankStatus.sub}</p>
          </div>
        </div>
      </div>

      {/* 행동→결과 (조건부) */}
      {showActionResult && (
        <div className="px-5 py-3 bg-emerald-50 flex items-center gap-2">
          <span className="text-emerald-600 text-base font-black shrink-0">✓</span>
          <p className="text-sm text-emerald-800 font-medium break-keep">
            지난주 <span className="font-bold">{actionLabel}</span> 후 개선됨
          </p>
        </div>
      )}
    </div>
  );
}
