import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BeforeAfterCard } from '@/components/dashboard/BeforeAfterCard'
import { TrendLine } from '@/components/dashboard/TrendLine'
import { ExportButton } from './ExportButton'
import ShareButton from '@/components/share/ShareButton'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { History, ImageIcon, TrendingUp, Calendar, Download } from 'lucide-react'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  const { data: businesses } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)

  const business = businesses?.[0]
  if (!business) return (
    <NoBusiness
      Icon={History}
      title="변화 기록"
      description="스캔을 진행할 때마다 기록이 쌓입니다. AI 검색 노출이 어떻게 개선되었는지 확인하세요."
      features={[
        { Icon: ImageIcon,   title: "Before / After 비교",  desc: "사업장 등록 시점의 AI 검색 결과와 현재를 나란히 비교합니다." },
        { Icon: TrendingUp,  title: "30일 점수 추세선",     desc: "AI Visibility Score의 변화를 그래프로 한눈에 확인하세요." },
        { Icon: Calendar,    title: "스캔 히스토리 테이블", desc: "날짜별 점수·노출 횟수·전주 대비 변화를 표로 확인합니다." },
        { Icon: Download,    title: "CSV / PDF 내보내기",   desc: "Pro 이상 구독 시 전체 기록을 엑셀·PDF로 내보낼 수 있습니다." },
      ]}
    />
  )

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()
  const plan = sub?.plan ?? 'free'

  const [{ data: beforeAfter }, { data: history }] = await Promise.all([
    supabase
      .from('before_after')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('score_history')
      .select('*')
      .eq('business_id', business.id)
      .order('score_date', { ascending: false })
      .limit(30),
  ])

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">변화 기록</h1>
          <p className="text-gray-500 text-sm mt-1">스캔을 진행할 때마다 기록이 쌓입니다. AI 검색 노출이 어떻게 개선되었는지 확인하세요.</p>
        </div>
        <div className="flex items-center gap-3">
          <ShareButton
            title={`${business.name} AI 노출 리포트`}
            text={`AEOlab으로 분석한 AI 검색 노출 결과를 확인해보세요.`}
          />
          <ExportButton bizId={business.id} userId={user.id} plan={plan} />
        </div>
      </div>

      <div className="space-y-6">
        <TrendLine data={history ?? []} />
        <BeforeAfterCard items={beforeAfter ?? []} businessName={business.name} />

        {/* 스캔 히스토리 테이블 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div>
              <div className="text-sm font-medium text-gray-700">점수 변화 기록</div>
              <div className="text-xs text-gray-400 mt-0.5">점수가 높을수록 AI 검색에 더 잘 노출됩니다 (0~100점)</div>
            </div>
          </div>
          {(history ?? []).length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm font-medium mb-1">아직 스캔 기록이 없습니다.</p>
              <p className="text-gray-400 text-xs">대시보드에서 첫 AI 스캔을 진행하면 여기에 기록이 쌓입니다.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">날짜</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">점수</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">AI 노출 횟수 (100회 중)</th>
                  <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">전주 대비 변화</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(history ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-3 text-gray-700">
                      {new Date(row.score_date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-3 font-semibold text-blue-600">{Math.round(row.total_score)}점</td>
                    <td className="px-6 py-3 text-gray-600">{row.exposure_freq}/100</td>
                    <td className="px-6 py-3">
                      {row.weekly_change > 0 ? (
                        <span className="text-green-600">+{row.weekly_change.toFixed(1)}</span>
                      ) : row.weekly_change < 0 ? (
                        <span className="text-red-500">{row.weekly_change.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
