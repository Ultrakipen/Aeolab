"use client";

interface Props {
  eligibility: "active" | "likely" | "inactive";
  naverInBriefing: boolean;
  naverCaptchaBlocked: boolean;
  myRankInList: number;
  totalCompetitors: number;
  topMissingKeywordCount: number;
  todayAction: string | null;
  unifiedScore: number;
  isFranchise?: boolean;
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function ScanResultNavBar({
  eligibility,
  naverInBriefing,
  naverCaptchaBlocked,
  myRankInList,
  totalCompetitors,
  topMissingKeywordCount,
  todayAction,
  unifiedScore,
  isFranchise,
}: Props) {
  const isInactive = eligibility === "inactive" || isFranchise;

  /* ── 네이버 AI 현황 ─────────────────────────── */
  const naverStatus = naverCaptchaBlocked
    ? { icon: "?", label: "측정 불가", sub: "봇 차단", color: "text-gray-400 bg-gray-100", border: "border-gray-200" }
    : isInactive
    ? { icon: "↑", label: "검색 노출", sub: "SEO 최적화", color: "text-blue-700 bg-blue-100", border: "border-blue-200" }
    : eligibility === "likely"
    ? { icon: "△", label: "AI탭 준비 중", sub: "브리핑 확대 예정", color: "text-yellow-700 bg-yellow-100", border: "border-yellow-200" }
    : naverInBriefing
    ? { icon: "✓", label: "AI 브리핑 노출", sub: "5채널 최적화", color: "text-emerald-700 bg-emerald-100", border: "border-emerald-200" }
    : { icon: "✗", label: "AI 미노출", sub: "개선 필요", color: "text-red-600 bg-red-100", border: "border-red-200" };

  /* ── 경쟁 현황 ─────────────────────────────── */
  const rankStatus =
    totalCompetitors <= 1
      ? { icon: "-", label: "경쟁사 없음", sub: "등록 후 비교", color: "text-gray-400 bg-gray-100", border: "border-gray-200" }
      : myRankInList === 1
      ? { icon: "1위", label: `${totalCompetitors}곳 중 1위`, sub: "선두 유지 중", color: "text-emerald-700 bg-emerald-100", border: "border-emerald-200" }
      : { icon: `${myRankInList}위`, label: `${totalCompetitors}곳 중 ${myRankInList}위`, sub: "개선 여지 있음", color: "text-amber-700 bg-amber-100", border: "border-amber-200" };

  /* ── 키워드 현황 ──────────────────────────── */
  const kwStatus =
    topMissingKeywordCount === 0
      ? { icon: "✓", label: "키워드 양호", sub: "AI 노출 기반 완비", color: "text-emerald-700 bg-emerald-100", border: "border-emerald-200" }
      : { icon: String(topMissingKeywordCount), label: `보강 필요 ${topMissingKeywordCount}개`, sub: "소개글에 추가", color: "text-orange-600 bg-orange-100", border: "border-orange-200" };

  /* ── 점수 현황 ────────────────────────────── */
  const scoreColor =
    unifiedScore >= 75 ? "text-blue-700 bg-blue-100 border-blue-200"
    : unifiedScore >= 55 ? "text-blue-700 bg-blue-100 border-blue-200"
    : unifiedScore >= 30 ? "text-slate-600 bg-slate-100 border-slate-200"
    : "text-slate-600 bg-slate-100 border-slate-200";

  const items = [
    {
      id: "nav-naver",
      scrollTarget: isInactive ? "section-insight" : "section-insight",
      iconBg: naverStatus.color,
      border: naverStatus.border,
      icon: naverStatus.icon,
      label: naverStatus.label,
      sub: naverStatus.sub,
      highlight: isInactive,
    },
    {
      id: "nav-score",
      scrollTarget: "section-score",
      iconBg: scoreColor.split(" ").slice(0, 3).join(" "),
      border: scoreColor.split(" ")[2],
      icon: String(Math.round(unifiedScore)),
      label: "AI 노출 지수",
      sub: "종합 점수",
      highlight: false,
    },
    {
      id: "nav-rank",
      scrollTarget: "section-detail",
      iconBg: rankStatus.color,
      border: rankStatus.border,
      icon: rankStatus.icon,
      label: rankStatus.label,
      sub: rankStatus.sub,
      highlight: false,
    },
    {
      id: "nav-keyword",
      scrollTarget: "section-keyword",
      iconBg: kwStatus.color,
      border: kwStatus.border,
      icon: kwStatus.icon,
      label: kwStatus.label,
      sub: kwStatus.sub,
      highlight: topMissingKeywordCount > 0,
    },
  ];

  return (
    <div className="space-y-2">
      {/* 요약 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.scrollTarget)}
            className={`flex items-center gap-2.5 p-3 rounded-xl border bg-white text-left hover:shadow-sm transition-all ${
              item.highlight ? "border-blue-300 ring-1 ring-blue-200" : item.border
            }`}
          >
            <span
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${item.iconBg}`}
            >
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-1">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* 오늘 할 일 바 */}
      {todayAction && (
        <button
          onClick={() => scrollTo("section-action")}
          className="w-full flex items-center gap-3 px-4 py-2.5 bg-blue-600 rounded-xl text-left hover:bg-blue-700 transition-colors"
        >
          <span className="text-white text-sm font-black shrink-0">→</span>
          <p className="text-sm font-semibold text-white leading-snug break-keep line-clamp-1">
            <span className="text-blue-200 mr-1">지금 바로:</span>
            {todayAction}
          </p>
          <span className="ml-auto text-blue-200 text-xs shrink-0">이동 ↓</span>
        </button>
      )}
    </div>
  );
}
