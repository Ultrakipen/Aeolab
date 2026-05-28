"use client";

import Link from "next/link";

/**
 * DualTrackCard — 업종별 듀얼트랙 AI 가시성 카드 (v3.0)
 *
 * Track 1: 네이버 AI 검색 준비도 (AI브리핑·AI탭 통합) — 업종별 비중: 40~70%
 *   AI 브리핑: 음식점·카페·숙박 등 ACTIVE 업종만
 *   AI탭: 모든 업종 (2026-04-27 베타, 6월 전체 확대 예정 — 네이버 공식)
 * Track 2: 글로벌 AI 가시성       (업종별 비중: 30~90%)
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
  smartPlaceStatus?: string;
  bizId?: string;
  token?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "음식점", cafe: "카페", bakery: "베이커리", bar: "바",
  beauty: "미용실", nail: "네일샵", medical: "의원/병원",
  pharmacy: "약국", fitness: "헬스장", yoga: "요가/필라테스",
  pet: "반려동물", education: "교육/학원", tutoring: "과외",
  legal: "법률", realestate: "부동산", interior: "인테리어",
  auto: "자동차", cleaning: "청소", shopping: "온라인쇼핑",
  fashion: "패션", photo: "사진", video: "영상", design: "디자인",
  accommodation: "숙박", other: "기타",
};

// 업종별 맞춤 메시지 (§7.1 기준)
const CATEGORY_MESSAGES: Record<string, { track1Tip: string; track2Tip: string }> = {
  restaurant: {
    track1Tip: "스마트플레이스 소개글 안 Q&A에 '주차 가능', '단체 예약' 추가",
    track2Tip: "구글 비즈니스 프로필 등록 + AI 검색 최적화 정보",
  },
  cafe: {
    track1Tip: "공간 용도·분위기 소개글 Q&A 추가 (노트북 가능, 반려견 동반)",
    track2Tip: "스페셜티·비건 콘텐츠 블로그 발행",
  },
  beauty: {
    track1Tip: "당일 예약·전문 시술 소개글 Q&A 추가 (탈모 케어, 웨딩 전문)",
    track2Tip: "시술 전후 사진 + 웹사이트 AI 정보 등록",
  },
  fitness: {
    track1Tip: "24시간 운영·PT 전문 소개글 Q&A 추가",
    track2Tip: "체형 교정 결과 사례 콘텐츠 발행 (10-20대 타겟)",
  },
  clinic: {
    track1Tip: "야간 진료·전문의 직접 진료 소개글 Q&A 추가",
    track2Tip: "자체 웹사이트·구글 비즈니스 프로필에 전문성 콘텐츠 등록 (ChatGPT·Gemini 참조 소스)",
  },
  pet: {
    track1Tip: "CCTV 확인·응급 진료 소개글 Q&A 추가",
    track2Tip: "수의사 전문성 콘텐츠 발행",
  },
  academy: {
    track1Tip: "합격 사례·원어민 강사 소개글 Q&A 추가",
    track2Tip: "ChatGPT·Gemini 노출을 위한 자체 웹사이트·구글 비즈니스 프로필 최적화",
  },
  legal: {
    track1Tip: "전문 분야·무료 상담 소개글 Q&A 추가",
    track2Tip: "블로그 칼럼 + 승소 사례 발행",
  },
  shopping: {
    track1Tip: "배송·AS 중심 소개글 Q&A 추가 (당일 배송, 무료 반품)",
    track2Tip: "ChatGPT 쇼핑 추천을 위한 AI 검색 최적화",
  },
};

const DEFAULT_MESSAGE = {
  track1Tip: "스마트플레이스 소개글 안 Q&A 추가 + 소개글 본문 작성",
  track2Tip: "구글 비즈니스 프로필 등록 + 웹사이트 AI 검색 최적화",
};

// INACTIVE 업종용 네이버 SEO 팁 (블로그 + 스마트플레이스 중심)
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

const STAGE_COLORS: Record<string, string> = {
  survival:  "bg-red-100 text-red-700 border border-red-200",
  stability: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  growth:    "bg-blue-100 text-blue-700 border border-blue-200",
  dominance: "bg-green-100 text-green-700 border border-green-200",
};

const STAGE_ICONS: Record<string, string> = {
  survival:  "🌱",
  stability: "📈",
  growth:    "🔥",
  dominance: "🏆",
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
  label: string;
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
        <div className="mt-2 text-base text-red-600 font-medium bg-red-100 rounded-lg px-3 py-2 leading-relaxed">
          ⚡ 지금 할 것: {tip}
        </div>
      )}
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
  hasRegisteredKeywords = false,
  blogContribution,
  eligibility,
  aiExposureData,
}: DualTrackCardProps) {
  const msg = CATEGORY_MESSAGES[category] || DEFAULT_MESSAGE;
  const isTrack1Weak = track1Score < 40;
  const isTrack2Weak = track2Score < 40;

  const isActive   = eligibility === "active";
  const isLikely   = eligibility === "likely";
  const isInactive = eligibility === "inactive";

  const track1Label = isActive
    ? "📍 네이버 AI 브리핑 노출 지수"
    : isLikely
    ? "📍 네이버 검색 지수 (AI 브리핑 확대 예정)"
    : isInactive
    ? "📍 네이버 SEO 검색 지수"
    : "📍 네이버 AI 브리핑 노출 지수";

  const track1Sublabel = isActive
    ? "이 지수가 낮으면 네이버 AI가 내 가게를 잘 모릅니다"
    : isLikely
    ? "블로그·스마트플레이스 관리로 검색 노출을 높이고, AI 브리핑 확대 시 즉시 활성화됩니다"
    : isInactive
    ? "블로그·스마트플레이스를 꾸준히 관리하면 네이버 검색 노출을 개선할 수 있습니다"
    : "이 지수가 낮으면 네이버 AI가 내 가게를 잘 모릅니다";

  const track1Tip = isInactive
    ? (INACTIVE_NAVER_SEO_TIPS[category] ?? INACTIVE_NAVER_SEO_TIPS.other)
    : msg.track1Tip;

  const chatgptRate = (aiExposureData?.chatgptFreq !== undefined && aiExposureData?.chatgptSampleSize)
    ? Math.round(aiExposureData.chatgptFreq / aiExposureData.chatgptSampleSize * 100)
    : null;
  const geminiRate = (aiExposureData?.geminiFreq !== undefined && aiExposureData?.geminiSampleSize)
    ? Math.round(aiExposureData.geminiFreq / aiExposureData.geminiSampleSize * 100)
    : null;
  const hasAiData = chatgptRate !== null || geminiRate !== null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5 space-y-3 md:space-y-4">
      {/* 헤더: 통합 점수 + 성장 단계 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-bold text-gray-900">AI 노출 종합 지수</h2>
          {/* 1계층: 업종별 가중치 비율 — 항상 노출 */}
          <div className="mt-1.5 inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-sm flex-wrap">
            <span className="text-gray-500">{CATEGORY_LABELS[category] || "이 업종"} 기준</span>
            <span className="text-gray-300">·</span>
            <span className="font-semibold text-green-600">네이버 {Math.round(naverWeight * 100)}%</span>
            <span className="text-gray-400">+</span>
            <span className="font-semibold text-blue-600">글로벌 AI {Math.round(globalWeight * 100)}%</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl md:text-4xl font-extrabold text-indigo-600">
            {unifiedScore.toFixed(0)}
            <span className="text-base md:text-lg font-normal text-gray-400">점</span>
          </div>
          {/* 업종별 채널 비중 안내 */}
          <div className="text-sm text-gray-500 mt-0.5">
            {CATEGORY_LABELS[category] || "이 업종"} 기준 · 네이버 {Math.round(naverWeight * 100)}% 비중
          </div>
          {benchmarkAvg && benchmarkAvg > 0 && (
            <div className="text-sm mt-1">
              <span className={unifiedScore >= benchmarkAvg ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
                {unifiedScore >= benchmarkAvg
                  ? `▲ 업종 평균보다 ${Math.round(unifiedScore - benchmarkAvg)}점 높습니다 ✓`
                  : `▼ 업종 평균보다 ${Math.round(benchmarkAvg - unifiedScore)}점 낮습니다 — 개선 여지 있음`}
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
          {/* 성장 단계 기준 명시 */}
          <div className="text-sm text-gray-500 mt-0.5">네이버 채널 점수 기준</div>
        </div>
      </div>

      {/* Track 1 */}
      <ScoreBar
        score={track1Score}
        weight={naverWeight}
        label={track1Label}
        sublabel={track1Sublabel}
        color="bg-green-500"
        isWeak={isTrack1Weak}
        tip={track1Tip}
      />

      {/* INACTIVE: 네이버 SEO 개선 안내 박스 */}
      {isInactive && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 md:p-4">
          <p className="text-sm font-semibold text-green-800 mb-2">
            📝 네이버 검색 노출 개선 방법
          </p>
          <div className="space-y-1.5">
            {[
              "블로그 정기 발행 (주 1~2회) → 네이버 검색 결과 상위 노출",
              "스마트플레이스 소개글·사진 업데이트 → 플레이스 검색 최적화",
              "리뷰 답글 꾸준히 달기 → 네이버 플레이스 신뢰도 향상",
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-1.5 text-sm text-green-700">
                <span className="mt-0.5 shrink-0">✓</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIKELY: AI 브리핑 확대 예정 안내 */}
      {isLikely && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 md:p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-1">
            🔔 네이버 AI 브리핑 확대 예정 업종
          </p>
          <p className="text-sm text-yellow-700 leading-relaxed">
            지금은 블로그·스마트플레이스 관리로 네이버 검색 노출을 높이세요. AI 브리핑 업종 확대 시 자동으로 전환됩니다.
          </p>
        </div>
      )}

      {/* Track 2 — 글로벌 AI */}
      <ScoreBar
        score={track2Score}
        weight={globalWeight}
        label="🌐 글로벌 AI 인식 현황"
        sublabel="ChatGPT·Gemini가 현재 이 사업장을 인식하는 수준입니다"
        color="bg-blue-500"
        isWeak={isTrack2Weak}
        tip={msg.track2Tip}
      />

      {/* AI 도구별 노출 현황 (실측 데이터) */}
      {hasAiData && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 md:p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2.5">
            🤖 AI 도구별 노출 현황 (실측)
          </p>
          <div className="space-y-2.5">
            {chatgptRate !== null && aiExposureData?.chatgptSampleSize ? (
              <div>
                <div className="flex justify-between text-sm text-gray-700 mb-1">
                  <span>ChatGPT</span>
                  <span className="font-semibold">
                    {chatgptRate}%
                    <span className="text-sm text-gray-500 font-normal ml-1">
                      ({aiExposureData.chatgptFreq}/{aiExposureData.chatgptSampleSize}회)
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
                <span className="text-sm text-gray-500">정식 스캔(Basic+) 후 확인</span>
              </div>
            )}
            {geminiRate !== null && aiExposureData?.geminiSampleSize ? (
              <div>
                <div className="flex justify-between text-sm text-gray-700 mb-1">
                  <span>Google Gemini</span>
                  <span className="font-semibold">
                    {geminiRate}%
                    <span className="text-sm text-gray-500 font-normal ml-1">
                      ({aiExposureData.geminiFreq}/{aiExposureData.geminiSampleSize}회)
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
                <span className="text-sm text-gray-500">정식 스캔(Basic+) 후 확인</span>
              </div>
            )}
          </div>
          {(() => {
            const isFastDiagnosis =
              (aiExposureData?.chatgptSampleSize != null && aiExposureData.chatgptSampleSize <= 10) ||
              (aiExposureData?.geminiSampleSize != null && aiExposureData.geminiSampleSize <= 10);
            return isFastDiagnosis ? (
              <p className="text-sm text-gray-400 mt-2">
                빠른 진단 결과 (10/5회) · 정밀 자동 스캔 (50회)은 스케줄러가 오늘 실행합니다
              </p>
            ) : null;
          })()}
          <p className="text-sm text-gray-500 mt-2.5 leading-relaxed">
            ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다. 측정 시점·기기·로그인 상태에 따라 달라질 수 있음
          </p>
        </div>
      )}

      {/* 없는 키워드 (최대 3개) */}
      {topMissingKeywords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4">
          <p className="text-base font-semibold text-amber-800 mb-2 leading-snug">
            {hasRegisteredKeywords
              ? "⚠️ 등록 키워드 중 아직 AI 검색에서 확인이 필요한 키워드"
              : "⚠️ 지금 당장 없는 키워드 — AI 조건 검색에서 제외되는 이유"}
          </p>
          <div className="flex flex-wrap gap-2">
            {topMissingKeywords.map((kw) => (
              <Link
                key={kw}
                href={`/guide?keyword=${encodeURIComponent(kw)}`}
                className="inline-flex items-center gap-1 bg-white border border-amber-300 text-amber-700 text-sm font-medium rounded-full px-3 py-1 hover:opacity-80 transition-opacity"
              >
                ❌ {kw} →
              </Link>
            ))}
          </div>
          <p className="text-base text-amber-600 mt-2 leading-relaxed">
            {hasRegisteredKeywords
              ? "이 키워드로 스캔하면 AI 검색 노출 여부를 바로 확인할 수 있습니다."
              : "스마트플레이스 소개글 안 Q&A에 위 키워드를 추가하면 AI 브리핑 인용 후보 가능성이 높아집니다."}
          </p>
        </div>
      )}

      {/* 추정값 안내 */}
      {isKeywordEstimated && (
        <p className="text-base text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
          리뷰 데이터가 없어 키워드 지수는 업종 평균으로 추정됩니다.
          리뷰 3개를 붙여넣으면 정확한 키워드 갭을 확인할 수 있습니다.
        </p>
      )}

      {/* 블로그 분석 기여 배지 */}
      {blogContribution?.active && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-700 font-medium">
            블로그 {blogContribution.postCount}개 포스트 분석 반영 · 키워드 커버리지 {Math.round(blogContribution.keywordCoverage)}%
          </span>
          <a
            href="/blog-analysis?reanalyze=1"
            className="text-blue-500 underline text-sm whitespace-nowrap ml-2"
            onClick={(e) => { e.currentTarget.textContent = "재분석 중..."; }}
          >
            블로그 재분석
          </a>
        </div>
      )}

      {/* 블로그 미등록 안내 (키워드 추정 상태일 때만) */}
      {isKeywordEstimated && !blogContribution?.active && (
        <a
          href="/blog-analysis"
          className="block text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors"
        >
          블로그를 등록하면 키워드 지수 정확도가 향상됩니다 →
        </a>
      )}
    </div>
  );
}
