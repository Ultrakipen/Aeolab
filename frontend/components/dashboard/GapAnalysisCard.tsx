"use client";

import { useState } from "react";
import type { GapAnalysis } from "@/types/gap";
import { TrendingUp, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  gap: GapAnalysis;
}

const DIMENSION_LABELS: Record<string, string> = {
  exposure_freq:              "AI 검색 노출 빈도",
  review_quality:             "리뷰 수·평점",
  schema_score:               "AI 인식 최적화",
  online_mentions:            "온라인 언급 빈도",
  info_completeness:          "정보 완성도",
  content_freshness:          "최신성",
  naver_exposure_confirmed:   "네이버 AI 브리핑 노출",
  smart_place_completeness:   "스마트플레이스 완성도",
  schema_seo:                 "웹사이트 AI 구조화",
  keyword_gap_score:          "키워드 격차",
  multi_ai_exposure:          "다중 AI 플랫폼 노출",
  online_mentions_t2:         "온라인 언급 빈도",
  google_presence:            "구글 검색 노출",
};

/** 점수 → 수준 레이블 + 색상 */
function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "상위권", color: "text-emerald-600" };
  if (score >= 45) return { label: "중위권", color: "text-blue-600" };
  if (score >= 20) return { label: "개선 구간", color: "text-orange-500" };
  return { label: "시작 단계", color: "text-red-500" };
}

/** 점수 근거 설명 패널 */
function ScoreBasisPanel() {
  return (
    <div className="mt-1 mb-3 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 space-y-2">
      <p className="font-semibold text-gray-700 mb-1">점수 산출 근거 (100점 만점)</p>
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <span className="shrink-0 font-medium text-gray-500 w-5">①</span>
          <span><strong className="text-gray-700">네이버 AI 브리핑 노출</strong> — 스마트플레이스 완성도, 소개글 Q&A, 리뷰 품질 반영</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 font-medium text-gray-500 w-5">②</span>
          <span><strong className="text-gray-700">리뷰 수·평점</strong> — 리뷰 개수, 별점 평균, 키워드 다양성 반영</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 font-medium text-gray-500 w-5">③</span>
          <span><strong className="text-gray-700">온라인 정보 완성도</strong> — 전화번호·영업시간·주소·사진 등록 여부</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 font-medium text-gray-500 w-5">④</span>
          <span><strong className="text-gray-700">키워드 커버리지</strong> — 업종 핵심 키워드가 리뷰·소개글에 얼마나 포함됐는지</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 font-medium text-gray-500 w-5">⑤</span>
          <span><strong className="text-gray-700">글로벌 AI 노출</strong> — ChatGPT·구글 AI·Gemini에서 가게가 검색되는지</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 font-medium text-gray-500 w-5">⑥</span>
          <span><strong className="text-gray-700">콘텐츠 최신성</strong> — 최근 리뷰·소식·블로그 발행 여부</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap gap-3 text-sm">
        <span className="text-red-500 font-medium">0~19점 시작 단계</span>
        <span className="text-orange-500 font-medium">20~44점 개선 구간</span>
        <span className="text-blue-600 font-medium">45~69점 중위권</span>
        <span className="text-emerald-600 font-medium">70점~ 상위권</span>
      </div>
    </div>
  );
}

export function GapAnalysisCard({ gap }: Props) {
  const [showBasis, setShowBasis] = useState(false);
  const dimensions = gap.dimensions ?? [];

  const top3WithGap = dimensions
    .filter((d) => d.gap_to_top > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  const opportunities = dimensions
    .filter((d) => d.gap_to_top === 0 && (d.my_score ?? 0) === 0)
    .slice(0, 2);

  const myScore = gap.vs_top?.my_score ?? 0;
  const topCompetitorScore = gap.vs_top?.top_competitor_score ?? 0;
  const iAmAhead = myScore >= topCompetitorScore;
  const estimatedScore = gap.estimated_score_if_fixed ?? 0;
  const showEstimate = estimatedScore > myScore + 0.5;

  const myLevel = getScoreLevel(Math.round(myScore));

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-orange-500 shrink-0" />
        <div className="text-base font-bold text-gray-800">
          {iAmAhead ? "경쟁사가 앞선 세부 항목" : "1위와 나의 격차 분석"}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-2 leading-relaxed">
        {iAmAhead
          ? "총점은 경쟁사보다 앞서지만, 아래 세부 항목은 경쟁사가 더 높습니다. 격차를 더 벌리려면 이 항목들을 개선하세요."
          : "최고 점수 경쟁사 대비 나의 부족한 항목을 우선순위 순으로 보여줍니다."}
        {gap.vs_top?.top_competitor_name && (
          <span className="ml-1 text-gray-500">
            (비교 대상: <strong>{gap.vs_top.top_competitor_name}</strong>{" "}
            {gap.vs_top.top_competitor_score}점{iAmAhead ? `, 내 가게 ${Math.round(myScore)}점` : ""})
          </span>
        )}
      </p>

      {/* 점수 근거 토글 */}
      <button
        onClick={() => setShowBasis((v) => !v)}
        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 mb-3 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
        점수가 어떻게 계산되나요?
        {showBasis ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {showBasis && <ScoreBasisPanel />}

      {dimensions.length === 0 ? (
        <p className="text-sm text-gray-400">경쟁사를 먼저 등록하면 격차 분석이 가능합니다.</p>
      ) : (
        <>
          {top3WithGap.length > 0 ? (
            <div className="space-y-3">
              {top3WithGap.map((d) => {
                const potentialWidth =
                  d.improvement_potential === "high"
                    ? 85
                    : d.improvement_potential === "medium"
                    ? 55
                    : 25;
                return (
                  <div key={d.dimension_key} className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-700">
                          {DIMENSION_LABELS[d.dimension_key] ?? d.dimension_key}
                        </span>
                        <span className="text-sm text-red-500 font-semibold shrink-0">
                          -{Math.round(d.gap_to_top)}점 차이
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{d.gap_reason}</p>
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full"
                          style={{ width: `${potentialWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            (() => {
              const competitorScore = gap.vs_top?.top_competitor_score ?? 0;
              const competitorName = gap.vs_top?.top_competitor_name ?? "경쟁사";
              const compLevel = getScoreLevel(Math.round(competitorScore));

              if (myScore >= competitorScore) {
                return (
                  <div className="bg-emerald-50 rounded-xl p-4 text-sm">
                    <div className="font-semibold mb-3 flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      이 경쟁사보다 AI 노출 점수가 높습니다
                    </div>
                    {/* 점수 비교 */}
                    <div className="flex items-center gap-6 mb-3">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-emerald-700">{Math.round(myScore)}</div>
                        <div className="text-sm text-gray-400">/ 100점</div>
                        <div className={`text-sm font-semibold mt-0.5 ${myLevel.color}`}>{myLevel.label}</div>
                        <div className="text-sm text-gray-500 mt-0.5">내 가게</div>
                      </div>
                      <div className="text-gray-300 text-xl">&gt;</div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-400">{Math.round(competitorScore)}</div>
                        <div className="text-sm text-gray-400">/ 100점</div>
                        <div className={`text-sm font-semibold mt-0.5 ${compLevel.color}`}>{compLevel.label}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{competitorName}</div>
                      </div>
                    </div>
                    <p className="text-sm text-emerald-600">
                      현재 등록된 경쟁사 중 1위입니다. 경쟁사를 더 추가해 비교 범위를 넓혀보세요.
                    </p>
                  </div>
                );
              } else {
                return (
                  <div className="bg-amber-50 rounded-xl p-4 text-sm">
                    <div className="font-semibold mb-3 flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      항목별 비교 데이터 수집 중
                    </div>
                    {/* 점수 비교 — /100 기준 + 수준 표시 */}
                    <div className="flex items-center gap-6 mb-3">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-amber-700">{Math.round(myScore)}</div>
                        <div className="text-sm text-gray-400">/ 100점</div>
                        <div className={`text-sm font-semibold mt-0.5 ${myLevel.color}`}>{myLevel.label}</div>
                        <div className="text-sm text-gray-500 mt-0.5">내 가게</div>
                      </div>
                      <div className="text-gray-300 text-xl">&lt;</div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-500">{Math.round(competitorScore)}</div>
                        <div className="text-sm text-gray-400">/ 100점</div>
                        <div className={`text-sm font-semibold mt-0.5 ${compLevel.color}`}>{compLevel.label}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{competitorName}</div>
                      </div>
                    </div>
                    <p className="text-sm text-amber-700 mb-2">
                      경쟁 가게가 새로 등록됐거나 아직 첫 스캔이 실행되지 않아 항목별 세부 비교가 준비되지 않았습니다.
                    </p>
                    <div className="bg-white rounded-lg p-3 border border-amber-200 space-y-1.5 text-sm">
                      <p className="text-gray-700 font-medium">해결 방법</p>
                      <p className="text-gray-600 flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold shrink-0">①</span>
                        <span><strong>지금 바로:</strong> 경쟁사 페이지 상단 &ldquo;AI 스캔 시작&rdquo; 버튼을 누르면 즉시 항목별 비교가 나타납니다.</span>
                      </p>
                      <p className="text-gray-600 flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold shrink-0">②</span>
                        <span><strong>자동 해소:</strong> 매일 새벽 2시 자동 스캔 후 자동으로 채워집니다.</span>
                      </p>
                    </div>
                  </div>
                );
              }
            })()
          )}

          {/* 선점 기회 */}
          {opportunities.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-sm font-semibold text-emerald-600 mb-2">
                ⚡ 선점 기회 — 경쟁사도 아직 없는 항목
              </div>
              <div className="space-y-3">
                {opportunities.map((d) => (
                  <div key={d.dimension_key} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5 text-sm shrink-0">→</span>
                    <div>
                      <span className="text-sm font-semibold text-gray-700">
                        {DIMENSION_LABELS[d.dimension_key] ?? d.dimension_key}
                      </span>
                      {d.gap_reason && (
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{d.gap_reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 예상 점수 */}
          {showEstimate && (
            <div className="mt-4 bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
              위 항목 개선 시 예상 점수:{" "}
              <strong className="text-blue-900">{Math.round(estimatedScore)}점</strong>{" "}
              <span className="text-blue-500 text-sm">(현재 {Math.round(myScore)}점 → {getScoreLevel(Math.round(estimatedScore)).label})</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
