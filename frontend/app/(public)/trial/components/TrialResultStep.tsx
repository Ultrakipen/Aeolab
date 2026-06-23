"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CATEGORY_MAP,
  FLAT_CATEGORY_MAP,
  flatToGroup,
} from "@/lib/categories";
import { getUserGroup, GROUP_MESSAGES, getBriefingEligibility, type BriefingEligibility } from "@/lib/userGroup";
import { PLAN_PRICES, FIRST_MONTH_DISCOUNT_PRICES } from "@/lib/plans";
import TodayOneAction from "@/components/trial/TodayOneAction";
import NaverStatusSection from "@/components/trial/NaverStatusSection";
import SubscriptionValueCompare from "@/components/trial/SubscriptionValueCompare";
import KakaoShareButton from "@/components/common/KakaoShareButton";
import TextShareButton from "@/components/trial/TextShareButton";
import ResultSummaryHero from "@/components/common/ResultSummaryHero";
import { naverSeoTile, aiTabTile, briefingTile, rankTile, makeTile, type ChannelTile } from "@/lib/scoreLabels";
import type {
  TrialScanResult,
  TrialPlaceMatch,
  TrialSmartPlaceCheck,
} from "@/types";
import type { TrialResultProps } from "./TrialSharedTypes";
import { trackTrialComplete, trackEvent } from "@/lib/analytics";
import {
  Info,
  Store,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Calendar,
  Check,
  X,
  XCircle,
  Lock,
} from "lucide-react";


// ── 잠긴 상세 분석 카드 (점수는 위에서 공개, 여기서는 항목별 분석 유도) ────
function LockedScoreCard({
  score,
  track1,
  track2,
  userGroup,
  breakdown,
}: {
  score: number;
  track1: number;
  track2: number;
  userGroup?: string;
  breakdown?: {
    keyword_gap_score?: number;
    smart_place_completeness?: number;
    review_quality?: number;
    kakao_completeness?: number;
  };
}) {
  const kgPct = breakdown?.keyword_gap_score !== undefined
    ? Math.round(breakdown.keyword_gap_score)
    : null;
  const spPct = breakdown?.smart_place_completeness !== undefined
    ? Math.round(breakdown.smart_place_completeness)
    : null;

  return (
    <div className="rounded-xl border-2 border-blue-100 bg-white overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-blue-100">
        <p className="text-base font-bold text-slate-700">📊 항목별 상세 분석</p>
        <p className="text-sm text-slate-500 mt-0.5">5가지 항목 개별 점수 + 경쟁사 비교 + 매주 자동 측정</p>
      </div>

      {/* 공개 힌트 — 실측 항목 1~2개만 */}
      {(kgPct !== null || spPct !== null) && (
        <div className="px-4 pt-4 space-y-2">
          {kgPct !== null && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-700 font-medium">핵심 키워드 보유율</span>
                <span className="text-sm font-bold text-slate-800">{kgPct >= 65 ? "양호" : kgPct >= 40 ? "보완 필요" : "개선 필요"}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${kgPct}%` }}
                />
              </div>
            </div>
          )}
          {spPct !== null && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-700 font-medium">네이버 프로필 완성도</span>
                <span className="text-sm font-bold text-slate-800">{spPct >= 65 ? "양호" : spPct >= 40 ? "보완 필요" : "개선 필요"}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${spPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 블러: 나머지 항목 */}
      <div className="relative">
        <div className="px-4 pt-3 pb-5 blur-sm select-none pointer-events-none opacity-50" aria-hidden="true">
          {[
            { label: "고객 후기 신뢰도", barW: 50 },
            { label: userGroup === "INACTIVE" ? "키워드·리뷰 최적화" : "AI 브리핑 노출", barW: 50 },
            { label: "카카오맵 등록", barW: 50 },
          ].map((item) => (
            <div key={item.label} className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span className="text-sm text-slate-400">--</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full bg-blue-400" style={{ width: `${item.barW}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px]">
          <div className="text-center px-6">
            <p className="text-sm font-bold text-slate-800 mb-1">🔒 나머지 항목 점수 + 경쟁사 비교</p>
            <p className="text-sm text-slate-500 mb-3 leading-relaxed break-keep">
              구독하면 5개 항목 전부 + 경쟁사 대비 순위 + 매주 자동 측정
            </p>
            <Link href="/pricing" className="inline-block text-sm font-bold text-white bg-blue-600 rounded-xl px-5 py-2 hover:bg-blue-700 transition-colors">
              구독 시작하기 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ChatGPT/Gemini 노출 빈도 텍스트 헬퍼 ────────────────────────────
function chatgptFreqLabel(freq: number | undefined, mentioned: boolean | undefined, sampleSize: number): { text: string; color: string } {
  if (freq === undefined) {
    return mentioned ? { text: "노출됨", color: "text-green-700" } : { text: "미노출", color: "text-slate-500" };
  }
  if (freq === 0) return { text: "미노출", color: "text-slate-500" };
  const ratio = freq / sampleSize;
  if (ratio >= 0.6) return { text: "자주 노출", color: "text-green-700" };
  if (ratio >= 0.3) return { text: "가끔 노출", color: "text-blue-700" };
  return { text: "드물게", color: "text-amber-700" };
}

function geminiFreqLabel(freq: number | undefined): { text: string; color: string } {
  if (freq === undefined) return { text: "미측정", color: "text-slate-400" };
  if (freq === 0) return { text: "미노출", color: "text-slate-500" };
  if (freq >= 7) return { text: "자주 노출", color: "text-green-700" };
  if (freq >= 4) return { text: "가끔 노출", color: "text-blue-700" };
  return { text: "드물게", color: "text-amber-700" };
}

// ── 핵심 결론 카드 (스크롤 없이 즉시 파악, 실측 데이터만) ──────────────
function ScanConclusionCard({
  businessName,
  chatgptMentioned,
  chatgptSampleSize,
  chatgptExposureFreq,
  geminiExposureFreq,
  smartPlaceCheck,
  missingKws,
  inBriefing,
  briefingCategory,
  chatgptQueries,
  naverMyRank,
  kakaoRank,
  blogCount,
  isSmartPlaceConfirmed,
}: {
  businessName: string;
  chatgptMentioned: boolean | undefined;
  chatgptSampleSize: number;
  chatgptExposureFreq?: number;
  geminiExposureFreq?: number;
  smartPlaceCheck: TrialSmartPlaceCheck | null | undefined;
  missingKws: string[];
  inBriefing: boolean | null;
  briefingCategory: "active" | "likely" | "inactive";
  chatgptQueries?: string[];
  naverMyRank?: number | null;
  kakaoRank?: number | null;
  blogCount?: number;
  isSmartPlaceConfirmed?: boolean;
}) {
  // chatgptQueries prop은 향후 확장을 위해 유지 (현재 1줄 요약 구조에서 미사용)
  void chatgptQueries;

  // 실측 데이터가 하나도 없으면 카드 자체 숨김
  const hasAnyData =
    chatgptMentioned !== undefined ||
    (smartPlaceCheck && !smartPlaceCheck.error) ||
    missingKws.length > 0 ||
    inBriefing !== null ||
    isSmartPlaceConfirmed;
  if (!hasAnyData) return null;

  // 강점 항목 목록 (실측 데이터 있는 것만)
  const strengthItems: { icon: string; text: string }[] = [];
  if (isSmartPlaceConfirmed) {
    strengthItems.push({ icon: "✅", text: "스마트플레이스 등록 확인 — 네이버 지역 검색 대상" });
  }
  if (kakaoRank !== null && kakaoRank !== undefined && kakaoRank <= 10) {
    strengthItems.push({ icon: "✅", text: `카카오 검색 ${kakaoRank}위 확인` });
  }
  if (blogCount !== undefined && blogCount > 0) {
    strengthItems.push({ icon: "✅", text: `블로그 리뷰 ${blogCount.toLocaleString()}건 확인` });
  }
  if (
    smartPlaceCheck &&
    !smartPlaceCheck.error &&
    ((smartPlaceCheck as { visitor_review_count?: number }).visitor_review_count ?? 0) > 0
  ) {
    const vrc = (smartPlaceCheck as { visitor_review_count?: number }).visitor_review_count ?? 0;
    // 블로그카운트와 중복 표시 방지: 방문자 리뷰는 별도 항목으로만
    if (!strengthItems.some((s) => s.text.includes("블로그"))) {
      strengthItems.push({ icon: "✅", text: `방문자 리뷰 ${vrc.toLocaleString()}건 확인` });
    }
  }

  // 핵심 개선 포인트 (키워드 갭 우선)
  const topMissingKw = missingKws[0] ?? null;

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm">
      <p className="text-sm font-bold text-slate-500 mb-3 tracking-wide uppercase">이번 스캔 발견</p>

      {/* 강점 먼저 — 실측 데이터 있는 것만 */}
      {strengthItems.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {strengthItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
              <span className="text-base shrink-0">{item.icon}</span>
              <p className="text-sm font-semibold text-green-800 break-keep">{item.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* 핵심 개선 포인트 1개 */}
      {topMissingKw && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 mb-3">
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0 mt-0.5">⚠️</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800 break-keep">
                소개글에 경쟁사 핵심 키워드 {missingKws.length}개 없음
              </p>
              <p className="text-sm text-amber-700 mt-0.5 break-keep">
                &lsquo;{topMissingKw}&rsquo; 등 추가 시 2~4주 내 네이버 순위 상승 기대
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 구분선 */}
      <div className="border-t border-slate-100 pt-3 mb-2" />

      {/* ChatGPT 측정 결과 1줄 요약 */}
      <p className="text-sm text-slate-400 leading-snug break-keep">
        ChatGPT {chatgptSampleSize}회 초기 측정 —{" "}
        {chatgptMentioned
          ? `"${businessName}" 노출됨`
          : "아직 미노출 (네이버 최적화 후 수개월 내 반영 예상)"}
      </p>

      <div className="space-y-2 mt-3">

        {/* 사진 강점 (photo_count 많을 때만 — 상단 strengthItems에 없는 추가 강점) */}
        {smartPlaceCheck && !smartPlaceCheck.error && (smartPlaceCheck as { photo_count?: number }).photo_count != null && ((smartPlaceCheck as { photo_count?: number }).photo_count ?? 0) >= 30 && (
          <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 bg-green-50 border border-green-200">
            <span className="text-lg shrink-0 mt-0.5">✅</span>
            <p className="text-sm font-semibold text-slate-800 break-keep">
              사진 {(smartPlaceCheck as { photo_count?: number }).photo_count}장 등록 — 풍부한 시각 콘텐츠가 확인됐습니다
            </p>
          </div>
        )}

        {/* 네이버 상위권인데 ChatGPT 미노출 — 정상 맥락 설명 */}
        {chatgptExposureFreq === 0 && (geminiExposureFreq === 0 || geminiExposureFreq === undefined) &&
         naverMyRank !== null && naverMyRank !== undefined && naverMyRank <= 5 && (
          <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 bg-blue-50 border border-blue-100">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600 break-keep leading-snug">
              <strong className="text-slate-800">네이버 {naverMyRank}위인데 ChatGPT에 없는 건 정상입니다.</strong>{" "}
              ChatGPT는 수개월~1년 주기로 학습 데이터를 갱신하며, 네이버 검색 상위권인 가게도 대부분 아직 미인식 상태입니다. 네이버 최적화를 유지하면 점차 반영됩니다.
            </p>
          </div>
        )}

        {/* 네이버 AI 브리핑 실측 결과 (active 업종, 체험 스캔에서 측정된 경우만) */}
        {briefingCategory === "active" && inBriefing !== null && (
          <div className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${inBriefing ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
            <span className="text-lg shrink-0 mt-0.5">{inBriefing ? "✅" : "⚠️"}</span>
            <p className="text-sm font-semibold text-slate-800 break-keep">
              네이버 AI 브리핑 —{" "}
              {inBriefing
                ? `"${businessName}"이 노출 중입니다`
                : `"${businessName}"이 아직 노출되지 않습니다`}
            </p>
          </div>
        )}

        {/* 스마트플레이스 미완성 항목 (누락된 것만) */}
        {smartPlaceCheck && !smartPlaceCheck.error && (() => {
          const missing = [
            !smartPlaceCheck.is_smart_place && "스마트플레이스 등록",
            !smartPlaceCheck.has_recent_post && "최근 소식",
            !smartPlaceCheck.has_intro && "소개글",
          ].filter(Boolean) as string[];
          if (missing.length === 0) return null;
          return (
            <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 bg-amber-50 border border-amber-200">
              <span className="text-lg shrink-0 mt-0.5">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 break-keep">
                  스마트플레이스 {missing.join(" · ")} 미완성
                </p>
                <p className="text-sm text-slate-500 mt-0.5 break-keep">
                  완성하면 AI 인용·네이버 신선도 점수가 올라갑니다
                </p>
              </div>
            </div>
          );
        })()}

        {/* 키워드가 이미 모두 갖춰진 경우에만 긍정 메시지 */}
        {missingKws.length === 0 && (
          <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 bg-green-50 border border-green-200">
            <span className="text-lg shrink-0 mt-0.5">✅</span>
            <p className="text-sm font-semibold text-slate-800 break-keep">
              경쟁 가게 핵심 키워드가 이미 갖춰져 있습니다
            </p>
          </div>
        )}

      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-sm text-slate-400 leading-relaxed">
          측정 시점·기기·질의 구성에 따라 결과가 달라질 수 있습니다
        </p>
        <a href="#today-action" className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 whitespace-nowrap ml-3">
          오늘 할 일 보기 ↓
        </a>
      </div>
    </div>
  );
}

// ── 점수 요약 카드 (성장 단계 중심 — 거부감 없이 기회 전달) ─────────────
function ScoreSummaryCard({
  score,
  benchmarkAvg,
  categoryLabel,
  isEstimatedBenchmark,
}: {
  score: number;
  benchmarkAvg: number;
  categoryLabel: string;
  isEstimatedBenchmark: boolean;
}) {
  const vsAvg = Math.round(score - benchmarkAvg);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 mb-4 shadow-sm">
      {/* 업종 평균 대비 내 위치 — 성장단계·채널 상태는 상단 종합결론 히어로에 표시 */}
      <p className="text-sm font-bold text-slate-700 mb-3">업종 평균 대비 내 위치</p>

      {/* 점수 바 + 업종 평균선 (숫자 미표시 — 상대 위치만) */}
      <div className="mb-1">
        <div className="w-full bg-slate-100 rounded-full h-2.5 relative">
          <div
            className="h-2.5 rounded-full bg-blue-400 transition-all duration-700"
            style={{ width: `${score}%` }}
          />
          {!isEstimatedBenchmark && benchmarkAvg > 0 && benchmarkAvg <= 100 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 rounded-full"
              style={{ left: `${benchmarkAvg}%` }}
              title={`${categoryLabel} 업종 평균`}
            />
          )}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-sm text-slate-400">시작</span>
          {!isEstimatedBenchmark && benchmarkAvg > 0 && (
            <span className="text-sm text-slate-400">{categoryLabel} 업종 평균</span>
          )}
          <span className="text-sm text-slate-400">최적화</span>
        </div>
      </div>

      {!isEstimatedBenchmark && Math.abs(vsAvg) >= 1 && (
        <p className="text-sm text-slate-500 mt-2 break-keep">
          내 가게 AI 검색 노출은 {categoryLabel} 업종 평균 {vsAvg >= 0 ? "이상입니다" : "대비 개선 여지가 있습니다"}.
        </p>
      )}

      <div className="mt-3">
        <p className="text-sm text-slate-400 leading-relaxed">
          AEOlab AI 가시성 진단 · 네이버·ChatGPT 실측 기반 · 측정 시점에 따라 결과가 달라질 수 있습니다
        </p>
      </div>
    </div>
  );
}

// 업종별 벤치마크 기본값
const CATEGORY_BENCHMARKS: Record<string, { avg: number; top30: number }> = {
  food: { avg: 52, top30: 68 },
  cafe: { avg: 48, top30: 65 },
  health: { avg: 58, top30: 75 },
  beauty: { avg: 55, top30: 72 },
  education: { avg: 53, top30: 70 },
  professional: { avg: 50, top30: 67 },
  shopping: { avg: 44, top30: 61 },
  living: { avg: 47, top30: 63 },
  culture: { avg: 45, top30: 62 },
  accommodation: { avg: 51, top30: 68 },
};

// ── 컴포넌트 본체 ─────────────────────────────────────────────────────
export default function TrialResultStep(props: TrialResultProps) {
  const {
    result,
    selectedCategory,
    selectedTags,
    form,
    hasFaq,
    hasRecentPost,
    hasIntro,
    isLoggedIn,
    apiBenchmark,
    naverCheckState,
    naverCheckResult,
    naverCheckError,
    onNaverBriefingCheck,
    onNaverCheckReset,
    onSaveTrialData,
    onReset,
    isRestored = false,
    onRescan,
  } = props;

  // 점수 계산
  const totalScore = Math.round(result.score?.total_score ?? 0);
  // track1Estimated / track2Estimated — ScoreSummaryCard 숫자 점수 제거로 렌더링 미사용, 향후 다른 UI에 재활용 가능
  void (result.track1_score == null && result.score?.track1_score == null && result.score?.naver_channel_score == null);
  void (result.track2_score == null && result.score?.track2_score == null && result.score?.global_channel_score == null);
  const track1 =
    result.track1_score ??
    result.score?.track1_score ??
    result.score?.naver_channel_score ??
    Math.round(totalScore * 0.6);
  const track2 =
    result.track2_score ??
    result.score?.track2_score ??
    result.score?.global_channel_score ??
    Math.round(totalScore * 0.4);
  const unified = result.score?.unified_score ?? result.score?.total_score;
  const gs = result.growth_stage;
  const gsLabel = result.growth_stage_label ?? gs?.stage_label ?? "성장 중";
  const missingKws = result.top_missing_keywords ?? [];
  const pioneerKws = result.pioneer_keywords ?? [];
  const faqText = result.faq_copy_text ?? null;
  const [dismissedKws, setDismissedKws] = useState<string[]>([]);
  const effectiveFaqText =
    missingKws.length > 0 && dismissedKws.includes(missingKws[0])
      ? null
      : faqText;
  const effectiveMissingKws = missingKws.filter((k) => !dismissedKws.includes(k));
  const effectivePioneerKws = pioneerKws.filter(
    (k) => missingKws.includes(k) && !dismissedKws.includes(k),
  );

  const score = Math.round(
    result.score?.total_score ?? result.score?.unified_score ?? 0,
  );
  const naver = result.naver;
  const blogCount = naver?.blog_mentions ?? 0;
  const smartPlaceStatus: boolean | null =
    form.is_smart_place === true
      ? true
      : form.is_smart_place === false
        ? null
        : naver?.is_smart_place === true
          ? true
          : null;
  const isSmartPlace = smartPlaceStatus === true;

  const inBriefing: boolean | null =
    naver?.in_briefing !== undefined && naver?.in_briefing !== null
      ? Boolean(naver.in_briefing)
      : null;

  const benchmarkData =
    CATEGORY_BENCHMARKS[flatToGroup(selectedCategory)] ??
    CATEGORY_BENCHMARKS[selectedCategory] ?? { avg: 50, top30: 65 };
  // Level 1(업종+지역 ≥5건) 실측만 신뢰 가능 — fallback 응답은 비교에 사용 안 함
  const hasReliableBenchmark = !!(apiBenchmark?.avg_score && !apiBenchmark?.fallback);
  const benchmarkAvg = apiBenchmark?.avg_score ?? benchmarkData.avg;
  const isEstimatedBenchmark = !hasReliableBenchmark;

  const chatgptResult = (
    result as {
      chatgpt_result?: {
        mentioned?: boolean;
        excerpt?: string;
        exposure_freq?: number;
        sample_size?: number;
        queries_used?: string[];
      };
    }
  ).chatgpt_result;
  const chatgptMentioned =
    chatgptResult?.mentioned ??
    (chatgptResult?.exposure_freq !== undefined
      ? chatgptResult.exposure_freq > 0
      : undefined);
  const chatgptSampleSize = chatgptResult?.sample_size ?? 5;

  const websiteCheckResult = (
    result as {
      website_check_result?: { has_website?: boolean };
    }
  ).website_check_result;
  const hasWebsite: boolean | null = websiteCheckResult?.has_website ?? null;

  const geminiExposureFreq = (
    result as {
      gemini_result?: { exposure_freq?: number };
    }
  ).gemini_result?.exposure_freq;

  const aiEvidence = (result as {
    ai_evidence?: {
      queries?: Array<{ query: string; mentioned: boolean; excerpt?: string }>;
    };
  }).ai_evidence;

  const analyzedKeyword =
    (result as { analyzed_keyword?: string }).analyzed_keyword ||
    selectedTags[0] ||
    undefined;

  // ChatGPT 카드에 표시할 질의: 실제 ChatGPT 쿼리 > Gemini 쿼리 > 핵심키워드 > 태그 fallback
  const chatgptDisplayQueries = (() => {
    // 1순위: 실제 ChatGPT에 보낸 쿼리 (가장 정확)
    if (chatgptResult?.queries_used && chatgptResult.queries_used.length > 0) {
      return chatgptResult.queries_used;
    }
    // 2순위: Gemini ai_evidence 쿼리
    if (aiEvidence?.queries && aiEvidence.queries.length > 0) {
      return aiEvidence.queries.map((q) => q.query);
    }
    const city = (form.region || "")
      .trim()
      .replace(/^(?:서울특별시|부산광역시|인천광역시|대구광역시|대전광역시|광주광역시|울산광역시|세종특별자치시|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)\s*/u, "");
    const prefix = city || form.region || "";
    // 3순위: 분석 키워드 기반 조합
    if (analyzedKeyword) return [`${prefix ? prefix + " " : ""}${analyzedKeyword} 추천`];
    const tags = selectedTags.length > 0 ? selectedTags.slice(0, 1) : [];
    if (tags.length === 0) return [form.business_name || "내 가게"];
    // 4순위: 태그 fallback (1개만 — 실제 단일 쿼리 반영)
    return tags.map((t) => `${prefix ? prefix + " " : ""}${t} 추천`);
  })();

  const isFranchise = (form as { is_franchise?: boolean }).is_franchise === true;
  const userGroupValue = getUserGroup(selectedCategory, isFranchise);

  function getSignupCTALabel(group: string): string {
    if (group === "ACTIVE") return "가입하고 네이버 AI 브리핑 노출 시작하기";
    if (group === "LIKELY") return "가입하고 AI탭 노출 + 확대 예정 대비하기";
    if (group === "franchise") return "가입하고 글로벌 AI 노출 시작하기";
    return "가입하고 ChatGPT·Gemini 최적화 진단 받기";
  }

  function handleSignupCTAClick(group: string) {
    const dimMap: Record<string, string> = {
      ACTIVE: "signup_cta_clicked_active",
      LIKELY: "signup_cta_clicked_likely",
      INACTIVE: "signup_cta_clicked_inactive",
      franchise: "signup_cta_clicked_franchise",
    };
    trackEvent(dimMap[group] ?? "signup_cta_clicked_inactive", {
      category: selectedCategory,
      group,
    });
  }

  const naverChannelScore = result.score?.naver_channel_score ?? track1;
  const globalChannelScore = result.score?.global_channel_score ?? track2;

  // 업종 AI 브리핑 분류 (백엔드 제공 우선, 없으면 프론트 단일 소스 헬퍼 사용)
  const briefingCategory: BriefingEligibility =
    (result.briefing_category as BriefingEligibility | undefined) ??
    getBriefingEligibility(selectedCategory, isFranchise);

  // ── 종합 결론 히어로 (대시보드 HeroCard 구조 복제) ──────────────────────
  const heroInactive = briefingCategory === "inactive" || isFranchise;
  const naverCompetitorCount =
    (naver as { naver_competitors?: unknown[] } | null)?.naver_competitors?.length ?? 0;

  // 카카오 순위: 네이버 순위 없을 때 대체 타일로 사용
  const kakaoMyRank = (result as { kakao?: { my_rank?: number | null } }).kakao?.my_rank ?? null;
  const rankOrKakaoTile: ChannelTile = (!naver?.my_rank && kakaoMyRank && kakaoMyRank <= 5)
    ? makeTile("kakao-rank", "카카오 검색", "good",
        kakaoMyRank === 1 ? "카카오 1위" : `카카오 ${kakaoMyRank}위`,
        "카카오맵 상위 노출 중")
    : rankTile({ myRank: naver?.my_rank, totalCompetitors: naverCompetitorCount });

  const heroTiles: ChannelTile[] = [
    naverSeoTile({ missingKeywordCount: effectiveMissingKws.length }),
    rankOrKakaoTile,
    briefingTile({ eligibility: briefingCategory, isFranchise, inBriefing }),
  ];

  const heroEvidenceParts: string[] = [];
  if (naver?.my_rank && naverCompetitorCount > 1)
    heroEvidenceParts.push(`경쟁 ${naverCompetitorCount}곳 중 ${naver.my_rank}위`);
  if (kakaoMyRank && kakaoMyRank <= 5 && !naver?.my_rank)
    heroEvidenceParts.push(`카카오 ${kakaoMyRank}위`);
  if (blogCount > 0)
    heroEvidenceParts.push(`블로그 ${blogCount}건`);
  heroEvidenceParts.push(
    effectiveMissingKws.length === 0 ? "키워드 모두 포함" : `키워드 ${effectiveMissingKws.length}개 보강 필요`,
  );
  const heroEvidence = heroEvidenceParts.join(" · ");

  // 점수 산식 분해 데이터
  const breakdown = result.score?.breakdown;
  const breakdownItems = [
    {
      label: "AI 질문에 내 가게가 나오는 핵심 키워드 보유",
      weight: 30,
      value: breakdown?.keyword_gap_score,
    },
    {
      label: "고객 후기 수와 평점 신뢰도",
      weight: 25,
      value: breakdown?.review_quality,
      trialLimited: !breakdown?.review_quality,
      trialNote: "체험 스캔에서는 미수집 — 정식 스캔에서 자동으로 측정합니다",
    },
    {
      label: "네이버 가게 프로필 완성도",
      weight: 15,
      value: breakdown?.smart_place_completeness,
    },
    {
      label: isFranchise || userGroupValue === "INACTIVE"
        ? "네이버 지역·블로그 검색 노출 여부"
        : userGroupValue === "LIKELY"
          ? "네이버 AI 브리핑 노출 여부 (확대 검토 중)"
          : "실제 네이버 AI 브리핑 노출 여부",
      weight: 15,
      value: breakdown?.naver_exposure_confirmed,
      trialLimited: !breakdown?.naver_exposure_confirmed,
      trialNote: "체험 스캔에서는 미측정 — 정식 스캔에서 확인합니다",
    },
    {
      label: "카카오맵 가게 정보 등록",
      weight: 10,
      value: breakdown?.kakao_completeness,
    },
  ];

  // 점수 의미 해석
  const unifiedScore = unified ?? score;
  const isInactiveGroup = userGroupValue !== "ACTIVE";
  const scoreInterpretation =
    unifiedScore >= 60
      ? { text: isInactiveGroup ? "네이버·글로벌 AI 검색 노출 안정권" : "AI 브리핑 노출 안정권", color: "text-green-700", bg: "bg-green-50 border-green-200" }
      : unifiedScore >= 40
        ? { text: isInactiveGroup ? "기반 구축 중 — 플레이스·블로그 보완 필요" : "기반 구축 중 — 콘텐츠 보완 필요", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" }
        : { text: isInactiveGroup ? "네이버 검색 노출 낮음 — 블로그·플레이스 개선 필요" : "노출 확률 낮음 — 지금 바로 개선 필요", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" };

  // 7일 후 날짜 계산
  const nextScanDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${month}월 ${day}일 (${weekdays[d.getDay()]})`;
  })();

  const categoryLabel =
    FLAT_CATEGORY_MAP[selectedCategory]?.label ??
    CATEGORY_MAP[selectedCategory]?.label ??
    selectedCategory;

  // 결과 화면 마운트 시 최상단으로 스크롤 (스캔 진행 중 아래로 스크롤된 상태 초기화)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // GA4: trial_complete
  useEffect(() => {
    const trialId = (result as { trial_id?: string }).trial_id;
    trackTrialComplete({
      trial_id: trialId,
      category: selectedCategory,
      score,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 업종 그룹 배너 노드 (섹션 4 내에 포함) ──────────────────────────
  const group = userGroupValue;
  const msg = GROUP_MESSAGES[group];
  const bgMap: Record<string, string> = {
    ACTIVE: "bg-green-50 border-green-200",
    LIKELY: "bg-blue-50 border-blue-200",
    INACTIVE: "bg-amber-50 border-amber-200",
    franchise: "bg-amber-50 border-amber-200",
  };

  const groupBannerNode = (
    <>
      {(group === "INACTIVE" || group === "franchise") && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm md:text-base font-bold text-amber-900">
              {group === "franchise"
                ? "프랜차이즈 가맹점은 네이버 AI 브리핑 대상에서 제외됩니다"
                : "현재 네이버 AI 브리핑 대상 업종이 아닙니다"}
            </p>
          </div>
          <p className="text-sm text-amber-800 leading-relaxed mb-2 break-keep">
            {group === "franchise"
              ? "네이버 본사 정책에 따라 프랜차이즈 가맹점은 AI 브리핑 노출이 제한됩니다. 단, 네이버 AI탭(업종 공식 제한 없음, 베타 확대 중)도 확인하세요."
              : "ChatGPT·Gemini·Google AI 노출 최적화에 집중합니다. 또한 네이버 AI탭(업종 공식 제한 없음, 베타 확대 중)도 확인하세요."}
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "네이버 AI탭", desc: "업종 공식 제한 없음 · 베타 확대 중" },
              { label: "ChatGPT", desc: "OpenAI 학습 데이터 + Bing 검색" },
              { label: "Gemini", desc: "Google 검색 혼합" },
              { label: "Google AI", desc: "구글 SGE 인용" },
            ].map((ch) => (
              <span
                key={ch.label}
                className="inline-flex items-center gap-1 text-sm bg-white border border-amber-300 rounded-full px-2.5 py-1 text-amber-900 font-medium"
              >
                <span className="font-bold">{ch.label}</span>
                <span className="text-amber-700">{ch.desc}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {group === "LIKELY" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 mb-1">
            네이버 AI탭 — 베타 확대 중
          </p>
          <p className="text-sm text-amber-800 leading-relaxed">
            네이버 AI탭은 2026-04-27 베타 출시, 베타 확대 중입니다 (업종 공식 제한 없음).
            AI 브리핑 업종 확대는 네이버 공식 발표 후 적용 예정이며 현재 확대 검토 중입니다.
          </p>
        </div>
      )}

      <div className={`rounded-xl border px-4 py-3 ${bgMap[group]}`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${msg.badgeColor}`}>
            {msg.badge}
          </span>
          <span className="text-sm text-gray-500">{categoryLabel}</span>
        </div>
        <p className="text-sm md:text-base text-gray-900 font-semibold leading-snug break-keep mb-1">
          {msg.headline}
        </p>
        <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">
          {msg.sub}
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* 이전 결과 복원 안내 배너 */}
      {isRestored && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
            <p className="text-sm text-blue-800">
              이전 스캔 결과입니다. 이메일로 저장하지 않으면 탭을 닫을 때 사라집니다.
            </p>
            <button
              onClick={onRescan ?? onReset}
              className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2 transition-colors shrink-0"
            >
              새로 스캔하기
            </button>
          </div>
        </div>
      )}

      {/* Sticky 상단 CTA — 비로그인, 데스크톱 전용 */}
      {!isLoggedIn && (
        <div className="hidden md:block sticky top-0 z-40 bg-blue-600 shadow-md">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-base font-medium leading-tight text-white">
              이 결과를 기반으로 매주 자동 진단 + 경쟁사 비교 + 개선 가이드 — 무료 회원가입
            </p>
            <Link
              href="/signup"
              onClick={() => { onSaveTrialData(); handleSignupCTAClick(userGroupValue); }}
              className="shrink-0 bg-white text-blue-600 text-base font-bold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {getSignupCTALabel(userGroupValue)}
            </Link>
          </div>
        </div>
      )}

      <StickySignupBanner isLoggedIn={isLoggedIn} onSave={onSaveTrialData} />

      <div className="max-w-5xl mx-auto py-6 px-4 pb-28 md:pb-8">

        {/* ── 1. 가게 헤더 (업종 배지 인라인 통합) ───────────────── */}
        {form.business_name ? (
          <div className="rounded-xl bg-white border border-slate-200 px-5 py-4 mb-4 shadow-sm">
            {/* 레이블 */}
            <p className="text-sm font-bold text-slate-400 tracking-widest uppercase mb-3 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              진단 대상 가게
            </p>
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner">
                <Store className="w-7 h-7 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-black text-slate-900 leading-tight tracking-tight break-keep">
                  {form.business_name}
                </p>
                {form.region && (
                  <p className="text-base text-slate-500 mt-0.5 font-medium">{form.region}</p>
                )}
                <div className="mt-2">
                  <BriefingBadgeChip category={briefingCategory} />
                </div>
              </div>
              {result.place_match?.naver_place_url && (
                <a
                  href={result.place_match.naver_place_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shadow-md"
                >
                  네이버 플레이스 →
                </a>
              )}
            </div>
          </div>
        ) : (
          <BriefingCategoryBadge category={briefingCategory} />
        )}

        {/* ── 발견된 강점 배너 — 첫 인상: 실측 강점 먼저 표시 ── */}
        {(() => {
          const isSpConfirmed = !!(result.place_match?.naver_place_url
            || result.smart_place_check?.is_smart_place
            || (naver as { is_smart_place?: boolean } | null)?.is_smart_place
            || (form as { is_smart_place?: boolean }).is_smart_place);
          const badges: { icon: string; text: string }[] = [];
          if (isSpConfirmed) badges.push({ icon: "📍", text: "스마트플레이스 등록됨" });
          const _kakaoRk = (result as { kakao?: { my_rank?: number | null } }).kakao?.my_rank ?? null;
          if (_kakaoRk && _kakaoRk <= 5) badges.push({ icon: "🟡", text: `카카오맵 ${_kakaoRk}위` });
          if (blogCount > 0) badges.push({ icon: "📝", text: `블로그 리뷰 ${blogCount}건` });
          if ((result.smart_place_check as { visitor_review_count?: number } | null)?.visitor_review_count) {
            const vrc2 = (result.smart_place_check as { visitor_review_count?: number }).visitor_review_count!;
            if (vrc2 > 0 && !badges.some(b => b.text.includes("리뷰"))) badges.push({ icon: "⭐", text: `방문자 리뷰 ${vrc2}건` });
          }
          if (badges.length === 0) return null;
          return (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 mb-4">
              <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">이번 스캔에서 발견한 강점</p>
              <div className="flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-800 bg-white border border-green-200 rounded-full px-3 py-1 shadow-sm">
                    <span>{b.icon}</span>{b.text}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── 1. 종합 결론 — 대시보드 HeroCard 구조 복제 (성장단계+네이버 3채널 그리드+실측근거+오늘할일) ── */}
        <div className="mb-4">
          <ResultSummaryHero
            stageScore={track1}
            inactive={briefingCategory === "inactive"}
            isFranchise={isFranchise}
            evidenceText={heroEvidence}
            tiles={heroTiles}
            todayAction={
            effectiveMissingKws.length > 0
              ? `소개글에 '${effectiveMissingKws[0]}' 키워드 추가 → 네이버 순위 ↑`
              : !isSmartPlace
              ? "스마트플레이스 등록하기 — 네이버 검색 노출 시작"
              : gs?.this_week_action
          }
            todayActionLink="#today-action"
          />
        </div>

        {/* ── 1-b. 네이버 현황 (location_based 업종만) ──────────── */}
        {(result as { business_type?: string }).business_type !== "non_location" && (
          <NaverStatusSection
            businessName={form.business_name || "내 가게"}
            searchQuery={(naver as { search_query?: string } | null)?.search_query}
            region={form.region}
            myRank={naver?.my_rank ?? null}
            isSmartPlace={
              // 네이버 플레이스 URL이 존재 = 후보 선택됨 = 스마트플레이스 등록 확인
              !!(result.place_match?.naver_place_url
              || result.smart_place_check?.is_smart_place
              || (naver as { is_smart_place?: boolean } | null)?.is_smart_place
              || form.is_smart_place)
            }
            naverCompetitors={
              (naver as { naver_competitors?: Array<{ rank: number; name: string; address?: string }> } | null)?.naver_competitors
            }
            hasIntro={result.smart_place_check?.has_intro ?? hasIntro}
            hasRecentPost={result.smart_place_check?.has_recent_post ?? hasRecentPost}
            hasFaq={result.smart_place_check?.has_faq ?? hasFaq}
            photoCount={(result.smart_place_check as { photo_count?: number } | null | undefined)?.photo_count}
            visitorReviewCount={(result.smart_place_check as { visitor_review_count?: number } | null | undefined)?.visitor_review_count}
            avgRating={(result.smart_place_check as { avg_rating?: number } | null | undefined)?.avg_rating}
            briefingCategory={briefingCategory}
            inBriefing={inBriefing}
            blogCount={blogCount}
            topCompetitorName={(naver as { top_competitor_name?: string | null } | null)?.top_competitor_name}
            topCompetitorBlogCount={(naver as { top_competitor_blog_count?: number } | null)?.top_competitor_blog_count}
            keywordRanks={(result as { keyword_ranks?: Array<{ query: string; rank: number | null; exposed: boolean }> }).keyword_ranks}
            keywordBlogComparison={(result as { keyword_blog_comparison?: Array<{ keyword: string; my_count: number; competitor_name: string; competitor_count: number }> }).keyword_blog_comparison}
          />
        )}

        {/* ── 1-c. 네이버 현황 직후 인라인 CTA (전환 최적 순간) ── */}
        {!isLoggedIn && (
          <div className="rounded-xl border border-blue-300 bg-blue-600 px-4 py-4 mb-4 shadow-md">
            <p className="text-base font-bold text-white leading-snug break-keep mb-1">
              네이버 순위가 오르면 바로 알려드립니다
            </p>
            <p className="text-sm text-blue-200 leading-snug break-keep mb-3">
              소개글 개선 후 네이버 순위가 올랐는지 — 매주 자동으로 확인하고 카톡으로 알려드립니다. 경쟁 가게와 비교도 제공합니다
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Link
                href="/signup"
                onClick={onSaveTrialData}
                className="inline-block bg-white text-blue-700 font-black text-sm px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors shadow whitespace-nowrap"
              >
                매주 자동 추적 시작 — 첫 달 {FIRST_MONTH_DISCOUNT_PRICES.basic.toLocaleString()}원
              </Link>
              <span className="text-sm text-blue-300">이후 월 {PLAN_PRICES.basic.toLocaleString()}원 · 언제든 해지</span>
            </div>
          </div>
        )}

        {/* ── 2. 핵심 실측 상세 (AI 스캔 결과) ──────────────────── */}
        <ScanConclusionCard
          businessName={form.business_name || "내 가게"}
          chatgptMentioned={chatgptMentioned}
          chatgptSampleSize={chatgptSampleSize}
          chatgptExposureFreq={chatgptResult?.exposure_freq}
          geminiExposureFreq={geminiExposureFreq}
          smartPlaceCheck={result.smart_place_check ?? null}
          missingKws={effectiveMissingKws}
          inBriefing={inBriefing}
          briefingCategory={briefingCategory}
          chatgptQueries={chatgptDisplayQueries}
          naverMyRank={naver?.my_rank ?? null}
          kakaoRank={(result as { kakao?: { my_rank?: number | null } }).kakao?.my_rank ?? null}
          blogCount={naver?.blog_mentions ?? 0}
          isSmartPlaceConfirmed={!!(
            result.place_match?.naver_place_url ||
            result.smart_place_check?.is_smart_place ||
            (naver as { is_smart_place?: boolean } | null)?.is_smart_place ||
            form.is_smart_place
          )}
        />

        {/* ── 2. 지금 바로 할 핵심 액션 ──────────────────────────── */}
        <div id="today-action" />
        <TodayOneAction
          key={effectiveMissingKws[0] ?? "no-kw"}
          isSmartPlace={isSmartPlace}
          missingKws={effectiveMissingKws}
          hasFaq={hasFaq}
          inBriefing={inBriefing}
          faqText={effectiveFaqText}
          selectedTags={selectedTags}
          categoryLabel={categoryLabel}
          userGroup={userGroupValue}
          category={selectedCategory}
          isLoggedIn={isLoggedIn}
          onDismissKw={(kw) => setDismissedKws((prev) => [...prev, kw])}
        />

        {/* ── 구독 유도 + 전환 CTA ── */}
        {!isLoggedIn && (
          <LockedScoreCard
            score={score}
            track1={track1}
            track2={track2}
            userGroup={userGroupValue}
            breakdown={breakdown}
          />
        )}
        <SubscriptionValueCompare isLoggedIn={isLoggedIn} onSave={onSaveTrialData} />

        {/* ── 개선 효과 연결 브리지 (페이지 하단) ── */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-5 mb-4">
          <p className="text-base font-bold text-blue-700 mb-1">네이버 최적화 → 검색 상위 노출 → AI 추천까지</p>
          <p className="text-sm text-slate-600 leading-relaxed mb-4 break-keep">
            <strong className="text-slate-800">네이버 블로그·플레이스 최적화</strong>는 네이버 검색 상위 노출의 핵심입니다.
            ChatGPT·Gemini도 네이버 콘텐츠를 학습 데이터로 사용하기 때문에, 네이버에서 잘 보이는 가게가 AI 검색에도 함께 노출됩니다.
          </p>
          <div className="space-y-2 text-sm bg-white rounded-xl px-4 py-3 border border-blue-100">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-black">1</span>
              <div>
                <p className="font-semibold text-slate-800">스마트플레이스 소개글·키워드·소식·리뷰 개선</p>
                <p className="text-slate-500 text-sm">개선 직후 ~ 2~4주 내 네이버에 반영</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-black">2</span>
              <div>
                <p className="font-bold text-green-800">네이버 지역 검색 상위권 노출 가능</p>
                <p className="text-slate-500 text-sm">네이버가 내 가게를 관련성 높은 가게로 평가 → 검색 결과 상위에 노출</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black">3</span>
              <div>
                <p className="font-bold text-blue-800 break-keep">
                  {briefingCategory === "active"
                    ? "네이버 AI 브리핑 + ChatGPT·Gemini 동시 노출"
                    : briefingCategory === "likely"
                    ? "네이버 AI탭 + ChatGPT·Gemini 노출 향상"
                    : "네이버 AI탭 + ChatGPT·Gemini 추천 가능성 향상"}
                </p>
                <p className="text-slate-500 text-sm">
                  {briefingCategory === "active"
                    ? "네이버 AI 브리핑 2~4주 내 / ChatGPT·Gemini 수개월 내 반영 기대"
                    : "네이버 AI탭 2~4주 내 / ChatGPT·Gemini 수개월~1년 내 반영"}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-100 space-y-1.5">
            <p className="text-sm text-slate-600 leading-relaxed break-keep font-medium">
              📅 채널별 반영 예상 기간
            </p>
            <p className="text-sm text-slate-500 leading-relaxed break-keep">
              · 스마트플레이스·네이버 검색: <strong className="text-slate-700">즉시~2주</strong>
            </p>
            <p className="text-sm text-slate-500 leading-relaxed break-keep">
              · 네이버 AI 브리핑·AI탭: 개선 후 <strong className="text-slate-700">2~4주</strong> 내 반영 기대
            </p>
            <p className="text-sm text-slate-500 leading-relaxed break-keep">
              · ChatGPT·Gemini: 학습 데이터 반영까지 <strong className="text-slate-700">수개월~1년</strong> — 네이버 최적화로 가속 가능
            </p>
            <p className="text-sm text-blue-600 font-medium leading-relaxed break-keep mt-1">
              → 구독하면 이 변화를 매주 자동 추적하고 경쟁사와 비교합니다
            </p>
          </div>
        </div>

        {/* ── 15. 공유 버튼 ──────────────────────────────────────── */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5 mb-4">
          <p className="text-sm md:text-base font-bold text-slate-800 mb-1 leading-snug break-keep">
            같은 동네 사장님께도 알려주세요
          </p>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed break-keep">
            결과 카드를 공유해 친구 가게도 무료 진단받게 하세요
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <KakaoShareButton
              score={result.score?.unified_score ?? result.score?.total_score ?? 0}
              businessName={form.business_name || "내 가게"}
              category={categoryLabel}
              region={form.region || ""}
              trialId={result.trial_id}
              benchmarkAvg={apiBenchmark?.avg_score}
            />
            <TextShareButton
              score={score}
              category={selectedCategory}
              topMissingKeywords={result.top_missing_keywords}
            />
          </div>
        </div>

        {/* ── 16. 재진단 버튼 ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          {!isLoggedIn && (
            <Link
              href="/signup"
              onClick={() => { onSaveTrialData(); handleSignupCTAClick(userGroupValue); }}
              className="flex-1 text-center bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm md:text-base"
            >
              {getSignupCTALabel(userGroupValue)}
            </Link>
          )}
          <button
            onClick={onReset}
            className="flex-1 border border-slate-300 text-slate-500 font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors text-sm"
          >
            다시 진단하기
          </button>
        </div>
      </div>
    </>
  );
}

// ── 체험 스캔 기준 + 측정 시점 통합 박스 ─────────────────────────────
function MergedScanInfoBox({ chatgptSampleSize }: { chatgptSampleSize: number }) {
  const now = new Date().toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="bg-slate-700 rounded-xl px-4 py-4 mb-4">
      <div className="flex items-start gap-3 mb-3">
        <Info className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-base text-white font-bold leading-snug mb-1.5">
            이번 체험 스캔 기준
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            네이버 스마트플레이스 자동 점검 + ChatGPT <strong className="text-white font-semibold">{chatgptSampleSize}회 질의</strong>로 측정한 결과입니다. Gemini는 Basic 구독 시 측정됩니다.
          </p>
        </div>
      </div>
      <div className="bg-slate-600 rounded-lg px-3 py-2 mb-3">
        <p className="text-sm text-slate-300 leading-relaxed">
          <span className="text-white font-semibold">Basic 구독</span>에서는 Gemini·ChatGPT 각{" "}
          <span className="text-white font-semibold">50회씩(총 100회)</span> + 네이버 스마트플레이스 주기 측정. Pro 이상에서 Google AI Overview 추가 측정합니다.
        </p>
      </div>
      <div className="border-t border-slate-500 pt-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        <p className="text-sm text-slate-400">
          측정 시점: <span className="text-slate-300">{now}</span>
        </p>
        <p className="text-sm text-slate-400 sm:before:content-['·'] sm:before:mr-3">
          Basic 가입 시 → 매주 자동 측정 + 점수 변화 추적
        </p>
      </div>
    </div>
  );
}

// ── 업종 AI 브리핑 배지 ────────────────────────────────────────────────
function BriefingCategoryBadge({
  category,
}: {
  category: "active" | "likely" | "inactive";
}) {
  if (category === "active") {
    return (
      <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
        <p className="text-sm font-semibold text-green-800">
          네이버 AI 브리핑 + AI탭 + ChatGPT·Gemini·Google AI — 5채널 모두 노출 가능 업종입니다
        </p>
      </div>
    );
  }
  if (category === "likely") {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 mb-3 flex items-start gap-2">
        <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">
            AI탭 + ChatGPT·Gemini·Google AI — 4채널 노출이 가능합니다
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            네이버 AI 브리핑은 현재 공식 대상이 아닙니다 (확대 검토 중)
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-blue-50 border border-blue-300 rounded-xl px-4 py-2.5 mb-3 flex items-start gap-2">
      <Globe className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-blue-800">
          AI탭 + ChatGPT·Gemini·Google AI — 4채널 노출이 가능합니다
        </p>
        <p className="text-sm text-blue-700 mt-0.5">
          네이버 AI 브리핑 대상 업종이 아닙니다
        </p>
      </div>
    </div>
  );
}

// ── 점수 산식 투명 박스 ────────────────────────────────────────────────
interface BreakdownItem {
  label: string;
  weight: number;
  value: number | undefined;
  trialLimited?: boolean;
  trialNote?: string;
}

function ScoreBreakdownBox({
  breakdownItems,
  scoreInterpretation,
  unifiedScore,
}: {
  breakdownItems: BreakdownItem[];
  scoreInterpretation: { text: string; color: string; bg: string };
  unifiedScore: number;
}) {
  const hasAnyValue = breakdownItems.some((item) => item.value !== undefined);
  if (!hasAnyValue) return null;

  const ScoreIcon =
    unifiedScore >= 60 ? CheckCircle2 : unifiedScore >= 40 ? AlertTriangle : XCircle;
  const scoreIconColor =
    unifiedScore >= 60
      ? "text-green-600"
      : unifiedScore >= 40
        ? "text-amber-500"
        : "text-amber-600";

  return (
    <div id="score-breakdown" className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 mb-4 shadow-sm">
      {/* 점수 의미 해석 */}
      <div className={`rounded-xl px-3 py-2 mb-4 border ${scoreInterpretation.bg}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${scoreInterpretation.color}`}>
          <ScoreIcon className={`w-4 h-4 shrink-0 ${scoreIconColor}`} />
          {scoreInterpretation.text}
        </div>
      </div>

      <p className="text-sm font-bold text-gray-800 mb-0.5">
        네이버 트랙 내 항목 비중
      </p>
      <p className="text-sm text-slate-400 mb-3">
        네이버 검색 준비도 점수 내 기여 비중 (업종별 네이버/글로벌 비율 적용 전)
      </p>
      <div className="space-y-3">
        {breakdownItems.map((item) => {
          const val = item.value ?? 0;
          const isUnmeasured = item.trialLimited && val === 0;
          const barColor =
            val >= 50 ? "bg-blue-500" : val >= 30 ? "bg-amber-400" : "bg-amber-300";
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 font-medium">
                  {item.label}
                  <span className="ml-1.5 text-slate-400 font-normal">({item.weight}%)</span>
                </span>
                <span
                  className={`text-sm font-bold ${
                    isUnmeasured
                      ? "text-slate-400"
                      : item.value === undefined
                        ? "text-slate-400"
                        : val >= 65
                          ? "text-blue-700"
                          : val >= 40
                            ? "text-amber-700"
                            : "text-red-600"
                  }`}
                >
                  {isUnmeasured
                    ? "미측정"
                    : item.value === undefined
                      ? "확인 필요"
                      : val >= 65
                        ? "양호"
                        : val >= 40
                          ? "보완 필요"
                          : "주의"}
                </span>
              </div>
              {isUnmeasured ? (
                <div className="w-full bg-slate-100 rounded-full h-2 flex items-center">
                  <div className="h-2 w-full rounded-full bg-slate-200" />
                </div>
              ) : (
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${barColor}`}
                    style={{ width: `${item.value === undefined ? 0 : Math.min(100, Math.round(val))}%` }}
                  />
                </div>
              )}
              {isUnmeasured && item.trialNote && (
                <p className="text-sm text-slate-500 mt-0.5">{item.trialNote}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-1.5 mt-3">
        <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-500 leading-relaxed">
          AEOlab 자체 측정값 · 네이버 공식 노출 지표 아님 · 측정 시점·질의 구성에 따라 결과가 달라질 수 있습니다
        </p>
      </div>
    </div>
  );
}


// ── 네이버 AI 브리핑 결과 카드 ────────────────────────────────────────
function NaverBriefingResultCard({
  businessName,
  inBriefing,
  isLikely,
  hasFaq,
  hasIntro,
  isSmartPlace,
}: {
  businessName: string;
  inBriefing: boolean | null;
  isLikely?: boolean;
  hasFaq?: boolean;
  hasIntro?: boolean;
  isSmartPlace?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm mb-4 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100" style={{ background: "rgba(3,199,90,0.08)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "#03c75a" }}>
            <span className="text-white text-sm font-bold leading-none">N</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">네이버 AI 브리핑 검색 결과</span>
        </div>
        {isLikely && (
          <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">확대 검토 중</span>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* 결론 */}
        {inBriefing === null ? (
          !isLikely ? (
            /* ACTIVE 업종 — 전환 유도 UI */
            <div className="space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                음식점·카페는 <strong className="text-slate-900">네이버 AI 브리핑 자동 노출 확인 대상</strong>입니다.
                체험 스캔은 ChatGPT 측정 중심으로 진행되며, 네이버 AI 브리핑 실측 확인은 정식 스캔에서 제공합니다.
              </p>
              {/* 잠금된 결과 미리보기 */}
              <div className="relative rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 blur-sm select-none pointer-events-none" aria-hidden="true">
                  <p className="text-base font-semibold text-gray-800 mb-1">
                    &ldquo;{businessName}&rdquo;이 이번 네이버 검색에서 AI 브리핑에 ···
                  </p>
                  <p className="text-sm text-gray-500">주요 원인 분석 · 개선 액션 3가지</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm font-semibold">정식 스캔에서 확인 가능</span>
                  </div>
                </div>
              </div>
              {/* CTA */}
              <a
                href="/pricing"
                className="flex items-center justify-center gap-1.5 w-full text-center font-semibold text-sm px-4 py-3 rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                내 가게 AI 브리핑 노출 확인하기 → Basic 시작 (첫 달 4,950원)
              </a>
            </div>
          ) : (
            /* LIKELY 업종 — 확대 예정 안내 */
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-amber-800 mb-1">AI 브리핑 업종 확대 검토 중</p>
              <p className="text-sm text-amber-700 leading-relaxed">
                현재 네이버 AI 브리핑 공식 대상이 아닙니다. 업종 확대는 검토 중이며,
                AI탭(베타 확대 중)은 지금도 가능합니다. 정식 스캔에서 노출 여부를 모니터링합니다.
              </p>
            </div>
          )
        ) : (
          <p className="text-base font-semibold leading-snug text-gray-800">
            &ldquo;{businessName}&rdquo;이 이번 네이버 검색에서{" "}
            {inBriefing === true ? (
              <span className="text-green-700">AI 브리핑에 노출됐습니다.</span>
            ) : (
              <span className="text-slate-700">AI 브리핑에 아직 노출되지 않았습니다.</span>
            )}
          </p>
        )}

        {/* 노출 중 */}
        {inBriefing === true && (
          <div className="border-l-2 border-green-400 pl-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              이미 네이버 AI 브리핑에 가게가 인용되고 있습니다. 경쟁 가게보다 더 자주 노출되려면
              리뷰 키워드 다양성을 높이고 소식을 주기적으로 업로드하세요.
            </p>
          </div>
        )}

        {/* 미노출 — 원인 (실측 데이터 기반 분기) */}
        {inBriefing === false && (() => {
          const confirmedReasons: string[] = [];
          const isSpConfirmed = isSmartPlace !== undefined;
          const isIntroConfirmed = hasIntro !== undefined;
          const isFaqConfirmed = hasFaq !== undefined;

          if (isSpConfirmed && !isSmartPlace) confirmedReasons.push("스마트플레이스 미확인 — 미등록이거나 스캔에서 찾지 못했습니다. 플레이스 등록 및 소개글 완성도를 점검하세요");
          if (isIntroConfirmed && !hasIntro) confirmedReasons.push("소개글 미작성 — AI가 인용할 텍스트가 없습니다 (이번 스캔에서 확인됨)");
          else if (isFaqConfirmed && !hasFaq) confirmedReasons.push("소개글에 Q&A 섹션 없음 — 구조화된 정보 부족 (이번 스캔에서 확인됨)");

          const hasConfirmed = confirmedReasons.length > 0;

          return (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1.5">주요 원인</p>
              <ul className="space-y-1.5">
                {confirmedReasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-gray-400 shrink-0 mt-px">•</span>
                    {reason}
                  </li>
                ))}
                {!hasConfirmed && (
                  <li className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gray-400 shrink-0 mt-px">•</span>
                    리뷰 키워드 다양성 부족 — 업종 대표 키워드가 리뷰에 충분히 쌓이지 않음
                  </li>
                )}
                {!hasConfirmed && (
                  <li className="flex items-start gap-2 text-sm text-gray-500">
                    <span className="text-gray-400 shrink-0 mt-px">•</span>
                    정확한 원인은 구독 후 상세 분석에서 확인 가능합니다
                  </li>
                )}
              </ul>
            </div>
          );
        })()}

        {/* 미노출 — 지금 할 일 (실측 데이터 기반 분기) */}
        {inBriefing === false && (() => {
          const actions: string[] = [];
          if (isSmartPlace !== undefined && !isSmartPlace) actions.push("스마트플레이스 등록 확인 — 미등록이면 등록, 이미 등록됐다면 소개글·사진 완성도 점검");
          if ((hasIntro !== undefined && !hasIntro) || (hasFaq !== undefined && !hasFaq)) actions.push("소개글 끝에 Q&A 3개 추가 — \"가격은?\" \"예약은?\" \"주차는?\"");
          if (actions.length === 0) {
            actions.push("소개글 끝에 Q&A 3개 추가 — \"가격은?\" \"예약은?\" \"주차는?\"");
            actions.push("2주에 1회 소식 업로드로 최신성 점수 유지");
          }
          return (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1.5">지금 할 일</p>
              <ol className="space-y-1.5">
                {actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gray-500 shrink-0 font-semibold mt-px">{i + 1}.</span>
                    {action}
                  </li>
                ))}
              </ol>
            </div>
          );
        })()}

      </div>

      {/* 면책 */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-sm text-gray-400 leading-relaxed">
          네이버 AI 브리핑은 검색어·시점·기기·로그인 상태에 따라 달라질 수 있습니다.
        </p>
      </div>
    </div>
  );
}

// ── ChatGPT 검색 결과 카드 (GPT 답변 스타일 — 결론→원인→액션) ──────────
function ChatGPTResultCard({
  businessName,
  queries,
  mentioned,
  excerpt,
  sampleSize,
  hasFaq,
  hasIntro,
  isSmartPlace,
  missingKws,
}: {
  businessName: string;
  queries: string[];
  mentioned: boolean;
  excerpt?: string;
  sampleSize: number;
  hasFaq?: boolean;
  hasIntro?: boolean;
  isSmartPlace?: boolean;
  missingKws?: string[];
}) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm mb-4 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold leading-none">G</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">ChatGPT 검색 결과</span>
        </div>
        <span className="text-sm text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {sampleSize}회 질의 기준
        </span>
      </div>

      {/* 본문 */}
      <div className="px-4 py-4 space-y-3">
        {/* 질의 목록 */}
        <div>
          <p className="text-sm text-gray-400 mb-1.5 leading-snug">
            실제 손님이 AI에게 묻는 방식으로 {sampleSize}회 테스트했습니다
            <span className="ml-1 text-slate-400">(정식 스캔은 50회 — 표본이 많을수록 정확도 높아짐)</span>
          </p>
          <ul className="space-y-0.5 mb-2">
            {queries.map((q, i) => (
              <li key={i} className="text-sm font-medium text-gray-700">
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-400 leading-snug">
            손님은 가게 이름을 모른 채 업종·지역 키워드로 AI에 묻습니다.
            위 질의에 &ldquo;{businessName}&rdquo;이 추천됐는지 확인한 결과입니다.
          </p>
        </div>

        {/* 결론 */}
        <p className="text-base font-semibold leading-snug text-gray-800">
          &ldquo;{businessName}&rdquo;는 이번 {sampleSize}회 테스트에서 추천 목록에{" "}
          {mentioned ? (
            <span className="text-green-700">등장했습니다.</span>
          ) : (
            <span className="text-slate-700">아직 등장하지 않았습니다.</span>
          )}
        </p>

        {/* 포함된 경우: 발췌 */}
        {mentioned && excerpt && (
          <div className="border-l-2 border-green-400 pl-3">
            <p className="text-sm text-gray-600 italic leading-relaxed">
              &ldquo;{excerpt.length > 150 ? excerpt.slice(0, 150) + "…" : excerpt}&rdquo;
            </p>
          </div>
        )}

        {/* 미포함: 원인 (실측 데이터 기반 분기) */}
        {!mentioned && (() => {
          const diagnosedReasons: string[] = [];
          const isSpConfirmed = isSmartPlace !== undefined;
          const isIntroConfirmed = hasIntro !== undefined;
          const isFaqConfirmed = hasFaq !== undefined;

          if (isSpConfirmed && !isSmartPlace) diagnosedReasons.push("스마트플레이스 미확인 — 미등록이거나 스캔에서 찾지 못했습니다. 플레이스 등록 및 소개글 완성도를 점검하세요");
          if (isIntroConfirmed && !hasIntro) diagnosedReasons.push("소개글 미작성 — AI가 인용할 텍스트가 없습니다 (이번 스캔에서 확인됨)");
          else if (isFaqConfirmed && !hasFaq) diagnosedReasons.push("소개글에 Q&A 섹션 없음 — 구조화된 정보 부족 (이번 스캔에서 확인됨)");
          if (missingKws && missingKws.length > 0) diagnosedReasons.push(`경쟁 가게가 쓰는 키워드 '${missingKws.slice(0, 2).join("', '")}' 등 ${missingKws.length}개가 소개글에 없습니다`);

          const hasConfirmed = diagnosedReasons.length > 0;

          return (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1.5">원인</p>
              <ul className="space-y-1.5">
                {diagnosedReasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-gray-400 shrink-0 mt-px">•</span>
                    {reason}
                  </li>
                ))}
                {!hasConfirmed && (
                  <>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-gray-400 shrink-0 mt-px">•</span>
                      소개글·리뷰 키워드 데이터가 아직 AI 학습에 충분히 반영되지 않았을 수 있습니다
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-500">
                      <span className="text-gray-400 shrink-0 mt-px">•</span>
                      정확한 원인은 구독 후 상세 분석에서 확인 가능합니다
                    </li>
                  </>
                )}
              </ul>
            </div>
          );
        })()}

        {/* 미포함: 지금 할 일 (실측 데이터 기반 분기) */}
        {!mentioned && (() => {
          const actions: string[] = [];
          if (isSmartPlace !== undefined && !isSmartPlace) actions.push("스마트플레이스 등록 확인 — 미등록이면 등록, 이미 등록됐다면 소개글·사진 완성도 점검");
          if ((hasIntro !== undefined && !hasIntro) || (hasFaq !== undefined && !hasFaq)) actions.push("소개글 끝에 Q&A 3개 추가 — \"가격은?\" \"예약은?\" \"주차는?\"");
          if (missingKws && missingKws.length > 0) actions.push(`'${missingKws[0]}' 키워드를 소개글·리뷰에 추가하기`);
          if (actions.length === 0) {
            actions.push("소개글 끝에 Q&A 3개 추가 — \"가격은?\" \"예약은?\" \"주차는?\"");
            actions.push("아래 개선 가이드에서 키워드별 대응 방법 확인");
          }
          return (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1.5">지금 할 일</p>
              <ol className="space-y-1.5">
                {actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gray-500 shrink-0 font-semibold mt-px">{i + 1}.</span>
                    {action}
                  </li>
                ))}
              </ol>
            </div>
          );
        })()}
      </div>

      {/* 면책 */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-sm text-gray-400 leading-relaxed">
          ChatGPT 측정은 AI 학습 데이터 기반입니다. 실제 ChatGPT 앱의 검색 결과와 다를 수 있으며, 단기 콘텐츠 변경으로 점수가 즉시 변동되지 않습니다.
        </p>
      </div>
    </div>
  );
}

// ── 다음 측정일 안내 (경량 버전 — SubscriptionValueCompare 바로 위) ──
function NextScanDateNote({
  nextScanDate,
  isLoggedIn,
}: {
  nextScanDate: string;
  isLoggedIn: boolean;
}) {
  if (isLoggedIn) return null;
  return (
    <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
      <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
      <p className="text-sm text-slate-600 leading-snug">
        지금 가입하면 다음 자동 측정:{" "}
        <span className="font-bold text-slate-800">{nextScanDate}</span>
        <span className="ml-1.5 text-slate-400">· 매주 변화 감지 + 카카오 알림</span>
      </p>
    </div>
  );
}

// ── 헤더 내 업종 배지 칩 (인라인용) ──────────────────────────────────
function BriefingBadgeChip({
  category,
}: {
  category: "active" | "likely" | "inactive";
}) {
  if (category === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-green-700 bg-white rounded-full px-3 py-1 shadow-sm whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        AI 브리핑·AI탭 5채널 대상
      </span>
    );
  }
  if (category === "likely") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-3 py-1 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        네이버 AI탭·ChatGPT·Gemini 4채널
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 bg-slate-100 border border-slate-300 rounded-full px-3 py-1 whitespace-nowrap">
      <Globe className="w-3.5 h-3.5 shrink-0" />
      AI탭·ChatGPT·Gemini 4채널
    </span>
  );
}

// ── 즉시 파악 현황 요약 바 ────────────────────────────────────────────
function ScanStatusBar({
  chatgptMentioned, chatgptExposureFreq, chatgptSampleSize,
  geminiExposureFreq, inBriefing, briefingCategory, smartPlaceCheck,
}: {
  chatgptMentioned: boolean | undefined;
  chatgptExposureFreq?: number;
  chatgptSampleSize: number;
  geminiExposureFreq?: number;
  inBriefing: boolean | null;
  briefingCategory: "active" | "likely" | "inactive";
  smartPlaceCheck: TrialSmartPlaceCheck | null | undefined;
}) {
  const chatgptOk = chatgptExposureFreq !== undefined ? chatgptExposureFreq > 0 : chatgptMentioned === true;
  const geminiOk = (geminiExposureFreq ?? 0) > 0;
  const briefingOk = briefingCategory === "active" ? inBriefing === true : null;
  const spOk = smartPlaceCheck && !smartPlaceCheck.error
    ? (smartPlaceCheck.is_smart_place && smartPlaceCheck.has_intro)
    : null;

  type ItemStatus = "ok" | "warn" | "na" | "unknown";
  const items: { label: string; status: ItemStatus; detail: string }[] = [
    {
      label: "ChatGPT",
      status: chatgptMentioned === undefined ? "unknown" : chatgptOk ? "ok" : "warn",
      detail: chatgptOk ? "노출 확인" : "미노출",
    },
    {
      label: "Gemini",
      status: geminiExposureFreq === undefined ? "unknown" : geminiOk ? "ok" : "warn",
      detail: geminiExposureFreq === undefined ? "미측정" : geminiOk ? `${geminiExposureFreq}/${10}회 노출` : "미노출",
    },
    {
      label: "네이버 AI브리핑",
      status: briefingOk === null ? "na" : briefingOk ? "ok" : "warn",
      detail: briefingOk === null ? "비대상 업종" : briefingOk ? "노출 중" : "미노출",
    },
    {
      label: "스마트플레이스",
      status: spOk === null ? "unknown" : spOk ? "ok" : "warn",
      detail: spOk === null ? "확인 불가" : spOk ? "기본 완료" : "보완 필요",
    },
  ];

  const statusStyle: Record<ItemStatus, { bg: string; text: string; dot: string }> = {
    ok:      { bg: "bg-green-50 border-green-200",  text: "text-green-700",  dot: "bg-green-500" },
    warn:    { bg: "bg-amber-50 border-amber-200",   text: "text-amber-700",  dot: "bg-amber-400" },
    na:      { bg: "bg-slate-50 border-slate-200",   text: "text-slate-400",  dot: "bg-slate-300" },
    unknown: { bg: "bg-slate-50 border-slate-200",   text: "text-slate-500",  dot: "bg-slate-300" },
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      {items.map((item) => {
        const s = statusStyle[item.status];
        return (
          <div key={item.label} className={`rounded-xl border px-3 py-3 ${s.bg}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
              <span className="text-sm font-semibold text-slate-600">{item.label}</span>
            </div>
            <p className={`text-base font-black leading-tight ${s.text}`}>{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Sticky 하단 배너 ──────────────────────────────────────────────────
function StickySignupBanner({
  isLoggedIn,
  onSave,
}: {
  isLoggedIn: boolean;
  onSave: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (
        localStorage.getItem("aeolab_trial_banner_dismissed") ===
        new Date().toDateString()
      ) {
        setDismissed(true);
      }
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }, []);

  if (isLoggedIn || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(
        "aeolab_trial_banner_dismissed",
        new Date().toDateString(),
      );
    } catch {
      // 무시
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white px-4 pt-4 pb-4 z-50 shadow-2xl"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm md:text-base font-semibold leading-snug">
            7일 후 AI가 내 가게를 인식했는지 자동으로 확인해 드립니다
          </p>
          <p className="text-sm md:text-base text-blue-200 mt-0.5">
            <span className="text-emerald-300 font-semibold">첫 달 {FIRST_MONTH_DISCOUNT_PRICES.basic.toLocaleString()}원</span>
            {" "}· 이후 월 {PLAN_PRICES.basic.toLocaleString()}원 · 언제든 해지
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/signup"
            onClick={onSave}
            className="bg-white text-blue-700 font-bold text-sm md:text-base px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap shadow-md"
          >
            회원가입하기 (1분)
          </Link>
          <button
            onClick={handleDismiss}
            aria-label="배너 닫기"
            className="text-blue-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-blue-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SmartPlaceCheckCard ───────────────────────────────────────────────
function SmartPlaceCheckCard({ check, userGroup }: { check: TrialSmartPlaceCheck; userGroup?: string }) {
  const isActive = userGroup === "ACTIVE";
  if (check.error) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          <strong className="text-slate-700">스마트플레이스 자동 점검</strong> —
          네이버 서버 응답 지연으로 이번 체험에서는 점검하지 못했습니다.
          정식 스캔에서는 리뷰 수·평점·사진 수·소식 여부를 자동으로 확인합니다.
        </p>
      </div>
    );
  }

  const items = [
    {
      key: "is_smart_place",
      label: "스마트플레이스 가입",
      checked: check.is_smart_place,
      link: check.action_links?.register,
    },
    {
      key: "has_recent_post",
      label: "최근 소식 업데이트",
      checked: check.has_recent_post,
      link: check.action_links?.post,
    },
    {
      key: "has_intro",
      label: "소개글 작성",
      checked: check.has_intro,
      link: check.action_links?.intro,
    },
  ];
  const allOK = check.score_loss === 0;

  const visitorReviewCount = (check as { visitor_review_count?: number }).visitor_review_count ?? 0;
  const avgRating = (check as { avg_rating?: number }).avg_rating ?? 0;

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 md:p-6 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-base md:text-lg font-bold text-gray-900">
          스마트플레이스 등록 상태
        </p>
        <span className="text-sm text-gray-500">자동 확인됨</span>
      </div>

      {/* 실측 지표 — 리뷰 수·별점 (0이면 미감지) */}
      {(visitorReviewCount > 0 || avgRating > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {visitorReviewCount > 0 && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
              visitorReviewCount >= 100 ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"
            }`}>
              <span className={`text-sm font-bold ${visitorReviewCount >= 100 ? "text-emerald-700" : "text-blue-700"}`}>
                방문자 리뷰 {visitorReviewCount.toLocaleString()}건
              </span>
              {visitorReviewCount >= 100 && (
                <span className="text-sm text-emerald-600">— 리뷰 신뢰도 양호</span>
              )}
            </div>
          )}
          {avgRating > 0 && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
              avgRating >= 4.0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
            }`}>
              <span className={`text-sm font-bold ${avgRating >= 4.0 ? "text-emerald-700" : "text-amber-700"}`}>
                별점 {avgRating.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 border ${
              item.checked
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {item.checked ? (
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <X className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <span
                className={`text-sm md:text-base font-semibold break-keep ${
                  item.checked ? "text-emerald-800" : "text-amber-800"
                }`}
              >
                {item.label}
              </span>
            </div>
            {!item.checked && item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                지금 등록하기 →
              </a>
            )}
          </div>
        ))}
      </div>

      {allOK ? (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3">
          <p className="text-sm md:text-base font-bold text-emerald-800 leading-relaxed">
            스마트플레이스 4개 항목 모두 등록 완료
          </p>
          <p className="text-sm text-emerald-700 mt-1 leading-relaxed">
            {isActive
              ? "네이버 AI 브리핑 노출에 필요한 기본 조건은 갖추셨습니다. 이제 키워드와 리뷰로 점수를 더 올려보세요."
              : "네이버 플레이스 기본 조건은 갖추셨습니다. ChatGPT·Gemini 최적화는 구글 비즈니스 프로필과 자체 웹사이트가 핵심 경로입니다."}
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
          <p className="text-sm md:text-base font-bold text-amber-800 leading-relaxed">
            아래 항목이 누락되어 AI 브리핑 노출에 불리한 상태입니다
          </p>
          <p className="text-sm text-amber-700 mt-1 leading-relaxed">
            {isActive
              ? "노란색 항목을 등록하면 네이버 AI 브리핑 노출 점수가 올라갑니다."
              : "노란색 항목을 등록하면 네이버 플레이스 노출이 향상됩니다. ChatGPT·Gemini는 구글 비즈니스 프로필·자체 웹사이트 최적화로 별도 개선하세요."}
          </p>
        </div>
      )}

      {/* AI탭 품질 향상 참고 사항 — 점수 미반영, advisory only */}
      {(check.has_reservation !== undefined || check.photo_count != null) && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-500 mb-2">AI탭 품질 향상 참고 사항 (점수 미반영)</p>
          <div className="flex flex-col gap-2">
            {check.has_reservation !== undefined && (
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
                  check.has_reservation
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                {check.has_reservation ? (
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <span className="text-sm text-gray-700 flex-1 break-keep">
                  {check.has_reservation
                    ? "네이버 예약 연동됨 — AI탭 결과에 예약 버튼 표시됩니다"
                    : "네이버 예약 미연동 — 설정하면 AI탭 결과에 예약 버튼이 표시됩니다"}
                </span>
                {!check.has_reservation && check.action_links?.reservation && (
                  <a
                    href={check.action_links.reservation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap transition-colors"
                  >
                    설정하기 →
                  </a>
                )}
              </div>
            )}
            {check.photo_count != null && (
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
                  (check.photo_count ?? 0) >= 10
                    ? "bg-blue-50 border-blue-200"
                    : "bg-amber-50 border-amber-200"
                }`}
              >
                <Info
                  className={`w-4 h-4 shrink-0 ${
                    (check.photo_count ?? 0) >= 10 ? "text-blue-500" : "text-amber-500"
                  }`}
                />
                <span className="text-sm text-gray-700 break-keep">
                  사진 {check.photo_count ?? 0}장 등록
                  {(check.photo_count ?? 0) < 10
                    ? " — 10장 이상 권장 (AI탭 노출 품질 향상)"
                    : " — 충분한 사진이 등록되어 있습니다"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
