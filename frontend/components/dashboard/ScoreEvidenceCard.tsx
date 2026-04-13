// ScoreEvidenceCard.tsx — 네이버 기반 점수 근거 카드 (서버 컴포넌트)
// Track 1 · Track 2 각 항목의 점수 근거와 구체적 개선 행동을 소상공인 눈높이로 표시

import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

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

// 레이블 변환 헬퍼 (영문 키를 화면에 표시할 때 사용)
function scoreLabel(key: string): string {
  return SCORE_LABELS[key] ?? key;
}

void scoreLabel; // 미사용 경고 방지 (향후 dynamic rendering 시 활용)

interface NaverResult {
  mentioned?: boolean
  in_briefing?: boolean
  excerpt?: string | null
  top_blogs?: Array<{ title?: string; description?: string }>
  is_smart_place?: boolean
  review_count?: number
  avg_rating?: number
}

interface KakaoResult {
  review_count?: number
  avg_rating?: number
  is_on_kakao?: boolean
  my_rank?: number | null
}

interface PlatformResult {
  mentioned?: boolean
  exposure_freq?: number
  error?: string
}

interface Props {
  breakdown: Record<string, number>
  naverResult: NaverResult | null
  kakaoResult: KakaoResult | null
  topMissingKeywords: string[]
  isKeywordEstimated: boolean
  track1Score: number
  track2Score: number
  naverWeight: number
  allPlatformResults: Record<string, PlatformResult>
  reviewCount?: number
  avgRating?: number
  hasSmartPlace?: boolean
  hasFaq?: boolean
  hasRecentPost?: boolean
  hasIntro?: boolean
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-3">
      <div
        className={`${color} h-3 rounded-full transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

function ScoreBadge({ value }: { value: number }) {
  const color =
    value >= 70 ? "text-green-600" :
    value >= 40 ? "text-yellow-600" :
    "text-red-500"
  return (
    <span className={`text-base md:text-lg font-bold w-12 text-right shrink-0 ${color}`}>
      {Math.round(value)}
    </span>
  )
}

function barColor(value: number): string {
  if (value >= 70) return "bg-green-500"
  if (value >= 40) return "bg-yellow-400"
  return "bg-red-400"
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
}

// smart_place_completeness 값으로 세부 항목 유무 역산
// 40(sp) + 30(faq) + 20(post) + 10(intro) 조합
// 가능한 확정 값: 0, 40, 50, 60, 70, 80, 90, 100
// 그 외 중간값은 역산 불가 → 보수적으로 "확인 필요" 처리
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
  }
  // 확정 조합에 있으면 반환, 없으면 보수적 판단 (모두 확인 필요 = false)
  if (completeness in KNOWN_COMBOS) return KNOWN_COMBOS[completeness]
  // 0~40 미만: 미등록 확실
  if (completeness < 40) return { registered: false, faq: false, recentPost: false, intro: false }
  // 그 외 중간값: 등록은 확실하나 세부 항목은 불확실 → false(없다고 표시)로 보수적 처리
  return { registered: true, faq: false, recentPost: false, intro: false }
}

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
}: Props) {
  const kws = breakdown["keyword_gap_score"] ?? 0
  const rqs = breakdown["review_quality"] ?? 0
  const spc = breakdown["smart_place_completeness"] ?? 0
  const nec = breakdown["naver_exposure_confirmed"] ?? 0

  const spDecoded = decodeSmartPlace(Math.round(spc))

  // 리뷰 수·평점 통합 (kakaoResult 또는 prop 우선)
  const finalReviewCount = (kakaoResult?.review_count ?? reviewCount ?? naverResult?.review_count ?? 0)
  const finalAvgRating   = (kakaoResult?.avg_rating   ?? avgRating   ?? naverResult?.avg_rating   ?? 0)

  // 네이버 AI 브리핑 상태
  const inBriefing   = naverResult?.in_briefing ?? false
  const naverMentioned = naverResult?.mentioned  ?? false

  // Track 2 플랫폼 노출 정리
  const platformList: { key: string; label: string }[] = [
    { key: "gemini",     label: "Gemini" },
    { key: "chatgpt",    label: "ChatGPT" },
    { key: "perplexity", label: "Perplexity" },
    { key: "google",     label: "Google AI" },
  ]

  const globalWeight = Math.round((1 - naverWeight) * 100)
  const naverWeightPct = Math.round(naverWeight * 100)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-100 bg-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base md:text-lg font-bold text-gray-900">
              네이버 기반 점수 근거
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              왜 이 점수인지 4가지 항목으로 설명합니다
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
              네이버 {naverWeightPct}%
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-semibold">
              글로벌 {globalWeight}%
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* ── 네이버 AI 브리핑 준비 상태 ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-0.5">
                네이버 AI 브리핑 준비 상태
              </div>
              <div className="text-sm text-gray-500">업종 점수의 {naverWeightPct}% 반영</div>
            </div>
            <div className={`text-2xl md:text-3xl font-bold ${track1Score >= 70 ? "text-green-600" : track1Score >= 40 ? "text-yellow-600" : "text-red-500"}`}>
              {Math.round(track1Score)}
              <span className="text-sm text-gray-400 font-normal ml-1">/ 100</span>
            </div>
          </div>

          <div className="space-y-5">
            {/* 1. 키워드 커버리지 */}
            <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm md:text-base font-semibold text-gray-800">
                      1. 키워드 커버리지
                    </span>
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                      영향도 ★★★ (전체 점수의 35%)
                    </span>
                    {isKeywordEstimated && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        추정값
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    리뷰·블로그에서 업종 핵심 키워드가 얼마나 언급됐는지 측정합니다
                  </p>
                </div>
                <ScoreBadge value={kws} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <ScoreBar value={kws} color={barColor(kws)} />
              </div>
              {isKeywordEstimated && (
                <p className="text-xs text-gray-400 italic mb-2">
                  리뷰가 쌓이면 정확해집니다. 현재는 블로그 텍스트 기반 추정값입니다.
                </p>
              )}
              {kws < 70 ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-700">
                      리뷰·블로그에서 업종 키워드가 {kws < 30 ? "거의 발견되지 않았습니다" : "부족하게 발견됩니다"}
                    </p>
                  </div>
                  {topMissingKeywords.length > 0 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-2">
                        지금 없는 키워드 (FAQ·소개글에 추가하면 즉시 개선)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {topMissingKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="text-sm bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
                    <span className="text-blue-500 text-sm shrink-0 mt-0.5">→</span>
                    <p className="text-sm text-blue-800 font-medium">
                      스마트플레이스 FAQ에 위 키워드를 포함해 등록하면 AI 브리핑 인용 확률이 높아집니다
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
                    <span className="text-sm md:text-base font-semibold text-gray-800">
                      2. 리뷰 품질
                    </span>
                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                      영향도 ★★ (전체 점수의 25%)
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    리뷰 수 × 평균 별점 × 키워드 다양성으로 계산합니다
                  </p>
                </div>
                <ScoreBadge value={rqs} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <ScoreBar value={rqs} color={barColor(rqs)} />
              </div>
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center gap-2">
                  <StatusIcon ok={finalReviewCount > 0} />
                  <span className="text-sm text-gray-700">
                    {finalReviewCount > 0
                      ? `리뷰 ${finalReviewCount}개 확인됨${finalAvgRating > 0 ? ` · 평균 ${finalAvgRating.toFixed(1)}점` : ""}`
                      : "리뷰 없음 — 아직 리뷰가 수집되지 않았습니다"
                    }
                  </span>
                </div>
              </div>
              {rqs < 70 && (
                <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-3">
                  <span className="text-blue-500 text-sm shrink-0 mt-0.5">→</span>
                  <p className="text-sm text-blue-800 font-medium">
                    {finalReviewCount === 0
                      ? "단골 손님 1명에게 네이버 지도 리뷰를 요청하세요. 리뷰 1개만 있어도 점수가 올라갑니다"
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
                    <span className="text-sm md:text-base font-semibold text-gray-800">
                      3. 스마트플레이스 완성도
                    </span>
                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                      영향도 ★★ (전체 점수의 25%)
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    등록(40) + FAQ(30) + 소식(20) + 소개글(10) = 최대 100점
                  </p>
                </div>
                <ScoreBadge value={spc} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <ScoreBar value={spc} color={barColor(spc)} />
              </div>
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2">
                  <StatusIcon ok={spDecoded.registered} />
                  <span className="text-sm text-gray-700">
                    {spDecoded.registered ? "스마트플레이스 등록됨 (+40점)" : "스마트플레이스 미등록 — 등록 즉시 40점 획득"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon ok={spDecoded.faq} />
                  <span className={`text-sm ${spDecoded.faq ? "text-gray-700" : "text-red-600 font-medium"}`}>
                    {spDecoded.faq
                      ? "FAQ 등록됨 (+30점) — AI 브리핑 직접 인용 경로"
                      : "FAQ 없음 — AI 브리핑 직접 인용 경로 (최대 +30점)"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon ok={spDecoded.recentPost} />
                  <span className="text-sm text-gray-700">
                    {spDecoded.recentPost ? "소식 등록됨 (+20점)" : "소식 없음 — 최신성 점수 유지에 필요 (+20점)"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon ok={spDecoded.intro} />
                  <span className="text-sm text-gray-700">
                    {spDecoded.intro ? "소개글 있음 (+10점)" : "소개글 없음 (+10점)"}
                  </span>
                </div>
              </div>
              {spc < 100 && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-blue-800 mb-1">
                    지금 할 일:
                    {!spDecoded.registered && " 스마트플레이스 등록 (40점)"}
                    {spDecoded.registered && !spDecoded.faq && " FAQ 1개 등록 (+30점)"}
                    {spDecoded.registered && spDecoded.faq && !spDecoded.recentPost && " 소식 업데이트 (+20점)"}
                    {spDecoded.registered && spDecoded.faq && spDecoded.recentPost && !spDecoded.intro && " 소개글 추가 (+10점)"}
                  </p>
                  {!spDecoded.faq && spDecoded.registered && (
                    <p className="text-sm text-blue-700">
                      FAQ는 AI 브리핑이 가장 자주 직접 인용하는 항목입니다. 5분이면 등록할 수 있습니다.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 4. 네이버 AI 브리핑 노출 */}
            <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm md:text-base font-semibold text-gray-800">
                      4. 네이버 AI 브리핑 노출
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full font-medium">
                      영향도 ★ (전체 점수의 15%)
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    실제 네이버 AI 브리핑에 직접 인용됐는지 확인합니다
                  </p>
                </div>
                <ScoreBadge value={nec} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <ScoreBar value={nec} color={barColor(nec)} />
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
                    {inBriefing
                      ? "네이버 AI 브리핑에 직접 인용됨 (100점)"
                      : "네이버 AI 브리핑 미노출 (0점)"}
                  </span>
                </div>
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
                  <p className="text-xs font-semibold text-green-700 mb-1">네이버 AI 인용 발췌</p>
                  <p className="text-sm text-green-900 italic leading-relaxed">
                    &ldquo;{naverResult.excerpt}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ChatGPT · Gemini 등 해외 AI 노출 현황 ── */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-0.5">
                ChatGPT · Gemini 등 해외 AI 노출 현황
              </div>
              <div className="text-sm text-gray-500">업종 점수의 {globalWeight}% 반영</div>
            </div>
            <div className={`text-xl md:text-2xl font-bold ${track2Score >= 70 ? "text-green-600" : track2Score >= 40 ? "text-yellow-600" : "text-red-500"}`}>
              {Math.round(track2Score)}
              <span className="text-sm text-gray-400 font-normal ml-1">/ 100</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {platformList.map(({ key, label }) => {
              const r = allPlatformResults[key]
              if (!r) return null
              const ok = r.mentioned === true
              const hasError = !!r.error
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-sm ${
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
                  <span className={hasError ? "text-gray-400" : ok ? "text-green-800 font-medium" : "text-red-700"}>
                    {label}
                  </span>
                  {r.exposure_freq !== undefined && r.exposure_freq > 0 && (
                    <span className="text-xs text-gray-400 ml-auto">
                      100회 중 {r.exposure_freq}회
                    </span>
                  )}
                </div>
              )
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
      </div>
    </div>
  )
}
