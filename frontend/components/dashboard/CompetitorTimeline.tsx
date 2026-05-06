'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Lock, AlertCircle } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface CompetitorScore {
  name: string
  score: number
  mentioned: boolean
}

interface TrendScan {
  scanned_at: string
  total_score: number
  unified_score?: number
  track1_score?: number
  competitor_scores: Record<string, CompetitorScore> | null
}

interface ChartPoint {
  date: string
  내가게: number | null
  [key: string]: number | null | string
}

// Pro 플랜 최대 10개 경쟁사 지원
const LINE_COLORS = [
  '#f97316', '#ef4444', '#8b5cf6', '#06b6d4',
  '#10b981', '#f59e0b', '#ec4899', '#3b82f6',
  '#84cc16', '#6366f1',
]

function getDaysDiff(a: string, b: string): number {
  return Math.abs(
    Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000),
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

interface Props {
  bizId: string
  accessToken: string
  plan: string
  bizName?: string
  competitors?: { id: string; name: string }[]
}

const PLAN_RANK: Record<string, number> = {
  free: 0, basic: 1, startup: 2, pro: 3, biz: 4,
}
function planAtLeast(current: string, required: string): boolean {
  return (PLAN_RANK[current] ?? 0) >= (PLAN_RANK[required] ?? 99)
}

export default function CompetitorTimeline({ bizId, accessToken, plan, bizName = '내 가게', competitors: regComps = [] }: Props) {
  const [days, setDays] = useState<7 | 30>(7)
  const [scans, setScans] = useState<TrendScan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canView30 = planAtLeast(plan, 'pro')
  const canView = planAtLeast(plan, 'basic')

  const fetchData = useCallback(async () => {
    if (!bizId || !accessToken) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${BACKEND}/api/report/history/${bizId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const data: TrendScan[] = await res.json()
      setScans(data)
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [bizId, accessToken])

  useEffect(() => { fetchData() }, [fetchData])

  // 표시 일수 제한 (free/basic: 7일, pro+: 30일)
  const effectiveDays = canView30 ? days : 7

  // 최근 N일 필터 (score_date 폴백: 백엔드 호환성)
  const filtered = scans.filter((s) => {
    const dateStr = s.scanned_at || (s as unknown as Record<string, string>).score_date
    if (!dateStr) return false
    const now = new Date()
    const diff = (now.getTime() - new Date(dateStr).getTime()) / 86400000
    return diff <= effectiveDays
  })

  // 경쟁사 이름 목록 + 최신 점수 (전체 스캔 이력 기반)
  const compNames: string[] = []
  const lastKnownScore: Record<string, number> = {}

  // 1) 필터된 스캔(7/30일)에서 먼저 수집
  for (const scan of filtered) {
    if (!scan.competitor_scores) continue
    for (const entry of Object.values(scan.competitor_scores as Record<string, CompetitorScore>)) {
      const name = entry?.name
      if (name && !compNames.includes(name)) compNames.push(name)
    }
  }

  // 2) 전체 스캔 이력에서 compNames 추가 + 최신 점수 기록
  //    scans는 백엔드에서 최신순(DESC)으로 반환 → 첫 번째 등장이 가장 최근
  for (const scan of scans) {
    if (!scan.competitor_scores) continue
    for (const [, entry] of Object.entries(scan.competitor_scores as Record<string, CompetitorScore>)) {
      const name = entry?.name
      if (!name) continue
      if (!compNames.includes(name)) compNames.push(name)
      if (lastKnownScore[name] === undefined) lastKnownScore[name] = Math.round(entry.score)
    }
  }

  // 3) 현재 등록된 경쟁사도 추가 (아직 스캔 안 된 경쟁사)
  for (const c of regComps) {
    if (c.name && !compNames.includes(c.name)) compNames.push(c.name)
  }

  // 차트 데이터 구성
  const sortedFiltered = [...filtered].sort((a, b) => {
    const aDate = a.scanned_at || (a as unknown as Record<string, string>).score_date || ''
    const bDate = b.scanned_at || (b as unknown as Record<string, string>).score_date || ''
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })

  const chartData: ChartPoint[] = sortedFiltered.map((s, idx) => {
    const isLast = idx === sortedFiltered.length - 1
    const dateStr = s.scanned_at || (s as unknown as Record<string, string>).score_date || ''
    const point: ChartPoint = {
      date: formatDate(dateStr),
      내가게: Math.round(s.track1_score ?? s.unified_score ?? s.total_score ?? 0),
    }
    // 이름으로 경쟁사 점수 조회 (UUID 키 → name 필드 매핑)
    compNames.forEach((name, compIdx) => {
      const entry = Object.values(s.competitor_scores as Record<string, CompetitorScore> || {})
        .find((v) => v?.name === name)
      // 동점자 시각 분리: 경쟁사 인덱스 × 2점 지터 추가 (툴팁에서 반올림하여 숨김)
      const jitter = compIdx * 2
      if (entry) {
        point[name] = Math.round(entry.score) + jitter
      } else if (isLast && lastKnownScore[name] !== undefined) {
        // 필터 범위 밖 최신 점수 → 마지막 포인트에 참조용 도트 표시
        point[name] = (lastKnownScore[name] ?? 0) + jitter
      } else {
        point[name] = null
      }
    })
    return point
  })

  // 동적 Y축 범위 — 지터 포함 최대값 기준으로 줌인 (낮은 점수대도 차이 보임)
  const allChartVals = chartData.flatMap(pt =>
    [...compNames, '내가게'].map(k => pt[k] as number | null).filter((v): v is number => v !== null)
  )
  const yMax = allChartVals.length > 0
    ? Math.min(100, Math.ceil((Math.max(...allChartVals) + 8) / 10) * 10)
    : 100

  // 변화 요약 — 마지막 2개 스캔 비교 (UUID 키 → name 필드 매핑, 시간순 정렬 기준)
  const summaries: { name: string; change: number; color: string }[] = []
  if (sortedFiltered.length >= 2) {
    const prev = sortedFiltered[sortedFiltered.length - 2]
    const curr = sortedFiltered[sortedFiltered.length - 1]
    compNames.forEach((name) => {
      const prevEntry = Object.values(prev.competitor_scores as Record<string, CompetitorScore> || {}).find((v) => v?.name === name)
      const currEntry = Object.values(curr.competitor_scores as Record<string, CompetitorScore> || {}).find((v) => v?.name === name)
      const prevScore = prevEntry?.score ?? 0
      const currScore = currEntry?.score ?? 0
      const change = Math.round((currScore - prevScore) * 10) / 10
      summaries.push({
        name,
        change,
        color: change > 0 ? 'text-red-600' : change < 0 ? 'text-emerald-600' : 'text-gray-500',
      })
    })
  }

  if (!canView) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-800">경쟁사 AI 노출 변화</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Lock className="w-8 h-8 text-gray-300" />
          <p className="text-sm font-semibold text-gray-600">Basic 이상 플랜에서 이용 가능합니다</p>
          <a href="/pricing" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            플랜 업그레이드
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5 mt-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600 shrink-0" />
          <h2 className="text-base font-bold text-gray-800">경쟁사 AI 노출 변화</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => {
                if (d === 30 && !canView30) return
                setDays(d)
              }}
              disabled={d === 30 && !canView30}
              className={[
                'text-sm px-3 py-1 rounded-lg font-medium transition-colors',
                days === d && effectiveDays === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                d === 30 && !canView30 ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {d}일
              {d === 30 && !canView30 && (
                <span className="ml-1 text-sm">(Pro+)</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
      )}

      {/* 에러 */}
      {!loading && error && (
        <div className="flex items-center gap-2 text-sm text-red-500 py-6 justify-center">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* 데이터 없음 */}
      {!loading && !error && chartData.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-sm text-gray-500 leading-relaxed">
            경쟁사를 등록하고 첫 스캔이 완료되면<br />
            비교 그래프가 나타납니다.
          </p>
          <a href="/dashboard" className="inline-block mt-3 text-sm text-blue-600 font-semibold hover:underline">
            대시보드에서 AI 스캔 실행 →
          </a>
        </div>
      )}

      {/* 차트 */}
      {!loading && !error && chartData.length > 0 && (
        <>
          {/* 변화 요약 배너 */}
          {summaries.some((s) => s.change !== 0) && (
            <div className="space-y-1.5 mb-4">
              {summaries.filter((s) => Math.abs(s.change) >= 1).map((s) => (
                <div
                  key={s.name}
                  className={[
                    'flex items-center gap-2 text-sm rounded-xl px-3 py-2',
                    s.change > 0
                      ? 'bg-amber-50 text-amber-800 border border-amber-100'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-100',
                  ].join(' ')}
                >
                  {s.change > 0
                    ? <TrendingUp className="w-4 h-4 shrink-0" />
                    : <TrendingDown className="w-4 h-4 shrink-0" />}
                  <span>
                    <strong>{s.name}</strong>이(가) 최근 스캔에서{' '}
                    {s.change > 0 ? '+' : ''}{s.change}점{' '}
                    {s.change > 0 ? '상승 — 경쟝 위협 증가' : '하락 — 경쟝 완화'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <ResponsiveContainer width="100%" height={220 + Math.max(0, compNames.length - 2) * 18}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, yMax]}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(value) => [`${Math.round(Number(value))}점`, undefined]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => value === '내가게' ? bizName : value}
              />
              <Line
                type="monotone"
                dataKey="내가게"
                name="내가게"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
              />
              {compNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                  strokeDasharray="4 2"
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {compNames.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-2">
              경쟁사를 등록하면 비교 선이 표시됩니다.
            </p>
          )}

          {/* 현재 점수 순위 — 차트에서 겹쳐 보이지 않는 경쟁사도 명확히 표시 */}
          {compNames.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs font-semibold text-gray-500 mb-2">최근 스캔 기준 점수 순위</div>
              <div className="space-y-1.5">
                {(() => {
                  const latestMy = sortedFiltered.length > 0
                    ? Math.round(sortedFiltered[sortedFiltered.length - 1].track1_score ?? sortedFiltered[sortedFiltered.length - 1].unified_score ?? sortedFiltered[sortedFiltered.length - 1].total_score ?? 0)
                    : 0
                  const rows = [
                    { name: bizName, score: latestMy, isMe: true, color: '#2563eb' },
                    ...compNames.map((name, i) => ({
                      name,
                      score: lastKnownScore[name] ?? 0,
                      isMe: false,
                      color: LINE_COLORS[i % LINE_COLORS.length],
                    })),
                  ].sort((a, b) => b.score - a.score)
                  const maxScore = Math.max(...rows.map(r => r.score), 10)
                  return rows.map((row, rank) => (
                    <div key={row.name} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 shrink-0">#{rank + 1}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.round((row.score / maxScore) * 100)}%`, backgroundColor: row.color }}
                        />
                      </div>
                      <span className={`text-xs truncate max-w-[130px] ${row.isMe ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
                        {row.isMe ? `${row.name} (내 가게)` : row.name}
                      </span>
                      <span className="text-xs font-semibold shrink-0 text-gray-500">{row.score}점</span>
                    </div>
                  ))
                })()}
              </div>
              {compNames.some(n => (lastKnownScore[n] ?? 0) <= 15) && (
                <p className="mt-1.5 text-xs text-gray-400">※ 15점 = AI 검색 미언급 · 스캔 반복 시 점수 변동</p>
              )}
            </div>
          )}

          {/* 안내 */}
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            <p className="text-xs text-gray-400">실선 = 내 가게 · 점선 = 경쟁사 추이</p>
            {compNames.length > 1 && (
              <p className="text-xs text-gray-400">※ 같은 점수 경쟁사는 시각 구분을 위해 약간 다른 높이로 표시됩니다</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
