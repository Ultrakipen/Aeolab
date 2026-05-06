'use client'

import { useState, useEffect } from 'react'
import { MessageSquareQuote, ChevronDown, ChevronUp, Search } from 'lucide-react'
import Link from 'next/link'

const PLATFORM_COLORS: Record<string, string> = {
  gemini:  'bg-blue-100 text-blue-700',
  naver:   'bg-green-100 text-green-700',
  chatgpt: 'bg-emerald-100 text-emerald-700',
  claude:  'bg-orange-100 text-orange-700',
  google:  'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-700',
}

const SENTIMENT_BADGE: Record<string, { label: string; cls: string }> = {
  positive: { label: '긍정', cls: 'bg-emerald-50 text-emerald-600' },
  negative: { label: '부정', cls: 'bg-red-50 text-red-600' },
  neutral:  { label: '중립', cls: 'bg-gray-50 text-gray-500' },
}

interface Citation {
  platform: string
  platform_label: string
  query: string
  excerpt: string
  sentiment?: string
}

interface Props {
  bizId: string
  token: string
}

export default function AICitationCard({ bizId, token }: Props) {
  const [citations, setCitations] = useState<Citation[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    fetch(`${BACKEND}/api/report/ai-citations/${bizId}?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.citations?.length > 0) setCitations(data.citations)
      })
      .catch((e) => console.warn('[AICitation]', e))
      .finally(() => setLoading(false))
  }, [bizId, token])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const mentionedCount = citations.filter(c => c.excerpt && c.excerpt.length > 0).length

  if (citations.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquareQuote className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-bold text-gray-900">AI 검색 언급 분석</h3>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          아직 AI 인용 데이터가 없습니다. 스캔을 완료하면 자동으로 분석됩니다.
        </p>
        {/* 행동 유도 */}
        <div className="mt-4 bg-amber-50 rounded-lg p-3">
          <p className="text-sm font-semibold text-amber-800">AI가 아직 내 가게를 언급하지 않고 있습니다</p>
          <p className="text-sm text-amber-700 mt-1">소개글 Q&A 추가와 키워드 보강이 가장 효과적입니다.</p>
          <Link href="/guide" className="mt-2 inline-flex items-center text-sm font-semibold text-amber-800 hover:underline">
            지금 소개글 편집하러 가기 →
          </Link>
        </div>
      </div>
    )
  }

  const INITIAL_VISIBLE = 10
  const visible = expanded ? citations : citations.slice(0, INITIAL_VISIBLE)

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquareQuote className="w-5 h-5 text-blue-500" />
        <div>
          <h3 className="text-base font-bold text-gray-900">AI 검색 언급 분석</h3>
          <p className="text-sm text-gray-500">네이버 AI 브리핑 실제 문장 · Gemini/ChatGPT 추천 시뮬레이션</p>
        </div>
      </div>

      <div className="space-y-3">
        {visible.map((c, i) => {
          const colorCls = PLATFORM_COLORS[c.platform] ?? PLATFORM_COLORS.default
          const sent = c.sentiment ? SENTIMENT_BADGE[c.sentiment] : null
          return (
            <div key={i} className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${colorCls}`}>
                  {c.platform_label || c.platform}
                </span>
                {sent && (
                  <span className={`text-sm px-2 py-0.5 rounded-full ${sent.cls}`}>
                    {sent.label}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
                  <Search className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-400 font-medium">검색어</span>
                  <span className="text-xs font-semibold text-slate-700">&ldquo;{c.query}&rdquo;</span>
                </span>
              </div>
              {c.excerpt && c.excerpt.length > 0 && !c.excerpt.includes('(구체적 인용문 없음)') ? (
                c.platform === 'naver' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-amber-700 font-semibold mb-1">네이버 브리핑에서 발견된 실제 문장</p>
                    <p className="text-sm text-gray-800 leading-relaxed italic">
                      &ldquo;{c.excerpt}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-blue-600 font-semibold mb-1">
                      {c.platform === 'gemini' ? 'Gemini가 추천 시 사용할 표현 (50회 샘플 기반)' : 'ChatGPT가 추천 시 사용할 표현 (50회 샘플 기반)'}
                    </p>
                    <p className="text-sm text-gray-800 leading-relaxed italic">
                      &ldquo;{c.excerpt}&rdquo;
                    </p>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-400 italic">
                  이번 스캔에서 인용 문장이 감지되지 않았습니다.
                </p>
              )}
              {/* 부정 sentiment 인용에 개선 링크 */}
              {c.sentiment === 'negative' && (
                <Link href="/guide" className="text-xs text-red-600 hover:underline mt-1 block">
                  이 부분 개선 방법 →
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {citations.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-800 py-1"
        >
          {expanded ? (
            <><ChevronUp className="w-4 h-4" />접기</>
          ) : (
            <><ChevronDown className="w-4 h-4" />더 보기 ({citations.length - INITIAL_VISIBLE}개 더)</>
          )}
        </button>
      )}

      {/* 인용 후 행동 유도 */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        {mentionedCount === 0 ? (
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-sm font-semibold text-amber-800">AI가 아직 내 가게를 언급하지 않고 있습니다</p>
            <p className="text-xs text-amber-700 mt-1">소개글 Q&A 추가와 키워드 보강이 가장 효과적입니다.</p>
            <Link href="/guide" className="mt-2 inline-flex items-center text-xs font-semibold text-amber-800 hover:underline">
              지금 소개글 편집하러 가기 →
            </Link>
          </div>
        ) : (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-800">AI가 내 가게를 언급하고 있습니다</p>
            <p className="text-sm text-blue-700 mt-1">언급된 키워드를 FAQ와 소개글에 더 자주 넣으면 노출 빈도가 높아집니다.</p>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-3 leading-relaxed">
        ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
        측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
      </p>
    </div>
  )
}
