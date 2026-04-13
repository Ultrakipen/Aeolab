'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Send, Copy, Check, Trash2, ThumbsUp, ThumbsDown, Minus, Star, Clock } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface ReviewReply {
  id: string
  review_text: string
  reply_draft: string
  sentiment: 'positive' | 'negative' | 'neutral'
  created_at: string
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === 'positive') return (
    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
      <ThumbsUp className="w-3 h-3" /> 긍정
    </span>
  )
  if (sentiment === 'negative') return (
    <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
      <ThumbsDown className="w-3 h-3" /> 부정
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
      <Minus className="w-3 h-3" /> 일반
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
      }}
      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? '복사됨' : '복사'}
    </button>
  )
}

export default function ReviewInboxPage() {
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [plan, setPlan] = useState<string>('free')
  const [reviewText, setReviewText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ reply_draft: string; sentiment: string; used: number; limit: number } | null>(null)
  const [history, setHistory] = useState<ReviewReply[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setToken(session.access_token)

      const { data: businesses } = await supabase
        .from('businesses').select('id').eq('user_id', session.user.id).eq('is_active', true).limit(1)
      const biz = businesses?.[0]
      if (biz) setBusinessId(biz.id)

      const { data: sub } = await supabase
        .from('subscriptions').select('plan, status').eq('user_id', session.user.id).in('status', ['active', 'grace_period']).maybeSingle()
      setPlan(sub?.plan ?? 'free')
    }
    init()
  }, [])

  const fetchHistory = useCallback(async () => {
    if (!businessId || !token) return
    setHistoryLoading(true)
    try {
      const res = await fetch(`${BACKEND}/api/guide/${businessId}/review-replies`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setHistory(await res.json())
    } catch {}
    setHistoryLoading(false)
  }, [businessId, token])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewText.trim() || !businessId || !token) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${BACKEND}/api/guide/review-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ business_id: businessId, review_text: reviewText }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) setError(`이번 달 한도(${data.detail?.limit}회)를 초과했습니다.`)
        else setError(data.detail?.message || '답변 생성 실패. 다시 시도해주세요.')
        return
      }
      setResult(data)
      fetchHistory()
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (plan === 'free') {
    const features = [
      {
        Icon: MessageSquare,
        title: 'AI 답변 자동 초안',
        desc: '리뷰를 붙여넣으면 업종 키워드가 포함된 답변 초안을 즉시 생성합니다.',
      },
      {
        Icon: Star,
        title: '감정 자동 분류',
        desc: '긍정·부정·일반 리뷰를 자동으로 구분해 상황에 맞는 톤으로 답변합니다.',
      },
      {
        Icon: Copy,
        title: '바로 복사·붙여넣기',
        desc: '생성된 답변을 한 번에 복사해 네이버·카카오 리뷰 답글란에 붙여넣으세요.',
      },
      {
        Icon: Clock,
        title: '답변 이력 관리',
        desc: '생성한 답변 이력을 모아볼 수 있어 일관된 답변 품질을 유지합니다.',
      },
    ]

    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">리뷰 답변 생성</h1>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Basic 이상</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">손님 리뷰에 AI가 업종 키워드 포함 답변 초안을 생성합니다</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-5 shadow-sm flex gap-4">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <f.Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm mb-0.5">{f.title}</div>
                <div className="text-sm text-gray-500">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-600 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-white font-semibold text-sm">Basic 플랜부터 이용 가능</p>
            <p className="text-blue-100 text-sm mt-0.5">월 9,900원 · 리뷰 답변 월 10회 포함</p>
          </div>
          <a
            href="/pricing"
            className="shrink-0 bg-white text-blue-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            플랜 업그레이드
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">리뷰 답변 생성</h1>
          <p className="text-sm text-gray-500">리뷰를 붙여넣으면 AI가 업종 키워드 포함 답변을 초안해드립니다</p>
        </div>
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          리뷰 텍스트 붙여넣기
        </label>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="손님이 남긴 리뷰를 여기에 붙여넣으세요. (최대 300자)"
          maxLength={300}
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">{reviewText.length} / 300자</span>
          <button
            type="submit"
            disabled={loading || !reviewText.trim() || !businessId}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {loading ? '생성 중...' : '답변 초안 생성'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </form>

      {/* 생성 결과 */}
      {result && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-900">생성된 답변 초안</span>
              <SentimentBadge sentiment={result.sentiment} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{result.used}/{result.limit === 999 ? '∞' : result.limit}회 사용</span>
              <CopyButton text={result.reply_draft} />
            </div>
          </div>
          <p className="text-blue-900 text-sm leading-relaxed bg-white rounded-xl px-4 py-3 border border-blue-100">
            {result.reply_draft}
          </p>
          <p className="text-xs text-blue-600 mt-2">
            위 답변을 네이버·카카오 리뷰 답글란에 붙여넣으세요.
          </p>
        </div>
      )}

      {/* 이력 */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">최근 답변 이력</h2>
        {historyLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">아직 생성된 답변이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm text-gray-400 leading-relaxed flex-1 line-clamp-2">
                    리뷰: {h.review_text}
                  </p>
                  <SentimentBadge sentiment={h.sentiment} />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-700 flex-1">{h.reply_draft}</p>
                  <CopyButton text={h.reply_draft} />
                </div>
                <p className="text-xs text-gray-300 mt-2">{h.created_at.slice(0, 10)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
