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

  // ⚠️ Bug Fix: title·growth_stage·created_at 컬럼은 guides 테이블에 존재하지 않음
  // 존재하지 않는 컬럼 SELECT 시 PostgREST 오류 → data=null → "가이드 없음" 오표시 버그
  const { data: guides, error: guidesError } = await supabase
    .from('guides')
    .select('id, business_id, context, next_month_goal, priority_json, tools_json, scan_id, summary, items_json, generated_at')
    .eq('business_id', business.id)
    .order('generated_at', { ascending: false })
    .limit(1)

  if (guidesError) {
    console.error('[GuidePage] guides query error:', guidesError.message)
  }

  const { data: scans } = await supabase
    .from('scan_results')
    .select('id, total_score, scanned_at, gemini_result, naver_result')
    .eq('business_id', business.id)
    .order('scanned_at', { ascending: false })
    .limit(1)

  // 최신 스캔에서 네이버 AI 브리핑 또는 Gemini 노출 여부 추출
  const latestScan = scans?.[0]
  const latestScanMentioned: boolean | null = (() => {
    if (!latestScan) return null
    const naver = latestScan.naver_result as { in_briefing?: boolean; mentioned?: boolean } | null
    if (naver?.in_briefing === true) return true
    const gemini = latestScan.gemini_result as { mentioned?: boolean } | null
    if (gemini?.mentioned === true) return true
    if (naver?.in_briefing === false || gemini?.mentioned === false) return false
    return null
  })()

  // 플랜 + 이번 달 가이드 사용 횟수 조회
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const currentPlan = (subscription?.status === "active" || subscription?.status === "grace_period") ? (subscription?.plan ?? "free") : "free"

  const GUIDE_LIMITS: Record<string, number> = {
    free: 0, basic: 5, pro: 8, startup: 5, biz: 20, enterprise: 999,
  }
  const guideLimit = GUIDE_LIMITS[currentPlan] ?? 0

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: guideUsed } = await supabase
    .from('guides')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .gte('generated_at', monthStart.toISOString())

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">AI 개선 가이드</h1>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">스캔 결과를 바탕으로 AI가 분석한 <strong>지금 당장 실천 가능한</strong> 개선 방법을 알려드립니다.</p>
      </div>
      <GuideClient
        business={business}
        guide={guides?.[0] ?? null}
        latestScanId={latestScan?.id ?? null}
        userId={user.id}
        currentPlan={currentPlan}
        guideUsed={guideUsed ?? 0}
        guideLimit={guideLimit}
        latestScanMentioned={latestScanMentioned}
      />
    </div>
  )
}
