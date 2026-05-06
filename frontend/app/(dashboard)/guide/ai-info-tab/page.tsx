import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { AiInfoTabGuide } from './AiInfoTabGuide'
import { getBriefingEligibility } from '@/lib/userGroup'
import { getActiveBusinessId } from '@/lib/active-business'

export default async function AiInfoTabGuidePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
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
    .select('id, name, category, is_franchise, naver_place_url, naver_place_id, has_intro, has_recent_post, ai_info_tab_status, review_count')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(10)

  const business = (activeBizId
    ? businesses?.find(b => b.id === activeBizId)
    : businesses?.[0]) ?? null

  // 사용자 플랜 조회 (요금제별 안내 분기용)
  const { data: subRow } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const plan: string = (subRow?.status === 'active' ? subRow?.plan : null) ?? 'free'

  const elig = business
    ? getBriefingEligibility(business.category, !!business.is_franchise)
    : 'inactive'

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          href="/guide"
          className="inline-flex items-center gap-1 text-sm md:text-base text-gray-500 hover:text-blue-600"
        >
          <ChevronLeft className="w-4 h-4" /> 가이드로 돌아가기
        </Link>
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-1 text-sm md:text-base text-blue-600 hover:underline font-medium"
        >
          서비스 안내 매뉴얼 (전체 동작 원리) →
        </Link>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 break-keep">
          네이버 AI 브리핑 노출 — 5단계 설정 가이드
        </h1>
        <p className="text-base md:text-lg text-gray-700 leading-relaxed break-keep">
          내 사업장이 네이버 AI 브리핑에 노출되도록 단계별로 안내합니다. 평균 소요 15분.
        </p>
        <p className="mt-2 text-sm md:text-base text-gray-500">
          출처:{" "}
          <a
            href="https://help.naver.com/service/30026/contents/24632"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            네이버 스마트플레이스 공식 안내
          </a>
        </p>
      </div>

      <AiInfoTabGuide
        business={business}
        eligibility={elig}
        plan={plan}
      />
    </div>
  )
}
