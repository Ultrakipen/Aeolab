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
        { Icon: Target,   title: "플랜별 최대 20개", desc: "Basic 5개 · Pro 10개 · Biz 20개까지 경쟁사를 등록할 수 있습니다." },
      ]}
    />
  )

  const { data: competitors } = await supabase
    .from('competitors')
    .select('*')
    .eq('business_id', business.id)
    .eq('is_active', true)

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token ?? ''

  const [{ data: scanResults }, { data: trendScans }, gapAnalysis] = await Promise.all([
    supabase
      .from('scan_results')
      .select('competitor_scores, total_score')
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
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">경쟁사 관리</h1>
        <p className="text-gray-500 text-sm mt-1">주변 경쟁 점포를 등록하면, AI 검색에서 내 가게가 몇 위인지 비교할 수 있습니다.</p>
      </div>
      {gapAnalysis && gapAnalysis.dimensions?.length > 0 && (
        <div className="mb-6">
          <GapAnalysisCard gap={gapAnalysis} />
        </div>
      )}
      <CompetitorsClient
        business={business}
        competitors={competitors ?? []}
        myScore={scanResults?.[0]?.total_score ?? 0}
        userId={user.id}
        trendScans={trendScans ?? []}
      />
    </div>
  )
}
