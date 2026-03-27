'use client'

import { useState } from 'react'

interface ScoreCardProps {
  score: number
  grade: string
  exposureFreq: number
  prevScore?: number
  scannedAt?: string
}

const GRADE_COLOR: Record<string, string> = {
  A: 'text-green-500',
  B: 'text-blue-500',
  C: 'text-yellow-500',
  D: 'text-orange-500',
  F: 'text-red-500',
}

const GRADE_INFO: Record<string, { range: string; description: string; percentile: string }> = {
  A: { range: '80점 이상', description: 'AI 검색 최상위 노출', percentile: '상위 20%' },
  B: { range: '60~79점', description: 'AI 검색 양호', percentile: '상위 40%' },
  C: { range: '40~59점', description: 'AI 검색 개선 필요', percentile: '중간 40%' },
  D: { range: '40점 미만', description: 'AI 검색 미흡', percentile: '하위 20%' },
  F: { range: '20점 미만', description: 'AI 검색 거의 불가', percentile: '최하위' },
}

export function ScoreCard({ score, grade, exposureFreq, prevScore, scannedAt }: ScoreCardProps) {
  const change = prevScore !== undefined ? score - prevScore : null
  const [showTooltip, setShowTooltip] = useState(false)
  const gradeInfo = GRADE_INFO[grade]

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="text-sm text-gray-500 mb-1">AI Visibility Score</div>
      <div className="flex items-end gap-3 mb-2">
        <div className={`text-5xl font-bold ${GRADE_COLOR[grade] ?? 'text-gray-900'}`}>
          {score}
        </div>
        <div className="text-2xl font-bold text-gray-400 mb-1">/ 100</div>
        {change !== null && (
          <div className={`text-sm font-medium mb-2 ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {change >= 0 ? `+${change.toFixed(1)}` : change.toFixed(1)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 relative">
        <button
          className={`text-3xl font-bold ${GRADE_COLOR[grade] ?? 'text-gray-900'} cursor-help`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label={`${grade}등급 설명`}
        >
          {grade}
        </button>
        <span className="text-sm text-gray-400">등급</span>
        {showTooltip && gradeInfo && (
          <div className="absolute left-0 top-8 z-10 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg w-44">
            <p className="font-semibold">{gradeInfo.range}</p>
            <p className="text-gray-300 mt-0.5">{gradeInfo.description}</p>
            <p className="text-gray-400 mt-0.5">{gradeInfo.percentile} 수준</p>
          </div>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="text-sm text-gray-500 mb-1">AI 노출 빈도</div>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-semibold text-gray-900">{exposureFreq}</div>
          <div className="text-sm text-gray-400">/ 100회</div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, exposureFreq)}%` }}
          />
        </div>
      </div>
      {scannedAt && (
        <div className="text-xs text-gray-400 mt-3">
          마지막 스캔: {new Date(scannedAt).toLocaleDateString('ko-KR')}
        </div>
      )}
    </div>
  )
}
