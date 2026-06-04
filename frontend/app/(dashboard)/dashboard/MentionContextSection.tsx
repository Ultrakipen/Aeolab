'use client'

import { useState, useEffect } from 'react'
import { Lock, MessageSquare, CheckCircle, XCircle, MinusCircle, AlertCircle } from 'lucide-react'
import { MentionContextCard } from '@/components/dashboard/MentionContextCard'
import { MentionContext } from '@/types'

interface MentionSummary {
  positive_count: number
  negative_count: number
  neutral_count: number
  not_mentioned_count: number
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
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
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

  // 카드 정렬: 언급된 것 먼저 (positive→neutral→negative), 미언급 마지막
  const sentimentOrder: Record<string, number> = { positive: 0, neutral: 1, negative: 2 }
  const sortedCitations = [...citations].sort((a, b) => {
    if (a.mentioned === b.mentioned) {
      return (sentimentOrder[a.sentiment] ?? 1) - (sentimentOrder[b.sentiment] ?? 1)
    }
    return a.mentioned === false ? 1 : -1
  })

  const allNotMentioned = citations.length > 0 && citations.every(c => c.mentioned === false)

  // 총 언급 건수 (positive + neutral + negative)
  const mentionedCount = summary
    ? (summary.positive_count ?? 0) + (summary.neutral_count ?? 0) + (summary.negative_count ?? 0)
    : citations.filter(c => c.mentioned !== false).length

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-500" />
          <h2 className="text-base md:text-lg font-bold text-gray-900">AI 언급 맥락 분석</h2>
        </div>
        {mentionedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-semibold">
            <CheckCircle className="w-4 h-4" />
            AI에 {mentionedCount}건 언급
          </span>
        )}
      </div>

      {/* 요약 바 — 컬러 pill 뱃지 */}
      {summary && (
        <div className="flex flex-wrap gap-2 mb-4">
          {summary.positive_count > 0 && (
            <span className="inline-flex items-center gap-1 text-sm bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              긍정 {summary.positive_count}
            </span>
          )}
          {summary.neutral_count > 0 && (
            <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
              <MinusCircle className="w-3.5 h-3.5" />
              중립 {summary.neutral_count}
            </span>
          )}
          {summary.negative_count > 0 && (
            <span className="inline-flex items-center gap-1 text-sm bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              부정 {summary.negative_count}
            </span>
          )}
          {(summary.not_mentioned_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
              <XCircle className="w-3.5 h-3.5" />
              미언급 {summary.not_mentioned_count}
            </span>
          )}
        </div>
      )}

      {/* 전체 미언급 안내 박스 */}
      {allNotMentioned && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-sm text-blue-800 leading-relaxed">
          <span className="font-semibold">미언급은 오류가 아닙니다.</span>{' '}
          ChatGPT·Gemini 같은 글로벌 AI는 온라인에 콘텐츠가 충분히 쌓인 사업장부터 인식합니다.
          처음 스캔에서는 전체 미언급이 정상 결과이며, 블로그 리뷰·구글 비즈니스 프로필 보강 후 수개월 내 개선됩니다.
          <span className="text-blue-500 text-xs block mt-1">※ ChatGPT·Gemini 측정은 AI 학습 데이터 기반이며 실시간 검색 결과와 다를 수 있습니다.</span>
        </div>
      )}

      {/* 카드 그리드 — 언급된 항목 전체 + 미언급 최대 4개 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(() => {
          const mentionedCards = sortedCitations.filter(c => c.mentioned !== false)
          const notMentionedCards = sortedCitations.filter(c => c.mentioned === false)
          const displayCards = [...mentionedCards, ...notMentionedCards.slice(0, Math.max(2, 6 - mentionedCards.length))]
          return displayCards.map((c, i) => <MentionContextCard key={i} citation={c} />)
        })()}
      </div>
    </div>
  )
}
