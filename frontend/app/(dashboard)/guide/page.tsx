import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GuideClient } from './GuideClient'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { Lightbulb, Bot, ListChecks, RefreshCw, CheckSquare } from 'lucide-react'

export default async function GuidePage() {
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
      Icon={Lightbulb}
      title="AI 개선 가이드"
      description="스캔 결과를 바탕으로 AI가 지금 당장 실천 가능한 개선 방법을 알려드립니다."
      features={[
        { Icon: Bot,         title: "Claude AI 자동 분석", desc: "내 사업장 데이터를 Claude Sonnet이 분석해 맞춤 가이드를 생성합니다." },
        { Icon: ListChecks,  title: "단계별 실천 항목",    desc: "리뷰 전략, Schema 등록, 콘텐츠 개선 등 즉시 실천 가능한 항목을 제공합니다." },
        { Icon: CheckSquare, title: "진행률 체크리스트",   desc: "완료한 항목을 체크하며 개선 진행 상황을 한눈에 확인하세요." },
        { Icon: RefreshCw,   title: "스캔마다 업데이트",   desc: "AI 스캔을 진행할 때마다 최신 상태에 맞는 가이드가 새로 생성됩니다." },
      ]}
    />
  )

  const { data: guides } = await supabase
    .from('guides')
    .select('*')
    .eq('business_id', business.id)
    .order('generated_at', { ascending: false })
    .limit(1)

  const { data: scans } = await supabase
    .from('scan_results')
    .select('id, total_score, scanned_at')
    .eq('business_id', business.id)
    .order('scanned_at', { ascending: false })
    .limit(1)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI 개선 가이드</h1>
        <p className="text-gray-500 text-sm mt-1">스캔 결과를 바탕으로 AI가 분석한 <strong>지금 당장 실천 가능한</strong> 개선 방법을 알려드립니다.</p>
      </div>
      <GuideClient
        business={business}
        guide={guides?.[0] ?? null}
        latestScanId={scans?.[0]?.id ?? null}
        userId={user.id}
      />
    </div>
  )
}
