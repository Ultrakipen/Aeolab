'use client'

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts'

interface TrendPoint {
  score_date: string
  total_score: number
  exposure_freq: number
}

export interface ActionLog {
  action_type: string
  action_label: string
  action_date: string    // "YYYY-MM-DD"
  score_before: number | null
  score_after: number | null
}

interface TrendLineProps {
  data: TrendPoint[]
  actionLogs?: ActionLog[]
}

/** 7일 이동평균 계산 — 앞쪽 데이터 부족한 구간은 null (차트에서 끊김 처리) */
function movingAvg(values: (number | null)[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null
    const slice = values.slice(i - window + 1, i + 1)
    if (slice.some((v) => v === null)) return null
    const sum = (slice as number[]).reduce((a, b) => a + b, 0)
    return Math.round(sum / window)
  })
}

/** score_after가 있을 때 방향 레이블 생성 — 점수 수치 미노출 */
function deltaLabel(log: ActionLog): string {
  if (log.score_after != null && log.score_before != null) {
    const diff = Math.round(log.score_after - log.score_before)
    const dir = diff > 0 ? '↑ 상승' : diff < 0 ? '↓ 하락' : '변화 없음'
    return `${log.action_label} (${dir})`
  }
  return log.action_label
}

/** action_type별 색상 */
const ACTION_COLOR: Record<string, string> = {
  faq_registered: '#f59e0b',
  intro_updated: '#10b981',
  post_published: '#8b5cf6',
  review_replied: '#3b82f6',
  guide_generated: '#ec4899',
}

export function TrendLine({ data, actionLogs = [] }: TrendLineProps) {
  const sorted = [...data].reverse().slice(-30)

  const raw = sorted.map((d) => Math.round(d.total_score))
  const ma7 = movingAvg(raw)

  const chartData = sorted.map((d, i) => ({
    date: d.score_date.slice(5),   // "MM-DD"
    score: raw[i],
    ma7: ma7[i],
  }))

  // action_date를 "MM-DD" 형식으로 변환해 X축과 매칭
  const logsForChart = actionLogs.map((log) => ({
    ...log,
    dateKey: log.action_date.slice(5),  // "YYYY-MM-DD" → "MM-DD"
    color: ACTION_COLOR[log.action_type] ?? '#f59e0b',
  }))

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm flex items-center justify-center h-48">
        <p className="text-gray-400 text-base">30일 추세 데이터가 없습니다.</p>
      </div>
    )
  }

  const latestScore = chartData.length > 0 ? chartData[chartData.length - 1].score : null
  const latestGrade = latestScore == null ? null
    : latestScore >= 80 ? { label: '우수', color: '#16a34a', bg: 'bg-green-100' }
    : latestScore >= 60 ? { label: '양호', color: '#2563eb', bg: 'bg-blue-100' }
    : latestScore >= 40 ? { label: '보통', color: '#d97706', bg: 'bg-yellow-100' }
    : { label: '개선 필요', color: '#dc2626', bg: 'bg-red-100' }

  return (
    <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="text-base font-medium text-gray-700">30일 AI 노출 추세</div>
          {latestScore != null && latestGrade && (
            <span
              className={`text-sm font-semibold px-2 py-0.5 rounded-full ${latestGrade.bg}`}
              style={{ color: latestGrade.color }}
            >
              현재 {latestGrade.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-px bg-blue-200 border-dashed border-t-2 border-blue-300" />
            일별 측정값
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-0.5 bg-blue-600 rounded" />
            7일 평균
          </span>
          {logsForChart.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-px h-4 border-l-2 border-dashed border-amber-400" />
              행동 기록
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        일별 측정값은 통계 변동이 있으므로 <strong className="text-gray-500">7일 평균선</strong>으로 실제 추세를 확인하세요.
        {logsForChart.length > 0 && (
          <span className="ml-1 text-amber-600">점선은 행동을 기록한 날짜입니다.</span>
        )}
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData}>
          {/* 점수 구간 배경 — 우수/양호/보통/개선 필요 */}
          <ReferenceArea y1={80} y2={100} fill="#f0fdf4" fillOpacity={0.6} ifOverflow="hidden" />
          <ReferenceArea y1={60} y2={80}  fill="#eff6ff" fillOpacity={0.6} ifOverflow="hidden" />
          <ReferenceArea y1={40} y2={60}  fill="#fefce8" fillOpacity={0.6} ifOverflow="hidden" />
          <ReferenceArea y1={0}  y2={40}  fill="#fef2f2" fillOpacity={0.6} ifOverflow="hidden" />
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            ticks={[0, 40, 60, 80, 100]}
            tick={(props: { x: string | number; y: string | number; payload?: { value: number } }) => {
              const x = typeof props.x === 'string' ? parseInt(props.x) : props.x
              const y = typeof props.y === 'string' ? parseInt(props.y) : props.y
              const v = props.payload?.value ?? 0
              const grade = v === 80 ? '우수' : v === 60 ? '양호' : v === 40 ? '보통' : ''
              if (!grade) return <g />
              return (
                <g>
                  <text x={x} y={y} dy={4} textAnchor="end" fontSize={10} fill="#94a3b8">{grade}</text>
                </g>
              )
            }}
          />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
            formatter={(val: unknown, name: unknown) => {
              if (val === null || val === undefined) return ['—', String(name)]
              const n = Number(val)
              const grade = n >= 80 ? '우수' : n >= 60 ? '양호' : n >= 40 ? '보통' : '개선 필요'
              const label = name === 'score' ? '일별 측정값' : '7일 평균'
              return [grade, label]
            }}
          />
          {/* 행동 기록 세로 점선 오버레이 */}
          {logsForChart.map((log, idx) => (
            <ReferenceLine
              key={`${log.action_date}-${idx}`}
              x={log.dateKey}
              stroke={log.color}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: deltaLabel(log),
                position: 'top',
                fontSize: 10,
                fill: log.color,
                offset: 6,
              }}
            />
          ))}
          {/* 일별 측정값 — 연한 점선, 배경 정보 */}
          <Line
            type="monotone"
            dataKey="score"
            stroke="#93c5fd"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            activeDot={{ r: 3, fill: '#93c5fd' }}
            connectNulls={false}
          />
          {/* 7일 이동평균 — 굵은 실선, 주 정보 */}
          <Line
            type="monotone"
            dataKey="ma7"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#2563eb' }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 행동 기록 범례 목록 */}
      {logsForChart.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {logsForChart.map((log, idx) => (
            <div
              key={`legend-${idx}`}
              className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-full border"
              style={{ borderColor: log.color, color: log.color, backgroundColor: `${log.color}10` }}
            >
              <span
                className="inline-block w-px h-3 border-l-2 border-dashed"
                style={{ borderColor: log.color }}
              />
              <span>{log.action_date.slice(5)} {deltaLabel(log)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
