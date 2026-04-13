import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CompetitorsClient } from './CompetitorsClient'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { GapAnalysisCard } from '@/components/dashboard/GapAnalysisCard'
import PioneerKeywordsCard from './PioneerKeywordsCard'
import { Store, Search, BarChart2, Target, Zap, ArrowRight } from 'lucide-react'
import type { GapAnalysis } from '@/types/gap'
import type { Competitor } from '@/types/entities'
import { PlaceCompareTable } from '@/components/dashboard/PlaceCompareTable'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export default async function CompetitorsPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) redirect('/login')

  const { data: businesses } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)

  const business = businesses?.[0]
  if (!business) return (
    <NoBusiness
      Icon={Store}
      title="경쟁사 관리"
      description="주변 경쟁 점포를 등록하면 AI 검색에서 내 가게가 몇 위인지 비교할 수 있습니다."
      features={[
        { Icon: Search,    title: "카카오맵 지역 검색",   desc: "카카오 로컬 API로 같은 지역·업종의 실제 경쟁 점포를 검색해 바로 등록하세요." },
        { Icon: BarChart2, title: "AI 노출 순위 비교",    desc: "내 가게와 경쟁사의 AI Visibility Score를 나란히 비교해 경쟁 위치를 파악합니다." },
        { Icon: BarChart2, title: "경쟁사 점수 추이",     desc: "경쟁사의 점수 변화를 모니터링해 시장 흐름을 선제적으로 파악하세요." },
        { Icon: Target,    title: "플랜별 경쟁사 관리",   desc: "Basic 3개 · Pro/창업 10개 · Biz 무제한으로 경쟁사를 등록할 수 있습니다." },
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
      place_photo_count:     (raw.naver_photo_count           ?? raw.place_photo_count     ?? null) as number | null,
      place_synced_at:       (raw.naver_place_last_synced_at  ?? raw.place_synced_at       ?? null) as string | null,
    }
  }

  const { data: rawCompetitors } = await supabase
    .from('competitors')
    .select('id, business_id, name, category, region, address, naver_place_id, kakao_place_id, last_score, is_active, created_at, lat, lng, place_review_count, place_avg_rating, place_has_faq, place_has_recent_post, place_has_menu, place_photo_count, place_synced_at, blog_mention_count, website_url, website_seo_score, website_seo_result, comp_keywords, detail_synced_at, naver_review_count, naver_avg_rating, has_faq, has_recent_post, has_menu, naver_photo_count, naver_place_last_synced_at')
    .eq('business_id', business.id)
    .eq('is_active', true)
  const competitors: Competitor[] = rawCompetitors?.map(mapCompetitorFields) ?? []

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  const COMPETITOR_LIMITS: Record<string, number> = {
    free: 0, basic: 3, pro: 10, startup: 10, biz: 999, enterprise: 999,
  }
  const currentPlan = subscription?.status === 'active'
    ? (subscription?.plan ?? 'free')
    : 'free'
  const competitorLimit = COMPETITOR_LIMITS[currentPlan] ?? 3

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token ?? ''

  const [{ data: scanResults }, { data: trendScans }, gapAnalysis, myBlogMentions] = await Promise.all([
    supabase
      .from('scan_results')
      .select('competitor_scores, total_score, scanned_at')
      .eq('business_id', business.id)
      .order('scanned_at', { ascending: false })
      .limit(1),
    supabase
      .from('scan_results')
      .select('scanned_at, total_score, competitor_scores')
      .eq('business_id', business.id)
      .not('competitor_scores', 'is', null)
      .order('scanned_at', { ascending: true })
      .limit(10),
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

  return (
    <div className="p-4 md:p-8 max-w-screen-xl mx-auto">
      {/* 페이지 헤더 */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">경쟁사 관리</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1 leading-relaxed">
              주변 경쟁 가게를 등록해 AI 검색 노출 순위와 키워드 격차를 비교하세요.
            </p>
          </div>
          {(competitors?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                경쟁사 {competitors?.length}개 등록됨
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 스캔 안내 배너 — 경쟁사 등록 후 스캔 미실행 상태 */}
      {(competitors?.length ?? 0) > 0 && !scanResults?.[0]?.competitor_scores && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">경쟁사 등록 완료! 이제 AI 스캔을 실행하세요</p>
              <p className="text-sm text-blue-700 mt-0.5">
                AI 스캔 1회로 <strong>내 가게 + 등록된 경쟁사 {competitors?.length}곳</strong>을 동시에 분석해 순위와 키워드 격차를 비교합니다.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm shrink-0"
          >
            <Zap className="w-4 h-4" />
            대시보드에서 스캔하기
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* GapAnalysis 카드 */}
      {(competitors?.length ?? 0) > 0 && gapAnalysis && gapAnalysis.dimensions?.length > 0 && (
        <div className="mb-6">
          <GapAnalysisCard gap={gapAnalysis} />
        </div>
      )}

      {/* 키워드 격차 섹션 */}
      {(competitors?.length ?? 0) > 0 && gapAnalysis?.keyword_gap && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {(gapAnalysis.keyword_gap.competitor_only_keywords?.length ?? 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <div className="text-base font-semibold text-red-800">경쟁사 독점 키워드</div>
              </div>
              <p className="text-sm text-red-600 mb-3">경쟁 가게 리뷰에는 있지만 내 리뷰에는 없는 키워드입니다.</p>
              <div className="flex flex-wrap gap-2">
                {gapAnalysis.keyword_gap.competitor_only_keywords.map((kw: string) => (
                  <span key={kw} className="bg-red-100 text-red-700 text-sm font-medium px-3 py-1 rounded-full border border-red-200">
                    {kw}
                  </span>
                ))}
              </div>
              <p className="text-sm text-red-500 mt-3 font-medium">
                이 키워드를 리뷰 유도 문구에 반영하면 격차를 줄일 수 있습니다.
              </p>
            </div>
          )}
          {(gapAnalysis.keyword_gap.pioneer_keywords?.length ?? 0) > 0 && (
            <PioneerKeywordsCard
              bizId={business.id}
              pioneerKeywords={gapAnalysis.keyword_gap.pioneer_keywords}
            />
          )}
          {(gapAnalysis.keyword_gap.present_keywords?.length ?? 0) > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 md:p-5 md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                <div className="text-base font-semibold text-blue-800">경쟁사와 공통 키워드</div>
              </div>
              <p className="text-sm text-blue-600 mb-3">이미 보유한 키워드이지만 경쟁사도 동일하게 가지고 있어 차별화가 되지 않습니다.</p>
              <div className="flex flex-wrap gap-2">
                {gapAnalysis.keyword_gap.present_keywords.slice(0, 10).map((kw: string) => (
                  <span key={kw} className="bg-blue-100 text-blue-600 text-sm px-3 py-1 rounded-full border border-blue-200">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CompetitorsClient
        business={business}
        competitors={competitors ?? []}
        myScore={scanResults?.[0]?.total_score ?? 0}
        myReviewCount={business.review_count ?? 0}
        myAvgRating={business.avg_rating ?? 0}
        myBlogMentions={myBlogMentions ?? 0}
        userId={user.id}
        trendScans={trendScans ?? []}
        competitorScores={scanResults?.[0]?.competitor_scores ?? null}
        lastScannedAt={scanResults?.[0]?.scanned_at ?? null}
        currentPlan={currentPlan}
        planLimit={competitorLimit}
        accessToken={accessToken}
      />

      {/* 스마트플레이스 경쟁사 비교표 — Basic 이상 플랜 */}
      {currentPlan !== 'free' && (
        <div className="mt-6">
          <PlaceCompareTable
            bizId={business.id}
            currentPlan={currentPlan}
            authToken={accessToken}
          />
        </div>
      )}
    </div>
  )
}
