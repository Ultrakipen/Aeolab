'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

const LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

interface TrendPoint {
  period: string
  ratio: number
}

interface KeywordTrend {
  keyword: string
  trend: TrendPoint[]
  monthly_volume: number | null
}

interface TrendResponse {
  keywords: KeywordTrend[]
  category: string
  region: string
}

interface Props {
  bizId: string
  accessToken: string
  categoryKo?: string
}

function SkeletonBar() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  )
}

export default function KeywordTrendChart({ bizId, accessToken, categoryKo }: Props) {
  const [data, setData] = useState<TrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchTrend = async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`${BACKEND}/api/report/keyword-trend/${bizId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) throw new Error('fetch failed')
        const json = await res.json() as TrendResponse
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTrend()
    return () => { cancelled = true }
  }, [bizId, accessToken])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
        <SkeletonBar />
      </div>
    )
  }

  if (error || !data || !data.keywords || data.keywords.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <h3 className="text-base font-bold text-gray-700">키워드 트렌드</h3>
        </div>
        <p className="text-sm text-gray-400">트렌드 데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  const topKeywords = data.keywords

  // Recharts용 데이터 변환: period 기준으로 합칩니다
  const allPeriods = Array.from(
    new Set(topKeywords.flatMap((k) => k.trend.map((t) => t.period)))
  ).sort()

  const chartData = allPeriods.map((period) => {
    const row: Record<string, string | number> = { period }
    topKeywords.forEach((k) => {
      const pt = k.trend.find((t) => t.period === period)
      row[k.keyword] = pt ? Math.round(pt.ratio) : 0
    })
    return row
  })

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500 shrink-0" />
          <h3 className="text-base font-bold text-gray-900">키워드 검색 트렌드</h3>
          <span className="text-sm text-gray-400">네이버 검색 관심도 · 3개월</span>
        </div>
        {/* 키워드 배지 행 */}
        <div className="flex flex-wrap gap-2">
          {topKeywords.map((k, i) => (
            <span
              key={k.keyword}
              className="inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${LINE_COLORS[i]}15`, color: LINE_COLORS[i] }}
            >
              {k.keyword}
              {k.monthly_volume !== null && k.monthly_volume > 0 && (
                <span className="text-xs opacity-80">
                  · 월{' '}
                  {k.monthly_volume >= 10000
                    ? `${Math.round(k.monthly_volume / 1000)}k`
                    : k.monthly_volume.toLocaleString()}
                  회
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value) => [`${value} (관심도 지수)`]}
            labelFormatter={(label) => `기간: ${label}`}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => (
              <span style={{ color: '#374151' }}>{value}</span>
            )}
          />
          {topKeywords.map((k, i) => (
            <Line
              key={k.keyword}
              type="monotone"
              dataKey={k.keyword}
              stroke={LINE_COLORS[i]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <p className="text-sm text-gray-400 mt-3 text-center">
        {data.region} · {categoryKo ?? data.category} 업종 · 네이버 검색 관심도 지수 (0~100, 100=최고점)
      </p>
    </div>
  )
}
