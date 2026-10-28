"use client";

import { RefreshCw, CheckCircle2 } from "lucide-react";
import { fmtMonthDay, type LastGoodNaver } from "@/lib/naverMeasure";
import type { KeywordRankState } from "@/lib/keywordExposure";
import { READINESS_NOTE } from "@/lib/scoreLabels";

interface DashboardHeroCardProps {
  unifiedScore: number;
  track1Score?: number;
  scoreChangeDiff: number | null;
  /**
   * @deprecated 상태 판단에 쓰지 않는다(2026-10-27). 업종 표준 키워드를 사장님 입력 텍스트와 비교한 값이라
   * 리뷰가 많은 가게도 거의 전부 "누락"으로 나오고, 정기 스캔은 이 값을 계산하지 않아 0("모두 포함")으로 보였다.
   */
  topMissingKeywordCount?: number;
  lastScannedLabel?: string | null;
  /** 이번 스캔 시각(ISO) — 칸에 측정일을 표시하는 데 쓴다 */
  scannedAt?: string | null;
  naverInBriefing?: boolean;
  /** 네이버 AI 브리핑·AI탭 측정이 안 된 경우(캡차·접속 실패·대기열 초과 등) — lib/naverMeasure.isNaverUnmeasured */
  naverCaptchaBlocked?: boolean;
  /** 이번 측정이 실패했을 때 보여줄 직전 성공 측정(30일 이내) — lib/naverMeasure.pickLastGoodNaver */
  lastGoodNaver?: LastGoodNaver | null;
  /** 순위 측정 상태(첫 화면 노출 확인/미확인/측정 전) — lib/keywordExposure.getKeywordRankState */
  keywordRank?: KeywordRankState | null;
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
  // 이 점수는 네이버 인기가 아니라 "AI 검색에 얼마나 준비돼 있는가"를 잰다 — 이름을 그에 맞추고,
  // 30~55 구간은 등급("미흡")이 아니라 할 일의 방향("보강 단계")으로 표현한다. lib/scoreLabels.ts getStageView와 동일하게 유지.
  if (score >= 75) return { label: "AI 검색 준비도 · 양호",      labelColor: "text-emerald-700", bg: "bg-emerald-50", cardBorder: "border-emerald-300" };
  if (score >= 55) return { label: "AI 검색 준비도 · 개선 중",   labelColor: "text-blue-700",    bg: "bg-blue-50",    cardBorder: "border-blue-300"    };
  if (score >= 30) return { label: "AI 검색 준비도 · 보강 단계", labelColor: "text-amber-700",   bg: "bg-amber-50",   cardBorder: "border-amber-300"   };
  return                   { label: "AI 검색 준비도 · 시작 전",   labelColor: "text-slate-600",   bg: "bg-slate-50",   cardBorder: "border-slate-300"   };
}

export default function DashboardHeroCard({
  unifiedScore,
  track1Score,
  scoreChangeDiff,
  lastScannedLabel,
  scannedAt,
  naverInBriefing: naverInBriefingProp,
  naverCaptchaBlocked,
  lastGoodNaver,
  keywordRank,
  latestAdOnly,
  briefingEligibility,
  isFranchise,
  naverAiTabVisible: naverAiTabVisibleProp,
  todayAction,
  todayActionLink,
  myRankInList,
  totalCompetitors,
  benchmarkAvg,
  staleRescan,
}: DashboardHeroCardProps) {
  const stage = getStage(track1Score ?? unifiedScore);
  const isInactiveOrFranchise = briefingEligibility === "inactive" || !!isFranchise;

  // 이번 네이버 측정이 실패했어도 30일 이내 성공한 직전 결과가 있으면 날짜와 함께 그것을 보여준다.
  // 직전 결과도 없을 때만 "확인 전"(unmeasured) — 실패를 미노출처럼 보이게 하지 않는다.
  const useLast = !!naverCaptchaBlocked && !!lastGoodNaver;
  const unmeasured = !!naverCaptchaBlocked && !lastGoodNaver;
  const naverInBriefing = useLast ? lastGoodNaver!.inBriefing : (naverInBriefingProp ?? false);
  const naverAiTabVisible = useLast ? lastGoodNaver!.aiTabVisible : naverAiTabVisibleProp;
  // 측정일은 항상 보여준다. 스캔이 7일 이상 지났으면 "노출 중" 같은 긍정 문구도 날짜 표기로 바꿔 오래된 결과를 현재처럼 보이지 않게 한다.
  const scanMd = fmtMonthDay(scannedAt);
  const scanAgeDays = scannedAt ? Math.floor((Date.now() - new Date(scannedAt).getTime()) / 86_400_000) : 0;
  const oldScan = scanAgeDays >= 7;
  const measuredDetail = useLast
    ? `${fmtMonthDay(lastGoodNaver!.measuredAt) ?? "직전"} 확인`
    : scanMd ? `${scanMd} 측정` : "측정 결과";
  const positiveDetail = (text: string) => (useLast || oldScan ? measuredDetail : text);

  // INACTIVE/프랜차이즈는 네이버 AI 브리핑 비대상 — 부정 점수 레이블("노출 미흡") 대신
  // 네이버 검색·플레이스가 핵심 무기임을 긍정 리드로. 실제 채널 상태는 아래 3채널 그리드가 정직하게 표시.
  // 단, in_briefing 실측이 true면 "가능합니다"(가정형) 대신 "노출 중입니다"(확정형)로 — 실측과 문구가
  // 어긋나 보이지 않도록 통일(2026-07-14, 그리드는 이미 "정보형 노출 중"으로 실측 분기하고 있었음).
  const infoBriefingExposed = isInactiveOrFranchise && naverInBriefing;
  const headerView = isInactiveOrFranchise
    ? {
        label: "네이버 검색·플레이스가 핵심 무기",
        labelColor: "text-green-800",
        bg: "bg-green-50",
        cardBorder: "border-green-300",
        sub: infoBriefingExposed
          ? "네이버 검색·플레이스·AI탭이 주요 노출 경로 — 블로그·콘텐츠 기반 '정보형 AI 브리핑'에도 노출 중입니다"
          : isFranchise
          ? "네이버 검색·플레이스·AI탭 집중 전략 — 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다"
          : "네이버 검색·플레이스·AI탭이 주요 노출 경로 — 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다",
      }
    : unmeasured
    // 네이버 측정이 실패했고 직전 성공 결과도 없으면 그 점수로 단계 라벨(등급)을 붙이지 않는다
    ? { label: "AI 검색 준비도 · 일부 항목 확인 전", labelColor: "text-slate-700", bg: "bg-slate-50", cardBorder: "border-slate-300", sub: null as string | null }
    : { label: stage.label, labelColor: stage.labelColor, bg: stage.bg, cardBorder: stage.cardBorder, sub: null as string | null };

  // 점수 숫자 대신 실측 근거(경쟁사 순위)로 단계 레이블을 뒷받침 — 신뢰도 확보.
  // 키워드 "N개 보강 필요/모두 포함"은 근거가 약해 쓰지 않는다(topMissingKeywordCount 주석 참조).
  const evidenceText = (() => {
    if (myRankInList && totalCompetitors && totalCompetitors > 1) {
      return `경쟁사 ${totalCompetitors}곳 중 ${myRankInList}위`;
    }
    if (benchmarkAvg != null) {
      return unifiedScore >= benchmarkAvg ? "업종 평균 이상" : "업종 평균 미달";
    }
    return "";
  })();

  // "네이버 검색" 칸은 순위 측정(별도 파이프라인)의 사실만 말한다 — AI 브리핑 스캔 실패와 무관하다.
  // 업종 표준 키워드 누락 여부는 상태로 쓰지 않는다(근거가 약하고 정기 스캔은 계산하지 않아 0으로 보임).
  const rankAsOf = fmtMonthDay(keywordRank?.measuredAt ?? null);
  const naverSeoCard = keywordRank?.state === "hit"
    ? { icon: "✓", iconClass: "bg-emerald-700 text-white", status: "첫 화면 노출 확인", statusClass: "text-emerald-700", detail: `키워드 ${keywordRank.count}개 · 광고 제외` }
    : !naverCaptchaBlocked && (latestAdOnly ?? false)
    ? { icon: "!", iconClass: "bg-amber-700 text-white",   status: "광고만 노출",      statusClass: "text-amber-700",   detail: "유료광고 결과만 노출" }
    : keywordRank?.state === "none"
    ? { icon: "–", iconClass: "bg-gray-200 text-gray-600", status: "첫 화면 노출 미확인", statusClass: "text-gray-700", detail: rankAsOf ? `순위 측정 ${rankAsOf}` : "순위 측정 결과" }
    : { icon: "?", iconClass: "bg-gray-200 text-gray-600", status: "순위 측정 전",     statusClass: "text-gray-700",    detail: "아직 결과 없음" };

  // AI탭·AI 브리핑: 이번 측정이 실패하면 직전 성공 결과를 날짜와 함께, 그것도 없으면 "확인 전"만 말한다.
  const unknownCard = { icon: "?", iconClass: "bg-gray-200 text-gray-600", status: "확인 전", statusClass: "text-gray-700", detail: "아직 결과 없음" };

  const naverAiTabCard = unmeasured
    ? unknownCard
    : naverAiTabVisible === true
    ? { icon: "✓", iconClass: "bg-emerald-700 text-white", status: "노출 중",    statusClass: "text-emerald-700", detail: positiveDetail("AI탭 답변 있음") }
    : naverAiTabVisible === false
    ? { icon: "!", iconClass: "bg-amber-700 text-white",   status: "미노출",      statusClass: "text-amber-700",   detail: measuredDetail }
    : { icon: "i", iconClass: "bg-blue-100 text-blue-700 font-black", status: "준비 가능",   statusClass: "text-blue-700",    detail: "가이드로 설정하기" };

  const naverBriefingCard = unmeasured
    ? unknownCard
    : isInactiveOrFranchise && naverInBriefing
    ? { icon: "✓", iconClass: "bg-emerald-700 text-white", status: "정보형 노출 중",   statusClass: "text-emerald-700", detail: "콘텐츠 기반 AI 브리핑 노출" }
    : isInactiveOrFranchise
    ? { icon: "–", iconClass: "bg-gray-200 text-gray-600", status: "이 업종 해당 없음", statusClass: "text-gray-600",    detail: "네이버 검색·AI탭으로 노출 가능" }
    : briefingEligibility === "likely" && naverInBriefing
    ? { icon: "✓", iconClass: "bg-emerald-700 text-white", status: "정보형 노출 중",   statusClass: "text-emerald-700", detail: "콘텐츠 기반 AI 브리핑 노출" }
    : briefingEligibility === "likely"
    ? { icon: "△", iconClass: "bg-yellow-400 text-white",  status: "확대 예정",        statusClass: "text-yellow-700",  detail: "지금 준비 중" }
    : naverInBriefing
    ? { icon: "✓", iconClass: "bg-emerald-700 text-white", status: "노출 중",          statusClass: "text-emerald-700", detail: positiveDetail("브리핑 노출 확인됨") }
    : { icon: "!", iconClass: "bg-amber-700 text-white",   status: "미노출",           statusClass: "text-amber-700",   detail: measuredDetail };

  // INACTIVE/프랜차이즈는 AI 브리핑 비대상 → 경쟁순위 카드 대체 표시.
  // 단, 정보형 AI 브리핑에 실측 노출(naverInBriefing=True) 시 브리핑 카드로 교체 — 사용자에게 긍정 신호.
  const rankCard =
    myRankInList && totalCompetitors && totalCompetitors > 1
      ? myRankInList === 1
        ? { icon: "1", iconClass: "bg-emerald-700 text-white", status: "동네 1위",  statusClass: "text-emerald-700", detail: `경쟁 ${totalCompetitors}곳 중 1위` }
        : { icon: String(myRankInList), iconClass: "bg-amber-700 text-white", status: `${myRankInList}위`, statusClass: "text-amber-700", detail: `경쟁 ${totalCompetitors}곳 중 ${myRankInList}위` }
      : { icon: "–", iconClass: "bg-gray-200 text-gray-600", status: "비교 준비 중", statusClass: "text-gray-600", detail: "경쟁사 등록 후 표시" };

  const ANCHOR_MAP: Record<string, string> = {
    "naver-seo":      "#naver-seo-anchor",
    "naver-aitab":    "#naver-aitab-anchor",
    "naver-briefing": "#naver-briefing-anchor",
    "naver-rank":     "#section-detail",
  };
  // INACTIVE+in_briefing=True: 정보형 노출 확인 → 브리핑 카드 표시 (경쟁순위 대신)
  const naverChannels = isInactiveOrFranchise && !naverInBriefing
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
            {/* "AI 검색 준비도" 라벨이 보일 때만 — 이 단계가 인기가 아니라 준비 정도를 잰다는 기대 설정 */}
            {!isInactiveOrFranchise && (
              <p className="text-sm text-gray-700 mt-1 leading-snug break-keep">
                {READINESS_NOTE}{" "}
                <a href="/score-guide" className="font-semibold text-blue-700 hover:underline whitespace-nowrap">점수 보는 법 →</a>
              </p>
            )}
            {evidenceText && (
              <p className="text-sm font-bold text-gray-800 mt-1 break-keep">{evidenceText}</p>
            )}
            {(lastScannedLabel || staleRescan) && (
              <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                {lastScannedLabel && <span>{lastScannedLabel}</span>}
                {staleRescan && (
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 font-semibold px-1.5 py-0.5 rounded">
                    <RefreshCw className="w-3 h-3 shrink-0" /> 다시 측정 권장
                  </span>
                )}
              </p>
            )}
          </div>
          {scoreChangeDiff !== null && scoreChangeDiff !== 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              scoreChangeDiff > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
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
          <span className="ml-1 text-xs text-gray-600 hidden sm:inline">소상공인에게 가장 중요한 곳</span>
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
                <p className="text-sm font-medium text-gray-600 leading-tight break-keep">{card.platform}</p>
                <p className={`text-sm font-bold mt-0.5 leading-tight ${card.statusClass}`}>{card.status}</p>
                <p className="text-xs text-gray-600 mt-0.5 leading-tight break-keep group-hover:text-blue-700 transition-colors">{card.detail}</p>
              </div>
            </a>
          ))}
        </div>
        {/* 조사 방법 공개 — 사장님이 결과의 근거를 직접 판단할 수 있게 한다 */}
        <details className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-blue-700">어떻게 조사했나요?</summary>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700 leading-relaxed break-keep list-disc pl-5">
            <li><strong>네이버 검색</strong> — 등록한 키워드로 네이버를 검색해, 첫 화면(광고 제외)에 내 가게가 나오는지 PC·모바일에서 확인합니다. 가게 이름으로 검색한 결과는 제외합니다. 첫 화면에는 몇 곳만 보여서, 가게가 많은 지역에서는 잘 되는 가게도 첫 화면에 안 잡힐 수 있습니다.</li>
            <li><strong>AI탭</strong> — 등록한 키워드 기반 검색어로 네이버 AI탭 답변에 내 가게가 포함되는지 확인합니다.</li>
            <li><strong>AI 브리핑</strong> — 검색 결과 화면에 AI 브리핑이 뜨는지, 뜬다면 내 가게가 포함되는지 확인합니다. 브리핑이 아예 뜨지 않는 검색어도 있습니다.</li>
            <li>&lsquo;확인 전&rsquo;은 아직 측정 결과가 없는 항목입니다. 결과가 있으면 측정한 날짜를 함께 보여 드립니다.</li>
            <li>측정 시점·기기·로그인 상태에 따라 결과가 달라질 수 있습니다. 변화는 2~4주(추정) 뒤 다시 측정해 확인하세요.</li>
          </ul>
        </details>
      </div>

      {/* ── 오늘 할 일 앵커 CTA — 동일 텍스트 중복 방지: 실제 내용은 아래 ActionZone에만 표시 ── */}
      {todayAction && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <a
            href={todayActionLink ?? "#section-action"}
            className="flex items-center justify-between gap-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl px-4 py-3 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-rose-700 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-rose-700 leading-tight">오늘의 개선 미션</p>
                <p className="text-sm font-semibold text-gray-800 leading-snug break-keep mt-0.5 line-clamp-2">{todayAction}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-rose-700 group-hover:text-rose-800 shrink-0 whitespace-nowrap">확인하기 ↓</span>
          </a>
        </div>
      )}
    </div>
  );
}
