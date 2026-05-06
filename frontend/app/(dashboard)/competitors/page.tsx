import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CompetitorsClient } from './CompetitorsClient'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { Store, Search, BarChart2, Target, Zap } from 'lucide-react'
import type { GapAnalysis } from '@/types/gap'
import type { Competitor } from '@/types/entities'
import { getActiveBusinessId } from '@/lib/active-business'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ biz_id?: string }>
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) redirect('/login')

  const params = await searchParams
  const selectedBizId = params.biz_id ?? null
  // URL param이 없으면 cookie 기반 활성 사업장 결정
  const activeBizId = selectedBizId ?? await getActiveBusinessId(user.id)

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, category, region, keywords, is_smart_place, naver_place_id, kakao_place_id, website_url, review_count, avg_rating')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

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
        { Icon: BarChart2, title: "경쟁사 점수 추이",     desc: "경쟁사의 점수 변화를 모니터링해 시장 흐름을 선제적으로 파악하세요." },
        { Icon: Target,    title: "플랜별 경쟁사 관리",   desc: "Basic 3개 · 창업패키지 5개 · Pro 10개 · Biz 무제한으로 경쟁사를 등록할 수 있습니다." },
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

  const { data: rawCompetitors } = await supabase
    .from('competitors')
    .select('id, business_id, name, address, naver_place_id, is_active, created_at, lat, lng, blog_mention_count, website_url, website_seo_score, website_seo_result, comp_keywords, detail_synced_at, naver_review_count, naver_avg_rating, has_faq, has_recent_post, has_menu, has_intro, naver_photo_count, naver_place_last_synced_at')
    .eq('business_id', business.id)
    .eq('is_active', true)
  const competitors: Competitor[] = rawCompetitors?.map(mapCompetitorFields) ?? []

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'grace_period'])
    .maybeSingle()

  const COMPETITOR_LIMITS: Record<string, number> = {
    free: 0, basic: 3, pro: 10, startup: 5, biz: 999,
  }
  const currentPlan = (subscription?.status === 'active' || subscription?.status === 'grace_period')
    ? (subscription?.plan ?? 'free')
    : 'free'
  const competitorLimit = COMPETITOR_LIMITS[currentPlan] ?? 3

  // 액세스 토큰 — line 18에서 이미 인증된 user 사용 (getUser() 중복 호출 방지)
  const accessToken = user ? (await supabase.auth.getSession()).data.session?.access_token ?? '' : ''

  const [
    { data: scanResults },
    { data: latestScans },
    { data: trendScans },
    gapAnalysis,
    myBlogMentions,
  ] = await Promise.all([
    // competitor_scores가 있는 최신 스캔 결과 (경쟁사 점수 표시용)
    supabase
      .from('scan_results')
      .select('competitor_scores, total_score, scanned_at')
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
        }).then(r => r.ok ? r.json() : { count: 0 }).then((d: { count: number }) => d.count).catch(() => 0)
      : Promise.resolve(0),
  ])

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
        <div className="flex flex-wrap gap-2 mt-2 md:mt-4 pt-4 md:pt-6 border-t border-gray-200 mb-8 md:mb-10">
          {businesses!.map(b => (
            <Link
              key={b.id}
              href={`?biz_id=${b.id}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border ${
                b.id === business.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              {b.name}
            </Link>
          ))}
        </div>
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
          <div className="mb-6 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  s.n < step ? 'bg-blue-500 text-white' :
                  s.n === step ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
                  'bg-gray-200 text-gray-400'
                }`}>
                  {s.n < step ? '✓' : s.n}
                </div>
                <span className={`text-sm font-semibold truncate ${s.n === step ? 'text-blue-700' : s.n < step ? 'text-blue-500' : 'text-gray-400'}`}>
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

      {/* 경쟁사 미등록 fallback 배너 — 추정 데이터 안내 */}
      {gapAnalysis && (gapAnalysis as GapAnalysis & { is_competitor_estimated?: boolean }).is_competitor_estimated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
          <strong>현재는 업종 평균과 비교한 추정 데이터입니다.</strong>
          경쟁사를 직접 등록하면 실제 가게 간 비교 데이터가 표시됩니다.
          <Link href="/competitors" className="underline ml-1">경쟁사 등록하기 →</Link>
        </div>
      )}

      <CompetitorsClient
        business={business}
        competitors={competitors ?? []}
        myScore={latestScanWithScores?.total_score ?? latestScans?.[0]?.total_score ?? 0}
        myReviewCount={business.review_count ?? 0}
        myAvgRating={business.avg_rating ?? 0}
        myBlogMentions={myBlogMentions ?? 0}
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
