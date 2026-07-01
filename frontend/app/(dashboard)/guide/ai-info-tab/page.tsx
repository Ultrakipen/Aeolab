import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { AiInfoTabGuide } from './AiInfoTabGuide'
import { getBriefingEligibility } from '@/lib/userGroup'
import { getActiveBusinessId } from '@/lib/active-business'
import { fetchBriefingCategories } from '@/lib/briefingCategoriesServer'

export const metadata: Metadata = {
  title: 'AI 브리핑 5단계 가이드 | AEOlab',
  description: '네이버 AI 브리핑 노출을 위한 5단계 실행 가이드. 소개글·소식·리뷰 최적화로 AI 검색 상단 노출을 달성하세요.',
}

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
    .select('id, name, category, is_franchise, naver_place_url, naver_place_id, has_intro, has_recent_post, ai_info_tab_status, review_count, blog_mention_count, sp_completeness_json')
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

  // 관리자 이메일 → biz 플랜 부여 (layout.tsx 동일 로직, 불일치 방지)
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "hoozdev@gmail.com")
    .split(",").map((e) => e.trim().toLowerCase())
  const isAdminUser = ADMIN_EMAILS.includes((user.email ?? "").toLowerCase())

  const plan: string = isAdminUser ? "biz" : (
    (subRow?.status === 'active' || subRow?.status === 'grace_period')
      ? (subRow?.plan ?? 'free')
      : 'free'
  )

  const briefingCats = await fetchBriefingCategories()
  const elig = business
    ? getBriefingEligibility(business.category, !!business.is_franchise, briefingCats.active, briefingCats.likely)
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
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/guide/ai-tab"
            className="inline-flex items-center gap-1 text-sm md:text-base text-indigo-600 hover:underline font-medium"
          >
            AI탭 5항목 가이드 →
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1 text-sm md:text-base text-blue-600 hover:underline font-medium"
          >
            서비스 안내 매뉴얼 →
          </Link>
        </div>
      </div>

      {/* 두 경로 분기 안내 — 가이드 진입 직후 명확화 */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:p-5">
        <p className="text-sm md:text-base font-bold text-blue-900 mb-1.5">
          📘 네이버 AI 브리핑 — 검색결과 상단 AI 자동 추천 박스 (2025.03 정식)
        </p>
        <p className="text-sm md:text-base text-blue-800 leading-relaxed break-keep">
          AI탭(검색결과 &quot;AI&quot; 탭 메뉴)과는 다른 노출 경로입니다.
          AI 브리핑은 <strong>음식점·카페·베이커리·바·숙박업 등 AI 브리핑 대상 업종</strong>만 대상이며,
          프랜차이즈 가맹점은 현재 제외됩니다(네이버 공식 정책).
        </p>
        <p className="mt-2 text-sm md:text-base text-blue-700 bg-white border border-blue-100 rounded px-2.5 py-1.5">
          ℹ️ AI탭은 업종 제한 발표가 없습니다 (2026-04-27 베타, 정식 출시).{' '}
          <Link href="/guide/ai-tab" className="underline font-semibold">AI탭 5항목 가이드 →</Link>
        </p>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 break-keep">
          {elig === 'inactive' || (business?.is_franchise)
            ? '네이버 검색 상위노출 + AI 노출 통합 가이드'
            : '네이버 AI 브리핑 노출 — 5단계 설정 가이드'}
        </h1>
        <p className="text-base md:text-lg text-gray-700 leading-relaxed break-keep">
          {elig === 'inactive' || (business?.is_franchise)
            ? '소개글·소식·리뷰 3가지를 갖추면 네이버 일반 검색 상위노출과 AI탭·ChatGPT·Gemini 노출이 동시에 개선됩니다. 평균 소요 10분.'
            : '내 사업장이 네이버 AI 브리핑에 노출되도록 단계별로 안내합니다. 평균 소요 15분.'}
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
        blogMentionCount={(business as { blog_mention_count?: number } | null)?.blog_mention_count ?? 0}
        hasReservation={(() => {
          const sp = (business as { sp_completeness_json?: { has_reservation?: boolean } } | null)?.sp_completeness_json
          return sp && typeof sp.has_reservation === 'boolean' ? sp.has_reservation : null
        })()}
        photoCount={(() => {
          const sp = (business as { sp_completeness_json?: { photo_count?: number } } | null)?.sp_completeness_json
          return sp && typeof sp.photo_count === 'number' ? sp.photo_count : null
        })()}
      />
    </div>
  )
}
