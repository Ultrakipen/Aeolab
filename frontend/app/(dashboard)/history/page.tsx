import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendLine } from '@/components/dashboard/TrendLine'
import { ExportButton } from './ExportButton'
import BlogScreenshotSection from './BlogScreenshotSection'
import ShareButton from '@/components/share/ShareButton'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { History, ImageIcon, TrendingUp, Calendar, Download } from 'lucide-react'
import Link from 'next/link'
import { getActiveBusinessId } from '@/lib/active-business'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) redirect('/login')

  // cookie 기반 활성 사업장 결정
  const activeBizId = await getActiveBusinessId(user.id)

  const { data: activeBizData } = activeBizId
    ? await supabase
        .from('businesses')
        .select('id, name, category, region, keywords, is_smart_place, naver_place_id, naver_blog_id')
        .eq('id', activeBizId)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null }

  const business = activeBizData
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

  let accessToken = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    accessToken = session?.access_token ?? ''
  } catch { /* accessToken = '' */ }

  const [historyRes, blogShotsRes] = await Promise.all([
    supabase
      .from('score_history')
      .select('id, business_id, score_date, total_score, unified_score, track1_score, track2_score, exposure_freq, weekly_change, context, created_at')
      .eq('business_id', business.id)
      .order('score_date', { ascending: false })
      .limit(30),
    // 블로그 스크린샷: blog_keyword 타입만, 오름차순 조회 (가장 오래된 것 = baseline, 가장 최신 = latest)
    supabase
      .from('before_after')
      .select('keyword, image_url, created_at')
      .eq('business_id', business.id)
      .eq('capture_type', 'blog_keyword')
      .order('created_at', { ascending: true })
      .limit(100),
  ])

  // v3.0 컬럼(unified_score 등) 미마이그레이션 시 fallback: 기본 컬럼만 조회
  // fallback SELECT의 컬럼 목록이 다른 것은 의도적 — 수정하지 말 것
  type ScoreHistoryRow = {
    id: string
    business_id: string
    score_date: string
    total_score: number
    unified_score?: number | null
    track1_score?: number | null
    track2_score?: number | null
    exposure_freq: number
    weekly_change?: number | null
    context?: string | null
    created_at?: string | null
  }
  let historyData: ScoreHistoryRow[] | null = historyRes.data as ScoreHistoryRow[] | null
  if (historyRes.error) {
    const fallback = await supabase
      .from('score_history')
      .select('id, business_id, score_date, total_score, exposure_freq, weekly_change, created_at')
      .eq('business_id', business.id)
      .order('score_date', { ascending: false })
      .limit(30)
    historyData = fallback.data as ScoreHistoryRow[] | null
  }

  const history = historyData

  // 점수 요약 계산
  const scores = history ?? []
  const latestScore = scores[0]
  const prevScore = scores[1]
  const currentVal = latestScore ? (latestScore.unified_score ?? latestScore.total_score ?? 0) : 0
  const prevVal = prevScore ? (prevScore.unified_score ?? prevScore.total_score ?? 0) : 0
  const diff = currentVal - prevVal
  const maxScore = scores.length > 0
    ? Math.max(...scores.map(s => s.unified_score ?? s.total_score ?? 0))
    : 0

  // 블로그 스크린샷: 키워드별로 가장 오래된 것(baseline)과 최신 것(latest)을 분리
  // blogShotsRes는 created_at ASC 정렬이므로 순서대로 순회하면 첫 번째가 baseline
  const bizKeywords: string[] = (business.keywords ?? []).slice(0, 10)
  type ShotItem = { url: string; captured_at: string }
  type BlogShot = { keyword: string; baseline: ShotItem | null; latest: ShotItem | null }
  const blogShotMap: Record<string, { baseline: ShotItem | null; latest: ShotItem | null }> = {}
  for (const row of (blogShotsRes.data ?? [])) {
    const kw = (row.keyword ?? '').trim()
    if (!kw || !row.image_url) continue
    const item: ShotItem = { url: row.image_url, captured_at: row.created_at }
    if (!blogShotMap[kw]) {
      // 첫 번째 = 가입 시점(baseline), latest는 아직 같은 값으로 초기화
      blogShotMap[kw] = { baseline: item, latest: item }
    } else {
      // 이후 것은 latest 갱신 (오름차순 순회이므로 마지막에 만나는 것이 최신)
      blogShotMap[kw].latest = item
    }
  }
  const initialBlogShots: BlogShot[] = bizKeywords
    .filter((k) => k.trim())
    .map((kw) => {
      const trimmed = kw.trim()
      const entry = blogShotMap[trimmed]
      return {
        keyword: trimmed,
        baseline: entry?.baseline ?? null,
        latest: entry?.latest ?? null,
      }
    })

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
        {/* 최신 점수 요약 카드 */}
        {scores.length >= 2 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border p-3 md:p-4 text-center">
              <p className="text-sm text-gray-500 mb-1 font-medium">현재 점수</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{currentVal.toFixed(1)}</p>
            </div>
            <div className="bg-white rounded-xl border p-3 md:p-4 text-center">
              <p className="text-sm text-gray-500 mb-1 font-medium">지난주 대비</p>
              <p className={`text-2xl md:text-3xl font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-3 md:p-4 text-center">
              <p className="text-sm text-gray-500 mb-1 font-medium">최고 기록</p>
              <p className="text-2xl md:text-3xl font-bold text-blue-600">{maxScore.toFixed(1)}</p>
            </div>
          </div>
        )}

        {/* 스캔 히스토리 테이블 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1">
                <div className="text-base font-medium text-gray-700">점수 변화 기록</div>
                <div className="text-sm text-gray-400 mt-0.5">점수가 높을수록 AI 검색에 더 잘 노출됩니다 (0~100점)</div>
              </div>
              {/* 모바일 전용 스크롤 안내 */}
              <div className="md:hidden flex items-center gap-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 self-start">
                <span className="text-base">←</span>
                <span>좌우로 밀어서 더 보기</span>
              </div>
            </div>
          </div>
          {/* 점수 계산 설명 */}
          <div className="px-4 md:px-6 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-sm text-gray-500">
              통합 점수 = 네이버 AI 점수 × 업종 비율 + 글로벌 AI 점수 × 비율로 계산됩니다
            </p>
          </div>
          {(history ?? []).length === 0 ? (
            <div className="p-4 sm:p-6 md:p-8 text-center">
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
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">네이버 AI 브리핑 점수</th>
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

        {/* 점수 변화 행동 유도 메시지 */}
        {scores.length >= 2 && diff < -3 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-red-500 text-xl shrink-0">⚠️</span>
            <div>
              <p className="font-semibold text-red-700">점수가 {Math.abs(diff).toFixed(1)}점 떨어졌습니다</p>
              <p className="text-sm text-red-600 mt-1">경쟁사가 강화되었거나 내 가게 정보 업데이트가 필요할 수 있습니다.</p>
              <Link href="/guide" className="mt-2 inline-flex items-center text-sm font-semibold text-red-700 hover:underline">
                개선 방법 보기 →
              </Link>
            </div>
          </div>
        )}
        {scores.length >= 2 && diff >= 3 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl shrink-0">🎉</span>
            <div>
              <p className="font-semibold text-emerald-700">점수가 {diff.toFixed(1)}점 올랐습니다!</p>
              <p className="text-sm text-emerald-600 mt-1">지속적으로 유지하려면 FAQ와 소식 업데이트를 주 1회 이어가세요.</p>
            </div>
          </div>
        )}

        <TrendLine data={history ?? []} />

        {/* 키워드별 AI 검색 노출 변화 — 가입 시점 / 현재 비교 */}
        <BlogScreenshotSection
          bizId={business.id}
          accessToken={accessToken}
          plan={plan}
          initialShots={initialBlogShots}
          naverBlogId={business.naver_blog_id ?? ""}
        />

        {/* 히스토리 안내 배너 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 items-start">
          <div className="text-blue-400 mt-0.5 shrink-0 text-base">ℹ️</div>
          <div className="text-sm md:text-base text-blue-700">
            <span className="font-medium">스코어 기록</span>은 대시보드에서 AI 스캔을 실행할 때마다 쌓입니다.
            <span className="font-medium ml-2">키워드별 노출 변화</span>는 가입 시점과 현재를 비교해 개선 여부를 한눈에 확인할 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  )
}
