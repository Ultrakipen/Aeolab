// ScoreEvidenceCard.tsx — 점수 근거 카드 (v3.1 6항목 / v3.0 graceful fallback)
// Track 1 6항목: 키워드 검색 노출 · 리뷰 품질 · 스마트플레이스 · 블로그 C-rank · 지도/카카오 · AI 브리핑
// v3.0 응답(model_version 없음·"v3.0") → 기존 4항목 유지

import { CheckCircle2, XCircle, AlertTriangle, AlertOctagon, Lock } from "lucide-react";
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
  captcha_detected?: boolean;
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
  locked?: boolean;
  hiddenKeywordCount?: number;
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
  hasRecentPost?: boolean | null;
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
    <span className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
      양호
    </span>
  );
  if (value >= 40) return (
    <span className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
      보통
    </span>
  );
  return (
    <span className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
      개선 필요
    </span>
  );
}

function barColor(value: number): string {
  if (value >= 70) return "bg-green-500";
  if (value >= 40) return "bg-yellow-400";
  return "bg-red-400";
}

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="w-4 h-4 text-gray-300 shrink-0 inline-flex items-center justify-center text-xs">—</span>;
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
    : <XCircle className="w-4 h-4 text-red-700 shrink-0" />;
}

function WeightBadge({ pct, color }: { pct: number; color: string }) {
  return (
    <span className={`text-sm border px-2 py-0.5 rounded-full font-medium ${color}`}>
      가중치 {pct}%
    </span>
  );
}

// smart_place_completeness 역산
// 배점: is_smart_place(25) + has_recent_post(25) + has_intro(20) + rank_score(0~30)
// rank_score가 포함되어 정확한 역산 불가 → threshold 기반 근사치.
// hasSmartPlace/hasRecentPost/hasIntro prop이 직접 전달될 때는 이 함수 결과를 덮어씀.
function decodeSmartPlace(completeness: number): { registered: boolean; faq: boolean; recentPost: boolean; intro: boolean } {
  if (completeness < 25) return { registered: false, faq: false, recentPost: false, intro: false };
  if (completeness >= 70) return { registered: true, faq: false, recentPost: true, intro: true };
  if (completeness >= 50) return { registered: true, faq: false, recentPost: false, intro: false };
  if (completeness >= 45) return { registered: true, faq: false, recentPost: false, intro: true };
  return { registered: true, faq: false, recentPost: false, intro: false };
}

// ── v3.1 전용: 6항목 렌더러
function V31SixItems({
  locked = false,
  hiddenKeywordCount = 0,
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
  naverPlaceUrl,
}: {
  locked?: boolean;
  hiddenKeywordCount?: number;
  detail: V31Detail;
  naverResult: NaverResult | null;
  kakaoResult: KakaoResult | null;
  topMissingKeywords: string[];
  isKeywordEstimated: boolean;
  hasSmartPlace?: boolean;
  hasFaq?: boolean;
  hasRecentPost?: boolean | null;
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
  // null = 측정 불가(naver_result 없음 or captcha 차단) / false = 실측 미노출 / true = 실측 노출
  const _naverMeasured = naverResult != null && !naverResult.captcha_detected;
  const inBriefing: boolean | null = _naverMeasured ? (naverResult!.in_briefing ?? false) : null;
  const naverMentioned: boolean | null = _naverMeasured ? (naverResult!.mentioned ?? false) : null;

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
            <p className="text-sm text-gray-600">등록한 키워드로 네이버에서 직접 검색해 내 사업장이 몇 위에 나오는지 확인합니다</p>
          </div>
          {kwSearchItem?.measured === false ? (
            <span className="text-sm text-gray-600 font-medium w-28 text-right shrink-0">측정 대기</span>
          ) : (
            <ScoreBadge value={kwSearchItem?.score ?? 0} />
          )}
        </div>
        {kwSearchItem?.measured === false ? (
          <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-600">
            아직 측정 데이터 없음 — 키워드 등록 후 다음 주간 스캔 시 측정됩니다
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <ScoreBar value={kwSearchItem?.score ?? 0} color={barColor(kwSearchItem?.score ?? 0)} />
            </div>
            {(kwSearchItem?.score ?? 0) < 40 && (
              <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
                <span className="text-blue-600 text-sm shrink-0 mt-0.5">→</span>
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
            <p className="text-sm text-gray-600">리뷰 수 × 평균 별점 × 키워드 다양성으로 계산합니다</p>
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
            <span className="text-blue-600 text-sm shrink-0 mt-0.5">→</span>
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
                <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">(추정)</span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              등록·소식·소개글 완성도 기반, 순위·키워드 매칭 반영
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
              스마트플레이스 등록 · 소식 · 소개글 — 3항목 모두 완료
            </span>
          </div>
        ) : locked ? (
          // free 플랜: 어느 항목이 비었는지(✓/✗ + 구체 문구)는 그 자체로 처방전이므로
          // CSS 블러가 아니라 실제 값(spActual)을 아예 참조하지 않는 스켈레톤으로 렌더링
          // (블러는 DOM에 실값이 남아 view-source/요소검사로 그대로 드러남 — 2026-07-17 자체발견)
          // — 전체 완료(위 분기) 여부만은 안심 신호라 잠금 없이 노출
          <div className="relative rounded-lg overflow-hidden mb-2">
            <div className="space-y-1.5" aria-hidden="true">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-gray-300 shrink-0" />
                <span className="h-3.5 w-32 bg-gray-300 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-gray-300 shrink-0" />
                <span className="h-3.5 w-24 bg-gray-300 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-gray-300 shrink-0" />
                <span className="h-3.5 w-28 bg-gray-300 rounded" />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <a
                href="/pricing"
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded-full shadow-sm hover:bg-gray-50"
              >
                <Lock className="w-4 h-4" />
                어떤 항목이 부족한지 Basic에서 확인
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 mb-2">
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.registered} />
              <span className="text-sm text-gray-700">
                {spActual.registered ? "스마트플레이스 등록됨" : "스마트플레이스 미등록 — 지금 등록 필요"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.recentPost} />
              <span className="text-sm text-gray-700">
                {spActual.recentPost ? "소식 등록됨" : "최근 90일 내 소식 없음 — 핵심 개선 항목"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.intro} />
              <span className="text-sm text-gray-700">
                {spActual.intro ? "소개글 있음" : "소개글 없음 — 개선 필요"}
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
              {locked && hiddenKeywordCount > 0 && (
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-1 text-sm bg-amber-200 text-amber-900 px-2.5 py-1 rounded-full font-semibold hover:bg-amber-300 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  +{hiddenKeywordCount}개 더 — Basic에서 확인
                </a>
              )}
            </div>
            {isKeywordEstimated && (
              <p className="text-sm text-gray-600 italic mt-2">
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
              <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">(추정)</span>
            </div>
            <p className="text-sm text-gray-600">블로그 발행 빈도·외부 인용·업체명 매칭으로 콘텐츠 품질을 추정합니다</p>
          </div>
          <ScoreBadge value={blogItem?.score ?? 0} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <ScoreBar value={blogItem?.score ?? 0} color={barColor(blogItem?.score ?? 0)} />
        </div>
        <p className="text-sm text-gray-600 italic">
          측정 시점·기기·검색 환경에 따라 달라질 수 있습니다
        </p>
        {(blogItem?.score ?? 0) < 40 && (
          <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3 mt-2">
            <span className="text-blue-600 text-sm shrink-0 mt-0.5">→</span>
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
            <p className="text-sm text-gray-600">네이버 지도 등록 여부 + 카카오맵 리뷰 수·평점 통합 점수입니다</p>
          </div>
          <ScoreBadge value={mapItem?.score ?? 0} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <ScoreBar value={mapItem?.score ?? 0} color={barColor(mapItem?.score ?? 0)} />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <StatusIcon ok={!!(naverResult?.is_smart_place || naverPlaceUrl?.startsWith("http"))} />
          <span className="text-sm text-gray-700">
            {(naverResult?.is_smart_place || naverPlaceUrl?.startsWith("http")) ? "네이버 지도 플레이스 등록됨" : "네이버 지도 플레이스 미확인"}
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
                {aiBriefingApplicable ? "⑥ AI 브리핑 인용" : "⑥ 네이버 AI탭 (정식 출시)"}
              </span>
              {aiBriefingApplicable ? (
                <WeightBadge pct={weights["ai_briefing_score"]} color="text-blue-700 bg-blue-50 border-blue-200" />
              ) : (
                <span className="text-sm text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                  정식 출시
                </span>
              )}
            </div>
            <p className={`text-sm ${aiBriefingApplicable ? "text-gray-600" : "text-indigo-700"}`}>
              {aiBriefingApplicable
                ? "실제 네이버 AI 브리핑에 노출됐는지 확인합니다"
                : "네이버 AI탭은 업종 제한 발표가 없습니다 (2026-06-25 정식 출시)"}
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
                  {naverMentioned === null
                    ? "네이버 검색 측정 불가 (재스캔 권장)"
                    : naverMentioned
                      ? "네이버 검색에서 언급됨"
                      : "네이버 검색에서 미언급"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon ok={inBriefing} />
                <span className="text-sm text-gray-700">
                  {inBriefing === null
                    ? "네이버 AI 브리핑 측정 불가 (재스캔 권장)"
                    : inBriefing
                      ? "네이버 AI 브리핑 인용됨"
                      : "네이버 AI 브리핑 미노출"}
                </span>
              </div>
            </div>
            {!inBriefing && (
              <div className="flex items-start gap-2 bg-gray-100 rounded-lg p-3">
                <span className="text-gray-600 text-sm shrink-0 mt-0.5">→</span>
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
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                    가중치 0%
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                네이버 AI탭(정식 출시)에 사업장 답변이 노출됐는지 실측 확인합니다
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
  naverPlaceUrl,
}: {
  breakdown: Record<string, number | object>;
  naverResult: NaverResult | null;
  kakaoResult: KakaoResult | null;
  topMissingKeywords: string[];
  isKeywordEstimated: boolean;
  hasSmartPlace?: boolean;
  hasFaq?: boolean;
  hasRecentPost?: boolean | null;
  hasIntro?: boolean;
  reviewCount?: number;
  avgRating?: number;
  bizId?: string;
  token?: string;
  briefingEligibility?: "active" | "likely" | "inactive";
  naverPlaceUrl?: string | null;
}) {
  const kws = (breakdown["keyword_gap_score"] as number) ?? 0;
  const rqs = (breakdown["review_quality"] as number) ?? 0;
  const spc = (breakdown["smart_place_completeness"] as number) ?? 0;
  const nec = (breakdown["naver_exposure_confirmed"] as number) ?? 0;

  const spDecoded = decodeSmartPlace(Math.round(spc));
  const spActual = {
    registered: hasSmartPlace ?? (naverPlaceUrl?.startsWith("http") ? true : spDecoded.registered),
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
              <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                영향도 ★★★ (가중치 30%)
              </span>
              {isKeywordEstimated && (
                <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">(추정값)</span>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              소개글·리뷰·블로그 등 사업장 콘텐츠에서 업종 핵심 키워드가 얼마나 포함됐는지 측정합니다
            </p>
          </div>
          <ScoreBadge value={kws} />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <ScoreBar value={kws} color={barColor(kws)} />
        </div>
        {isKeywordEstimated && (
          <p className="text-sm text-gray-600 italic mb-2">
            리뷰가 쌓이면 정확해집니다. 현재는 블로그 텍스트 기반 추정값입니다.
          </p>
        )}
        {kws < 70 ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
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
              <span className="text-blue-600 text-sm shrink-0 mt-0.5">→</span>
              <p className="text-sm text-blue-800 font-medium">
                스마트플레이스 소개글·소식에 위 키워드를 포함하면 네이버 일반 검색 노출이 높아집니다
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
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
                영향도 ★★ (가중치 25%)
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">리뷰 수 × 평균 별점 × 키워드 다양성으로 계산합니다</p>
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
            <span className="text-blue-600 text-sm shrink-0 mt-0.5">→</span>
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
                영향도 ★★ (가중치 15%)
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              마지막 스캔 기준 · 등록·소식·소개글 완성도
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
              스마트플레이스 등록 · 소식 · 소개글 — 3항목 모두 완료
            </span>
          </div>
        ) : (
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.registered} />
              <span className="text-sm text-gray-700">
                {spActual.registered ? "스마트플레이스 등록됨" : "스마트플레이스 미등록 — 지금 등록 필요"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.recentPost} />
              <span className="text-sm text-gray-700">
                {spActual.recentPost ? "소식 등록됨" : "최근 90일 내 소식 없음 — 지금 업데이트 필요"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={spActual.intro} />
              <span className="text-sm text-gray-700">
                {spActual.intro ? "소개글 있음" : "소개글 없음 — 개선 필요"}
              </span>
            </div>
          </div>
        )}
        {spc < 100 && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-800 mb-1">
              지금 할 일:
              {!spActual.registered && " 스마트플레이스 등록"}
              {spActual.registered && !spActual.recentPost && " 소식 업데이트"}
              {spActual.registered && spActual.recentPost && !spActual.intro && " 소개글 추가"}
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
                <span className="text-sm md:text-base font-semibold text-indigo-900">4. 네이버 AI탭 (정식 출시)</span>
                <span className="text-sm text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                  정식 출시
                </span>
              </div>
              <p className="text-sm text-indigo-700 leading-relaxed">
                네이버 AI탭은 업종 제한 발표가 없습니다 (2026-06-25 정식 출시)
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
                <span className="text-sm text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full font-medium">
                  영향도 ★ (가중치 15%)
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">실제 네이버 AI 브리핑에 노출됐는지 확인합니다</p>
            </div>
            <ScoreBadge value={nec} />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <ScoreBar value={nec} color={barColor(nec)} />
          </div>
          {!inBriefing && (
            <div className="flex items-start gap-2 bg-gray-100 rounded-lg p-3">
              <span className="text-gray-600 text-sm shrink-0 mt-0.5">→</span>
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
  locked = false,
  hiddenKeywordCount = 0,
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
              채널별 노출 분석 ({isV32Parent ? "7" : isV31 ? "6" : "4"}가지 항목)
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              채널별 노출 현황과 항목별 분석입니다
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
            <p className="text-sm text-gray-600">이 업종 고객이 네이버 vs 글로벌 AI를 사용하는 비율</p>
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
              <div className="text-sm text-gray-600">업종 가중치 {naverWeightPct}%</div>
            </div>
            {effectiveGroup === "INACTIVE" ? (
              <span className="text-sm px-3 py-1 rounded-full font-semibold border bg-gray-100 text-gray-600 border-gray-200">
                플레이스형 비대상 · 정보형 블로그로 가능
              </span>
            ) : (
              <span className={`text-sm px-3 py-1 rounded-full font-semibold border ${
                track1Score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : track1Score >= 65 ? "bg-blue-50 text-blue-600 border-blue-100"
                : track1Score >= 45 ? "bg-yellow-50 text-yellow-600 border-yellow-200"
                : track1Score >= 25 ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-100"
              }`}>
                {track1Score >= 80 ? "우수" : track1Score >= 65 ? "양호" : track1Score >= 45 ? "보통" : track1Score >= 25 ? "미흡" : "주의 필요"}
              </span>
            )}
          </div>

          {/* INACTIVE 업종 안내 배너 */}
          {effectiveGroup === "INACTIVE" && (
            <div className="mb-3 space-y-2">
              {/* 네이버 SEO 검색 노출 안내 */}
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 flex items-start gap-2">
                <span className="text-blue-600 text-sm shrink-0 mt-0.5">🔍</span>
                <p className="text-sm text-blue-900 leading-relaxed">
                  <strong>네이버 일반 검색 상위 노출은 가능합니다.</strong>{" "}
                  AI 브리핑 대상은 아니지만, <strong>스마트플레이스 최적화·블로그 후기·키워드 관리</strong>로
                  네이버 검색 결과 상위에 노출될 수 있습니다.
                  아래 ①~⑤ 항목 점수를 높이면 네이버 검색 클릭이 늘어납니다.
                </p>
              </div>
              {/* AI탭 안내 */}
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 flex items-start gap-2">
                <span className="text-indigo-400 text-sm shrink-0 mt-0.5">ℹ️</span>
                <p className="text-sm text-indigo-800 leading-relaxed">
                  <strong>네이버 AI탭</strong>은 업종 제한 없이 노출 가능합니다 (2026-06-25 정식 출시).{" "}
                  소개글 200자 이상·사진 10장 이상·블로그 후기 확보가 핵심입니다.
                </p>
              </div>
            </div>
          )}

          {/* ACTIVE/LIKELY: 이 서비스의 개선 항목 = 네이버 SEO 상위노출로 직결된다는 정방향 안내 (2026-07-09 신설) */}
          {(effectiveGroup === "ACTIVE" || effectiveGroup === "LIKELY") && (
            <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 p-3 flex items-start gap-2">
              <span className="text-blue-600 text-sm shrink-0 mt-0.5">🔍</span>
              <p className="text-sm text-blue-900 leading-relaxed">
                <strong>아래 항목 점수를 올리면 네이버 일반 검색 상위 노출도 함께 좋아집니다.</strong>{" "}
                <strong>①키워드 검색 노출</strong>은 네이버에서 실제 검색했을 때의 순위 그 자체이며,
                소개글·리뷰·블로그 개선은 AI 브리핑·AI탭 노출과 네이버 일반 검색 순위를 동시에 끌어올립니다.
              </p>
            </div>
          )}

          {/* v3.1 / v3.0 분기 렌더링 */}
          {isV31 && track1Detail ? (
            <V31SixItems
              locked={locked}
              hiddenKeywordCount={hiddenKeywordCount}
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
              naverPlaceUrl={naverPlaceUrl}
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
              naverPlaceUrl={naverPlaceUrl}
            />
          )}
        </div>

        {/* Track 2 섹션 */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-0.5">
                ChatGPT · Gemini 등 글로벌 AI 노출 현황
              </div>
              <div className="text-sm text-gray-600">업종 가중치 {globalWeight}%</div>
            </div>
            <span className={`text-sm px-3 py-1 rounded-full font-semibold border ${
              track2Score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : track2Score >= 60 ? "bg-blue-50 text-blue-600 border-blue-100"
              : track2Score >= 35 ? "bg-yellow-50 text-yellow-600 border-yellow-200"
              : track2Score >= 10 ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-red-50 text-red-700 border-red-100"
            }`}>
              {track2Score >= 80 ? "우수" : track2Score >= 60 ? "양호" : track2Score >= 35 ? "보통" : track2Score >= 10 ? "낮음" : "측정 대기"}
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
                    hasError ? "bg-gray-50 border-gray-100 text-gray-600" :
                    ok ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                  }`}
                >
                  {hasError
                    ? <span className="text-gray-600 text-sm font-bold">?</span>
                    : ok
                      ? <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-700 shrink-0" />
                  }
                  <span className={`text-sm ${hasError ? "text-gray-600" : ok ? "text-green-800 font-medium" : "text-red-700"}`}>
                    {label}
                  </span>
                  {r.exposure_freq !== undefined && r.exposure_freq > 0 && (
                    <span className="text-sm text-gray-600 ml-auto">
                      {r.exposure_freq}회
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {track2Score < 30 && (
            <div className="mt-3 bg-purple-50 border border-purple-100 rounded-lg p-3 space-y-1.5">
              <p className="text-sm text-purple-800">
                <span className="font-semibold">지금 노출 안 되는 건 정상입니다.</span>{" "}
                ChatGPT는 학습 데이터 기반이라 수개월~1년 소요됩니다. Gemini는 구글 비즈니스 프로필 등록 후 2~4주 내 개선이 시작될 수 있습니다.
              </p>
              <p className="text-sm text-purple-700">
                <span className="font-medium">지금 할 수 있는 것:</span>{" "}
                <a href="/schema" className="underline font-medium">AI 인식 코드(JSON-LD) 등록</a>으로
                Google AI Overview 노출 가능성을 높이고, 블로그·뉴스 후기를 꾸준히 쌓으면 ChatGPT·Gemini에도 서서히 반영됩니다.
              </p>
            </div>
          )}
        </div>

        {/* 면책 문구 */}
        <p className="text-sm text-gray-600 border-t border-gray-100 pt-4">
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
                    <AlertOctagon className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
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
                    <span className={`text-sm font-bold shrink-0 ${m.priority === "critical" ? "text-red-700" : "text-blue-600"}`}>
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
