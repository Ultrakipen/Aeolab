import { createClient, getCachedUser, getCachedActivePlan } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CompetitorsClient } from './CompetitorsClient'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { Store, Search, BarChart2, Target, Zap, TrendingUp } from 'lucide-react'
import { BusinessSwitcherClient } from './BusinessSwitcherClient'
import type { GapAnalysis } from '@/types/gap'
import type { Competitor } from '@/types/entities'
import { getActiveBusinessId } from '@/lib/active-business'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ biz_id?: string }>
}) {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const params = await searchParams
  const selectedBizId = params.biz_id ?? null

  const ADMIN_EMAILS_LIST = (process.env.ADMIN_EMAILS ?? 'hoozdev@gmail.com').split(',').map(e => e.trim().toLowerCase())
  const isAdmin = ADMIN_EMAILS_LIST.includes((user.email ?? '').toLowerCase())

  // user.id만 있으면 되는 조회들 — 서로 독립적이므로 병렬 실행
  // (activeBizId 결정과 businesses 목록 조회는 서로 의존관계 없음: businesses는
  // user_id로만 필터링하고, activeBizId는 businesses 목록과 무관하게 쿠키/URL로 결정됨)
  const [resolvedActiveBizId, { data: businesses }, currentPlan, { data: sd }] = await Promise.all([
    selectedBizId ? Promise.resolve(selectedBizId) : getActiveBusinessId(user.id),
    supabase
      .from('businesses')
      .select('id, name, category, region, keywords, is_smart_place, naver_place_id, kakao_place_id, website_url, review_count, avg_rating')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    isAdmin ? Promise.resolve('biz') : getCachedActivePlan(user.id),
    // 백엔드 API 호출용 토큰 — auth 검증은 위 getUser()로 완료. 토큰 추출 목적으로만 사용
    supabase.auth.getSession(),
  ])
  const activeBizId = resolvedActiveBizId

  // cookie/URL param 기반 활성 사업장 결정 (없으면 첫 번째 사업장)
  const business = activeBizId
    ? (businesses?.find(b => b.id === activeBizId) ?? businesses?.[0])
    : businesses?.[0]
  if (!business) return (
    <NoBusiness
      Icon={Store}
      title="경쟁사 관리"
      description="주변 경쟁 점포를 등록하면 AI 검색에서 내 가게가 몇 위인지 비교할 수 있습니다."
      features={[
        { Icon: Search,    title: "카카오맵 지역 검색",   desc: "카카오 로컬 API로 같은 지역·업종의 실제 경쟁 점포를 검색해 바로 등록하세요." },
        { Icon: BarChart2, title: "AI 노출 순위 비교",    desc: "내 가게와 경쟁사의 AI Visibility Score를 나란히 비교해 경쟁 위치를 파악합니다." },
        { Icon: TrendingUp, title: "경쟁사 점수 추이",     desc: "경쟁사의 점수 변화를 모니터링해 시장 흐름을 선제적으로 파악하세요." },
        { Icon: Target,    title: "플랜별 경쟁사 관리",   desc: "Basic 3개 · 창업패키지·Pro 5개 · Biz 무제한으로 경쟁사를 등록할 수 있습니다." },
      ]}
    />
  )

  function mapCompetitorFields(raw: Record<string, unknown>): Competitor {
    return {
      ...(raw as unknown as Competitor),
      place_review_count:    (raw.naver_review_count         ?? raw.place_review_count    ?? null) as number | null,
      place_avg_rating:      (raw.naver_avg_rating            ?? raw.place_avg_rating      ?? null) as number | null,
      place_has_faq:         (raw.has_faq                     ?? raw.place_has_faq         ?? undefined) as boolean | undefined,
      place_has_recent_post: (raw.has_recent_post             ?? raw.place_has_recent_post ?? undefined) as boolean | undefined,
      place_has_menu:        (raw.has_menu                    ?? raw.place_has_menu        ?? undefined) as boolean | undefined,
      place_has_intro:       (raw.has_intro                   ?? raw.place_has_intro       ?? undefined) as boolean | undefined,
      place_photo_count:     (raw.naver_photo_count           ?? raw.place_photo_count     ?? null) as number | null,
      place_synced_at:       (raw.naver_place_last_synced_at  ?? raw.place_synced_at       ?? null) as string | null,
    }
  }

  const COMPETITOR_LIMITS: Record<string, number> = {
    free: 0, basic: 3, startup: 5, pro: 5, biz: 999, enterprise: 999,
  }
  const competitorLimit = COMPETITOR_LIMITS[currentPlan] ?? 3
  const accessToken = sd.session?.access_token ?? ''

  // competitors 조회는 이후 스캔 결과 조회들과 서로 의존관계 없음(둘 다 business.id만
  // 필요) — 순차 실행되던 것을 하나의 Promise.all로 합쳐 왕복 1회를 절약
  const [
    { data: rawCompetitors },
    { data: scanResults },
    { data: latestScans },
    { data: trendScans },
    gapAnalysis,
    myBlogMentions,
  ] = await Promise.all([
    supabase
      .from('competitors')
      .select('id, business_id, name, address, naver_place_id, is_active, created_at, lat, lng, blog_mention_count, website_url, website_seo_score, website_seo_result, comp_keywords, detail_synced_at, naver_review_count, naver_avg_rating, has_faq, has_recent_post, has_menu, has_intro, naver_photo_count, naver_place_last_synced_at')
      .eq('business_id', business.id)
      .eq('is_active', true),
    // competitor_scores가 있는 최신 스캔 결과 (경쟁사 점수 표시용)
    // track1_score: "성장 단계" 라벨(지역 1등 등)은 track1_score 기준이어야 함(CLAUDE.md 표준,
    // 업종별 naver/global 비율 차이로 인한 오판 방지) — unified인 total_score는 순위·막대용으로만 사용
    supabase
      .from('scan_results')
      .select('competitor_scores, total_score, track1_score, scanned_at')
      .eq('business_id', business.id)
      .not('competitor_scores', 'is', null)
      .order('scanned_at', { ascending: false })
      .limit(1),
    // 가장 최신 스캔 (lastScannedAt 표시 — competitor_scores 유무 무관)
    supabase
      .from('scan_results')
      .select('scanned_at, total_score')
      .eq('business_id', business.id)
      .order('scanned_at', { ascending: false })
      .limit(1),
    supabase
      .from('scan_results')
      .select('scanned_at, total_score, competitor_scores')
      .eq('business_id', business.id)
      .not('competitor_scores', 'is', null)
      .order('scanned_at', { ascending: false })
      .limit(30),
    accessToken
      ? fetch(`${BACKEND}/api/report/gap/${business.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        }).then(r => r.ok ? r.json() as Promise<GapAnalysis> : null).catch(() => null)
      : Promise.resolve(null),
    accessToken
      ? fetch(`${BACKEND}/api/businesses/${business.id}/blog-mentions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        }).then(r => r.ok ? r.json() : { count: 0, measured: false })
          .then((d: { count: number; measured?: boolean }) => (d.measured === false ? null : d.count))
          .catch(() => null)
      : Promise.resolve(null),
  ])

  const competitors: Competitor[] = rawCompetitors?.map(mapCompetitorFields) ?? []

  // competitor_scores가 있는 최신 스캔 결과
  const latestScanWithScores = scanResults?.[0] ?? null
  // 마지막 스캔 시각 (경쟁사 점수 유무와 무관)
  const lastScannedAt = latestScans?.[0]?.scanned_at ?? latestScanWithScores?.scanned_at ?? null

  return (
    <div className="p-4 md:p-8 max-w-screen-xl mx-auto">
      {/* 페이지 헤더 */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
              경쟁사 관리
              <span className="text-blue-600 font-semibold"> — {business.name}</span>
            </h1>
            <p className="text-sm md:text-base text-gray-500 mt-1 leading-relaxed">
              주변 경쟁 가게를 등록해 AI 검색 노출 순위와 키워드 격차를 비교하세요.
            </p>
          </div>
          {(competitors?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                경쟁사 {competitors?.length}개 등록됨
              </span>
              {(() => {
                const syncedCount = competitors.filter(c => c.place_synced_at).length
                return syncedCount < (competitors?.length ?? 0) ? (
                  <span className="text-amber-600 text-sm font-medium">
                    ({syncedCount}개 동기화 완료)
                  </span>
                ) : null
              })()}
            </div>
          )}
        </div>
      </div>

      {/* 사업장 전환 탭 — 다중 사업장 보유 시 */}
      {(businesses?.length ?? 0) > 1 && (
        <BusinessSwitcherClient
          businesses={businesses!}
          currentBizId={business.id}
        />
      )}

      {/* 3단계 진행 스텝퍼 — 완료(step=3)이면 숨김 */}
      {(() => {
        const step = (competitors?.length ?? 0) === 0 ? 1 : !latestScanWithScores ? 2 : 3
        if (step >= 3) return null
        const steps = [
          { n: 1, label: '경쟁사 등록' },
          { n: 2, label: 'AI 스캔' },
          { n: 3, label: '결과 확인' },
        ]
        return (
          <div className="mb-6 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  s.n < step ? 'bg-blue-500 text-white' :
                  s.n === step ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {s.n < step ? '✓' : s.n}
                </div>
                <span className={`text-sm font-semibold truncate ${s.n === step ? 'text-blue-700' : s.n < step ? 'text-blue-500' : 'text-gray-500'}`}>
                  {s.label}
                </span>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded ${s.n < step ? 'bg-blue-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
            <div className="ml-2 shrink-0">
              {step === 1 ? (
                <span className="text-sm text-blue-600 font-medium">아래에서 경쟁사를 추가하세요</span>
              ) : (
                <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
                  <Zap className="w-3.5 h-3.5" />스캔 실행
                </Link>
              )}
            </div>
          </div>
        )
      })()}

      {/* 경쟁사 추정 데이터 안내 배너 — 미등록/미스캔 두 경우를 구분해 안내 */}
      {gapAnalysis && (gapAnalysis as GapAnalysis & { is_competitor_estimated?: boolean }).is_competitor_estimated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
          <strong>현재는 업종 평균과 비교한 추정 데이터입니다.</strong>{' '}
          {(competitors?.length ?? 0) > 0
            ? '등록된 경쟁사의 AI 스캔이 아직 완료되지 않아 실제 비교 데이터 대신 업종 평균을 사용했습니다. 스캔이 끝나면 자동으로 실제 비교 데이터로 전환됩니다.'
            : '아래에서 경쟁사를 직접 등록하면 실제 가게 간 비교 데이터가 표시됩니다.'}
        </div>
      )}

      <CompetitorsClient
        key={business.id}
        business={business}
        competitors={competitors ?? []}
        myScore={latestScanWithScores?.total_score ?? latestScans?.[0]?.total_score ?? 0}
        myTrack1Score={latestScanWithScores?.track1_score ?? null}
        myReviewCount={business.review_count ?? 0}
        myAvgRating={business.avg_rating && business.avg_rating > 0 ? business.avg_rating : null}
        myBlogMentions={myBlogMentions}
        userId={user.id}
        trendScans={trendScans ?? []}
        competitorScores={latestScanWithScores?.competitor_scores ?? null}
        lastScannedAt={lastScannedAt}
        currentPlan={currentPlan}
        planLimit={competitorLimit}
        accessToken={accessToken}
        gapAnalysis={gapAnalysis}
      />
    </div>
  )
}
