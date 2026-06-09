"use client";

interface Props {
  eligibility: "active" | "likely" | "inactive";
  naverInBriefing: boolean;
  naverCaptchaBlocked: boolean;
  myRankInList: number;
  totalCompetitors: number;
  topMissingKeywordCount: number;
  todayAction?: string | null;
  latestAdOnly?: boolean;
  naverAiTabVisible?: boolean | null;
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
  latestAdOnly = false,
  naverAiTabVisible,
  isFranchise,
}: Props) {
  const isInactive = eligibility === "inactive" || isFranchise;

  /* ── 일반 검색 타일 ──────────────────────────── */
  const searchTile = naverCaptchaBlocked
    ? { icon: "?", label: "측정 불가", sub: "재스캔 필요", color: "text-gray-400 bg-gray-100", border: "border-gray-200" }
    : latestAdOnly
    ? { icon: "광고", label: "광고만 노출", sub: "자연 노출 없음", color: "text-orange-600 bg-orange-100", border: "border-orange-200" }
    : topMissingKeywordCount === 0
    ? { icon: "✓", label: "검색 노출 양호", sub: "키워드 최적화됨", color: "text-emerald-700 bg-emerald-100", border: "border-emerald-200" }
    : { icon: "!", label: "검색에 잘 안 보임", sub: `키워드 ${topMissingKeywordCount}개 추가 필요`, color: "text-amber-700 bg-amber-100", border: "border-amber-200" };

  /* ── AI탭 타일 ──────────────────────────────── */
  const aiTabTile = naverAiTabVisible === true
    ? { icon: "✓", label: "AI탭 노출 중", sub: "AI탭 답변 있음", color: "text-emerald-700 bg-emerald-100", border: "border-emerald-200" }
    : naverAiTabVisible === false
    ? { icon: "✗", label: "AI탭 미노출", sub: "설정 개선 필요", color: "text-orange-600 bg-orange-100", border: "border-orange-200" }
    : { icon: "–", label: "AI탭 미측정", sub: "스캔 후 자동 확인", color: "text-gray-400 bg-gray-100", border: "border-gray-200" };

  /* ── AI 브리핑 타일 ─────────────────────────── */
  const briefingTile = naverCaptchaBlocked
    ? { icon: "?", label: "측정 불가", sub: "재스캔 필요", color: "text-gray-400 bg-gray-100", border: "border-gray-200" }
    : isInactive
    ? { icon: "–", label: "AI 브리핑 대상 아님", sub: "ChatGPT·AI탭으로 노출 가능", color: "text-gray-500 bg-gray-100", border: "border-gray-200" }
    : eligibility === "likely"
    ? { icon: "△", label: "확대 예정", sub: "지금 준비 중", color: "text-yellow-700 bg-yellow-100", border: "border-yellow-200" }
    : naverInBriefing
    ? { icon: "✓", label: "AI 브리핑 노출", sub: "5채널 최적화", color: "text-emerald-700 bg-emerald-100", border: "border-emerald-200" }
    : { icon: "✗", label: "AI 브리핑 미노출", sub: "소개글 보강 필요", color: "text-red-600 bg-red-100", border: "border-red-200" };

  /* ── 경쟁 현황 타일 ─────────────────────────── */
  const rankStatus =
    totalCompetitors <= 1
      ? { icon: "-", label: "경쟁사 없음", sub: "등록 후 비교", color: "text-gray-400 bg-gray-100", border: "border-gray-200" }
      : myRankInList === 1
      ? { icon: "1위", label: `${totalCompetitors}곳 중 1위`, sub: "선두 유지 중", color: "text-emerald-700 bg-emerald-100", border: "border-emerald-200" }
      : { icon: `${myRankInList}위`, label: `${totalCompetitors}곳 중 ${myRankInList}위`, sub: "개선 여지 있음", color: "text-amber-700 bg-amber-100", border: "border-amber-200" };

  const items = [
    {
      id: "nav-search",
      scrollTarget: "section-naver",
      iconBg: searchTile.color,
      border: searchTile.border,
      icon: searchTile.icon,
      label: "일반검색 노출",
      sub: searchTile.label,
      statusSub: searchTile.sub,
      highlight: !naverCaptchaBlocked && topMissingKeywordCount > 0 && !latestAdOnly,
    },
    {
      id: "nav-aitab",
      scrollTarget: "section-naver",
      iconBg: aiTabTile.color,
      border: aiTabTile.border,
      icon: aiTabTile.icon,
      label: "AI탭 노출",
      sub: aiTabTile.label,
      statusSub: aiTabTile.sub,
      highlight: naverAiTabVisible === false,
    },
    {
      id: "nav-briefing",
      scrollTarget: "section-naver",
      iconBg: briefingTile.color,
      border: briefingTile.border,
      icon: briefingTile.icon,
      label: "AI브리핑 노출",
      sub: briefingTile.label,
      statusSub: briefingTile.sub,
      highlight: eligibility === "active" && !isFranchise && !naverInBriefing && !naverCaptchaBlocked,
    },
    {
      id: "nav-rank",
      scrollTarget: "section-detail",
      iconBg: rankStatus.color,
      border: rankStatus.border,
      icon: rankStatus.icon,
      label: "경쟁 현황",
      sub: rankStatus.label,
      statusSub: rankStatus.sub,
      highlight: false,
    },
  ];

  return (
    <div>
      {/* 네이버 3채널 + 경쟁현황 4타일 */}
      <p className="text-xs text-gray-400 mb-1.5 pl-0.5">각 항목을 누르면 상세 내용으로 이동합니다</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.scrollTarget)}
            className={`group relative flex items-center gap-2.5 p-3 rounded-xl border bg-white text-left transition-all cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md ${
              item.highlight ? "border-amber-300 ring-1 ring-amber-200" : item.border
            }`}
          >
            <span
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${item.iconBg}`}
            >
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500 leading-tight line-clamp-1">{item.label}</p>
              <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-1 mt-0.5">{item.sub}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.statusSub}</p>
            </div>
            <span className="absolute bottom-1.5 right-2 text-xs text-blue-400 font-semibold group-hover:text-blue-600 transition-colors">
              상세 ↓
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
