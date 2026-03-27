'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TrendPoint {
  score_date: string
  total_score: number
  exposure_freq: number
}

interface TrendLineProps {
  data: TrendPoint[]
}

export function TrendLine({ data }: TrendLineProps) {
  const chartData = [...data]
    .reverse()
    .slice(-30)
    .map((d) => ({
      date: d.score_date.slice(5),  // "MM-DD"
      score: Math.round(d.total_score),
      freq: d.exposure_freq,
    }))

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-center h-48">
        <p className="text-gray-400 text-sm">30일 추세 데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="text-sm font-medium text-gray-700 mb-4">30일 점수 추세</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
            formatter={(val) => [`${val ?? 0}점`, 'AI Visibility Score']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
