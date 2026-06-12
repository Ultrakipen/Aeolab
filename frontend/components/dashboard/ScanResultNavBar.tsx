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

/**
 * 얇은 목차 점프바 — 상태(✓/✗/노출 양호 등)는 위 Hero 카드가 유일 소스.
 * 여기서는 신호등 점(녹/황/회) + 라벨 + 점프만 제공해 정보 중복을 없애고
 * "어디를 누르면 무슨 개선 방법이 나오는지" 목차 역할만 한다.
 */
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

  // 신호등 색만 추출 — green(양호) / amber(보강 가능) / gray(해당없음·미측정)
  const GREEN = "bg-emerald-500";
  const AMBER = "bg-amber-400";
  const GRAY = "bg-gray-300";

  const searchDot = naverCaptchaBlocked
    ? GRAY
    : latestAdOnly
    ? AMBER
    : topMissingKeywordCount === 0
    ? GREEN
    : AMBER;

  const aiTabDot =
    naverAiTabVisible === true ? GREEN : naverAiTabVisible === false ? AMBER : GRAY;

  const briefingDot = naverCaptchaBlocked
    ? GRAY
    : isInactive
    ? GRAY
    : eligibility === "likely"
    ? AMBER
    : naverInBriefing
    ? GREEN
    : AMBER;

  const rankDot =
    totalCompetitors <= 1 ? GRAY : myRankInList === 1 ? GREEN : AMBER;

  const items = [
    { id: "nav-search", scrollTarget: "section-naver", dot: searchDot, label: "일반검색", highlight: searchDot === AMBER },
    { id: "nav-aitab", scrollTarget: "section-naver", dot: aiTabDot, label: "AI탭", highlight: naverAiTabVisible === false },
    { id: "nav-briefing", scrollTarget: "section-naver", dot: briefingDot, label: "AI브리핑", highlight: !isInactive && eligibility === "active" && !naverInBriefing && !naverCaptchaBlocked },
    { id: "nav-rank", scrollTarget: "section-detail", dot: rankDot, label: "경쟁현황", highlight: false },
  ];

  return (
    <div>
      <p className="text-xs text-gray-400 mb-1.5 pl-0.5">아래 항목을 누르면 상세 개선 방법으로 이동합니다</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.scrollTarget)}
            className={`group inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-left transition-all cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 ${
              item.highlight ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-200"
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.dot}`} aria-hidden="true" />
            <span className="text-sm font-semibold text-gray-700">{item.label}</span>
            <span className="text-xs text-blue-400 font-semibold group-hover:text-blue-600 transition-colors">↓</span>
          </button>
        ))}
      </div>
    </div>
  );
}
