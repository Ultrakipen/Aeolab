'use client'

import { useState, useEffect } from 'react'
import { Sparkles, MessageSquareQuote } from 'lucide-react'
import { PlanGate } from '@/components/common/PlanGate'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Citation {
  platform: string
  platform_label: string
  query: string
  excerpt: string
  mentioned: boolean
  sentiment: string
  mention_type?: string
}

interface AICitationResponse {
  citations: Citation[]
  total: number
  has_data: boolean
}

interface Props {
  businessId: string
  authToken: string | null
  currentPlan: string
  isInactive?: boolean
}

const PLATFORM_COLOR: Record<string, string> = {
  gemini: 'bg-blue-100 text-blue-700',
  chatgpt: 'bg-green-100 text-green-700',
  naver: 'bg-green-100 text-green-700',
  google: 'bg-blue-100 text-blue-700',
}

const SENTIMENT_CONFIG: Record<string, { label: string; color: string }> = {
  positive: { label: '긍정', color: 'bg-green-100 text-green-700' },
  negative: { label: '부정', color: 'bg-red-100 text-red-700' },
  neutral: { label: '중립', color: 'bg-gray-100 text-gray-600' },
}

function AICitationContent({ businessId, authToken, isInactive }: { businessId: string; authToken: string | null; isInactive?: boolean }) {
  const [data, setData] = useState<AICitationResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${BACKEND}/api/report/ai-citations/${businessId}?limit=5`, {
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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 md:p-5 animate-pulse">
        <div className="h-4 bg-blue-100 rounded w-1/3 mb-3" />
        <div className="h-3 bg-blue-100 rounded w-2/3 mb-2" />
        <div className="h-3 bg-blue-100 rounded w-1/2" />
      </div>
    )
  }

  if (!data) return null

  const rawCitations = data.citations ?? []
  // INACTIVE 업종은 "미언급" naver 항목만 숨김 — mentioned=true는 정보형 AI 브리핑
  // 실측 인용일 수 있어(업종 무관 노출 가능) 절대 숨기지 않는다.
  const allCitations = isInactive ? rawCitations.filter((c) => c.platform !== 'naver' || c.mentioned) : rawCitations
  const mentionedCitations = allCitations.filter((c) => c.mentioned).slice(0, 3)
  const totalMentioned = allCitations.filter((c) => c.mentioned).length
  const totalNotMentioned = allCitations.filter((c) => !c.mentioned && c.mention_type !== 'synthetic').length

  const title = isInactive
    ? 'ChatGPT·Gemini가 내 가게를 이렇게 말했습니다'
    : 'AI가 내 가게를 이렇게 말했습니다'

  const emptyMessage = isInactive
    ? 'ChatGPT·Gemini에 아직 언급되지 않았습니다. 가이드를 실행하면 노출 가능성이 높아집니다.'
    : '아직 AI에 언급되지 않았습니다.\n가이드를 실행하고 재스캔하면 언급 가능성이 높아집니다.'

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-900">{title}</span>
          </div>
          {isInactive && (
            <span className="text-sm text-gray-600 pl-6">플레이스형 AI 브리핑 비대상 업종 · 정보형 AI 브리핑·ChatGPT·Gemini·Google 기준</span>
          )}
        </div>
        {totalMentioned > 0 && (
          <span className="text-sm bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium">
            언급 {totalMentioned}회
          </span>
        )}
      </div>

      {totalMentioned === 0 ? (
        <div className="bg-white/70 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mentionedCitations.map((c, i) => {
            const sentimentConf = SENTIMENT_CONFIG[c.sentiment] ?? SENTIMENT_CONFIG.neutral
            const platformColor = PLATFORM_COLOR[c.platform] ?? 'bg-gray-100 text-gray-600'
            return (
              <div key={i} className="bg-white/80 rounded-xl p-3.5">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${platformColor}`}>
                    {c.platform_label || c.platform}
                  </span>
                  <span className="text-sm text-gray-600 truncate max-w-[200px]">"{c.query}"</span>
                </div>
                {c.excerpt && (
                  <div className="border-l-4 border-blue-400 pl-3 py-1 bg-blue-50/60 rounded-r-lg">
                    <div className="flex items-start gap-1.5">
                      <MessageSquareQuote className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{c.excerpt}</p>
                    </div>
                  </div>
                )}
                <div className="mt-2">
                  <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${sentimentConf.color}`}>
                    {sentimentConf.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalNotMentioned > 0 && (
        <div className="mt-3 bg-white/60 rounded-xl p-3 flex items-center gap-2">
          <span className="text-sm text-gray-600">
            아직 {totalNotMentioned}개 플랫폼에 미노출
          </span>
          <span className="text-sm font-medium text-indigo-600">→ 재스캔으로 확인</span>
        </div>
      )}
    </div>
  )
}

export function AICitationHighlight({ businessId, authToken, currentPlan, isInactive }: Props) {
  const plan = currentPlan ?? 'free'
  if (plan === 'free') {
    return (
      <PlanGate feature="AI 인용 현황" requiredPlan="basic" currentPlan={currentPlan}>
        <AICitationContent businessId={businessId} authToken={authToken} isInactive={isInactive} />
      </PlanGate>
    )
  }
  return <AICitationContent businessId={businessId} authToken={authToken} isInactive={isInactive} />
}
