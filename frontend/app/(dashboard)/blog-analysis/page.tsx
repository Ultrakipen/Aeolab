import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BlogClient } from './BlogClient'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { FileText, Search, BarChart2, TrendingUp } from 'lucide-react'
import { getActiveBusinessId } from '@/lib/active-business'
import { resolveActivePlan } from '@/lib/subscriptionPlan'

export default async function BlogPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) redirect('/login')

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, category, region, keywords, blog_url, blog_analyzed_at, blog_keyword_coverage, blog_post_count, blog_latest_post_date, is_franchise')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(5)

  if (!businesses || businesses.length === 0) return (
    <NoBusiness
      Icon={FileText}
      title="블로그 AI 진단"
      description="내 블로그 포스트가 실제로 AI에 인용되고 있는지 확인하고, 개선하면 더 많은 채널에서 인용되도록 안내합니다."
      features={[
        { Icon: Search,     title: "포스트별 실측 인용 확인", desc: "어떤 글이 네이버 AI 브리핑에 실제로 인용됐는지 포스트 단위로 확인합니다." },
        { Icon: BarChart2,  title: "5채널 AI 인용 현황",     desc: "Gemini·ChatGPT·네이버·Google 채널별로 얼마나 인용되고 있는지 한눈에 봅니다." },
        { Icon: TrendingUp, title: "경쟁사 대비 개선 방향",   desc: "경쟁사가 이미 점유한 키워드와 아직 아무도 안 쓴 선점 기회 키워드를 알려드립니다." },
      ]}
    />
  )

  // 관리자 우회 (competitors/page.tsx:78-80과 동일 패턴)
  const ADMIN_EMAILS_LIST = (process.env.ADMIN_EMAILS ?? 'hoozdev@gmail.com').split(',').map((e) => e.trim().toLowerCase())
  const isAdmin = ADMIN_EMAILS_LIST.includes((user.email ?? '').toLowerCase())
  const currentPlan = isAdmin ? 'biz' : await resolveActivePlan(supabase, user.id)

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token ?? ''

  // cookie 기반 활성 사업장 결정
  const activeBizId = await getActiveBusinessId(user.id)

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">블로그 AI 진단</h1>
        <p className="text-gray-500 text-base mt-1">포스트별로 실제 AI 인용 여부를 확인하고, 개선하면 더 많은 채널에서 인용되도록 안내합니다.</p>
      </div>
      <BlogClient
        businesses={businesses.map((b) => ({
          id: b.id,
          name: b.name,
          category: b.category,
          region: b.region,
          keywords: b.keywords,
          blog_url: b.blog_url,
          blog_analyzed_at: b.blog_analyzed_at,
          is_franchise: b.is_franchise,
        }))}
        currentPlan={currentPlan}
        accessToken={accessToken}
        initialBizId={activeBizId}
      />
    </div>
  )
}
