'use client'

import { useState, useEffect } from 'react'
import { MentionContextCard } from '@/components/dashboard/MentionContextCard'
import { MentionContext } from '@/types'

interface MentionSummary {
  positive_count: number
  negative_count: number
  neutral_count: number
  total: number
}

interface Props {
  bizId: string
  token: string
}

export function MentionContextSection({ bizId }: Props) {
  const [citations, setCitations] = useState<MentionContext[]>([])
  const [summary, setSummary] = useState<MentionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bizId) return
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

    // 쿠키 기반 인증 사용 (서버 컴포넌트에서 token 불필요)
    fetch(`${BACKEND}/api/report/mention-context/${bizId}`, {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('fetch error')
        return res.json()
      })
      .then((data) => {
        setCitations(data.platforms ?? [])
        setSummary(data.summary ?? null)
      })
      .catch(() => {
        // 데이터 없으면 숨김
      })
      .finally(() => setLoading(false))
  }, [bizId])

  if (loading || citations.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-base md:text-lg font-bold text-gray-900">AI 언급 맥락 분석</h2>
        {summary && (
          <div className="flex gap-3 text-sm">
            <span className="text-green-700 font-medium">긍정 {summary.positive_count}</span>
            <span className="text-gray-500">중립 {summary.neutral_count}</span>
            <span className="text-red-600 font-medium">부정 {summary.negative_count}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {citations.slice(0, 6).map((c, i) => (
          <MentionContextCard key={i} citation={c} />
        ))}
      </div>
    </div>
  )
}
