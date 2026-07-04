"use client";

import { RefreshCw } from "lucide-react";

interface DashboardHeroCardProps {
  unifiedScore: number;
  track1Score?: number;
  scoreChangeDiff: number | null;
  topMissingKeywordCount: number;
  lastScannedLabel?: string | null;
  naverInBriefing?: boolean;
  naverCaptchaBlocked?: boolean;
  latestAdOnly?: boolean;
  briefingEligibility?: "active" | "likely" | "inactive";
  isFranchise?: boolean;
  naverAiTabVisible?: boolean | null;
  todayAction?: string | null;
  todayActionLink?: string;
  myRankInList?: number;
  totalCompetitors?: number;
  benchmarkAvg?: number;
  staleRescan?: boolean;
}

function getStage(score: number): { label: string; labelColor: string; bg: string; cardBorder: string } {
  if (score >= 75) return { label: "AI 검색 노출 양호",    labelColor: "text-emerald-700", bg: "bg-emerald-50", cardBorder: "border-emerald-300" };
  if (score >= 55) return { label: "AI 검색 노출 개선 중", labelColor: "text-blue-700",    bg: "bg-blue-50",    cardBorder: "border-blue-300"    };
  if (score >= 30) return { label: "AI 검색 노출 미흡",    labelColor: "text-amber-700",   bg: "bg-amber-50",   cardBorder: "border-amber-300"   };
  return                   { label: "AI 검색 노출 시작 전", labelColor: "text-slate-600",   bg: "bg-slate-50",   cardBorder: "border-slate-300"   };
}

export default function DashboardHeroCard({
  unifiedScore,
  track1Score,
  scoreChangeDiff,
  topMissingKeywordCount,
  lastScannedLabel,
  naverInBriefing,
  naverCaptchaBlocked,
  latestAdOnly,
  briefingEligibility,
  isFranchise,
  naverAiTabVisible,
  todayAction,
  todayActionLink,
  myRankInList,
  totalCompetitors,
  benchmarkAvg,
  staleRescan,
}: DashboardHeroCardProps) {
  const stage = getStage(track1Score ?? unifiedScore);
  const isInactiveOrFranchise = briefingEligibility === "inactive" || !!isFranchise;

  // INACTIVE/프랜차이즈는 네이버 AI 브리핑 비대상 — 부정 점수 레이블("노출 미흡") 대신
  // 네이버 검색·플레이스가 핵심 무기임을 긍정 리드로. 실제 채널 상태는 아래 3채널 그리드가 정직하게 표시.
  const headerView = isInactiveOrFranchise
    ? {
        label: "네이버 검색·플레이스가 핵심 무기",
        labelColor: "text-green-800",
        bg: "bg-green-50",
        cardBorder: "border-green-300",
        sub: isFranchise
          ? "네이버 검색·플레이스·AI탭 집중 전략 — 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다"
          : "네이버 검색·플레이스·AI탭이 핵심 노출 채널 — 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다",
      }
    : { label: stage.label, labelColor: stage.labelColor, bg: stage.bg, cardBorder: stage.cardBorder, sub: null as string | null };

  // 점수 숫자 대신 실측 근거(경쟁사 순위·키워드 보강 수)로 단계 레이블을 뒷받침 — 신뢰도 확보
  const evidenceText = (() => {
    const parts: string[] = [];
    if (myRankInList && totalCompetitors && totalCompetitors > 1) {
      parts.push(`경쟁사 ${totalCompetitors}곳 중 ${myRankInList}위`);
    } else if (benchmarkAvg != null) {
      parts.push(unifiedScore >= benchmarkAvg ? "업종 평균 이상" : "업종 평균 미달");
    }
    parts.push(topMissingKeywordCount === 0 ? "키워드 모두 포함" : `키워드 ${topMissingKeywordCount}개 보강 필요`);
    return parts.join(" · ");
  })();

  const naverSeoCard = naverCaptchaBlocked
    ? { icon: "?", iconClass: "bg-gray-200 text-gray-500", status: "측정 불가",       statusClass: "text-gray-400",    detail: "일시적으로 확인 어려움" }
    : (latestAdOnly ?? false)
    ? { icon: "!", iconClass: "bg-amber-500 text-white",   status: "광고만 노출",      statusClass: "text-amber-700",   detail: "유료광고 결과만 노출" }
    : topMissingKeywordCount === 0
    ? { icon: "✓", iconClass: "bg-emerald-500 text-white", status: "노출 양호",       statusClass: "text-emerald-700", detail: "키워드 모두 포함됨" }
    : { icon: "!", iconClass: "bg-amber-500 text-white",   status: "키워드 보강 필요", statusClass: "text-amber-700",   detail: `${topMissingKeywordCount}개 키워드 추가 필요` };

  const naverAiTabCard = naverCaptchaBlocked
    ? { icon: "?", iconClass: "bg-gray-200 text-gray-500", status: "측정 불가",   statusClass: "text-gray-400",    detail: "일시적으로 확인 어려움" }
    : naverAiTabVisible === true
    ? { icon: "✓", iconClass: "bg-emerald-500 text-white", status: "노출 중",    statusClass: "text-emerald-700", detail: "AI탭 답변 있음" }
    : naverAiTabVisible === false
    ? { icon: "!", iconClass: "bg-amber-500 text-white",   status: "아직 미노출", statusClass: "text-amber-700",   detail: "설정 보강하면 가능" }
    : { icon: "i", iconClass: "bg-blue-100 text-blue-700 font-black", status: "준비 가능",   statusClass: "text-blue-700",    detail: "가이드로 설정하기" };

  const naverBriefingCard = naverCaptchaBlocked
    ? { icon: "?", iconClass: "bg-gray-200 text-gray-500", status: "측정 불가",        statusClass: "text-gray-400",    detail: "일시적으로 확인 어려움" }
    : isInactiveOrFranchise && (naverInBriefing ?? false)
    ? { icon: "✓", iconClass: "bg-emerald-500 text-white", status: "정보형 노출 중",   statusClass: "text-emerald-700", detail: "콘텐츠 기반 AI 브리핑 노출" }
    : isInactiveOrFranchise
    ? { icon: "–", iconClass: "bg-gray-200 text-gray-500", status: "이 업종 해당 없음", statusClass: "text-gray-400",    detail: "네이버 검색·AI탭으로 노출 가능" }
    : briefingEligibility === "likely" && (naverInBriefing ?? false)
    ? { icon: "✓", iconClass: "bg-emerald-500 text-white", status: "정보형 노출 중",   statusClass: "text-emerald-700", detail: "콘텐츠 기반 AI 브리핑 노출" }
    : briefingEligibility === "likely"
    ? { icon: "△", iconClass: "bg-yellow-400 text-white",  status: "확대 예정",        statusClass: "text-yellow-700",  detail: "지금 준비 중" }
    : (naverInBriefing ?? false)
    ? { icon: "✓", iconClass: "bg-emerald-500 text-white", status: "노출 중",          statusClass: "text-emerald-700", detail: "브리핑 노출 확인됨" }
    : { icon: "!", iconClass: "bg-amber-500 text-white",   status: "아직 미노출",       statusClass: "text-amber-700",   detail: "소개글 보강하면 가능" };

  // INACTIVE/프랜차이즈는 AI 브리핑 비대상 → 경쟁순위 카드 대체 표시.
  // 단, 정보형 AI 브리핑에 실측 노출(naverInBriefing=True) 시 브리핑 카드로 교체 — 사용자에게 긍정 신호.
  const rankCard =
    myRankInList && totalCompetitors && totalCompetitors > 1
      ? myRankInList === 1
        ? { icon: "1", iconClass: "bg-emerald-500 text-white", status: "동네 1위",  statusClass: "text-emerald-700", detail: `경쟁 ${totalCompetitors}곳 중 1위` }
        : { icon: String(myRankInList), iconClass: "bg-amber-500 text-white", status: `${myRankInList}위`, statusClass: "text-amber-700", detail: `경쟁 ${totalCompetitors}곳 중 ${myRankInList}위` }
      : { icon: "–", iconClass: "bg-gray-200 text-gray-500", status: "비교 준비 중", statusClass: "text-gray-400", detail: "경쟁사 등록 후 표시" };

  const ANCHOR_MAP: Record<string, string> = {
    "naver-seo":      "#naver-seo-anchor",
    "naver-aitab":    "#naver-aitab-anchor",
    "naver-briefing": "#naver-briefing-anchor",
    "naver-rank":     "#section-detail",
  };
  // INACTIVE+in_briefing=True: 정보형 노출 확인 → 브리핑 카드 표시 (경쟁순위 대신)
  const naverChannels = isInactiveOrFranchise && !(naverInBriefing ?? false)
    ? [
        { id: "naver-seo",   platform: "네이버 검색", ...naverSeoCard },
        { id: "naver-aitab", platform: "네이버 AI탭", ...naverAiTabCard },
        { id: "naver-rank",  platform: "경쟁 순위",   ...rankCard },
      ]
    : [
        { id: "naver-seo",      platform: "네이버 검색", ...naverSeoCard },
        { id: "naver-aitab",    platform: "네이버 AI탭", ...naverAiTabCard },
        { id: "naver-briefing", platform: "AI 브리핑",   ...naverBriefingCard },
      ];

  return (
    <div className={`bg-white rounded-xl border-2 shadow-md overflow-hidden mb-5 ${headerView.cardBorder}`}>

      {/* ── 종합 상태 헤더 — 단계 메시지(INACTIVE는 네이버 SEO 긍정 리드) ── */}
      <div className={`px-5 pt-4 pb-4 border-b border-gray-100 ${headerView.bg}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-xl font-black leading-tight break-keep ${headerView.labelColor}`}>{headerView.label}</p>
            {headerView.sub && (
              <p className="text-sm font-semibold text-green-700 mt-1 break-keep">{headerView.sub}</p>
            )}
            {evidenceText && (
              <p className="text-sm font-bold text-gray-800 mt-1 break-keep">{evidenceText}</p>
            )}
            {(lastScannedLabel || staleRescan) && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                {lastScannedLabel && <span>{lastScannedLabel}</span>}
                {staleRescan && (
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 font-semibold px-1.5 py-0.5 rounded">
                    <RefreshCw className="w-3 h-3 shrink-0" /> 재스캔 권장
                  </span>
                )}
              </p>
            )}
          </div>
          {scoreChangeDiff !== null && scoreChangeDiff !== 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              scoreChangeDiff > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
            }`}>
              {scoreChangeDiff > 0 ? "↑ 개선됨" : "↓ 하락"}
            </span>
          )}
        </div>
      </div>

      {/* ── 네이버 AI 채널 (소상공인 핵심) ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden="true" />
          <p className="text-sm font-bold text-gray-700">{isInactiveOrFranchise ? "네이버 노출 현황" : "네이버 AI 현황"}</p>
          <span className="ml-1 text-xs text-gray-400 hidden sm:inline">소상공인 핵심 채널</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {naverChannels.map((card) => (
            <a
              key={card.id}
              href={ANCHOR_MAP[card.id] ?? "#section-naver"}
              className="bg-white rounded-xl border border-gray-200 shadow-sm px-2 py-3 flex flex-col items-center gap-1.5 text-center hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${card.iconClass}`}>
                {card.icon}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-500 leading-tight break-keep">{card.platform}</p>
                <p className={`text-sm font-bold mt-0.5 leading-tight ${card.statusClass}`}>{card.status}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight break-keep group-hover:text-blue-400 transition-colors">{card.detail}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ── 오늘 할 일 앵커 CTA — 동일 텍스트 중복 방지: 실제 내용은 아래 ActionZone에만 표시 ── */}
      {todayAction && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <a
            href={todayActionLink ?? "#section-action"}
            className="flex items-center justify-between gap-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl px-4 py-3 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-rose-500 text-lg shrink-0">✅</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-rose-600 leading-tight">오늘의 개선 미션</p>
                <p className="text-sm font-semibold text-gray-800 leading-snug break-keep mt-0.5 line-clamp-2">{todayAction}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-rose-500 group-hover:text-rose-700 shrink-0 whitespace-nowrap">확인하기 ↓</span>
          </a>
        </div>
      )}
    </div>
  );
}
