import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SchemaPageContent from './SchemaClient'
import Link from 'next/link'
import { Lock } from 'lucide-react'

export default async function SchemaPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) redirect('/login')

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'grace_period'])
    .maybeSingle()

  const plan = (sub?.status === "active" || sub?.status === "grace_period") ? (sub?.plan ?? 'free') : 'free'
  const hasAccess = plan !== 'free'

  if (!hasAccess) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">스마트플레이스 · 블로그 AI 최적화</h1>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">
            가게 정보를 입력하면 스마트플레이스 소개글과 네이버 블로그 포스트 초안을 자동으로 만들어 드립니다.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-blue-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Basic 플랜부터 이용 가능합니다</h2>
          <p className="text-base text-gray-500 mb-2 leading-relaxed">
            스마트플레이스 소개글, 네이버 블로그 초안, AI 인식 코드를 자동으로 생성합니다.
          </p>
          <p className="text-base text-gray-400 mb-6">현재 플랜: 무료 체험</p>
          <Link
            href="/pricing"
            className="bg-blue-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            Basic 플랜 시작하기 (월 9,900원)
          </Link>
        </div>
      </div>
    )
  }

  return <SchemaPageContent userId={user.id} />
}
