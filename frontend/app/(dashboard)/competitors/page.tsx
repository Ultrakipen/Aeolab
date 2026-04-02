import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompetitorsClient } from './CompetitorsClient'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { GapAnalysisCard } from '@/components/dashboard/GapAnalysisCard'
import { Store, Search, BarChart2, Target } from 'lucide-react'
import type { GapAnalysis } from '@/types/gap'

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
        { Icon: Search,   title: "카카오맵 지역 검색", desc: "카카오 로컬 API로 같은 지역·업종의 실제 경쟁 점포를 검색해 바로 등록하세요." },
        { Icon: BarChart2, title: "AI 노출 순위 비교", desc: "내 가게와 경쟁사의 AI Visibility Score를 나란히 비교해 경쟁 위치를 파악합니다." },
        { Icon: BarChart2, title: "경쟁사 점수 추이", desc: "경쟁사의 점수 변화를 모니터링해 시장 흐름을 선제적으로 파악하세요." },
        { Icon: Target,   title: "플랜별 경쟁사 관리", desc: "Basic 3개 · Pro/창업 10개 · Biz 무제한으로 경쟁사를 등록할 수 있습니다." },
      ]}
    />
  )

  const { data: competitors } = await supabase
    .from('competitors')
    .select('*')
    .eq('business_id', business.id)
    .eq('is_active', true)

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  const COMPETITOR_LIMITS: Record<string, number> = {
    free: 0, basic: 3, pro: 10, startup: 10, biz: 999, enterprise: 999,
  }
  const currentPlan = subscription?.plan ?? 'basic'
  const competitorLimit = COMPETITOR_LIMITS[currentPlan] ?? 3

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token ?? ''

  const [{ data: scanResults }, { data: trendScans }, gapAnalysis] = await Promise.all([
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
  ])

  return (
    <div className="p-3 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">경쟁사 관리</h1>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">주변 경쟁 점포를 등록하면, AI 검색에서 내 가게가 몇 위인지 비교할 수 있습니다.</p>
      </div>
      {gapAnalysis && gapAnalysis.dimensions?.length > 0 && (
        <div className="mb-6">
          <GapAnalysisCard gap={gapAnalysis} />
        </div>
      )}
      {/* 갭 ⑥ — 경쟁사 키워드 상세 */}
      {gapAnalysis?.keyword_gap && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 경쟁사만 가진 키워드 */}
          {(gapAnalysis.keyword_gap.competitor_only_keywords?.length ?? 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="text-base font-semibold text-red-800 mb-1">경쟁사만 가진 키워드</div>
              <p className="text-base text-red-600 mb-3">경쟁 가게 리뷰에는 있지만 내 리뷰에는 없는 키워드입니다.</p>
              <div className="flex flex-wrap gap-2">
                {gapAnalysis.keyword_gap.competitor_only_keywords.map((kw: string) => (
                  <span key={kw} className="bg-red-100 text-red-700 text-sm font-medium px-2.5 py-1 rounded-full border border-red-200">
                    {kw}
                  </span>
                ))}
              </div>
              <p className="text-base text-red-500 mt-3">→ 이 키워드를 리뷰 유도 문구에 반영하면 격차를 줄일 수 있습니다.</p>
            </div>
          )}
          {/* 내가 선점한 키워드 */}
          {(gapAnalysis.keyword_gap.pioneer_keywords?.length ?? 0) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="text-base font-semibold text-emerald-800 mb-1">✨ 내가 선점한 키워드</div>
              <p className="text-base text-emerald-600 mb-3">경쟁 가게에는 없고 내 가게만 가진 차별화 키워드입니다.</p>
              <div className="flex flex-wrap gap-2">
                {gapAnalysis.keyword_gap.pioneer_keywords.map((kw: string) => (
                  <span key={kw} className="bg-emerald-100 text-emerald-700 text-sm font-medium px-2.5 py-1 rounded-full border border-emerald-200">
                    {kw}
                  </span>
                ))}
              </div>
              <p className="text-base text-emerald-600 mt-3">→ 이 키워드가 내 가게의 경쟁력입니다. 리뷰·소개글에서 강조하세요.</p>
            </div>
          )}
          {/* 공통으로 보유한 키워드 */}
          {(gapAnalysis.keyword_gap.present_keywords?.length ?? 0) > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 md:col-span-2">
              <div className="text-base font-semibold text-blue-800 mb-1">경쟁사와 공통으로 가진 키워드</div>
              <p className="text-base text-blue-600 mb-3">이미 보유한 키워드이지만 경쟁사도 똑같이 가지고 있어 차별화가 되지 않습니다.</p>
              <div className="flex flex-wrap gap-2">
                {gapAnalysis.keyword_gap.present_keywords.slice(0, 10).map((kw: string) => (
                  <span key={kw} className="bg-blue-100 text-blue-600 text-sm px-2.5 py-1 rounded-full border border-blue-200">
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
        userId={user.id}
        trendScans={trendScans ?? []}
        competitorScores={scanResults?.[0]?.competitor_scores ?? null}
        lastScannedAt={scanResults?.[0]?.scanned_at ?? null}
        currentPlan={currentPlan}
        planLimit={competitorLimit}
      />
    </div>
  )
}
