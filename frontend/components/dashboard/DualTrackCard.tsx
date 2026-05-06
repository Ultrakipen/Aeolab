"use client";

import { useState } from "react";
import { Sprout, TrendingUp, Flame, Trophy, MapPin, Globe, Zap, Lightbulb, Info } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { SCORE_LABELS } from "@/lib/score-labels";

void SCORE_LABELS; // 미사용 경고 방지 (향후 dynamic rendering 시 활용)

/**
 * DualTrackCard — 업종별 듀얼트랙 AI 가시성 카드 (v3.0)
 *
 * Track 1: 네이버 AI 브리핑 준비도 (업종별 비중: 40~70%)
 * Track 2: 글로벌 AI 가시성       (업종별 비중: 30~90%)
 * 성장 단계: track1_score 기준 (시작/성장 중/두각/선도)
 */

interface SmartPlaceStatus {
  hasFaq?: boolean;
  hasIntro?: boolean;
  hasRecentPost?: boolean;
  hasWebsite?: boolean;
}

interface DualTrackCardProps {
  track1Score: number;          // 네이버 AI 브리핑 점수 (0~100)
  track2Score: number;          // 글로벌 AI 노출 점수 (0~100)
  naverWeight: number;          // naver 비율 (0.0~1.0)
  globalWeight: number;         // global 비율 (0.0~1.0)
  unifiedScore: number;         // 통합 점수
  category: string;             // 업종 코드
  growthStage: string;          // "survival"|"stability"|"growth"|"dominance"
  growthStageLabel: string;     // "시작 단계"|"성장 중"|"빠른 성장"|"지역 1등"
  isKeywordEstimated?: boolean; // true → 추정값 배지 표시
  topMissingKeywords?: string[]; // 없는 키워드 (최대 3개)
  benchmarkAvg?: number;        // 업종 평균 점수 (비교 표시용)
  smartPlaceStatus?: SmartPlaceStatus; // 실제 스마트플레이스 상태 기반 동적 tip
  hasRegisteredKeywords?: boolean; // 사용자 등록 키워드 여부 (문구 분기용)
  blogContribution?: {          // 블로그 분석 기여 정보
    active: boolean;
    postCount: number;
    keywordCoverage: number;
    analyzedAt?: string;
    blogUrl?: string;
  };
  bizId?: string;
  token?: string;
}

// 업종별 맞춤 메시지 (§7.1 기준)
const CATEGORY_MESSAGES: Record<string, { track1Tip: string; track2Tip: string }> = {
  restaurant: {
    track1Tip: "소개글 하단에 '주차 가능', '단체 예약' Q&A 추가",
    track2Tip: "구글 비즈니스 프로필 등록 + AI 검색 최적화 코드 적용",
  },
  cafe: {
    track1Tip: "소개글 하단에 공간 용도·분위기 Q&A 추가 (노트북 가능, 반려견 동반)",
    track2Tip: "스페셜티·비건 콘텐츠 블로그 발행",
  },
  beauty: {
    track1Tip: "소개글 하단에 당일 예약·전문 시술 Q&A 추가 (탈모 케어, 웨딩 전문)",
    track2Tip: "시술 전후 사진 + 웹사이트 AI 검색 최적화 코드 적용",
  },
  fitness: {
    track1Tip: "소개글 하단에 24시간 운영·PT 전문 Q&A 추가",
    track2Tip: "체형 교정 결과 사례 콘텐츠 발행 (10-20대 타겟)",
  },
  clinic: {
    track1Tip: "소개글 하단에 야간 진료·전문의 직접 진료 Q&A 추가",
    track2Tip: "ChatGPT에서 찾히는 전문성 콘텐츠 발행",
  },
  pet: {
    track1Tip: "소개글 하단에 CCTV 확인·응급 진료 Q&A 추가",
    track2Tip: "수의사 전문성 콘텐츠 발행",
  },
  academy: {
    track1Tip: "소개글 하단에 합격 사례·원어민 강사 Q&A 추가",
    track2Tip: "ChatGPT 노출을 위한 블로그·웹사이트 콘텐츠 발행",
  },
  legal: {
    track1Tip: "소개글 하단에 전문 분야·무료 상담 Q&A 추가",
    track2Tip: "블로그 칼럼 + 승소 사례 발행",
  },
  shopping: {
    track1Tip: "소개글 하단에 배송·AS 중심 Q&A 추가 (당일 배송, 무료 반품)",
    track2Tip: "ChatGPT 쇼핑 추천 AI 검색 코드 적용",
  },
};

const DEFAULT_MESSAGE = {
  track1Tip: "소개글 하단에 Q&A 추가 + 소개글 키워드 보강",
  track2Tip: "구글 비즈니스 프로필 등록 + 웹사이트 AI 검색 코드 적용",
};

const STAGE_COLORS: Record<string, string> = {
  survival:  "bg-red-100 text-red-700 border border-red-200",
  stability: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  growth:    "bg-blue-100 text-blue-700 border border-blue-200",
  dominance: "bg-green-100 text-green-700 border border-green-200",
};

const STAGE_ICONS: Record<string, JSX.Element> = {
  survival:  <Sprout className="w-4 h-4" />,
  stability: <TrendingUp className="w-4 h-4" />,
  growth:    <Flame className="w-4 h-4" />,
  dominance: <Trophy className="w-4 h-4" />,
};

function ScoreBar({
  score,
  weight,
  label,
  sublabel,
  sourceNote,
  color,
  isWeak,
  isVeryLow,
  tip,
  opportunityMsg,
  immediateAction,
}: {
  score: number;
  weight: number;
  label: string | JSX.Element;
  sublabel: string;
  sourceNote?: string;
  color: string;
  isWeak: boolean;
  isVeryLow?: boolean;
  tip: string;
  opportunityMsg?: string;
  immediateAction?: string;
}) {
  const pct = Math.round(weight * 100);
  const barWidth = Math.min(100, Math.max(0, score));

  // 점수대별 색상: 0~29 amber, 30~59 yellow, 60+ green
  const scoreColor = score < 30
    ? "text-amber-600"
    : score < 60
    ? "text-yellow-600"
    : "text-emerald-600";

  // ring 색상: 30 미만은 amber (기회 프레임), 30~59는 yellow
  const ringClass = isVeryLow
    ? "ring-2 ring-amber-400 bg-amber-50"
    : isWeak
    ? "ring-2 ring-yellow-400 bg-yellow-50"
    : "bg-gray-50";

  return (
    <div className={`rounded-xl p-3 md:p-4 ${ringClass}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-gray-800 text-base leading-tight block">{label}</span>
          <span className="text-sm text-gray-500 bg-gray-200 rounded-full px-2 py-0.5 inline-block mt-0.5">
            전체 점수 중 {pct}% 비중
          </span>
        </div>
        <span className={`text-xl md:text-2xl font-bold shrink-0 ${scoreColor}`}>
          {score.toFixed(0)}점
        </span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="text-base text-gray-500 leading-relaxed">{sublabel}</p>
      {sourceNote && (
        <p className="text-sm text-gray-400 mt-1">{sourceNote}</p>
      )}
      {/* 30점 미만: 개선 기회 프레임 메시지 */}
      {isVeryLow && opportunityMsg && (
        <div className="mt-2 flex items-start gap-2 text-sm text-amber-700 font-medium bg-amber-100 rounded-lg px-3 py-2 leading-relaxed">
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <span>{opportunityMsg}</span>
        </div>
      )}
      {/* 30점 이상 약점: 행동 가이드 */}
      {isWeak && !isVeryLow && (
        <div className="mt-2 bg-yellow-100 rounded-lg px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-yellow-800">
            <Zap className="w-4 h-4 shrink-0" />
            지금 할 것
          </div>
          <p className="text-sm text-yellow-700 leading-relaxed pl-6">{tip}</p>
          <p className="text-sm text-yellow-600 pl-6 font-medium">
            1. {immediateAction ?? "스마트플레이스 → 소개글 하단에 Q&A 1개 추가 (5분)"}
          </p>
        </div>
      )}
      {/* 매우 낮을 때도 행동 가이드 추가 표시 */}
      {isVeryLow && (
        <div className="mt-2 bg-amber-100 rounded-lg px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
            <Zap className="w-4 h-4 shrink-0" />
            지금 할 것
          </div>
          <p className="text-sm text-amber-700 leading-relaxed pl-6">{tip}</p>
          <p className="text-sm text-amber-600 pl-6 font-medium">
            1. {immediateAction ?? "스마트플레이스 → 소개글 하단에 Q&A 1개 추가 (5분)"}
          </p>
        </div>
      )}
    </div>
  );
}

function buildTrack1Tip(category: string, sp?: SmartPlaceStatus): string {
  const missing: string[] = [];
  if (!sp?.hasFaq) missing.push("소개글 Q&A 추가");
  if (!sp?.hasIntro) missing.push("소개글 작성");
  if (!sp?.hasRecentPost) missing.push("소식 업데이트");
  if (missing.length > 0) return `스마트플레이스 ${missing.join(" + ")}`;
  // 모두 완료된 경우 — 키워드 개선 안내
  const catMsg = CATEGORY_MESSAGES[category];
  return catMsg ? catMsg.track1Tip : "리뷰 키워드를 보강하여 AI 브리핑 노출을 높이세요";
}

/**
 * smartPlaceStatus 우선순위 기반 즉각 행동 텍스트 (Track1 전용)
 * FAQ 완료 -> 소식 업데이트 -> 소개글 -> 리뷰 답변 순
 */
function getImmediateAction(sp?: SmartPlaceStatus): string {
  if (!sp) return "스마트플레이스 → 소개글 하단에 Q&A 1개 추가 (5분)";
  if (!sp.hasFaq)        return "스마트플레이스 → 소개글 하단에 Q&A 1개 추가 (5분, 즉시 효과)";
  if (!sp.hasRecentPost) return "스마트플레이스 -> 소식 탭 -> 이번 주 메뉴/이벤트 1개 올리기 (3분)";
  if (!sp.hasIntro)      return "스마트플레이스 -> 소개 탭 -> 핵심 키워드 포함 소개글 작성 (10분)";
  return "최근 리뷰 5개에 키워드 포함 답변 달기 (2분/개)";
}

function buildTrack2Tip(category: string, sp?: SmartPlaceStatus): string {
  const missing: string[] = [];
  if (!sp?.hasWebsite) missing.push("웹사이트 등록");
  if (missing.length > 0) return `${missing.join(" + ")} + AI 검색 최적화 코드 적용`;
  const catMsg = CATEGORY_MESSAGES[category];
  return catMsg ? catMsg.track2Tip : "웹사이트에 AI 검색 최적화 코드 적용 + 글로벌 AI 노출 강화";
}

// 성장 단계 진행률 계산
const STAGE_RANGES: Record<string, { min: number; max: number; next: string }> = {
  survival:  { min: 0,  max: 30,  next: "성장 중" },
  stability: { min: 31, max: 60,  next: "빠른 성장" },
  growth:    { min: 61, max: 85,  next: "지역 1등" },
  dominance: { min: 86, max: 100, next: "" },
};

function GrowthProgressBar({ stage, score }: { stage: string; score: number }) {
  const range = STAGE_RANGES[stage] ?? STAGE_RANGES.stability;
  const pct = Math.round(
    Math.min(100, Math.max(0, ((score - range.min) / (range.max - range.min)) * 100))
  );
  const pointsLeft = Math.max(0, range.max + 1 - Math.round(score));

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-500">현재 단계 진행률</span>
        {range.next ? (
          <span className="text-gray-500">다음 단계까지 <span className="font-bold text-indigo-600">+{pointsLeft}점</span></span>
        ) : (
          <span className="text-emerald-600 font-bold">최고 단계 달성!</span>
        )}
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DualTrackCard({
  track1Score,
  track2Score,
  naverWeight,
  globalWeight,
  unifiedScore,
  category,
  growthStage,
  growthStageLabel,
  isKeywordEstimated = false,
  topMissingKeywords = [],
  benchmarkAvg,
  smartPlaceStatus,
  blogContribution,
  hasRegisteredKeywords = false,
  bizId,
  token,
}: DualTrackCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isTrack1Weak = track1Score < 40;
  const isTrack2Weak = track2Score < 40;
  const isTrack1VeryLow = track1Score < 30;
  const isTrack2VeryLow = track2Score < 30;
  const naverPct = Math.round(naverWeight * 100);
  const globalPct = Math.round(globalWeight * 100);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 space-y-3 md:space-y-4">
      {/* 헤더: 통합 점수 + 성장 단계 */}
      <div className="space-y-2">
        {/* 1행: 제목 + 점수 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-bold text-gray-900">AI 검색 노출 현황</h2>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
              네이버 AI 브리핑 + 글로벌 AI (ChatGPT·Gemini 등) 통합
            </p>
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setShowTooltip((v) => !v)}
              onBlur={() => setTimeout(() => setShowTooltip(false), 150)}
              className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              aria-label="점수 계산 방식 보기"
            >
              <Info className="w-3.5 h-3.5 text-gray-500" />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-7 z-10 w-64 bg-gray-900 text-white text-sm rounded-xl p-3 shadow-xl leading-relaxed">
                <p className="font-semibold mb-1">통합 점수 계산 방식</p>
                <p className="text-gray-300">
                  = 네이버 AI 채널 × {naverPct}%<br />
                  + 글로벌 AI 채널 × {globalPct}%
                </p>
                <p className="text-gray-400 mt-1.5 text-sm">업종별 비율이 다릅니다. 소상공인 가게는 네이버 비중이 높습니다.</p>
              </div>
            )}
          </div>
        </div>
        {/* 2행: 상태 배지들 — 전체 폭, 모바일에서 자연스럽게 줄바꿈 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className={`text-sm font-semibold px-2 py-1 rounded-lg ${
            unifiedScore >= 70
              ? "bg-emerald-50 text-emerald-700"
              : unifiedScore >= 50
              ? "bg-amber-50 text-amber-700"
              : "bg-red-50 text-red-700"
          }`}>
            {unifiedScore >= 70
              ? "업종 상위권"
              : unifiedScore >= 50
              ? "업종 중위권 — 개선 여지 있음"
              : "AI 노출 개선 여지 큼"}
          </div>
          {benchmarkAvg && benchmarkAvg > 0 && (
            <div className={`px-2 py-1 rounded-lg text-sm font-semibold ${
              unifiedScore >= benchmarkAvg
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}>
              {unifiedScore >= benchmarkAvg
                ? `▲ 평균보다 ${Math.round(unifiedScore - benchmarkAvg)}점 높음`
                : `▼ 평균보다 ${Math.round(benchmarkAvg - unifiedScore)}점 낮음`}
            </div>
          )}
          <span className={`inline-flex items-center gap-1 text-sm font-semibold rounded-full px-2 py-0.5 ${
            STAGE_COLORS[growthStage] || STAGE_COLORS.stability
          }`}>
            {STAGE_ICONS[growthStage]} {growthStageLabel}
            {isKeywordEstimated && (
              <span className="text-gray-400 font-normal ml-1">(추정)</span>
            )}
          </span>
        </div>
        {/* 3행: 성장 단계 진행률 바 — 전체 폭 */}
        <GrowthProgressBar stage={growthStage} score={track1Score} />
      </div>

      {/* Track 1 — 네이버 AI 브리핑 */}
      <ScoreBar
        score={track1Score}
        weight={naverWeight}
        label={
          <span className="flex items-center gap-1.5 flex-wrap">
            <MapPin className="w-3.5 h-3.5 inline-block" />
            네이버 AI 브리핑 점수
            {isKeywordEstimated && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-2">키워드 추정값</span>
            )}
          </span>
        }
        sublabel="이 점수가 낮으면 네이버 AI가 내 가게를 잘 모릅니다"
        sourceNote="네이버 블로그·리뷰·스마트플레이스 실측 기반"
        color="bg-green-500"
        isWeak={isTrack1Weak}
        isVeryLow={isTrack1VeryLow}
        tip={buildTrack1Tip(category, smartPlaceStatus)}
        opportunityMsg="지금이 올릴 타이밍 — 업종 평균보다 낮을수록 개선 여지가 큽니다"
        immediateAction={getImmediateAction(smartPlaceStatus)}
      />

      {/* Track 2 — 글로벌 AI */}
      <ScoreBar
        score={track2Score}
        weight={globalWeight}
        label={<span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 inline-block" /> 글로벌 AI 노출 점수</span>}
        sublabel="이 점수가 낮으면 ChatGPT·구글 AI에서 내 가게가 안 나옵니다"
        sourceNote="ChatGPT·Gemini 등 각 AI 1회 테스트 기반 추정 점수"
        color="bg-blue-500"
        isWeak={isTrack2Weak}
        isVeryLow={isTrack2VeryLow}
        tip={buildTrack2Tip(category, smartPlaceStatus)}
        opportunityMsg="글로벌 AI에 아직 노출되지 않아 경쟁이 적습니다. 소개글 Q&A 추가로 시작하세요"
      />

      {/* 추정값 안내 — 강조 배너 */}
      {isKeywordEstimated && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
          ⚠️ 키워드 데이터가 부족해 <strong>일부 점수는 업종 평균으로 추정</strong>됩니다.
          리뷰 텍스트를 입력하면 더 정확해집니다.
          <Link href="/guide" className="underline ml-1">가이드에서 입력하기 →</Link>
        </div>
      )}

      {/* 블로그 분석 반영 배지 */}
      {blogContribution?.active && (
        <div className="mt-3 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-700 font-medium">
            블로그 {blogContribution.postCount}개 포스트 분석 반영 · 키워드 커버리지 {Math.round(blogContribution.keywordCoverage)}%
          </span>
          <Link
            href="/blog-analysis?reanalyze=1"
            className="text-blue-500 underline text-sm whitespace-nowrap ml-2"
            onClick={(e) => { e.currentTarget.textContent = "재분석 중..."; }}
          >
            재분석
          </Link>
        </div>
      )}

      {/* 블로그 미등록 + 추정 상태일 때 등록 유도 */}
      {isKeywordEstimated && !blogContribution?.active && (
        <Link
          href="/blog-analysis"
          className="mt-2 block text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors"
        >
          블로그를 등록하면 키워드 점수 정확도가 향상됩니다 →
        </Link>
      )}
    </div>
  );
}
