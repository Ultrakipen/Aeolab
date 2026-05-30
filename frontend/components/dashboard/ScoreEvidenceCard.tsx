// ScoreEvidenceCard.tsx — 점수 근거 카드 (v3.1 6항목 / v3.0 graceful fallback)
// Track 1 6항목: 키워드 검색 노출 · 리뷰 품질 · 스마트플레이스 · 블로그 C-rank · 지도/카카오 · AI 브리핑
// v3.0 응답(model_version 없음·"v3.0") → 기존 4항목 유지

import { CheckCircle2, XCircle, AlertTriangle, AlertOctagon } from "lucide-react";
import type { MissingItem } from "@/types/diagnosis";
import MissingKeywordBadges from "@/components/dashboard/MissingKeywordBadges";
import { SCORE_LABELS } from "@/lib/score-labels";

void SCORE_LABELS; // 향후 dynamic rendering 시 활용

// ── v3.1 가중치 상수 (백엔드 NAVER_TRACK_WEIGHTS_V3_1과 동기화 필수)
const V3_1_WEIGHTS: Record<string, Record<string, number>> = {
  ACTIVE:   { keyword_search_rank: 25, review_quality: 15, smart_place_completeness: 15, blog_crank: 10, local_map_score: 10, ai_briefing_score: 25 },
  LIKELY:   { keyword_search_rank: 30, review_quality: 17, smart_place_completeness: 18, blog_crank: 10, local_map_score: 10, ai_briefing_score: 15 },
  INACTIVE: { keyword_search_rank: 35, review_quality: 20, smart_place_completeness: 20, blog_crank: 10, local_map_score: 15, ai_briefing_score: 0  },
};

// ── v3.2 가중치 상수 (백엔드 NAVER_TRACK_WEIGHTS_V3_2와 동기화 필수)
// naver_ai_tab_visible 항목 추가. ai_briefing_score 일부 분리.
const V3_2_WEIGHTS: Record<string, Record<string, number>> = {
  ACTIVE:   { keyword_search_rank: 25, review_quality: 15, smart_place_completeness: 15, blog_crank: 10, local_map_score: 10, ai_briefing_score: 20, naver_ai_tab_visible:  5 },
  LIKELY:   { keyword_search_rank: 25, review_quality: 17, smart_place_completeness: 18, blog_crank: 10, local_map_score: 10, ai_briefing_score: 10, naver_ai_tab_visible: 10 },
  INACTIVE: { keyword_search_rank: 25, review_quality: 20, smart_place_completeness: 20, blog_crank:  5, local_map_score: 15, ai_briefing_score:  0, naver_ai_tab_visible: 15 },
};

const USER_GROUP_LABEL: Record<string, string> = {
  ACTIVE:   "AI 브리핑 대상 업종",
  LIKELY:   "AI 브리핑 확대 예정 업종",
  INACTIVE: "글로벌 AI 노출 우선 업종",
};

const USER_GROUP_COLOR: Record<string, string> = {
  ACTIVE:   "bg-blue-100 text-blue-800 border-blue-200",
  LIKELY:   "bg-amber-100 text-amber-800 border-amber-200",
  INACTIVE: "bg-gray-100 text-gray-700 border-gray-300",
};

// ── 타입 정의
interface V31ItemDetail {
  score: number;
  measured?: boolean;
  is_estimated?: boolean;
  kw_gap_absorbed?: number;
  kw_gap_estimated?: boolean;
}

interface V31Detail {
  user_group: string;
  model_version: string;
  weights: Record<string, number>;
  items: Record<string, V31ItemDetail>;
}

interface NaverResult {
  mentioned?: boolean;
  in_briefing?: boolean;
  excerpt?: string | null;
  top_blogs?: Array<{ title?: string; description?: string }>;
  is_smart_place?: boolean;
  review_count?: number;
  avg_rating?: number;
}

interface KakaoResult {
  review_count?: number;
  avg_rating?: number;
  is_on_kakao?: boolean;
  my_rank?: number | null;
}

interface PlatformResult {
  mentioned?: boolean;
  exposure_freq?: number;
  error?: string;
}

interface Props {
  breakdown: Record<string, number | object>;
  naverResult: NaverResult | null;
  kakaoResult: KakaoResult | null;
  topMissingKeywords: string[];
  isKeywordEstimated: boolean;
  track1Score: number;
  track2Score: number;
  naverWeight: number;
  allPlatformResults: Record<string, PlatformResult>;
  reviewCount?: number;
  avgRating?: number;
  hasSmartPlace?: boolean;
  hasFaq?: boolean;
  hasRecentPost?: boolean;
  hasIntro?: boolean;
  bizId?: string;
  token?: string;
  missingItems?: MissingItem[];
  naverPlaceUrl?: string | null;
  briefingEligibility?: "active" | "likely" | "inactive";
}

// ── 공통 서브 컴포넌트

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-3">
      <div
        className={`${color} h-3 rounded-full transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function ScoreBadge({ value }: { value: number }) {
  if (value >= 70) return (
    <span className="text-sm font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
      양호
    </span>
  );
  if (value >= 40) return (
    <span className="text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
      보통
    </span>
  );
  return (
    <span className="text-sm font-semibold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
      개선 필요
    </span>
  );
}

function barColor(value: number): string {
  if (value >= 70) return "bg-green-500";
  if (value >= 40) return "bg-yellow-400";
  return "bg-red-400";
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
}

function WeightBadge({ pct, color }: { pct: number; color: string }) {
  return (
    <span className={`text-sm border px-2 py-0.5 rounded-full font-medium ${color}`}>
      가중치 {pct}%
    </span>
  );
}

// smart_place_completeness 역산
function decodeSmartPlace(completeness: number) {
  const KNOWN_COMBOS: Record<number, { registered: boolean; faq: boolean; recentPost: boolean; intro: boolean }> = {
    0:   { registered: false, faq: false, recentPost: false, intro: false },
    40:  { registered: true,  faq: false, recentPost: false, intro: false },
    50:  { registered: true,  faq: false, recentPost: false, intro: true  },
    60:  { registered: true,  faq: false, recentPost: true,  intro: false },
    70:  { registered: true,  faq: true,  recentPost: false, intro: false },
    80:  { registered: true,  faq: true,  recentPost: false, intro: true  },
    90:  { registered: true,  faq: true,  recentPost: true,  intro: false },
    100: { registered: true,  faq: true,  recentPost: true,  intro: true  },
  };
  if (completeness in KNOWN_COMBOS) return KNOWN_COMBOS[completeness];
  if (completeness < 40) return { registered: false, faq: false, recentPost: false, intro: false };
  return { registered: true, faq: false, recentPost: false, intro: false };
}

// ── v3.1 전용: 6항목 렌더러
function V31SixItems({
  detail,
  naverResult,
  kakaoResult,
  topMissingKeywords,
  isKeywordEstimated,
  hasSmartPlace,
  hasFaq,
  hasRecentPost,
  hasIntro,
  reviewCount,
  avgRating,
  bizId,
  token,
}: {
  detail: V31Detail;
  naverResult: NaverResult | null;
  kakaoResult: KakaoResult | null;
  topMissingKeywords: string[];
  isKeywordEstimated: boolean;
  hasSmartPlace?: boolean;
  hasFaq?: boolean;
  hasRecentPost?: boolean;
  hasIntro?: boolean;
  reviewCount?: number;
  avgRating?: number;
  bizId?: string;
  token?: string;
  naverPlaceUrl?: string | null;
}) {
  const isV32 = detail.model_version === "v3.2";
  const weightsTable = isV32 ? V3_2_WEIGHTS : V3_1_WEIGHTS;
  const ug = detail.user_group in weightsTable ? detail.user_group : "ACTIVE";
  const weights = weightsTable[ug];
  const items = detail.items;

  const finalReviewCount = kakaoResult?.review_count ?? reviewCount ?? naverResult?.review_count ?? 0;
  const finalAvgRating   = kakaoResult?.avg_rating   ?? avgRating   ?? naverResult?.avg_rating   ?? 0;
  const inBriefing = naverResult?.in_briefing ?? false;
  const naverMentioned = naverResult?.mentioned ?? false;

  const kwSearchItem = items["keyword_search_rank"];
  const rvItem       = items["review_quality"];
  const spItem       = items["smart_place_completeness"];
  const blogItem     = items["blog_crank"];
  const mapItem      = items["local_map_score"];
  const aiItem       = items["ai_briefing_score"];
  const aiTabItem    = items["naver_ai_tab_visible"];

  const spc = spItem?.score ?? 0;
  const spDecoded = decodeSmartPlace(Math.round(spc));
  const spActual = {
    registered: hasSmartPlace ?? spDecoded.registered,
    faq:        hasFaq        ?? spDecoded.faq,
    recentPost: hasRecentPost ?? spDecoded.recentPost,
    intro:      hasIntro      ?? spDecoded.intro,
  };

  // INACTIVE 그룹은 AI 브리핑 가중치 0 → 항목 표시 시 별도 안내
  const aiBriefingApplicable = weights["ai_briefing_score"] > 0;
  const aiTabApplicable = isV32 && (weights["naver_ai_tab_visible"] ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* ① 네이버 키워드 검색 노출 (신규) */}
      <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm md:text-base font-semibold text-gray-800">
                ① 네이버 키워드 검색 노출
              </span>
              <WeightBadge pct={weights["keyword_search_rank"]} color="text-amber-700 bg-amber-50 border-amber-200" />
            </div>
            <p className="text-sm text-gray-500">등록한 키워드로 네이버에서 직접 검색해 내 사업장이 몇 위에 나오는지 확인합니다</p>
          </div>
          {kwSearchItem?.measured === false ? (
            <span className="text-sm text-gray-400 font-medium w-28 text-right shrink-0">측정 대기</span>
          ) : (
            <ScoreBadge value={kwSearchItem?.score ?? 0} />
          )}
        </div>
        {kwSearchItem?.measured === false ? (
          <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-500">
            아직 측정 데이터 없음 — 키워드 등록 후 다음 주간 스캔 시 측정됩니다
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <ScoreBar value={kwSearchItem?.score ?? 0} color={barColor(kwSearchItem?.score ?? 0)} />
            </div>
            {(kwSearchItem?.score ?? 0) < 40 && (
              <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
                <span className="text-blue-500 text-sm shrink-0 mt-0.5">→</span>
                <p className="text-sm text-blue-800 font-medium">
                  사업장 키워드 3개 이상 등록 후 스마트플레이스 소개글·소식에 반영하면 순위가 오릅니다
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ② 리뷰 품질 */}
      <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm md:text-base font-semibold text-gray-800">
                ② 리뷰 품질
              </span>
              <WeightBadge pct={weights["review_quality"]} color="text-blue-700 bg-blue-50 border-blue-200" />
            </div>
            <p className="text-sm text-gray-500">리뷰 수 × 평균 별점 × 키워드 다양성으로 계산합니다</p>
          </div>
          <ScoreBadge value={rvItem?.score ?? 0} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <ScoreBar value={rvItem?.score ?? 0} color={barColor(rvItem?.score ?? 0)} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <StatusIcon ok={finalReviewCount > 0} />
          <span className="text-sm text-gray-700">
            {finalReviewCount > 0
              ? `리뷰 ${finalReviewCount}개 확인됨${finalAvgRating > 0 ? ` · 평균 ${finalAvgRating.toFixed(1)}점` : ""}`
              : "리뷰 수 미수집 — 재스캔하면 자동으로 가져옵니다"
            }
          </span>
        </div>
        {(rvItem?.score ?? 0) < 70 && (
          <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
            <span className="text-blue-500 text-sm shrink-0 mt-0.5">→</span>
            <p className="text-sm text-blue-800 font-medium">
              {finalReviewCount === 0
                ? "재스캔하면 리뷰 수가 자동으로 갱신됩니다. 그래도 0이면 단골 손님 1명에게 네이버 지도 리뷰를 요청하세요"
                : "리뷰 답변에 업종 키워드를 포함하면 키워드 다양성이 높아집니다"
              }
            </p>
          </div>
        )}
      </div>

      {/* ③ 스마트플레이스 완성도 */}
      <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm md:text-base font-semibold text-gray-800">
                ③ 스마트플레이스 완성도
              </span>
              <WeightBadge pct={weights["smart_place_completeness"]} color="text-blue-700 bg-blue-50 border-blue-200" />
              {spItem?.kw_gap_estimated && (
                <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">(추정)</span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              등록(40)+소식(20)+소개글(20) 기반, 키워드 매칭 흡수 포함
            </p>
          </div>
          <ScoreBadge value={spc} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <ScoreBar value={spc} color={barColor(spc)} />
        </div>
        {spActual.registered && spActual.recentPost && spActual.intro ? (
          <div className="flex items-center gap-2 mb-2">
            <StatusIcon ok={true} />
            <span className="text-sm text-gray-700">
              스마트플레이스 등록 (+40점) · 소식 (+20점) · 소개글 (+20점) — 3항목 모두 완료
            </span>
          </div>
        ) : (
          <div className="space-y-1.5 mb-2">
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.registered} />
              <span className="text-sm text-gray-700">
                {spActual.registered ? "스마트플레이스 등록됨 (+40점)" : "스마트플레이스 미등록 — 등록 즉시 40점 획득"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.recentPost} />
              <span className="text-sm text-gray-700">
                {spActual.recentPost ? "소식 등록됨 (+20점)" : "소식 없음 (+20점)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.intro} />
              <span className="text-sm text-gray-700">
                {spActual.intro ? "소개글 있음 (+20점)" : "소개글 없음 (+20점)"}
              </span>
            </div>
          </div>
        )}
        {topMissingKeywords.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-sm font-semibold text-amber-700 mb-2">
              키워드 매칭 부족 (소개글·소식에 추가하면 즉시 개선)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bizId ? (
                <MissingKeywordBadges keywords={topMissingKeywords} bizId={bizId} token={token} />
              ) : (
                topMissingKeywords.map((kw) => (
                  <span key={kw} className="text-sm bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">
                    {kw}
                  </span>
                ))
              )}
            </div>
            {isKeywordEstimated && (
              <p className="text-sm text-gray-400 italic mt-2">
                리뷰가 쌓이면 정확해집니다. 현재는 블로그 텍스트 기반 추정값입니다.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ④ 블로그 생태계 (C-rank 추정) */}
      <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm md:text-base font-semibold text-gray-800">
                ④ 블로그 생태계
              </span>
              <WeightBadge pct={weights["blog_crank"]} color="text-purple-700 bg-purple-50 border-purple-200" />
              <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">(추정)</span>
            </div>
            <p className="text-sm text-gray-500">블로그 발행 빈도·외부 인용·업체명 매칭으로 콘텐츠 품질을 추정합니다</p>
          </div>
          <ScoreBadge value={blogItem?.score ?? 0} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <ScoreBar value={blogItem?.score ?? 0} color={barColor(blogItem?.score ?? 0)} />
        </div>
        <p className="text-sm text-gray-400 italic">
          측정 시점·기기·검색 환경에 따라 달라질 수 있습니다
        </p>
        {(blogItem?.score ?? 0) < 40 && (
          <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3 mt-2">
            <span className="text-blue-500 text-sm shrink-0 mt-0.5">→</span>
            <p className="text-sm text-blue-800 font-medium">
              블로그 후기 1건을 단골에게 요청하면 업체명 매칭 점수가 높아집니다
            </p>
          </div>
        )}
      </div>

      {/* ⑤ 지도/플레이스 + 카카오맵 */}
      <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm md:text-base font-semibold text-gray-800">
                ⑤ 지도/플레이스 + 카카오맵
              </span>
              <WeightBadge pct={weights["local_map_score"]} color="text-green-700 bg-green-50 border-green-200" />
            </div>
            <p className="text-sm text-gray-500">네이버 지도 등록 여부 + 카카오맵 리뷰 수·평점 통합 점수입니다</p>
          </div>
          <ScoreBadge value={mapItem?.score ?? 0} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <ScoreBar value={mapItem?.score ?? 0} color={barColor(mapItem?.score ?? 0)} />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <StatusIcon ok={!!naverResult?.is_smart_place} />
          <span className="text-sm text-gray-700">
            {naverResult?.is_smart_place ? "네이버 지도 플레이스 등록됨" : "네이버 지도 플레이스 미확인"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon ok={!!(kakaoResult?.is_on_kakao)} />
          <span className="text-sm text-gray-700">
            {kakaoResult?.is_on_kakao
              ? `카카오맵 등록됨${finalReviewCount > 0 ? ` · 리뷰 ${finalReviewCount}개` : ""}`
              : "카카오맵 등록 미확인"}
          </span>
        </div>
      </div>

      {/* ⑥ AI 브리핑 인용 (ACTIVE·LIKELY) / AI탭 안내 (INACTIVE) */}
      <div className={`rounded-xl border p-4 ${aiBriefingApplicable ? "border-gray-100 bg-gray-50" : "border-indigo-100 bg-indigo-50"}`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-sm md:text-base font-semibold ${aiBriefingApplicable ? "text-gray-800" : "text-indigo-900"}`}>
                {aiBriefingApplicable ? "⑥ AI 브리핑 인용" : "⑥ 네이버 AI탭 (Beta · 2026년 6월 정식 출시 예정)"}
              </span>
              {aiBriefingApplicable ? (
                <WeightBadge pct={weights["ai_briefing_score"]} color="text-blue-700 bg-blue-50 border-blue-200" />
              ) : (
                <span className="text-sm text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                  Beta · 2026년 6월 정식 출시 예정
                </span>
              )}
            </div>
            <p className={`text-sm ${aiBriefingApplicable ? "text-gray-500" : "text-indigo-700"}`}>
              {aiBriefingApplicable
                ? "실제 네이버 AI 브리핑에 노출됐는지 확인합니다"
                : "네이버 AI탭은 업종 공식 제한이 없습니다 (2026-04-28 베타, 2026년 6월 정식 출시 예정)"}
            </p>
          </div>
          {aiBriefingApplicable && <ScoreBadge value={aiItem?.score ?? 0} />}
        </div>
        {!aiBriefingApplicable && (
          <div className="flex items-start gap-2 bg-white rounded-lg p-3 border border-indigo-100">
            <span className="text-indigo-400 text-sm shrink-0 mt-0.5">→</span>
            <p className="text-sm text-indigo-800">
              소개글 200자 이상 · 사진 10장 이상 · 예약 연동 · 블로그 후기 확보가 AI탭 노출에 직결됩니다
            </p>
          </div>
        )}
        {aiBriefingApplicable && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <ScoreBar value={aiItem?.score ?? 0} color={barColor(aiItem?.score ?? 0)} />
            </div>
            <div className="space-y-1.5 mb-2">
              <div className="flex items-center gap-2">
                <StatusIcon ok={naverMentioned} />
                <span className="text-sm text-gray-700">
                  {naverMentioned ? "네이버 검색에서 언급됨" : "네이버 검색에서 미언급"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon ok={inBriefing} />
                <span className="text-sm text-gray-700">
                  {inBriefing ? "네이버 AI 브리핑 인용됨" : "네이버 AI 브리핑 미노출"}
                </span>
              </div>
            </div>
            {!inBriefing && (
              <div className="flex items-start gap-2 bg-gray-100 rounded-lg p-3">
                <span className="text-gray-500 text-sm shrink-0 mt-0.5">→</span>
                <p className="text-sm text-gray-700">
                  위 ①~⑤항목이 개선되면 AI 브리핑 노출이 자연스럽게 따라옵니다. 이 항목은 직접 조작할 수 없습니다.
                </p>
              </div>
            )}
            {naverResult?.excerpt && (
              <div className="mt-2 bg-green-50 border border-green-100 rounded-lg p-3">
                <p className="text-sm font-semibold text-green-700 mb-1">네이버 AI 인용 발췌</p>
                <p className="text-sm text-green-900 italic leading-relaxed">
                  &ldquo;{naverResult.excerpt}&rdquo;
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ⑦ 네이버 AI탭 노출 (v3.2 전용) */}
      {isV32 && (
        <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm md:text-base font-semibold text-gray-800">
                  ⑦ 네이버 AI탭 노출
                </span>
                {aiTabApplicable ? (
                  <WeightBadge pct={weights["naver_ai_tab_visible"]} color="text-indigo-700 bg-indigo-50 border-indigo-200" />
                ) : (
                  <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                    가중치 0%
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                네이버 AI탭(베타)에 사업장 답변이 노출됐는지 실측 확인합니다
              </p>
            </div>
            <ScoreBadge value={aiTabItem?.score ?? 0} />
          </div>
          {aiTabApplicable && (
            <div className="flex items-center gap-2">
              <ScoreBar value={aiTabItem?.score ?? 0} color={barColor(aiTabItem?.score ?? 0)} />
            </div>
          )}
          <div className="flex items-start gap-2 bg-indigo-50 rounded-lg p-3 mt-2">
            <span className="text-indigo-500 text-sm shrink-0 mt-0.5">ℹ️</span>
            <p className="text-sm text-indigo-700">
              {(aiTabItem?.score ?? 0) > 0
                ? "AI탭에 노출됩니다. 소개글·사진·키워드 최적화를 유지하세요."
                : "AI탭 노출이 확인되지 않았습니다. 소개글 200자 이상·사진 10장 이상을 권장합니다."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── v3.0 fallback: 기존 4항목 (hoist to avoid forward ref issues)
function V30FourItems({
  breakdown,
  naverResult,
  kakaoResult,
  topMissingKeywords,
  isKeywordEstimated,
  hasSmartPlace,
  hasFaq,
  hasRecentPost,
  hasIntro,
  reviewCount,
  avgRating,
  bizId,
  token,
  briefingEligibility,
}: {
  breakdown: Record<string, number | object>;
  naverResult: NaverResult | null;
  kakaoResult: KakaoResult | null;
  topMissingKeywords: string[];
  isKeywordEstimated: boolean;
  hasSmartPlace?: boolean;
  hasFaq?: boolean;
  hasRecentPost?: boolean;
  hasIntro?: boolean;
  reviewCount?: number;
  avgRating?: number;
  bizId?: string;
  token?: string;
  briefingEligibility?: "active" | "likely" | "inactive";
}) {
  const kws = (breakdown["keyword_gap_score"] as number) ?? 0;
  const rqs = (breakdown["review_quality"] as number) ?? 0;
  const spc = (breakdown["smart_place_completeness"] as number) ?? 0;
  const nec = (breakdown["naver_exposure_confirmed"] as number) ?? 0;

  const spDecoded = decodeSmartPlace(Math.round(spc));
  const spActual = {
    registered: hasSmartPlace ?? spDecoded.registered,
    faq:        hasFaq        ?? spDecoded.faq,
    recentPost: hasRecentPost ?? spDecoded.recentPost,
    intro:      hasIntro      ?? spDecoded.intro,
  };

  const finalReviewCount = kakaoResult?.review_count ?? reviewCount ?? naverResult?.review_count ?? 0;
  const finalAvgRating   = kakaoResult?.avg_rating   ?? avgRating   ?? naverResult?.avg_rating   ?? 0;
  const inBriefing   = naverResult?.in_briefing ?? false;

  return (
    <div className="space-y-5">
      {/* 1. 키워드 커버리지 */}
      <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm md:text-base font-semibold text-gray-800">1. 키워드 커버리지</span>
              <span className="text-sm text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                영향도 ★★★ (전체 점수의 35%)
              </span>
              {isKeywordEstimated && (
                <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">(추정값)</span>
              )}
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              소개글·리뷰·블로그 등 사업장 콘텐츠에서 업종 핵심 키워드가 얼마나 포함됐는지 측정합니다
            </p>
          </div>
          <ScoreBadge value={kws} />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <ScoreBar value={kws} color={barColor(kws)} />
        </div>
        {isKeywordEstimated && (
          <p className="text-sm text-gray-400 italic mb-2">
            리뷰가 쌓이면 정확해집니다. 현재는 블로그 텍스트 기반 추정값입니다.
          </p>
        )}
        {kws < 70 ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">
                아래 업종 핵심 키워드가 소개글·리뷰·블로그에서 {kws < 30 ? "거의 발견되지 않았습니다" : "부족하게 발견됩니다"}
              </p>
            </div>
            {topMissingKeywords.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-sm font-semibold text-amber-700 mb-2">
                  아직 부족한 키워드 — 소개글·소식에 추가하면 다음 스캔부터 반영
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {bizId ? (
                    <MissingKeywordBadges keywords={topMissingKeywords} bizId={bizId} token={token} />
                  ) : (
                    topMissingKeywords.map((kw) => (
                      <span key={kw} className="text-sm bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">
                        {kw}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
              <span className="text-blue-500 text-sm shrink-0 mt-0.5">→</span>
              <p className="text-sm text-blue-800 font-medium">
                스마트플레이스 소개글·소식에 위 키워드를 포함하면 네이버 일반 검색 노출이 높아집니다
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 font-medium">업종 키워드가 충분히 발견됩니다</p>
          </div>
        )}
      </div>

      {/* 2. 리뷰 품질 */}
      <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm md:text-base font-semibold text-gray-800">2. 리뷰 품질</span>
              <span className="text-sm text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                영향도 ★★ (전체 점수의 25%)
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">리뷰 수 × 평균 별점 × 키워드 다양성으로 계산합니다</p>
          </div>
          <ScoreBadge value={rqs} />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <ScoreBar value={rqs} color={barColor(rqs)} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <StatusIcon ok={finalReviewCount > 0} />
          <span className="text-sm text-gray-700">
            {finalReviewCount > 0
              ? `리뷰 ${finalReviewCount}개 확인됨${finalAvgRating > 0 ? ` · 평균 ${finalAvgRating.toFixed(1)}점` : ""}`
              : "리뷰 수 미수집 — 재스캔하면 자동으로 가져옵니다"
            }
          </span>
        </div>
        {rqs < 70 && (
          <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
            <span className="text-blue-500 text-sm shrink-0 mt-0.5">→</span>
            <p className="text-sm text-blue-800 font-medium">
              {finalReviewCount === 0
                ? "재스캔하면 리뷰 수가 자동 갱신됩니다. 그래도 0이면 단골 손님 1명에게 네이버 지도 리뷰를 요청하세요"
                : "리뷰 답변에 업종 키워드를 포함하면 키워드 다양성이 높아집니다"
              }
            </p>
          </div>
        )}
      </div>

      {/* 3. 스마트플레이스 완성도 */}
      <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm md:text-base font-semibold text-gray-800">3. 스마트플레이스 완성도</span>
              <span className="text-sm text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                영향도 ★★ (전체 점수의 25%)
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              마지막 스캔 기준 · 등록(40)+소식(20)+소개글(20)
            </p>
          </div>
          <ScoreBadge value={spc} />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <ScoreBar value={spc} color={barColor(spc)} />
        </div>
        {spActual.registered && spActual.recentPost && spActual.intro ? (
          <div className="flex items-center gap-2 mb-3">
            <StatusIcon ok={true} />
            <span className="text-sm text-gray-700">
              스마트플레이스 등록 (+40점) · 소식 (+20점) · 소개글 (+20점) — 3항목 모두 완료
            </span>
          </div>
        ) : (
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.registered} />
              <span className="text-sm text-gray-700">
                {spActual.registered ? "스마트플레이스 등록됨 (+40점)" : "스마트플레이스 미등록 — 등록 즉시 40점 획득"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.recentPost} />
              <span className="text-sm text-gray-700">
                {spActual.recentPost ? "소식 등록됨 (+20점)" : "소식 없음 — 최신성 점수 유지에 필요 (+20점)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.intro} />
              <span className="text-sm text-gray-700">
                {spActual.intro ? "소개글 있음 (+20점)" : "소개글 없음 (+20점)"}
              </span>
            </div>
          </div>
        )}
        {spc < 100 && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-800 mb-1">
              지금 할 일:
              {!spActual.registered && " 스마트플레이스 등록 (40점)"}
              {spActual.registered && !spActual.recentPost && " 소식 업데이트 (+20점)"}
              {spActual.registered && spActual.recentPost && !spActual.intro && " 소개글 추가 (+20점)"}
            </p>
          </div>
        )}
      </div>

      {/* 4. 네이버 AI탭 (INACTIVE) / AI 브리핑 노출 (ACTIVE·LIKELY) */}
      {briefingEligibility === "inactive" ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm md:text-base font-semibold text-indigo-900">4. 네이버 AI탭 (Beta · 2026년 6월 정식 출시 예정)</span>
                <span className="text-sm text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                  Beta · 2026년 6월 정식 출시 예정
                </span>
              </div>
              <p className="text-sm text-indigo-700 leading-relaxed">
                네이버 AI탭은 업종 공식 제한이 없습니다 (2026-04-28 베타, 2026년 6월 정식 출시 예정)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-white rounded-lg p-3 border border-indigo-100">
            <span className="text-indigo-400 text-sm shrink-0 mt-0.5">→</span>
            <p className="text-sm text-indigo-800">
              소개글 200자 이상 · 사진 10장 이상 · 예약 연동 · 블로그 후기 확보가 AI탭 노출에 직결됩니다
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm md:text-base font-semibold text-gray-800">4. 네이버 AI 브리핑 노출</span>
                <span className="text-sm text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full font-medium">
                  영향도 ★ (전체 점수의 15%)
                </span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">실제 네이버 AI 브리핑에 노출됐는지 확인합니다</p>
            </div>
            <ScoreBadge value={nec} />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <ScoreBar value={nec} color={barColor(nec)} />
          </div>
          {!inBriefing && (
            <div className="flex items-start gap-2 bg-gray-100 rounded-lg p-3">
              <span className="text-gray-500 text-sm shrink-0 mt-0.5">→</span>
              <p className="text-sm text-gray-700">
                위 1~3번이 개선되면 AI 브리핑 노출이 자연스럽게 따라옵니다. 이 항목은 직접 조작할 수 없습니다.
              </p>
            </div>
          )}
          {naverResult?.excerpt && (
            <div className="mt-2 bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-sm font-semibold text-green-700 mb-1">네이버 AI 인용 발췌</p>
              <p className="text-sm text-green-900 italic leading-relaxed">
                &ldquo;{naverResult.excerpt}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트
export default function ScoreEvidenceCard({
  breakdown,
  naverResult,
  kakaoResult,
  topMissingKeywords,
  isKeywordEstimated,
  track1Score,
  track2Score,
  naverWeight,
  allPlatformResults,
  reviewCount,
  avgRating,
  hasSmartPlace,
  hasFaq,
  hasRecentPost,
  hasIntro,
  bizId,
  token,
  missingItems,
  naverPlaceUrl,
  briefingEligibility,
}: Props) {
  // v3.1/v3.2 판별: score_breakdown.track1_detail?.model_version
  const track1Detail = breakdown["track1_detail"] as unknown as V31Detail | undefined;
  const _mv = track1Detail?.model_version ?? "";
  const isV31 = _mv === "v3.1" || _mv === "v3.2";
  const isV32Parent = _mv === "v3.2";
  const userGroup = isV31 ? (track1Detail?.user_group ?? "ACTIVE") : null;
  // v3.0 모드이거나 user_group이 없을 때 briefingEligibility로 보완
  const effectiveGroup: "ACTIVE" | "LIKELY" | "INACTIVE" | null =
    userGroup as "ACTIVE" | "LIKELY" | "INACTIVE" | null ??
    (briefingEligibility === "inactive" ? "INACTIVE"
     : briefingEligibility === "likely" ? "LIKELY"
     : briefingEligibility === "active" ? "ACTIVE"
     : null);

  const globalWeight = Math.round((1 - naverWeight) * 100);
  const naverWeightPct = Math.round(naverWeight * 100);

  const platformList: { key: string; label: string }[] = [
    { key: "gemini",  label: "Gemini" },
    { key: "chatgpt", label: "ChatGPT" },
    { key: "google",  label: "Google AI" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-100 bg-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base md:text-lg font-bold text-gray-900">
              AI 노출 지수 구성 ({isV32Parent ? "7" : isV31 ? "6" : "4"}가지 항목)
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              내 점수가 어떻게 계산됐는지 항목별로 설명합니다
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isV31 && userGroup && (
                <span className={`text-sm border px-2.5 py-1 rounded-full font-semibold ${USER_GROUP_COLOR[userGroup] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                  {USER_GROUP_LABEL[userGroup] ?? userGroup}
                </span>
              )}
              <span className="text-sm bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                네이버 {naverWeightPct}%
              </span>
              <span className="text-sm bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-semibold">
                글로벌 AI {globalWeight}%
              </span>
            </div>
            <p className="text-xs text-gray-400">이 업종 고객의 AI 검색 경로 비중</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Track 1 섹션 헤더 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-0.5">
                {effectiveGroup === "INACTIVE"
                  ? "네이버 검색 최적화 준비 상태"
                  : effectiveGroup === "LIKELY"
                  ? "네이버 AI탭 준비 상태"
                  : "네이버 AI 브리핑 준비 상태"}
              </div>
              <div className="text-sm text-gray-500">업종 점수의 {naverWeightPct}% 반영</div>
            </div>
            {effectiveGroup === "INACTIVE" ? (
              <span className="text-sm px-3 py-1 rounded-full font-semibold border bg-gray-100 text-gray-500 border-gray-200">
                AI 브리핑 비대상
              </span>
            ) : (
              <span className={`text-sm px-3 py-1 rounded-full font-semibold border ${
                track1Score >= 70 ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                : track1Score >= 40 ? "bg-amber-50 text-amber-600 border-amber-200"
                : "bg-red-50 text-red-500 border-red-100"
              }`}>
                {track1Score >= 70 ? "양호" : track1Score >= 40 ? "보통" : "개선 필요"}
              </span>
            )}
          </div>

          {/* INACTIVE 업종 안내 배너 */}
          {effectiveGroup === "INACTIVE" && (
            <div className="mb-3 space-y-2">
              {/* 네이버 SEO 검색 노출 안내 */}
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 flex items-start gap-2">
                <span className="text-blue-500 text-sm shrink-0 mt-0.5">🔍</span>
                <p className="text-sm text-blue-900 leading-relaxed">
                  <strong>네이버 일반 검색 상위 노출은 가능합니다.</strong>{" "}
                  AI 브리핑 대상은 아니지만, <strong>스마트플레이스 최적화·블로그 후기·키워드 관리</strong>로
                  네이버 검색 결과 상위에 노출될 수 있습니다.
                  이 항목 점수가 높을수록 네이버 검색 클릭이 늘어납니다.
                </p>
              </div>
              {/* AI탭 안내 */}
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 flex items-start gap-2">
                <span className="text-indigo-400 text-sm shrink-0 mt-0.5">ℹ️</span>
                <p className="text-sm text-indigo-800 leading-relaxed">
                  <strong>네이버 AI탭</strong>은 업종 제한 없이 노출 가능합니다 (2026-04-28 베타, 6월 정식 출시 예정).{" "}
                  소개글 200자 이상·사진 10장 이상·블로그 후기 확보가 핵심입니다.
                </p>
              </div>
            </div>
          )}

          {/* v3.1 / v3.0 분기 렌더링 */}
          {isV31 && track1Detail ? (
            <V31SixItems
              detail={track1Detail}
              naverResult={naverResult}
              kakaoResult={kakaoResult}
              topMissingKeywords={topMissingKeywords}
              isKeywordEstimated={isKeywordEstimated}
              hasSmartPlace={hasSmartPlace}
              hasFaq={hasFaq}
              hasRecentPost={hasRecentPost}
              hasIntro={hasIntro}
              reviewCount={reviewCount}
              avgRating={avgRating}
              bizId={bizId}
              token={token}
            />
          ) : (
            <V30FourItems
              breakdown={breakdown}
              naverResult={naverResult}
              kakaoResult={kakaoResult}
              topMissingKeywords={topMissingKeywords}
              isKeywordEstimated={isKeywordEstimated}
              hasSmartPlace={hasSmartPlace}
              hasFaq={hasFaq}
              hasRecentPost={hasRecentPost}
              hasIntro={hasIntro}
              reviewCount={reviewCount}
              avgRating={avgRating}
              bizId={bizId}
              token={token}
              briefingEligibility={briefingEligibility}
            />
          )}
        </div>

        {/* Track 2 섹션 */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-0.5">
                ChatGPT · Gemini 등 해외 AI 노출 현황
              </div>
              <div className="text-sm text-gray-500">업종 점수의 {globalWeight}% 반영</div>
            </div>
            <span className={`text-sm px-3 py-1 rounded-full font-semibold border ${
              track2Score >= 70 ? "bg-emerald-50 text-emerald-600 border-emerald-100"
              : track2Score >= 40 ? "bg-amber-50 text-amber-600 border-amber-200"
              : "bg-red-50 text-red-500 border-red-100"
            }`}>
              {track2Score >= 70 ? "양호" : track2Score >= 40 ? "보통" : "개선 필요"}
            </span>
          </div>

          {/* 모바일: 카드형 / PC: 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {platformList.map(({ key, label }) => {
              const r = allPlatformResults[key];
              if (!r) return null;
              const ok = r.mentioned === true;
              const hasError = !!r.error;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 border ${
                    hasError ? "bg-gray-50 border-gray-100 text-gray-400" :
                    ok ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                  }`}
                >
                  {hasError
                    ? <span className="text-gray-400 text-sm font-bold">?</span>
                    : ok
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  }
                  <span className={`text-sm ${hasError ? "text-gray-400" : ok ? "text-green-800 font-medium" : "text-red-700"}`}>
                    {label}
                  </span>
                  {r.exposure_freq !== undefined && r.exposure_freq > 0 && (
                    <span className="text-sm text-gray-400 ml-auto">
                      {r.exposure_freq}회
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {track2Score < 30 && (
            <div className="mt-3 bg-purple-50 border border-purple-100 rounded-lg p-3">
              <p className="text-sm text-purple-800">
                <span className="font-semibold">글로벌 AI 노출이 낮습니다.</span>{" "}
                사장님의 가게 정보를 AI가 이해하는 형식으로 등록하면, ChatGPT와 Gemini에 더 잘 노출됩니다.
                최적화 정보는 <a href="/schema" className="underline font-medium">스마트플레이스 최적화</a> 메뉴에서 자동으로 생성할 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* 면책 문구 */}
        <p className="text-sm text-gray-400 border-t border-gray-100 pt-4">
          측정 시점·기기·검색 환경에 따라 달라질 수 있습니다
        </p>

        {/* critical 우선순위 missing 항목 */}
        {missingItems && missingItems.length > 0 && (
          <div className="border-t border-gray-100 pt-5">
            <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              빠른 지수 상승 항목
            </div>
            <div className="space-y-2">
              {missingItems.map((m, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    m.priority === "critical"
                      ? "bg-red-50 border border-red-200"
                      : "bg-gray-50 border border-gray-100"
                  }`}
                >
                  {m.priority === "critical" ? (
                    <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm md:text-base font-semibold ${m.priority === "critical" ? "text-red-800" : "text-gray-800"}`}>
                      {m.item}
                    </span>
                    {m.desc && (
                      <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{m.desc}</p>
                    )}
                  </div>
                  {m.gain > 0 && (
                    <span className={`text-sm font-bold shrink-0 ${m.priority === "critical" ? "text-red-600" : "text-blue-600"}`}>
                      +{m.gain}점
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
