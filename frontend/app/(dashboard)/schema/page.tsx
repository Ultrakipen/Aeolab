import { createClient, getCachedUser, getCachedActivePlan } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SchemaPageContent from './SchemaClient'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { getActiveBusinessId } from '@/lib/active-business'

export default async function SchemaPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  // 관리자 우회 (competitors/page.tsx:78-80과 동일 패턴)
  const ADMIN_EMAILS_LIST = (process.env.ADMIN_EMAILS ?? 'hoozdev@gmail.com').split(',').map((e) => e.trim().toLowerCase())
  const isAdmin = ADMIN_EMAILS_LIST.includes((user.email ?? '').toLowerCase())
  const plan = isAdmin ? 'biz' : await getCachedActivePlan(user.id)
  const hasAccess = plan !== 'free'

  if (!hasAccess) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">AI 검색 최적화 도구</h1>
          <p className="text-gray-600 text-sm mt-1 leading-relaxed">
            스마트플레이스 소개글·블로그 초안 3종 자동 생성, AI 브리핑 키워드 점수 확인, 홈페이지 AI 인식 코드(JSON-LD)까지 한 번에 만들어 드립니다.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 md:p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Basic 플랜부터 이용 가능합니다</h2>
          <p className="text-base text-gray-600 mb-2 leading-relaxed">
            스마트플레이스 소개글·블로그 초안 3종·AI 인식 코드(JSON-LD) 자동 생성 + 소개글 AI 브리핑 키워드 점수 확인.
          </p>
          <p className="text-base text-gray-600 mb-6">현재 플랜: 무료 체험</p>
          <Link
            href="/pricing"
            className="bg-blue-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            Basic 플랜 시작하기 (월 11,900원)
          </Link>
        </div>
      </div>
    )
  }

  // 활성 사업장 정보 불러오기 (폼 자동 입력용)
  const activeBizId = await getActiveBusinessId(user.id)
  let prefill: { name: string; category: string; region: string; phone: string; address: string; website_url: string } | null = null

  if (activeBizId) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('name, category, region, phone, address, website_url')
      .eq('id', activeBizId)
      .maybeSingle()
    if (biz) {
      prefill = {
        name: biz.name ?? '',
        category: biz.category ?? 'restaurant',
        region: biz.region ?? '',
        phone: biz.phone ?? '',
        address: biz.address ?? '',
        website_url: biz.website_url ?? '',
      }
    }
  }

  return <SchemaPageContent userId={user.id} prefill={prefill} />
}
