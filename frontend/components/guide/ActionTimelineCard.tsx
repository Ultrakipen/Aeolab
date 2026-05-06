'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { PlanGate } from '@/components/common/PlanGate'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface TimelinePoint {
  date: string
  score: number | null
  track1: number | null
  track2: number | null
}

interface ActionWindow {
  action_type: string
  action_label: string
  action_date: string
  score_before: number | null
  score_after: number | null
  timeline: TimelinePoint[]
}

interface ActionTimelineResponse {
  business_name: string
  action_count: number
  windows: ActionWindow[]
  history: Array<{ date: string; score: number | null }>
}

interface Props {
  businessId: string
  authToken: string | null
  currentPlan: string
}

function DeltaBadge({ before, after }: { before: number | null; after: number | null }) {
  if (before === null || after === null) {
    return <span className="text-sm text-gray-400">측정 중</span>
  }
  const delta = after - before
  if (Math.abs(delta) < 0.1) {
    return (
      <span className="flex items-center gap-0.5 text-sm text-gray-500 font-medium">
        <Minus className="w-3.5 h-3.5" />
        변화 없음
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span className="flex items-center gap-0.5 text-sm text-green-600 font-semibold">
        <TrendingUp className="w-3.5 h-3.5" />
        +{delta.toFixed(1)}점
      </span>
    )
  }
  return (
    <span className="flex items-center gap-0.5 text-sm text-red-500 font-semibold">
      <TrendingDown className="w-3.5 h-3.5" />
      {delta.toFixed(1)}점
    </span>
  )
}

function MiniChart({ data }: { data: TimelinePoint[] }) {
  if (data.length < 2) return null
  const chartData = data
    .filter((d) => d.score !== null)
    .map((d) => ({ date: d.date.slice(5), score: d.score }))
  if (chartData.length < 2) return null
  return (
    <div className="mt-2 h-[60px] w-full">
      <ResponsiveContainer width="100%" height={60}>
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, padding: '2px 8px' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ActionTimelineContent({ businessId, authToken }: { businessId: string; authToken: string | null }) {
  const [data, setData] = useState<ActionTimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${BACKEND}/api/report/action-timeline/${businessId}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        })
        if (!res.ok) {
          setData(null)
          return
        }
        const json = await res.json()
        setData(json)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    void fetchData()
  }, [businessId, authToken])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    )
  }

  if (!data) return null

  const recentWindows = [...(data.windows ?? [])].slice(0, 3)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">행동 → 점수 변화</span>
        </div>
        {data.action_count > 0 && (
          <span className="text-sm bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
            총 {data.action_count}개 행동
          </span>
        )}
      </div>

      {recentWindows.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 leading-relaxed">
            아직 기록된 행동이 없습니다.<br />
            가이드를 실행하면 7일 후 점수 변화가 자동 기록됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentWindows.map((w, i) => (
            <div
              key={i}
              className="border border-gray-100 rounded-xl p-3.5 bg-gray-50"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{w.action_label}</p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {new Date(w.action_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {w.score_before !== null && (
                    <span className="text-sm text-gray-500">{w.score_before.toFixed(1)}점</span>
                  )}
                  {w.score_before !== null && (
                    <span className="text-sm text-gray-400">→</span>
                  )}
                  {w.score_after !== null && (
                    <span className="text-sm font-semibold text-gray-700">{w.score_after.toFixed(1)}점</span>
                  )}
                  <DeltaBadge before={w.score_before} after={w.score_after} />
                </div>
              </div>
              {(w.timeline ?? []).length >= 2 && <MiniChart data={w.timeline} />}
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-400 mt-3 text-center">
        더 많은 행동 기록은 대시보드에서 확인하세요
      </p>
    </div>
  )
}

export function ActionTimelineCard({ businessId, authToken, currentPlan }: Props) {
  const plan = currentPlan ?? 'free'
  if (plan === 'free') {
    return (
      <PlanGate feature="행동·점수 타임라인" requiredPlan="basic" currentPlan={currentPlan}>
        <ActionTimelineContent businessId={businessId} authToken={authToken} />
      </PlanGate>
    )
  }
  return <ActionTimelineContent businessId={businessId} authToken={authToken} />
}
