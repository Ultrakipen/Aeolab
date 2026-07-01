"use client";

import { useState } from "react";
import { Sprout, TrendingUp, Flame, Trophy, MapPin, Globe, Zap, Lightbulb, Info, Target } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { SCORE_LABELS } from "@/lib/score-labels";
import type { SmartPlaceStatus } from "@/app/(dashboard)/dashboard/sections/pageHelpers";

void SCORE_LABELS; // 미사용 경고 방지 (향후 dynamic rendering 시 활용)

/**
 * DualTrackCard — 업종별 듀얼트랙 AI 가시성 카드 (v3.0)
 *
 * Track 1: 네이버 AI 채널 준비도 — 브리핑·AI탭·일반검색·카카오 종합 (업종별 비중: 40~70%)
 * Track 2: 글로벌 AI 가시성       — ChatGPT·Gemini·Google AI (업종별 비중: 30~90%)
 * 성장 단계: track1_score 기준 (시작/성장 중/두각/선도)
 */

interface DualTrackCardProps {
  track1Score: number;
  track2Score: number;
  naverWeight: number;
  globalWeight: number;
  unifiedScore: number;
  category: string;
  growthStage: string;
  growthStageLabel: string;
  isKeywordEstimated?: boolean;
  topMissingKeywords?: string[];
  benchmarkAvg?: number;
  isEstimatedBenchmark?: boolean;
  smartPlaceStatus?: SmartPlaceStatus;
  hasRegisteredKeywords?: boolean;
  blogContribution?: {
    active: boolean;
    postCount: number;
    keywordCoverage: number;
    analyzedAt?: string;
    blogUrl?: string;
  };
  eligibility?: "active" | "likely" | "inactive";
  aiExposureData?: {
    chatgptFreq?: number;
    chatgptSampleSize?: number;
    geminiFreq?: number;
    geminiSampleSize?: number;
  };
  bizId?: string;
  token?: string;
  plan?: string;
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
    track2Tip: "자체 웹사이트·구글 비즈니스 프로필에 전문성 콘텐츠 등록 (ChatGPT·Gemini 참조 소스)",
  },
  pet: {
    track1Tip: "소개글 하단에 CCTV 확인·응급 진료 Q&A 추가",
    track2Tip: "수의사 전문성 콘텐츠 발행",
  },
  academy: {
    track1Tip: "소개글 하단에 합격 사례·원어민 강사 Q&A 추가",
    track2Tip: "ChatGPT·Gemini 노출을 위한 자체 웹사이트·구글 비즈니스 프로필 최적화",
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

// INACTIVE 업종 전용 — 블로그 + 스마트플레이스 중심 팁
const INACTIVE_NAVER_SEO_TIPS: Record<string, string> = {
  medical:    "건강 정보 블로그 주 1~2회 발행 + 스마트플레이스 전문의·진료 과목 소개 업데이트",
  pharmacy:   "약 복용·건강 팁 블로그 발행 + 스마트플레이스 약사 소개·영업시간 업데이트",
  education:  "합격 사례·학습법 블로그 발행 + 스마트플레이스 강사·커리큘럼 소개 업데이트",
  tutoring:   "과목별 학습 팁 블로그 발행 + 스마트플레이스 강사 경력·수업 방식 소개",
  legal:      "법률 칼럼·판례 해설 블로그 발행 + 스마트플레이스 전문 분야·상담 방법 업데이트",
  realestate: "지역 매물 소식·부동산 정보 블로그 발행 + 스마트플레이스 취급 지역·매물 소개",
  interior:   "시공 사례·인테리어 팁 블로그 발행 + 스마트플레이스 포트폴리오 사진 추가",
  auto:       "차량 관리 팁·정비 사례 블로그 발행 + 스마트플레이스 서비스 항목·가격 업데이트",
  cleaning:   "청소 노하우·사례 블로그 발행 + 스마트플레이스 서비스 범위·가격 소개",
  shopping:   "상품 리뷰·사용 후기 블로그 발행 + 스마트플레이스 베스트 상품 사진 업데이트",
  fashion:    "스타일링 팁·신상품 블로그 발행 + 스마트플레이스 신상품 코디 사진 업데이트",
  photo:      "촬영 사례 포트폴리오 블로그 발행 + 스마트플레이스 대표 작품 사진 업데이트",
  video:      "영상 제작 사례 블로그 발행 + 스마트플레이스 포트폴리오·서비스 소개",
  design:     "디자인 사례 포트폴리오 블로그 발행 + 스마트플레이스 작업물 소개 업데이트",
  other:      "업종 관련 정보성 블로그 주 1~2회 발행 + 스마트플레이스 소개글·사진 업데이트",
};

function getScoreStatusLabel(score: number, channelType: 'naver' | 'global' = 'naver'): { text: string; color: string } {
  if (channelType === 'global') {
    if (score < 10) return { text: "미측정 수준",   color: "text-red-600" };
    if (score < 35) return { text: "낮음 (일반적)", color: "text-amber-600" };
    if (score < 60) return { text: "보통",          color: "text-yellow-600" };
    if (score < 80) return { text: "양호",          color: "text-blue-600" };
    return             { text: "우수",              color: "text-emerald-600" };
  }
  if (score < 25) return { text: "주의 필요", color: "text-red-600" };
  if (score < 45) return { text: "미흡",     color: "text-amber-600" };
  if (score < 65) return { text: "보통",     color: "text-yellow-600" };
  if (score < 80) return { text: "양호",     color: "text-blue-600" };
  return             { text: "우수",         color: "text-emerald-600" };
}

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
  channelType = 'naver',
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
  channelType?: 'naver' | 'global';
}) {
  const pct = Math.round(weight * 100);
  const barWidth = Math.min(100, Math.max(0, score));

  // scoreColor — isWeak/isVeryLow ring 로직에서 간접 활용 가능하나 현재 span은 getScoreStatusLabel로 대체
  void (score < 30 ? "text-amber-600" : score < 60 ? "text-yellow-600" : "text-emerald-600");

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
            전체 진단 {pct}% 반영
          </span>
        </div>
        <span className={`text-base md:text-lg font-bold shrink-0 ${getScoreStatusLabel(score, channelType).color}`}>
          {getScoreStatusLabel(score, channelType).text}
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
          <span className="whitespace-pre-line">{opportunityMsg}</span>
        </div>
      )}
      {/* 30점 이상 약점: 행동 가이드 */}
      {isWeak && !isVeryLow && (
        <div className="mt-2 bg-yellow-100 rounded-lg px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-yellow-800">
            <Zap className="w-4 h-4 shrink-0" />
            {channelType === 'global' ? "장기 개선 방향" : "지금 할 것"}
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
            {channelType === 'global' ? "장기 개선 방향" : "지금 할 것"}
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

// 업종별 집중 채널 추천 — naverWeight + 현재 점수 갭 조합
function FocusRecommendation({
  naverWeight,
  track1Score,
  track2Score,
}: {
  naverWeight: number;
  track1Score: number;
  track2Score: number;
}) {
  const naverPct = Math.round(naverWeight * 100);
  const globalPct = 100 - naverPct;

  let msg: string;
  if (naverWeight >= 0.6) {
    if (track1Score < 50)
      msg = `네이버 채널 집중 — 업종 비중 ${naverPct}%이고 지금 바로 노출을 높일 수 있습니다`;
    else if (track1Score >= 70 && track2Score < 50)
      msg = `글로벌 AI도 함께 — 네이버는 양호, ChatGPT·Gemini 노출을 지금 강화하세요`;
    else
      msg = `네이버 채널 우선, 글로벌 AI 병행 — 업종 비중 네이버 ${naverPct}% / 글로벌 ${globalPct}%`;
  } else if (globalPct >= 60) {
    if (track2Score < 50)
      msg = `글로벌 AI 채널 집중 — 업종 비중 ${globalPct}%이고 ChatGPT·Gemini 개선이 핵심입니다`;
    else if (track2Score >= 70 && track1Score < 50)
      msg = `네이버도 함께 — 글로벌 AI는 양호, 네이버 검색 노출을 함께 강화하세요`;
    else
      msg = `글로벌 AI 채널 우선, 네이버 병행 — 업종 비중 글로벌 ${globalPct}% / 네이버 ${naverPct}%`;
  } else {
    if (track1Score < track2Score - 15)
      msg = `네이버 먼저 — 두 채널 균등 비중이지만 현재 네이버 검색 노출이 더 낮습니다`;
    else if (track2Score < track1Score - 15)
      msg = `글로벌 AI 먼저 — 두 채널 균등이지만 현재 ChatGPT·Gemini 인식도가 더 낮습니다`;
    else
      msg = `두 채널 균등 강화 — 네이버 ${naverPct}% / 글로벌 ${globalPct}% 비중으로 함께 개선하세요`;
  }

  return (
    <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5">
      <Target className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-indigo-800 mb-0.5">지금 집중할 채널</p>
        <p className="text-sm text-indigo-700 leading-snug">{msg}</p>
      </div>
    </div>
  );
}

// 성장 단계 진행률 계산
// 백엔드 _GROWTH_THRESHOLDS 와 일치: survival<30 / stability<55 / growth<75 / dominance>=75
const STAGE_RANGES: Record<string, { min: number; max: number; next: string }> = {
  survival:  { min: 0,  max: 29,  next: "성장 준비 중" },
  stability: { min: 30, max: 54,  next: "성장 진행 중" },
  growth:    { min: 55, max: 74,  next: "안정 궤도" },
  dominance: { min: 75, max: 100, next: "" },
};

function GrowthProgressBar({ stage, score }: { stage: string; score: number }) {
  const range = STAGE_RANGES[stage] ?? STAGE_RANGES.stability;
  const pct = Math.round(
    Math.min(100, Math.max(0, ((score - range.min) / (range.max - range.min)) * 100))
  );
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-500">현재 단계 진행률</span>
        {range.next ? (
          <span className="text-gray-500">다음 단계: <span className="font-bold text-indigo-600">{range.next}</span></span>
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
  isEstimatedBenchmark = false,
  smartPlaceStatus,
  blogContribution,
  hasRegisteredKeywords = false,
  eligibility,
  aiExposureData,
  bizId,
  token,
  plan,
}: DualTrackCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isTrack1Weak = track1Score < 40;
  const isTrack2Weak = track2Score < 40;
  const isTrack1VeryLow = track1Score < 30;
  const isTrack2VeryLow = track2Score < 30;
  const naverPct = Math.round(naverWeight * 100);
  const globalPct = Math.round(globalWeight * 100);

  const isActive   = eligibility === "active";
  const isLikely   = eligibility === "likely";
  const isInactive = eligibility === "inactive";

  const track1LabelText = isInactive
    ? "네이버 검색 준비도 (AI탭 포함)"
    : isLikely
    ? "네이버 AI 검색 지수 (AI탭 가능·AI 브리핑 확대 검토 중)"
    : "네이버 AI 노출 지수";

  const track1Sublabel = isInactive
    ? "블로그·스마트플레이스를 꾸준히 관리하면 AI탭·네이버 검색 노출을 개선할 수 있습니다"
    : isLikely
    ? "AI탭은 지금도 가능합니다. 블로그·스마트플레이스 관리로 AI탭 노출을 높이세요"
    : "이 지수가 낮으면 네이버 AI 브리핑·AI탭에서 내 가게를 잘 모릅니다";

  const track1TipFinal = isInactive
    ? (INACTIVE_NAVER_SEO_TIPS[category] ?? INACTIVE_NAVER_SEO_TIPS.other)
    : buildTrack1Tip(category, smartPlaceStatus);

  const track1ImmediateAction = isInactive
    ? "네이버 블로그에 업종 관련 정보 글 1개 발행 (15분)"
    : getImmediateAction(smartPlaceStatus);

  const chatgptRate = (aiExposureData?.chatgptFreq !== undefined && aiExposureData.chatgptSampleSize)
    ? Math.round(aiExposureData.chatgptFreq / aiExposureData.chatgptSampleSize * 100)
    : null;
  const geminiRate = (aiExposureData?.geminiFreq !== undefined && aiExposureData.geminiSampleSize)
    ? Math.round(aiExposureData.geminiFreq / aiExposureData.geminiSampleSize * 100)
    : null;
  const hasAiData = chatgptRate !== null || geminiRate !== null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5 space-y-3 md:space-y-4">
      {/* 헤더: 통합 점수 + 성장 단계 */}
      <div className="space-y-2">
        {/* 1행: 제목 + 점수 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-bold text-gray-900">AI 검색 노출 현황</h2>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
              {isInactive
                ? "네이버 검색 노출 + ChatGPT·Gemini 통합 진단"
                : isLikely
                ? "네이버 검색 + AI 브리핑(확대 예정) + ChatGPT·Gemini 통합 진단"
                : "네이버 AI 브리핑 + ChatGPT·Gemini 통합 진단"}
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
                <p className="font-semibold mb-1">AI 노출 종합 지수 계산 방식</p>
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
              : benchmarkAvg && unifiedScore >= benchmarkAvg
              ? "bg-amber-50 text-amber-700"
              : "bg-red-50 text-red-700"
          }`}>
            {unifiedScore >= 70
              ? "업종 상위권"
              : unifiedScore >= 50
              ? "업종 중위권 — 개선 여지 있음"
              : benchmarkAvg && unifiedScore >= benchmarkAvg
              ? "평균 이상 — 추가 개선 가능"
              : "AI 노출 개선 여지 큼"}
          </div>
          {benchmarkAvg && benchmarkAvg > 0 && !isEstimatedBenchmark && (
            <div className={`px-2 py-1 rounded-lg text-sm font-semibold ${
              unifiedScore >= benchmarkAvg
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}>
              {unifiedScore >= benchmarkAvg
                ? "▲ 업종 평균 이상"
                : "▼ 업종 평균 미만"}
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

      {/* Track 1 */}
      <ScoreBar
        score={track1Score}
        weight={naverWeight}
        label={
          <span className="flex items-center gap-1.5 flex-wrap">
            <MapPin className="w-3.5 h-3.5 inline-block" />
            {track1LabelText}
            {isKeywordEstimated && (
              <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-2">키워드 추정값</span>
            )}
          </span>
        }
        sublabel={track1Sublabel}
        sourceNote={isKeywordEstimated ? "네이버 블로그·리뷰·스마트플레이스 (일부 키워드 추정 포함)" : "네이버 블로그·리뷰·스마트플레이스 실측 기반"}
        color="bg-green-500"
        isWeak={isTrack1Weak}
        isVeryLow={isTrack1VeryLow}
        tip={track1TipFinal}
        opportunityMsg={isInactive
          ? "블로그·스마트플레이스 관리로 지금 바로 개선할 수 있습니다"
          : "지금이 올릴 타이밍 — 업종 평균보다 낮을수록 개선 여지가 큽니다"}
        immediateAction={track1ImmediateAction}
      />

      {/* INACTIVE: 네이버 SEO 검색 노출 개선 안내 (실측 데이터 기반 필터링) */}
      {isInactive && (() => {
        const blogDone = blogContribution?.active && (blogContribution?.postCount ?? 0) >= 2;
        const introDone = smartPlaceStatus?.hasIntro;
        const remainingTips = [
          !blogDone && "블로그 정기 발행 (주 1~2회) → 네이버 검색 결과 상위 노출",
          !introDone && "스마트플레이스 소개글·사진 업데이트 → 플레이스 검색 최적화",
          "리뷰 답글 꾸준히 달기 → 네이버 플레이스 신뢰도 향상",
        ].filter((t): t is string => typeof t === "string");

        const allManaged = blogDone && introDone && track1Score >= 60;

        if (allManaged) {
          return (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 md:p-4">
              <p className="text-sm font-semibold text-green-800 mb-1">✅ 네이버 기본 관리가 잘 되고 있습니다</p>
              <p className="text-sm text-green-700">리뷰 답글을 꾸준히 유지하면서 블로그 키워드 다양화로 다음 단계를 노려보세요.</p>
            </div>
          );
        }

        return (
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 md:p-4">
            <p className="text-sm font-semibold text-green-800 mb-2">📝 네이버 검색 노출 개선 방법</p>
            <div className="space-y-1.5 mb-2">
              {remainingTips.map((tip, i) => (
                <div key={i} className="flex items-start gap-1.5 text-sm text-green-700">
                  <span className="mt-0.5 shrink-0">✓</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-green-600 border-t border-green-100 pt-2">
              네이버 검색 상위노출이 올라갈수록 네이버 AI탭 노출 가능성도 함께 높아집니다
            </p>
          </div>
        );
      })()}

      {/* LIKELY: AI 브리핑 확대 예정 안내 */}
      {isLikely && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 md:p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-1">🔔 네이버 AI 브리핑 확대 예정 업종</p>
          <p className="text-sm text-yellow-700 leading-relaxed">
            지금은 블로그·스마트플레이스 관리로 네이버 검색 노출을 높이세요. 이 개선이 '정보형 AI 브리핑'·AI탭 노출의 기반이 됩니다. '플레이스형' AI 브리핑 업종 확대 시 자동으로 전환됩니다.
          </p>
        </div>
      )}

      {/* Track 2 — 글로벌 AI */}
      <ScoreBar
        score={track2Score}
        weight={globalWeight}
        label={<span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 inline-block" /> 글로벌 AI 인식 현황</span>}
        sublabel="ChatGPT·Gemini가 현재 이 사업장을 인식하는 수준입니다"
        sourceNote={hasAiData ? "ChatGPT·Gemini 실측 샘플링 기반" : "ChatGPT·Gemini 인식도 추정"}
        color="bg-blue-500"
        isWeak={isTrack2Weak}
        isVeryLow={isTrack2VeryLow}
        tip={buildTrack2Tip(category, smartPlaceStatus)}
        opportunityMsg={"Google AI Overview — 구글 비즈니스 프로필 등록으로 수 주 내 개선 가능.\nGemini 앱 — 구글 비즈니스 프로필 기반, 수 주~수개월 소요.\nChatGPT — 블로그·소개글 누적으로 수개월~1년 소요."}
        immediateAction="구글 비즈니스 프로필 등록 (무료) — Google AI Overview·Gemini 개선 가장 빠른 경로"
        channelType="global"
      />
      {/* Track 2 면책 문구 — AI 데이터 유무와 무관하게 항상 표시 */}
      <p className="text-xs text-gray-400 -mt-1 leading-relaxed px-1">
        ChatGPT·Gemini 스캐너 점수는 AI 학습 데이터 기반 — 한국 소상공인 포함률이 낮아 낮은 점수가 일반적, 스캐너 점수 개선 반영 수개월~1년. 단, Google AI Overview(구글 검색 상단 AI 요약)는 구글 비즈니스 프로필 등록 후 수 주 내 개선 시작 가능.
      </p>

      {/* 집중 채널 추천 */}
      <FocusRecommendation
        naverWeight={naverWeight}
        track1Score={track1Score}
        track2Score={track2Score}
      />

      {/* AI 도구별 노출 현황 (실측) */}
      {hasAiData && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 md:p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2.5">🤖 AI 도구별 노출 현황 (실측)</p>
          <p className="text-xs text-blue-600 mb-2.5 -mt-1">업종 키워드로 AI에 직접 질의했을 때 가게명이 언급된 횟수입니다</p>
          <div className="space-y-2.5">
            {chatgptRate !== null && aiExposureData?.chatgptSampleSize ? (
              <div>
                <div className="flex justify-between text-sm text-gray-700 mb-1">
                  <span>ChatGPT</span>
                  <span className="font-semibold">
                    {chatgptRate}%
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      ({aiExposureData.chatgptSampleSize}번 질의 중 {aiExposureData.chatgptFreq}번 가게명 언급)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, chatgptRate)}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex justify-between text-sm text-gray-400">
                <span>ChatGPT</span>
                <span className="text-sm">{plan && plan !== "free" ? "재스캔 시 측정 포함" : "Basic+ 스캔 후 확인"}</span>
              </div>
            )}
            {geminiRate !== null && aiExposureData?.geminiSampleSize ? (
              <div>
                <div className="flex justify-between text-sm text-gray-700 mb-1">
                  <span>Google Gemini</span>
                  <span className="font-semibold">
                    {geminiRate}%
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      ({aiExposureData.geminiSampleSize}번 질의 중 {aiExposureData.geminiFreq}번 가게명 언급)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, geminiRate)}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Google Gemini</span>
                <span className="text-sm">{plan && plan !== "free" ? "재스캔 시 측정 포함" : "Basic+ 스캔 후 확인"}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-2.5 leading-relaxed">
            ChatGPT는 과거 학습 데이터 기반 — 한국 소상공인은 낮은 점수가 일반적이며 단기 변동이 없습니다. Gemini(구글 AI)는 구글 비즈니스 프로필 정보를 반영하므로, 지금 등록하면 2~4주 내 인식이 개선될 수 있습니다.
          </p>
        </div>
      )}

      {/* 추정값 안내 — 강조 배너 */}
      {isKeywordEstimated && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
          ⚠️ 키워드 데이터가 부족해 <strong>일부 지수는 업종 평균으로 추정</strong>됩니다.
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
          블로그를 등록하면 키워드 지수 정확도가 향상됩니다 →
        </Link>
      )}
    </div>
  );
}
