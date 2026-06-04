"use client";

import { useState } from "react";
import { RefreshCw, Star, CheckCircle, XCircle, Info, Lock, ExternalLink } from "lucide-react";
import { updateCompetitor, syncCompetitorPlace } from "@/lib/api";

// 플레이스 카드에 필요한 최소 Competitor 필드만 정의
interface CompetitorWithPlace {
  id: string;
  name: string;
  naver_place_id?: string;
  place_review_count?: number | null;
  place_avg_rating?: number | null;
  place_has_faq?: boolean;
  place_has_recent_post?: boolean;
  place_has_menu?: boolean;
  place_photo_count?: number | null;
  place_synced_at?: string | null;
  // 신규 필드 (v3.1)
  blog_mention_count?: number | null;
  website_url?: string | null;
  website_seo_score?: number | null;
  website_seo_result?: Record<string, boolean | number | string> | null;
  comp_keywords?: Record<string, string[]> | null;
  // 신규 필드 (v5.5)
  place_has_intro?: boolean;
  ai_excerpt?: string | null;
  faq_questions?: string[] | null;
  // 신규 필드 (v5.6)
  weakness_data?: {
    competitor_name: string;
    total_posts_analyzed: number;
    has_weakness: boolean;
    weaknesses: Array<{
      keyword: string;
      count: number;
      opportunity: string;
    }>;
  } | null;
}

interface Props {
  competitor: CompetitorWithPlace;
  myReviewCount: number;
  myAvgRating: number;
  onSyncRequest: () => void;
  accessToken?: string;
  onPlaceIdSaved?: () => void;
  myBlogMentions?: number;   // 내 가게 블로그 언급 수 (비교용)
  canViewStartup?: boolean;  // 창업패키지+ 여부 (키워드 섹션 잠금)
  onFetchFaq?: () => void;
  isFetchingFaq?: boolean;
  onFetchWeakness?: () => void;
  isFetchingWeakness?: boolean;
}

function ReviewCompareBar({
  myCount,
  compCount,
}: {
  myCount: number;
  compCount: number;
}) {
  const total = Math.max(myCount + compCount, 1);
  const myPct = Math.round((myCount / total) * 100);
  const compPct = 100 - myPct;
  const diff = compCount - myCount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-blue-700">내 가게</span>
        <span className="font-medium text-gray-700">{myCount}개 리뷰</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-blue-500 rounded-l-full transition-all"
          style={{ width: `${myPct}%` }}
        />
        <div
          className="h-full bg-red-300 rounded-r-full transition-all"
          style={{ width: `${compPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{compCount}개 리뷰</span>
        {diff > 0 ? (
          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold text-sm border border-red-200">
            리뷰 {diff}개 부족
          </span>
        ) : diff < 0 ? (
          <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm border border-green-200">
            리뷰 {Math.abs(diff)}개 앞서는 중
          </span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-sm">
            동률
          </span>
        )}
      </div>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i <= full
              ? "text-yellow-400 fill-yellow-400"
              : i === full + 1 && half
              ? "text-yellow-300 fill-yellow-200"
              : "text-gray-200 fill-gray-100"
          }`}
        />
      ))}
      <span className="ml-1 text-sm font-semibold text-gray-700">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

// 경쟁사 현황만 보여주는 단순 카드 (내 가게 데이터는 별도 수집 필요)
function CompletenessItem({
  label,
  tip,
  hasComp,
}: {
  label: string;
  tip: string;   // 경쟁사가 보유했을 때 사용자에게 보여줄 행동 안내
  hasComp: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-100 last:border-0 gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 font-medium">{label}</p>
        {hasComp && (
          <p className="text-sm text-amber-700 mt-0.5 leading-snug">{tip}</p>
        )}
      </div>
      <div className="shrink-0 mt-0.5">
        {hasComp ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
            <CheckCircle className="w-3 h-3" /> 경쟁사 등록
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
            <XCircle className="w-3 h-3" /> 미등록
          </span>
        )}
      </div>
    </div>
  );
}

// 웹사이트 SEO 항목용 (경쟁사 보유 여부만)
function SeoItem({ label, hasComp }: { label: string; hasComp: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      {hasComp ? (
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3" /> 적용
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          <XCircle className="w-3 h-3" /> 미적용
        </span>
      )}
    </div>
  );
}

function LockedFeature({ requiredPlan, feature }: { requiredPlan: string; feature: string }) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
      <Lock className="w-3.5 h-3.5 text-gray-300 shrink-0" />
      <span className="text-sm text-gray-400">{feature} — {requiredPlan} 플랜부터 이용 가능</span>
    </div>
  );
}

function BlogMentionBar({
  myCount,
  compCount,
}: {
  myCount: number;
  compCount: number;
}) {
  const total = Math.max(myCount + compCount, 1);
  const myPct = Math.round((myCount / total) * 100);
  const compPct = 100 - myPct;
  const diff = compCount - myCount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-blue-700">내 가게</span>
        <span className="font-medium text-gray-700">{myCount}회</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-blue-500 rounded-l-full transition-all"
          style={{ width: `${myPct}%` }}
        />
        <div
          className="h-full bg-amber-300 rounded-r-full transition-all"
          style={{ width: `${compPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">경쟁사 {compCount}회</span>
        {diff > 0 ? (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold text-sm border border-amber-200">
            경쟁사 {diff}회 더 많음
          </span>
        ) : diff < 0 ? (
          <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm border border-green-200">
            {Math.abs(diff)}회 앞서는 중
          </span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-sm">동률</span>
        )}
      </div>
      <p className="text-sm text-gray-400 leading-relaxed">
        블로그 포스팅이 많을수록 AI 검색에서 더 자주 인용됩니다.
      </p>
    </div>
  );
}

export function CompetitorPlaceCard({
  competitor,
  myReviewCount,
  myAvgRating,
  onSyncRequest,
  accessToken,
  onPlaceIdSaved,
  myBlogMentions = 0,
  canViewStartup = false,
  onFetchFaq,
  isFetchingFaq = false,
  onFetchWeakness,
  isFetchingWeakness = false,
}: Props) {
  const [syncing, setSyncing] = useState(false);
  // 저장된 naver_place_id가 있으면 초기값으로 pre-populate
  const [localPlaceId, setLocalPlaceId] = useState(competitor.naver_place_id ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // page.tsx는 Supabase 직접 쿼리(raw 컬럼명), 백엔드 API는 매핑명 — 둘 다 체크
  const hasData = !!(
    competitor.place_synced_at ||
    (competitor as unknown as Record<string, unknown>).naver_place_last_synced_at
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSyncRequest();
    } finally {
      setSyncing(false);
    }
  };

  const handleSavePlaceId = async () => {
    const trimmed = localPlaceId.trim();
    if (!trimmed || !accessToken) return;
    setIsSaving(true);
    setSaveError("");
    try {
      await updateCompetitor(competitor.id, { naver_place_id: trimmed }, accessToken);
      const syncOk = await syncCompetitorPlace(competitor.id, accessToken)
        .then(() => true)
        .catch(() => false);
      setSaveSuccess(true);
      if (!syncOk) {
        setSaveError('플레이스 ID 저장 완료. 데이터 수집은 새로고침 버튼으로 직접 실행하세요.');
      }
      setTimeout(() => onPlaceIdSaved?.(), 1500); // 성공 메시지 잠깐 보여준 뒤 새로고침
    } catch {
      setSaveError("저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const syncedTimeLabel = competitor.place_synced_at
    ? new Date(competitor.place_synced_at).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  if (!hasData) {
    return (
      <div className="mt-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 leading-relaxed">
              네이버 플레이스 ID를 입력하면
            </p>
            <p className="text-sm text-gray-500">
              리뷰 수·평점을 자동으로 가져옵니다
            </p>
          </div>
        </div>

        {/* 플레이스 ID 입력 필드 */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="예: 1234567890"
              value={localPlaceId}
              onChange={(e) => setLocalPlaceId(e.target.value.replace(/\D/g, ""))}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSavePlaceId}
              disabled={isSaving || !localPlaceId.trim()}
              className="shrink-0 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" />저장 중</>
              ) : (
                "저장"
              )}
            </button>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            네이버 지도에서 업체 검색 후 URL의 숫자 복사 (예: map.naver.com/p/entry/place/<strong>1234567890</strong>)
          </p>
          {saveError && (
            <p className="text-sm text-red-500">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="text-sm text-green-600 font-semibold">
              ✓ 저장 완료! 데이터를 수집하는 중입니다 (30초~1분 소요)
            </p>
          )}
          {/* 이미 place_id가 있으면 동기화 버튼 표시 */}
          {localPlaceId && !saveSuccess && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "동기화 중..." : "저장된 ID로 지금 동기화"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const compReviewCount = competitor.place_review_count ?? 0;
  const compAvgRating = competitor.place_avg_rating ?? 0;
  const ratingDiff = myAvgRating - compAvgRating;

  return (
    <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4 space-y-4">
      {/* 헤더: 마지막 동기화 + 새로고침 버튼 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">네이버 플레이스 비교</span>
        <div className="flex items-center gap-2">
          {syncedTimeLabel && (
            <span className="text-sm text-gray-400">{syncedTimeLabel} 기준</span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="수동 새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 리뷰 수 비교 */}
      <div>
        <div className="text-sm font-medium text-gray-600 mb-2">리뷰 수 비교</div>
        <ReviewCompareBar myCount={myReviewCount} compCount={compReviewCount} />
      </div>

      {/* 평점 비교 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 w-16">내 가게</span>
            <StarRating rating={myAvgRating} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 w-16">경쟁사</span>
            <StarRating rating={compAvgRating} />
          </div>
        </div>
        {compAvgRating > 0 && (
          <div>
            {ratingDiff < -0.2 ? (
              <span className="text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                평점 {Math.abs(ratingDiff).toFixed(1)} 낮음
              </span>
            ) : ratingDiff > 0.2 ? (
              <span className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                평점 {ratingDiff.toFixed(1)} 높음
              </span>
            ) : (
              <span className="text-sm text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                비슷한 평점
              </span>
            )}
          </div>
        )}
      </div>

      {/* 플레이스 완성도 — 경쟁사 현황 + 행동 안내 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">스마트플레이스 현황</span>
          <span className="text-sm text-gray-400">경쟁사 기준</span>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-1">
          <CompletenessItem
            label="사업장 소개글 등록"
            tip="경쟁사가 소개글을 등록했습니다. 소개글은 AI 검색이 가게를 설명하는 핵심 소스입니다 — 500자 이상 작성을 권장합니다."
            hasComp={competitor.place_has_intro ?? false}
          />
          <CompletenessItem
            label="소개글 Q&A 섹션 포함"
            tip="경쟁사가 소개글에 Q&A를 포함하고 있습니다. 스마트플레이스 사장님 Q&A 탭은 폐기됐으므로, 소개글(업체정보 → 소개글)에 Q&A를 자연스럽게 넣는 방식이 현재 활용 가능한 경로입니다."
            hasComp={competitor.place_has_faq ?? false}
          />
          <CompletenessItem
            label="최근 소식·이벤트 게시"
            tip="경쟁사가 소식을 올리고 있습니다. 주 1회 소식을 게시하면 AI 검색 최신성 점수가 올라갑니다."
            hasComp={competitor.place_has_recent_post ?? false}
          />
          <CompletenessItem
            label="메뉴·서비스 가격표 등록"
            tip="경쟁사가 메뉴/가격표를 등록했습니다. 메뉴 정보는 AI가 가게를 소개할 때 자주 활용합니다."
            hasComp={competitor.place_has_menu ?? false}
          />
          {competitor.place_photo_count != null && (
            <div className="flex items-center justify-between py-2.5 last:border-0">
              <p className="text-sm text-gray-700 font-medium">사진 등록 수</p>
              <span className="text-sm font-bold text-gray-800">{competitor.place_photo_count}장</span>
            </div>
          )}
        </div>
        {/* 모두 미등록인 경우 안내 */}
        {!(competitor.place_has_intro || competitor.place_has_faq || competitor.place_has_recent_post || competitor.place_has_menu) && (
          <p className="text-sm text-gray-400 mt-2 px-1">
            경쟁사도 아직 미등록 — 먼저 등록하면 AI 검색에서 앞설 수 있습니다.
          </p>
        )}
      </div>

      {/* ── AI 추천 문장 ── */}
      {competitor.ai_excerpt && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span>🤖</span>
            <span className="text-sm font-medium text-gray-600">AI가 이 가게를 소개한 문장</span>
          </div>
          <blockquote className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl px-4 py-3">
            <p className="text-sm text-blue-900 leading-relaxed italic">"{competitor.ai_excerpt}"</p>
            <p className="text-sm text-blue-500 mt-1.5">Gemini AI 스캔 기준</p>
          </blockquote>
          <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
            AI가 경쟁사를 이렇게 소개하고 있습니다. 내 가게도 이런 키워드가 포함되도록 소개글을 작성하세요.
          </p>
        </div>
      )}

      {/* ── 블로그 언급 수 ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span>📰</span>
            <span className="text-sm font-medium text-gray-600">네이버 블로그 언급 수</span>
          </div>
          <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">자동 수집</span>
        </div>
        <p className="text-sm text-gray-400 mb-2 leading-relaxed">
          경쟁사 이름으로 네이버 블로그를 자동 검색해 몇 개의 포스팅이 있는지 확인합니다. 블로그 포스팅이 많을수록 AI 검색에서 더 자주 인용됩니다.
        </p>
        {competitor.blog_mention_count == null ? (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-dashed border-gray-200">
            새로고침 버튼을 누르면 자동으로 수집됩니다.
          </p>
        ) : (
          <BlogMentionBar
            myCount={myBlogMentions}
            compCount={competitor.blog_mention_count}
          />
        )}
      </div>

      {/* ── 웹사이트 보유 및 AI 검색 최적화 ── */}
      <div>
        <div className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-1.5">
          <span>🌐</span> 웹사이트 보유 및 AI 검색 최적화
        </div>
        {competitor.website_url ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <CheckCircle className="w-3.5 h-3.5" /> 경쟁사 웹사이트 있음
              </span>
              <a
                href={competitor.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> 방문
              </a>
              {competitor.website_seo_score != null && (
                <span className="text-sm font-semibold text-gray-500">
                  AI 최적화 점수 {competitor.website_seo_score}점 / 100점
                </span>
              )}
            </div>
            {competitor.website_seo_result && (
              <div className="bg-gray-50 rounded-xl px-3 py-1">
                {Object.entries(competitor.website_seo_result)
                  .filter(([, v]) => typeof v === "boolean")
                  .map(([key, val]) => {
                    const LABELS: Record<string, string> = {
                      has_json_ld: "AI 검색 정보 태그 설정",
                      has_schema_local_business: "가게 정보 자동 인식 설정",
                      has_open_graph: "SNS 공유 미리보기 설정",
                      is_mobile_friendly: "모바일 화면 최적화",
                      has_favicon: "사이트 아이콘 등록",
                      is_https: "보안 연결 (HTTPS)",
                      has_og_tags: "SNS 공유 미리보기 설정",
                      has_viewport: "모바일 화면 최적화",
                      has_local_business_schema: "가게 정보 자동 인식 설정",
                    };
                    if (!LABELS[key]) return null;
                    return (
                      <SeoItem key={key} label={LABELS[key]} hasComp={val as boolean} />
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full">
              <XCircle className="w-3.5 h-3.5" /> 경쟁사 웹사이트 없음
            </span>
            <span className="text-sm text-gray-400">— 내 가게에 웹사이트가 있다면 유리합니다</span>
          </div>
        )}
      </div>

      {/* ── FAQ 질문 목록 ── */}
      {competitor.place_has_faq && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span>❓</span>
            <span className="text-sm font-medium text-gray-600">경쟁사 FAQ 질문</span>
            <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">내 FAQ 작성 참고용</span>
          </div>
          {(!competitor.faq_questions || competitor.faq_questions.length === 0) ? (
            <button
              onClick={onFetchFaq}
              disabled={isFetchingFaq}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFaq ? 'animate-spin' : ''}`} />
              {isFetchingFaq ? 'FAQ 수집 중...' : '경쟁사 FAQ 질문 불러오기'}
            </button>
          ) : (
            <div className="space-y-1.5">
              {competitor.faq_questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-blue-500 font-bold text-sm shrink-0">Q.</span>
                  <p className="text-sm text-gray-700 leading-relaxed">{q}</p>
                </div>
              ))}
              <p className="text-sm text-gray-400 mt-2">위 질문들을 참고해 내 가게 FAQ를 작성하면 AI 검색 노출에 유리합니다.</p>
            </div>
          )}
        </div>
      )}

      {/* ── 키워드 분석 (창업패키지+ 전용) ── */}
      <div>
        <div className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-1.5">
          <span>🔑</span> 경쟁사 보유 키워드
        </div>
        {!canViewStartup ? (
          <LockedFeature
            requiredPlan="창업패키지"
            feature="경쟁사 키워드 분석"
          />
        ) : competitor.comp_keywords == null ? (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-dashed border-gray-200">
            키워드 데이터 동기화가 필요합니다.
          </p>
        ) : (
          <div className="space-y-3">
            {/* present 키워드 */}
            {(competitor.comp_keywords.present?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-1.5">경쟁사 리뷰에서 자주 나오는 키워드:</p>
                <div className="flex flex-wrap gap-1.5">
                  {competitor.comp_keywords.present!.map((kw) => (
                    <span
                      key={kw}
                      className="bg-blue-100 text-blue-700 text-sm px-2.5 py-0.5 rounded-full border border-blue-200 font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* missing 키워드 (경쟁사에 있고 나는 없음) */}
            {(competitor.comp_keywords.missing?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm font-semibold text-red-600 mb-1.5">우리 가게에 없는 키워드:</p>
                <div className="flex flex-wrap gap-1.5">
                  {competitor.comp_keywords.missing!.map((kw) => (
                    <span
                      key={kw}
                      className="bg-red-100 text-red-700 text-sm px-2.5 py-0.5 rounded-full border border-red-200 font-semibold"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* pioneer 키워드 */}
            {(competitor.comp_keywords.pioneer?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-1.5">경쟁사 선점 키워드:</p>
                <div className="flex flex-wrap gap-1.5">
                  {competitor.comp_keywords.pioneer!.map((kw) => (
                    <span
                      key={kw}
                      className="bg-emerald-100 text-emerald-700 text-sm px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 경쟁사 약점 분석 ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span>🎯</span>
            <span className="text-sm font-medium text-gray-600">경쟁사 약점 — 내 가게 공략 포인트</span>
          </div>
          <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">블로그 분석</span>
        </div>
        {competitor.weakness_data == null ? (
          <button
            onClick={onFetchWeakness}
            disabled={isFetchingWeakness}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingWeakness ? 'animate-spin' : ''}`} />
            {isFetchingWeakness ? '블로그 분석 중...' : '경쟁사 약점 분석하기'}
          </button>
        ) : !competitor.weakness_data.has_weakness ? (
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-dashed border-gray-200">
            <p className="text-sm text-gray-500">
              최근 블로그 {competitor.weakness_data.total_posts_analyzed}개 포스팅에서 뚜렷한 약점이 발견되지 않았습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">블로그 {competitor.weakness_data.total_posts_analyzed}개 포스팅 분석 결과:</p>
            {competitor.weakness_data.weaknesses.map((w, i) => (
              <div key={i} className="bg-red-50 border border-red-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                    &quot;{w.keyword}&quot; {w.count}회 언급
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">→ {w.opportunity}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
