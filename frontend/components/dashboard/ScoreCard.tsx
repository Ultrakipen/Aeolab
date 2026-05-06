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

const GRADE_BG: Record<string, string> = {
  A: 'bg-green-50 border-green-200 text-green-800',
  B: 'bg-blue-50 border-blue-200 text-blue-800',
  C: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  D: 'bg-orange-50 border-orange-200 text-orange-800',
  F: 'bg-red-50 border-red-200 text-red-800',
}

const GRADE_INFO: Record<string, { range: string; description: string; percentile: string; action: string }> = {
  A: { range: '80점 이상', description: 'AI 검색 최상위 노출', percentile: '상위 20%', action: '현 상태 유지 + 리뷰 꾸준히' },
  B: { range: '60~79점', description: 'AI 검색 양호', percentile: '상위 40%', action: '키워드 커버리지 집중 개선' },
  C: { range: '40~59점', description: 'AI 검색 개선 필요', percentile: '중간 40%', action: '스마트플레이스 소개글 + 소식 작성' },
  D: { range: '40점 미만', description: 'AI 검색 미흡', percentile: '하위 20%', action: '스마트플레이스 기본 정보 완성 우선' },
  F: { range: '20점 미만', description: 'AI 검색 거의 불가', percentile: '최하위', action: '스마트플레이스 신청부터 시작' },
}

export function ScoreCard({ score, grade, exposureFreq, prevScore, scannedAt }: ScoreCardProps) {
  const change = prevScore !== undefined ? score - prevScore : null
  const [showGradeDetail, setShowGradeDetail] = useState(false)
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

      {/* 등급 — 클릭하면 상세 펼침 (hover 대신: 모바일 호환) */}
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setShowGradeDetail(v => !v)}
        aria-expanded={showGradeDetail}
        aria-label={`${grade}등급 상세 보기`}
      >
        <span className={`text-3xl font-bold ${GRADE_COLOR[grade] ?? 'text-gray-900'}`}>{grade}</span>
        <span className="text-sm text-gray-400">등급</span>
        {gradeInfo && (
          <span className="text-xs text-gray-400 ml-auto">{showGradeDetail ? '▲' : '▼'} {gradeInfo.percentile}</span>
        )}
      </button>

      {/* 등급 상세 — 클릭 시 펼침 */}
      {showGradeDetail && gradeInfo && (
        <div className={`mt-2 border rounded-xl px-3 py-2.5 text-sm space-y-1 ${GRADE_BG[grade] ?? 'bg-gray-50 border-gray-200 text-gray-800'}`}>
          <p className="font-semibold">{gradeInfo.range} · {gradeInfo.description}</p>
          <p className="opacity-80">지금 할 것: {gradeInfo.action}</p>
        </div>
      )}

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
        <div className="text-sm text-gray-400 mt-3">
          마지막 스캔: {new Date(scannedAt).toLocaleDateString('ko-KR')}
        </div>
      )}
    </div>
  )
}
