'use client'

import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react'

interface ScorePoint {
  score_date: string
  total_score: number
  context?: string
}

interface Props {
  history: ScorePoint[]
  businessName: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatFullDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function BriefingTimeline({ history, businessName }: Props) {
  if (!history || history.length < 2) return null

  // 최근 8개만 표시
  const points = [...history].sort((a, b) => a.score_date.localeCompare(b.score_date)).slice(-8)
  const latest = points[points.length - 1]
  const first = points[0]
  const totalChange = Math.round((latest.total_score - first.total_score) * 10) / 10
  const maxScore = Math.max(...points.map((p) => p.total_score))
  const minScore = Math.min(...points.map((p) => p.total_score))
  const range = maxScore - minScore || 1

  // 처음으로 A등급(≥80) 달성한 날
  const firstAGrade = points.find((p) => p.total_score >= 80)
  // 최고점 달성일
  const peakPoint = points.find((p) => p.total_score === maxScore)

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-gray-900 mb-0.5">AI 브리핑 노출 성장 타임라인</div>
          <p className="text-sm text-gray-400">
            {formatFullDate(first.score_date)} ~ {formatFullDate(latest.score_date)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {totalChange > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : totalChange < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-500" />
          ) : (
            <Minus className="w-4 h-4 text-gray-400" />
          )}
          <span
            className={`text-sm font-bold ${
              totalChange > 0 ? 'text-green-600' : totalChange < 0 ? 'text-red-500' : 'text-gray-400'
            }`}
          >
            {totalChange > 0 ? '+' : ''}{totalChange}점
          </span>
          <span className="text-sm text-gray-400 ml-1">전체 변화</span>
        </div>
      </div>

      {/* 미니 바 차트 */}
      <div className="flex items-end gap-1.5 h-20 mb-3">
        {points.map((p, idx) => {
          const heightPct = range > 0 ? ((p.total_score - minScore) / range) * 80 + 20 : 50
          const isPeak = p.total_score === maxScore
          const isLatest = idx === points.length - 1
          const prev = points[idx - 1]
          const change = prev ? p.total_score - prev.total_score : 0
          const barColor = isPeak
            ? 'bg-amber-400'
            : isLatest
            ? 'bg-blue-500'
            : change > 0
            ? 'bg-green-400'
            : change < 0
            ? 'bg-red-400'
            : 'bg-gray-300'

          return (
            <div key={p.score_date} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* 툴팁 */}
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10">
                <div className="bg-gray-800 text-white text-sm rounded px-2 py-1 whitespace-nowrap">
                  {formatFullDate(p.score_date)}: {p.total_score.toFixed(1)}점
                  {isPeak && ' ★최고'}
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
              </div>

              {isPeak && <Star className="w-3 h-3 text-amber-500" />}
              <div
                className={`w-full rounded-t-sm ${barColor} transition-all`}
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-sm text-gray-400 leading-none">{formatDate(p.score_date)}</span>
            </div>
          )
        })}
      </div>

      {/* 마일스톤 */}
      <div className="space-y-1.5">
        {peakPoint && (
          <div className="flex items-center gap-2 text-sm">
            <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-gray-500">
              최고점 <span className="font-medium text-amber-700">{peakPoint.total_score.toFixed(1)}점</span> 달성
              <span className="text-gray-400 ml-1">({formatFullDate(peakPoint.score_date)})</span>
            </span>
          </div>
        )}
        {firstAGrade && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <span className="text-white font-bold leading-none" style={{ fontSize: 8 }}>A</span>
            </div>
            <span className="text-gray-500">
              A등급 첫 달성
              <span className="text-gray-400 ml-1">({formatFullDate(firstAGrade.score_date)})</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <span className="text-white font-bold leading-none" style={{ fontSize: 8 }}>→</span>
          </div>
          <span className="text-gray-500">
            현재 <span className="font-medium text-blue-700">{latest.total_score.toFixed(1)}점</span>
            <span className="text-gray-400 ml-1">({formatFullDate(latest.score_date)})</span>
          </span>
        </div>
      </div>
    </div>
  )
}
