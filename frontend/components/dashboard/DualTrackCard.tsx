"use client";

import { Sprout, TrendingUp, Flame, Trophy, MapPin, Globe, AlertTriangle, Zap, Lightbulb, XCircle } from "lucide-react";
import type { JSX } from "react";

// 영문 점수 키 → 소상공인 이해 가능한 한국어 레이블
const SCORE_LABELS: Record<string, string> = {
  exposure_freq:             "AI 검색 노출",
  review_quality:            "리뷰 평판",
  schema_score:              "온라인 정보 정리",
  online_mentions:           "온라인 언급 수",
  info_completeness:         "기본 정보 완성도",
  content_freshness:         "최근 활동",
  keyword_gap_score:         "키워드 커버리지",
  smart_place_completeness:  "스마트플레이스 완성도",
  naver_exposure_confirmed:  "네이버 AI 노출 확인",
  track1_score:              "네이버 AI 준비 점수",
  track2_score:              "글로벌 AI 준비 점수",
  unified_score:             "통합 AI 노출 점수",
};

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
}

// 업종별 맞춤 메시지 (§7.1 기준)
const CATEGORY_MESSAGES: Record<string, { track1Tip: string; track2Tip: string }> = {
  restaurant: {
    track1Tip: "스마트플레이스 FAQ에 '주차 가능', '단체 예약' 등록",
    track2Tip: "구글 비즈니스 프로필 등록 + AI 검색 최적화 코드 적용",
  },
  cafe: {
    track1Tip: "공간 용도·분위기 FAQ 등록 (노트북 가능, 반려견 동반)",
    track2Tip: "스페셜티·비건 콘텐츠 블로그 발행",
  },
  beauty: {
    track1Tip: "당일 예약·전문 시술 FAQ 등록 (탈모 케어, 웨딩 전문)",
    track2Tip: "시술 전후 사진 + 웹사이트 AI 검색 최적화 코드 적용",
  },
  fitness: {
    track1Tip: "24시간 운영·PT 전문 FAQ 등록",
    track2Tip: "체형 교정 결과 사례 콘텐츠 발행 (10-20대 타겟)",
  },
  clinic: {
    track1Tip: "야간 진료·전문의 직접 진료 FAQ 등록",
    track2Tip: "ChatGPT에서 찾히는 전문성 콘텐츠 발행",
  },
  pet: {
    track1Tip: "CCTV 확인·응급 진료 FAQ 등록",
    track2Tip: "수의사 전문성 콘텐츠 발행",
  },
  academy: {
    track1Tip: "합격 사례·원어민 강사 FAQ 등록",
    track2Tip: "Perplexity 추천 블로그 콘텐츠 발행 (10대 AI 검색)",
  },
  legal: {
    track1Tip: "전문 분야·무료 상담 FAQ 등록",
    track2Tip: "블로그 칼럼 + 승소 사례 발행",
  },
  shopping: {
    track1Tip: "배송·AS 중심 FAQ 등록 (당일 배송, 무료 반품)",
    track2Tip: "ChatGPT 쇼핑 추천 AI 검색 코드 적용",
  },
};

const DEFAULT_MESSAGE = {
  track1Tip: "스마트플레이스 FAQ 등록 + 소개글 작성",
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
  color,
  isWeak,
  tip,
}: {
  score: number;
  weight: number;
  label: string | JSX.Element;
  sublabel: string;
  color: string;
  isWeak: boolean;
  tip: string;
}) {
  const pct = Math.round(weight * 100);
  const barWidth = Math.min(100, Math.max(0, score));

  return (
    <div className={`rounded-xl p-3 md:p-4 ${isWeak ? "ring-2 ring-red-400 bg-red-50" : "bg-gray-50"}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-gray-800 text-base leading-tight block">{label}</span>
          <span className="text-sm text-gray-500 bg-gray-200 rounded-full px-2 py-0.5 inline-block mt-0.5">
            최종 점수의 {pct}%
          </span>
        </div>
        <span className={`text-xl md:text-2xl font-bold shrink-0 ${isWeak ? "text-red-600" : "text-gray-800"}`}>
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
      {isWeak && (
        <div className="mt-2 flex items-start gap-2 text-base text-red-600 font-medium bg-red-100 rounded-lg px-3 py-2 leading-relaxed">
          <Zap className="w-4 h-4 shrink-0 mt-0.5" />
          <span>지금 할 것: {tip}</span>
        </div>
      )}
    </div>
  );
}

function buildTrack1Tip(category: string, sp?: SmartPlaceStatus): string {
  const missing: string[] = [];
  if (!sp?.hasFaq) missing.push("FAQ 등록");
  if (!sp?.hasIntro) missing.push("소개글 작성");
  if (!sp?.hasRecentPost) missing.push("소식 업데이트");
  if (missing.length > 0) return `스마트플레이스 ${missing.join(" + ")}`;
  // 모두 완료된 경우 — 키워드 개선 안내
  const catMsg = CATEGORY_MESSAGES[category];
  return catMsg ? catMsg.track1Tip : "리뷰 키워드를 보강하여 AI 브리핑 노출을 높이세요";
}

function buildTrack2Tip(category: string, sp?: SmartPlaceStatus): string {
  const missing: string[] = [];
  if (!sp?.hasWebsite) missing.push("웹사이트 등록");
  if (missing.length > 0) return `${missing.join(" + ")} + AI 검색 최적화 코드 적용`;
  const catMsg = CATEGORY_MESSAGES[category];
  return catMsg ? catMsg.track2Tip : "웹사이트에 AI 검색 최적화 코드 적용 + 글로벌 AI 노출 강화";
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
}: DualTrackCardProps) {
  const isTrack1Weak = track1Score < 40;
  const isTrack2Weak = track2Score < 40;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 space-y-3 md:space-y-4">
      {/* 헤더: 통합 점수 + 성장 단계 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-bold text-gray-900">AI 검색 노출 현황</h2>
          <p className="text-base text-gray-500 mt-0.5 leading-relaxed">
            네이버 AI 브리핑 + 글로벌 AI (ChatGPT·Gemini 등) 통합 분석
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl md:text-4xl font-extrabold text-indigo-600">
            {unifiedScore.toFixed(0)}
            <span className="text-base md:text-lg font-normal text-gray-400">점</span>
          </div>
          {benchmarkAvg && benchmarkAvg > 0 && (
            <div className="text-xs mt-1">
              <span className={unifiedScore >= benchmarkAvg ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
                {unifiedScore >= benchmarkAvg
                  ? `▲ 업종 평균보다 ${Math.round(unifiedScore - benchmarkAvg)}점 높음`
                  : `▼ 업종 평균보다 ${Math.round(benchmarkAvg - unifiedScore)}점 낮음`}
              </span>
            </div>
          )}
          <span
            className={`inline-flex items-center gap-1 text-sm font-semibold rounded-full px-2 py-0.5 mt-1 ${
              STAGE_COLORS[growthStage] || STAGE_COLORS.stability
            }`}
          >
            {STAGE_ICONS[growthStage]} {growthStageLabel}
            {isKeywordEstimated && (
              <span className="text-gray-400 font-normal ml-1">(추정)</span>
            )}
          </span>
        </div>
      </div>

      {/* Track 1 — 네이버 AI 브리핑 */}
      <ScoreBar
        score={track1Score}
        weight={naverWeight}
        label={<span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 inline-block" /> 네이버 AI 브리핑 점수</span>}
        sublabel="스마트플레이스 완성도·리뷰 키워드·FAQ 등록 여부"
        color="bg-green-500"
        isWeak={isTrack1Weak}
        tip={buildTrack1Tip(category, smartPlaceStatus)}
      />

      {/* Track 2 — 글로벌 AI */}
      <ScoreBar
        score={track2Score}
        weight={globalWeight}
        label={<span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 inline-block" /> 글로벌 AI 노출 점수</span>}
        sublabel="ChatGPT·Gemini·Perplexity 노출 + 웹사이트 구조화"
        color="bg-blue-500"
        isWeak={isTrack2Weak}
        tip={buildTrack2Tip(category, smartPlaceStatus)}
      />

      {/* 없는 키워드 (최대 3개) */}
      {topMissingKeywords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4">
          <p className="text-base font-semibold text-amber-800 mb-2 leading-snug flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            지금 당장 없는 키워드 — AI 조건 검색에서 제외되는 이유
          </p>
          <div className="flex flex-wrap gap-2">
            {topMissingKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 bg-white border border-amber-300 text-amber-700 text-sm font-medium rounded-full px-3 py-1"
              >
                <XCircle className="w-4 h-4 text-red-500 shrink-0" /> {kw}
              </span>
            ))}
          </div>
          <p className="text-base text-amber-600 mt-2 leading-relaxed">
            스마트플레이스 FAQ나 소개글에 위 키워드를 추가하면 AI 브리핑 노출 확률이 높아집니다.
          </p>
        </div>
      )}

      {/* 추정값 안내 */}
      {isKeywordEstimated && (
        <p className="text-base text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed flex items-start gap-2">
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
          <span>리뷰 데이터가 없어 키워드 점수는 업종 평균으로 추정됩니다.
          리뷰 3개를 붙여넣으면 정확한 키워드 갭을 확인할 수 있습니다.</span>
        </p>
      )}
    </div>
  );
}
