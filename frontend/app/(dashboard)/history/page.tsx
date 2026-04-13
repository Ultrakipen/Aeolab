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
  const plan = (sub?.status === "active" || sub?.status === "grace_period") ? (sub?.plan ?? "free") : "free"

  const [{ data: beforeAfter }, { data: history }] = await Promise.all([
    supabase
      .from('before_after')
      .select('id, business_id, capture_type, image_url, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('score_history')
      .select('id, business_id, score_date, total_score, unified_score, track1_score, track2_score, exposure_freq, weekly_change, context, created_at')
      .eq('business_id', business.id)
      .order('score_date', { ascending: false })
      .limit(30),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">변화 기록</h1>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">스캔을 진행할 때마다 기록이 쌓입니다. AI 검색 노출이 어떻게 개선되었는지 확인하세요.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ShareButton
            title={`${business.name} AI 노출 리포트`}
            text={`AEOlab으로 분석한 AI 검색 노출 결과를 확인해보세요.`}
          />
          <ExportButton bizId={business.id} userId={user.id} plan={plan} />
        </div>
      </div>

      <div className="space-y-4">
        {/* 히스토리 안내 배너 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3 items-start">
          <div className="text-blue-400 mt-0.5 shrink-0 text-base">ℹ️</div>
          <div className="text-sm text-blue-700">
            <span className="font-medium">스코어 기록</span>은 대시보드에서 AI 스캔을 실행할 때마다 쌓입니다.
            <span className="font-medium ml-2">Before/After 스크린샷</span>은 사업장 등록 시 자동 촬영되며, 30일·60일·90일 후 비교 사진이 자동 추가됩니다.
          </div>
        </div>

        <TrendLine data={history ?? []} />
        <BeforeAfterCard items={beforeAfter ?? []} businessName={business.name} />

        {/* Before/After 초기 안내 — after 데이터 없을 때 */}
        {(beforeAfter ?? []).filter((i) => i.capture_type?.startsWith?.('after_')).length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-700 font-medium">
              개선 후(After) 스크린샷은 다음 자동 스캔(매일 새벽 2시) 후 자동 저장됩니다.
            </p>
            <p className="text-sm text-amber-600 mt-1">
              첫 스캔 완료 후 다음 날 확인해보세요.
            </p>
          </div>
        )}

        {/* 스캔 히스토리 테이블 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100">
            <div>
              <div className="text-base font-medium text-gray-700">점수 변화 기록</div>
              <div className="text-base text-gray-400 mt-0.5">점수가 높을수록 AI 검색에 더 잘 노출됩니다 (0~100점)</div>
            </div>
          </div>
          {(history ?? []).length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm font-medium mb-1">아직 스캔 기록이 없습니다.</p>
              <p className="text-gray-400 text-sm">대시보드에서 첫 AI 스캔을 진행하면 여기에 기록이 쌓입니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">날짜</th>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">통합 점수</th>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">네이버 AI 준비도</th>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">AI 노출 횟수 (100회 중)</th>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">전주 대비</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(history ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 md:px-6 py-3 text-gray-700 whitespace-nowrap">
                        {new Date(row.score_date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 md:px-6 py-3 font-semibold text-blue-600">
                        {Math.round(row.unified_score ?? row.total_score)}점
                      </td>
                      <td className="px-4 md:px-6 py-3">
                        {row.track1_score != null ? (
                          <span className="font-medium text-indigo-600">{Math.round(row.track1_score)}점</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 text-gray-600">{row.exposure_freq}/100</td>
                      <td className="px-4 md:px-6 py-3">
                        {(row.weekly_change ?? 0) > 0 ? (
                          <span className="text-green-600">+{(row.weekly_change as number).toFixed(1)}</span>
                        ) : (row.weekly_change ?? 0) < 0 ? (
                          <span className="text-red-500">{(row.weekly_change as number).toFixed(1)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
