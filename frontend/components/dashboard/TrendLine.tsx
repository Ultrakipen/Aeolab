'use client'

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface TrendPoint {
  score_date: string
  total_score: number
  exposure_freq: number
}

interface TrendLineProps {
  data: TrendPoint[]
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

export function TrendLine({ data }: TrendLineProps) {
  const sorted = [...data].reverse().slice(-30)

  const raw = sorted.map((d) => Math.round(d.total_score))
  const ma7 = movingAvg(raw)

  const chartData = sorted.map((d, i) => ({
    date: d.score_date.slice(5),   // "MM-DD"
    score: raw[i],
    ma7: ma7[i],
  }))

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-center h-48">
        <p className="text-gray-400 text-base">30일 추세 데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="text-base font-medium text-gray-700">30일 점수 추세</div>
        <div className="flex items-center gap-3 text-base text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-px bg-blue-200 border-dashed border-t-2 border-blue-300" />
            일별 점수
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-0.5 bg-blue-600 rounded" />
            7일 평균
          </span>
        </div>
      </div>
      <p className="text-base text-gray-400 mb-4">
        일별 점수는 통계 변동이 있으므로 <strong className="text-gray-500">7일 평균선</strong>으로 실제 추세를 확인하세요.
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
            formatter={(val: unknown, name: unknown) => {
              if (val === null || val === undefined) return ['—', String(name)]
              const label = name === 'score' ? '일별 점수' : '7일 평균'
              return [`${val}점`, label]
            }}
          />
          {/* 일별 점수 — 연한 점선, 배경 정보 */}
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
    </div>
  )
}
