import { createClient, getCachedUser, getCachedActivePlan } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendLine } from '@/components/dashboard/TrendLine'
import { ExportButton } from './ExportButton'
import BlogScreenshotSection from './BlogScreenshotSection'
import ShareButton from '@/components/share/ShareButton'
import { NoBusiness } from '@/components/dashboard/NoBusiness'
import { History, ImageIcon, TrendingUp, Calendar, Download, Lock } from 'lucide-react'
import Link from 'next/link'
import { getActiveBusinessId } from '@/lib/active-business'
import { getScoreTextLabel } from '@/lib/scoreLabels'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

const PLAN_RANK: Record<string, number> = {
  free: 0, basic: 1, startup: 1.5, pro: 2, biz: 3,
}

interface ActionLog {
  action_type: string
  action_label: string
  action_date: string
  score_before: number | null
  score_after: number | null
}

export default async function HistoryPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const ADMIN_EMAILS_LIST = (process.env.ADMIN_EMAILS ?? 'hoozdev@gmail.com').split(',').map((e) => e.trim().toLowerCase())
  const isAdmin = ADMIN_EMAILS_LIST.includes((user.email ?? '').toLowerCase())

  // user.id만 있으면 되는 조회들 — activeBizId 결정, 플랜 조회, 세션 조회는
  // 서로 독립적이므로 병렬 실행 (plan/session은 activeBizId·business와 무관)
  const [activeBizId, plan, sessionRes] = await Promise.all([
    getActiveBusinessId(user.id),
    isAdmin ? Promise.resolve('biz') : getCachedActivePlan(user.id),
    supabase.auth.getSession().catch(() => ({ data: { session: null } })),
  ])

  const { data: activeBizData } = activeBizId
    ? await supabase
        .from('businesses')
        .select('id, name, category, region, keywords, is_smart_place, naver_place_id, naver_blog_id, blog_url')
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

  // Free 플랜 차단 (Basic 이상 필요)
  if ((PLAN_RANK[plan] ?? 0) < PLAN_RANK['basic']) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-gray-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-700 mb-2">
            변화 기록은 Basic 이상 요금제에서 사용 가능합니다
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            AI 스캔 기록과 30일 추세선을 확인하고,<br />
            내 가게가 어떻게 성장했는지 추적할 수 있습니다.
          </p>
          <Link
            href="/pricing"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            요금제 보기 →
          </Link>
        </div>
      </div>
    )
  }

  const accessToken = sessionRes.data.session?.access_token ?? ''

  // "30일 추세"는 최근 30개 행이 아니라 최근 30일(날짜) 기준이어야 함 — 스캔이
  // 뜸한 계정에서 limit(30)이 실제로는 몇 달 전 데이터까지 끌어와 actionLogs(날짜
  // 기준 60일 조회)와 표시 범위가 어긋나던 구조적 원인. 날짜 필터로 통일.
  const historyCutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [historyRes, blogShotsRes, actionLogRes] = await Promise.all([
    supabase
      .from('score_history')
      .select('id, business_id, score_date, total_score, unified_score, track1_score, track2_score, exposure_freq, weekly_change, context, sample_size')
      .eq('business_id', business.id)
      .gte('score_date', historyCutoff)
      .order('score_date', { ascending: false })
      .limit(200),
    // 블로그 스크린샷: blog_keyword 타입만, 오름차순 조회 (가장 오래된 것 = baseline, 가장 최신 = latest)
    supabase
      .from('before_after')
      .select('keyword, image_url, created_at')
      .eq('business_id', business.id)
      .eq('capture_type', 'blog_keyword')
      .order('created_at', { ascending: true })
      .limit(100),
    fetch(`${BACKEND}/api/report/action-log/${business.id}?days=60`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null),
  ])

  // v3.0 컬럼(unified_score 등) 미마이그레이션 시 fallback: 기본 컬럼만 조회
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
    sample_size?: number | null
  }
  let historyData: ScoreHistoryRow[] | null = historyRes.data as ScoreHistoryRow[] | null
  if (historyRes.error) {
    const fallback = await supabase
      .from('score_history')
      .select('id, business_id, score_date, total_score, exposure_freq, weekly_change')
      .eq('business_id', business.id)
      .gte('score_date', historyCutoff)
      .order('score_date', { ascending: false })
      .limit(200)
    historyData = fallback.data as ScoreHistoryRow[] | null
  }

  const history = historyData

  // 30일 창 안에 기록이 없는 경우 — "한 번도 스캔 안 함"과 "예전엔 스캔했지만
  // 최근 30일엔 없음"을 구분해야 함(후자에 "첫 스캔을 진행하면"이라고 하면
  // 이미 여러 번 스캔한 사용자에게 사실과 다른 안내가 됨)
  let lastScanDateEver: string | null = null
  if ((history ?? []).length === 0) {
    const { data: lastScanRow } = await supabase
      .from('score_history')
      .select('score_date')
      .eq('business_id', business.id)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    lastScanDateEver = lastScanRow?.score_date ?? null
  }

  // 행동 로그 파싱
  let actionLogs: ActionLog[] = []
  if (actionLogRes && typeof actionLogRes === 'object' && 'ok' in actionLogRes && actionLogRes.ok) {
    const raw = await (actionLogRes as Response).json().catch(() => null)
    if (Array.isArray(raw)) {
      actionLogs = raw
    } else if (raw?.logs && Array.isArray(raw.logs)) {
      actionLogs = raw.logs
    }
  }

  // 점수 요약 계산
  const scores = history ?? []
  const latestScore = scores[0]
  const prevScore = scores[1]
  const currentVal = latestScore ? (latestScore.unified_score ?? latestScore.total_score ?? 0) : 0
  const prevVal = prevScore ? (prevScore.unified_score ?? prevScore.total_score ?? 0) : 0
  const diff = latestScore?.weekly_change ?? (currentVal - prevVal)
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
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <ShareButton
            title={`${business.name} AI 노출 리포트`}
            text={`AEOlab으로 분석한 AI 검색 노출 결과를 확인해보세요.`}
          />
          <ExportButton bizId={business.id} userId={user.id} plan={plan} />
        </div>
      </div>

      <div className="space-y-4">
        {/* 최신 상태 요약 카드 */}
        {scores.length >= 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border p-3 md:p-4 text-center">
              <p className="text-sm text-gray-500 mb-2 font-medium">현재 상태</p>
              <p className={`text-base md:text-lg font-bold ${currentVal >= 75 ? 'text-emerald-700' : currentVal >= 55 ? 'text-blue-600' : currentVal >= 30 ? 'text-amber-700' : 'text-gray-500'}`}>
                {getScoreTextLabel(currentVal)}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-3 md:p-4 text-center">
              <p className="text-sm text-gray-500 mb-2 font-medium">{latestScore?.weekly_change != null ? "지난주 대비" : "이전 스캔 대비"}</p>
              <p className={`text-base md:text-lg font-bold ${diff > 2 ? 'text-emerald-700' : diff < -2 ? 'text-red-600' : 'text-gray-500'}`}>
                {diff > 2 ? '↑ 상승' : diff < -2 ? '↓ 하락' : '— 유지'}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-3 md:p-4 text-center">
              <p className="text-sm text-gray-500 mb-2 font-medium">최고 도달 상태</p>
              <p className={`text-base md:text-lg font-bold ${maxScore >= 75 ? 'text-emerald-700' : maxScore >= 55 ? 'text-blue-600' : maxScore >= 30 ? 'text-amber-700' : 'text-gray-500'}`}>
                {getScoreTextLabel(maxScore)}
              </p>
            </div>
          </div>
        )}

        {/* 스캔 히스토리 테이블 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1">
                <div className="text-base font-medium text-gray-700">AI 노출 상태 기록</div>
                <div className="text-sm text-gray-500 mt-0.5">스캔할 때마다 AI 검색 노출 상태가 기록됩니다</div>
              </div>
              {/* 모바일 전용 스크롤 안내 */}
              <div className="md:hidden flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 self-start">
                <span className="text-base">←</span>
                <span>좌우로 밀어서 더 보기</span>
              </div>
            </div>
          </div>
          {/* 점수 계산 설명 */}
          <div className="px-4 md:px-6 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-sm text-gray-500">
              통합 점수 = 네이버 AI 점수와 글로벌 AI 점수를 업종별 비율로 가중 합산해 산출됩니다
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다
            </p>
          </div>
          {(history ?? []).length === 0 ? (
            <div className="p-4 sm:p-6 md:p-8 text-center">
              {lastScanDateEver ? (
                <>
                  <p className="text-gray-500 text-sm font-medium mb-1">
                    최근 30일간 스캔 기록이 없습니다. (마지막 스캔: {new Date(lastScanDateEver).toLocaleDateString('ko-KR')})
                  </p>
                  <p className="text-gray-500 text-sm mb-3">재스캔하면 최신 AI 검색 노출 상태가 여기에 기록됩니다.</p>
                  <Link href="/dashboard" className="inline-block text-sm font-semibold text-blue-600 hover:underline">
                    대시보드에서 지금 재스캔 →
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-gray-500 text-sm font-medium mb-1">아직 스캔 기록이 없습니다.</p>
                  <p className="text-gray-500 text-sm">대시보드에서 첫 AI 스캔을 진행하면 여기에 기록이 쌓입니다.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">날짜</th>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">전체 AI 노출</th>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">네이버 AI 노출도</th>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">AI 언급 횟수(샘플 대비)</th>
                    <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">전주 대비</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(history ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 md:px-6 py-3 text-gray-700 whitespace-nowrap">
                        {new Date(row.score_date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 md:px-6 py-3">
                        {(() => {
                          const s = row.unified_score ?? row.total_score ?? 0
                          const lbl = getScoreTextLabel(s)
                          const cls = s >= 75 ? 'text-emerald-700' : s >= 55 ? 'text-blue-600' : s >= 30 ? 'text-amber-700' : 'text-gray-500'
                          return <span className={`font-semibold text-sm ${cls}`}>{lbl}</span>
                        })()}
                      </td>
                      <td className="px-4 md:px-6 py-3">
                        {row.track1_score != null ? (
                          (() => {
                            const s = row.track1_score
                            const lbl = getScoreTextLabel(s)
                            const cls = s >= 75 ? 'text-emerald-700' : s >= 55 ? 'text-blue-600' : s >= 30 ? 'text-amber-700' : 'text-gray-500'
                            return <span className={`font-medium text-sm ${cls}`}>{lbl}</span>
                          })()
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 text-gray-600 text-sm">{row.exposure_freq ?? 0}/{row.sample_size ?? 100}</td>
                      <td className="px-4 md:px-6 py-3">
                        {(row.weekly_change ?? 0) > 2 ? (
                          <span className="text-green-700 font-semibold">↑ 상승</span>
                        ) : (row.weekly_change ?? 0) < -2 ? (
                          <span className="text-red-600 font-semibold">↓ 하락</span>
                        ) : (
                          <span className="text-gray-500">—</span>
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
              <p className="font-semibold text-red-700">AI 노출 상태가 하락했습니다</p>
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
              <p className="font-semibold text-emerald-700">AI 노출 상태가 개선됐습니다!</p>
              <p className="text-sm text-emerald-700 mt-1">지속적으로 유지하려면 FAQ와 소식 업데이트를 주 1회 이어가세요.</p>
            </div>
          </div>
        )}

        <TrendLine data={history ?? []} actionLogs={actionLogs} />

        {/* 키워드별 AI 검색 노출 변화 — 가입 시점 / 현재 비교 */}
        <BlogScreenshotSection
          bizId={business.id}
          accessToken={accessToken}
          plan={plan}
          initialShots={initialBlogShots}
          naverBlogId={(() => {
            // naver_blog_id 우선, 없으면 blog_url에서 추출 (블로그 진단 페이지에서 등록된 URL)
            if (business.naver_blog_id) return business.naver_blog_id
            const blogUrl: string = (business as { blog_url?: string }).blog_url ?? ''
            const m = blogUrl.match(/blog\.naver\.com\/([^/?#]+)/i)
            return m ? m[1] : ''
          })()}
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
