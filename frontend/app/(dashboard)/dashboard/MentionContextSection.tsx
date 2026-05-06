'use client'

import { useState, useEffect } from 'react'
import { Lock, MessageSquare } from 'lucide-react'
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
  token?: string
  currentPlan?: string
  isPro?: boolean
}

export function MentionContextSection({ bizId, token, currentPlan, isPro = false }: Props) {
  const [citations, setCitations] = useState<MentionContext[]>([])
  const [summary, setSummary] = useState<MentionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bizId || !isPro) {
      setLoading(false)
      return
    }
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    fetch(`${BACKEND}/api/report/mention-context/${bizId}`, {
      headers,
    })
      .then((res) => {
        if (!res.ok) throw new Error('fetch error')
        return res.json()
      })
      .then((data) => {
        setCitations(data.platforms ?? [])
        setSummary(data.summary ?? null)
      })
      .catch((e) => {
        console.warn('[MentionContext]', e)
      })
      .finally(() => setLoading(false))
  }, [bizId, isPro])

  // Pro가 아니면 잠금 티저 카드 표시
  if (!isPro) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-bold text-gray-700">AI 언급 맥락 분석</h2>
          <span className="ml-auto text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Pro</span>
        </div>
        {/* 샘플 미리보기 — 흐릿하게 */}
        <div className="relative">
          <div className="blur-sm pointer-events-none select-none space-y-2">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-emerald-800">긍정 언급 · Gemini</div>
                <div className="text-sm text-emerald-700 mt-0.5 line-clamp-1">"강남역 근처에서 분위기 좋고 서비스 친절한 카페를 추천해줘" 쿼리에서 언급됨</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-red-800">미언급 · ChatGPT</div>
                <div className="text-sm text-red-700 mt-0.5 line-clamp-1">"주차 가능한 카페 추천" 쿼리에서 경쟁사만 언급됨</div>
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 rounded-xl">
            <Lock className="w-6 h-6 text-gray-400 mb-2" />
            <p className="text-sm font-semibold text-gray-700 text-center px-4">AI가 내 가게를 어떤 질문에서 언급하는지,<br/>어떤 질문에서 빠지는지 확인합니다.</p>
            <a href="/pricing" className="mt-3 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-1.5 rounded-full transition-colors">Pro로 업그레이드 →</a>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return null

  if (citations.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-bold text-gray-700">AI 언급 맥락 분석</h2>
        </div>
        <p className="text-sm text-gray-500">
          스캔 결과에서 AI 언급 데이터를 불러오지 못했습니다. 스캔을 다시 실행해 주세요.
        </p>
      </div>
    )
  }

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
