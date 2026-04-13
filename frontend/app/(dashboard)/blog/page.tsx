import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BlogClient } from './BlogClient'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { FileText, Search, BarChart2, TrendingUp } from 'lucide-react'

export default async function BlogPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) redirect('/login')

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, category, region, keywords')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)

  const business = businesses?.[0]
  if (!business) return (
    <NoBusiness
      Icon={FileText}
      title="블로그 AI 진단"
      description="내 블로그가 AI 브리핑에 인용될 가능성을 분석하고 개선 방향을 제시합니다."
      features={[
        { Icon: Search,     title: "키워드 커버리지 분석", desc: "업종별 AI 브리핑 핵심 키워드가 블로그에 얼마나 포함되어 있는지 확인합니다." },
        { Icon: BarChart2,  title: "AI 인용 가능성 점수",  desc: "포스트 구조, 최신성, 키워드 밀도 기반으로 AI 브리핑 인용 가능성을 점수화합니다." },
        { Icon: TrendingUp, title: "개선 권고사항 제공",   desc: "지금 당장 블로그에 추가하면 효과적인 키워드와 작성 방법을 알려드립니다." },
      ]}
    />
  )

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const currentPlan = (subscription?.status === 'active' || subscription?.status === 'grace_period')
    ? (subscription?.plan ?? 'free') : 'free'

  // 최근 블로그 분석 결과 조회 (테이블이 없을 경우 null 처리)
  let blogResult = null
  try {
    const { data } = await supabase
      .from('blog_analyses')
      .select('*')
      .eq('business_id', business.id)
      .order('analyzed_at', { ascending: false })
      .limit(1)
    blogResult = data?.[0] ?? null
  } catch {
    blogResult = null
  }

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token ?? ''

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">블로그 AI 진단</h1>
        <p className="text-gray-500 text-sm mt-1">네이버 블로그·외부 블로그가 AI 브리핑에 인용될 가능성을 분석합니다.</p>
      </div>
      <BlogClient
        business={business}
        currentPlan={currentPlan}
        initialResult={blogResult}
        accessToken={accessToken}
      />
    </div>
  )
}
