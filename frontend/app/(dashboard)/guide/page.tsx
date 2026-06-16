import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GuideClient } from './GuideClient'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { Lightbulb, Bot, ListChecks, RefreshCw, CheckSquare, Lock, Sparkles, FileSearch } from 'lucide-react'
import { getActiveBusinessId } from '@/lib/active-business'
import { getBriefingEligibility } from '@/lib/userGroup'

export default async function GuidePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) redirect('/login')

  const params = await searchParams
  const selectedBizId = params.biz_id ?? null
  // URL param이 없으면 cookie 기반 활성 사업장 결정
  const activeBizId = selectedBizId ?? await getActiveBusinessId(user.id)

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, category, region, keywords, is_smart_place, has_faq, has_intro, has_recent_post, review_count, naver_place_id, kakao_place_id, website_url, is_franchise, naver_intro_draft, talktalk_faq_draft')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(10)

  const business = (activeBizId
    ? businesses?.find(b => b.id === activeBizId)
    : businesses?.[0]) ?? null
  if (!business) return (
    <NoBusiness
      Icon={Lightbulb}
      title="AI 개선 가이드"
      description="스캔 결과를 바탕으로 AI가 지금 당장 실천 가능한 개선 방법을 알려드립니다."
      features={[
        { Icon: Bot,         title: "Claude AI 자동 분석", desc: "내 사업장 데이터를 Claude Sonnet이 분석해 맞춤 가이드를 생성합니다." },
        { Icon: ListChecks,  title: "단계별 실천 항목",    desc: "리뷰 전략, AI 정보 등록, 콘텐츠 개선 등 즉시 실천 가능한 항목을 제공합니다." },
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
    free: 0, basic: 3, pro: 10, startup: 5, biz: 20, enterprise: 999,
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

  let initialToken = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    initialToken = session?.access_token ?? ''
  } catch { /* initialToken = '' */ }

  // Free 사용자 상단 게이트 — 가이드 생성 한도 0이면 업그레이드 안내
  if (guideLimit === 0) {
    return (
      <div className="p-4 md:p-8 max-w-lg mx-auto mt-10">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 md:p-8 text-center space-y-4">
          <div className="flex justify-center">
            <Lock className="w-10 h-10 text-blue-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-blue-900">AI 개선 가이드는 Basic 이상 플랜에서 이용할 수 있습니다</h2>
          <p className="text-blue-700 text-base leading-relaxed">
            스캔 결과를 바탕으로 Claude AI가 지금 당장 실천 가능한 개선 방법을 생성해 드립니다.<br />
            Basic 플랜은 월 3회 · Pro는 월 10회 가이드를 생성할 수 있습니다.
          </p>
          <a
            href="/pricing"
            className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-base transition-colors"
          >
            플랜 업그레이드 (월 9,900원~) →
          </a>
          <a href="/dashboard" className="block text-sm text-gray-500 hover:text-gray-700 transition-colors">
            대시보드로 돌아가기
          </a>
        </div>
      </div>
    )
  }

  // 두 노출 경로 가이드 진입점 분기 — AI 브리핑(업종 제한) vs AI탭(모든 업종)
  const briefingElig = getBriefingEligibility(business.category, !!business.is_franchise)
  const briefingActive = briefingElig === 'active' && !business.is_franchise
  const briefingLikely = briefingElig === 'likely' && !business.is_franchise

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">AI 개선 가이드</h1>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">스캔 결과를 바탕으로 AI가 분석한 <strong>지금 당장 실천 가능한</strong> 개선 방법을 알려드립니다.</p>
      </div>

      {businesses && businesses.length > 1 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {businesses.map(b => (
            <a
              key={b.id}
              href={`/guide?biz_id=${b.id}`}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
                b.id === business?.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >{b.name}</a>
          ))}
        </div>
      )}
      <GuideClient
        business={business}
        guide={guides?.[0] ?? null}
        latestScanId={latestScan?.id ?? null}
        userId={user.id}
        currentPlan={currentPlan}
        guideUsed={guideUsed ?? 0}
        guideLimit={guideLimit}
        latestScanMentioned={latestScanMentioned}
        initialToken={initialToken}
      />

      {/* 채널별 심화 가이드 — 가이드 본문 아래에 배치 (탐색 링크) */}
      <div className="mt-10 pt-8 border-t border-gray-100">
        <p className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">채널별 심화 가이드</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* AI 브리핑 가이드 */}
          <Link
            href={`/guide/ai-info-tab?biz_id=${business.id}`}
            className={`group rounded-xl border p-4 md:p-5 transition-all hover:shadow-md ${
              briefingActive
                ? 'bg-blue-50 border-blue-300 hover:border-blue-500'
                : briefingLikely
                ? 'bg-blue-50 border-blue-200 hover:border-blue-400'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1.5">
                <FileSearch className="w-5 h-5 text-blue-600 shrink-0" />
                <span className="text-base font-bold text-blue-900 break-keep">네이버 AI 브리핑 가이드</span>
              </div>
              {briefingActive && (
                <span className="inline-flex items-center rounded-full bg-blue-600 text-white px-2 py-0.5 text-sm font-bold whitespace-nowrap">
                  내 업종 대상
                </span>
              )}
              {briefingLikely && (
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-sm font-semibold whitespace-nowrap">
                  확대 예정
                </span>
              )}
              {!briefingActive && !briefingLikely && (
                <span className="inline-flex items-center rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 text-sm font-semibold whitespace-nowrap">
                  비대상
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 mb-2 leading-snug break-keep">
              검색결과 상단 AI 자동 추천 박스. 음식점·카페·숙박업 등 AI 브리핑 대상 업종.
            </p>
            <p className="text-sm font-semibold text-blue-700 group-hover:underline">5단계 설정 가이드 →</p>
          </Link>

          {/* AI탭 가이드 */}
          <Link
            href={`/guide/ai-tab?biz_id=${business.id}`}
            className="group rounded-xl border border-indigo-200 bg-indigo-50 p-4 md:p-5 transition-all hover:shadow-md hover:border-indigo-400"
          >
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
                <span className="text-base font-bold text-indigo-900 break-keep">네이버 AI탭 가이드</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-indigo-600 text-white px-2 py-0.5 text-sm font-bold whitespace-nowrap">
                Beta · 베타 확대 중
              </span>
            </div>
            <p className="text-sm text-gray-700 mb-2 leading-snug break-keep">
              검색결과 상단 &quot;AI&quot; 탭 메뉴. 2026-04-27 베타 출시, 업종 공식 제한 없음 (베타 확대 중).
            </p>
            <p className="text-sm font-semibold text-indigo-700 group-hover:underline">5항목 설정 가이드 →</p>
          </Link>

          {/* ChatGPT·Gemini 노출 가이드 */}
          <Link
            href="/guide/chatgpt-search"
            className="group rounded-xl border border-purple-200 bg-purple-50 p-4 md:p-5 transition-all hover:shadow-md hover:border-purple-400"
          >
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Bot className="w-5 h-5 text-purple-600 shrink-0" />
                <span className="text-base font-bold text-purple-900 break-keep">ChatGPT·Gemini 노출 가이드</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-purple-600 text-white px-2 py-0.5 text-sm font-bold whitespace-nowrap">
                모든 업종
              </span>
            </div>
            <p className="text-sm text-gray-700 mb-2 leading-snug break-keep">
              글로벌 AI가 내 가게를 언급하게 만드는 소개글·Q&amp;A 최적화.
            </p>
            <p className="text-sm font-semibold text-purple-700 group-hover:underline">소개글 최적화 가이드 →</p>
          </Link>
        </div>

        {/* 점수 모델 v3.1 변경 사항 안내 */}
        <div className="mt-4">
          <Link
            href="/guide/score-model-v3-1"
            className="group inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            업종별 맞춤 점수 기준 개선 안내
            <span className="group-hover:underline">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
