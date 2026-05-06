'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient, getSafeSession } from '@/lib/supabase/client'
import {
  generateReviewReply, getReviewReplies, deleteReviewReply,
  type ReviewReplyResult,
} from '@/lib/api'
import {
  MessageSquare, Send, Copy, Check, Trash2, ThumbsUp, ThumbsDown, Minus,
  Star, Clock, AlertTriangle, X, ChevronDown, ChevronUp, ShieldAlert,
  CheckCircle2, XCircle,
} from 'lucide-react'

type ReviewReply = ReviewReplyResult & { review_text?: string }

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// ── 위기관리 가이드 타입 ───────────────────────────────────────────
interface CrisisGuideResult {
  public_reply: string
  ai_impact_tips: string[]
  do_not_do: string[]
  offline_steps: string[]
}

// ── 위기관리 가이드 패널 컴포넌트 ─────────────────────────────────
function CrisisGuidePanel({
  reviewText,
  businessId,
  token,
  onClose,
}: {
  reviewText: string
  businessId: string
  token: string
  onClose: () => void
}) {
  const [result, setResult] = useState<CrisisGuideResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    reply: true, tips: true, doNot: false, offline: false,
  })

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedSection(key)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const toggleExpand = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    const generate = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${BACKEND}/api/guide/${businessId}/crisis-reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ review_text: reviewText }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { detail?: string }
          setError(err.detail || '가이드 생성에 실패했습니다.')
          return
        }
        const data = await res.json() as CrisisGuideResult
        setResult(data)
      } catch {
        setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      } finally {
        setLoading(false)
      }
    }
    generate()
  }, [reviewText, businessId, token])

  return (
    <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-600">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-white" />
          <span className="text-sm font-bold text-white">위기관리 가이드</span>
        </div>
        <button
          onClick={onClose}
          className="text-red-200 hover:text-white transition-colors"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* 리뷰 원문 미리보기 */}
        <div className="text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2 line-clamp-2 border border-red-200">
          <span className="font-semibold">원문: </span>{reviewText}
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="space-y-2 py-4">
            <div className="h-4 bg-red-100 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-red-100 rounded animate-pulse w-1/2" />
            <p className="text-sm text-red-400 text-center mt-3">AI가 위기관리 가이드를 생성하고 있습니다...</p>
          </div>
        )}

        {/* 에러 */}
        {!loading && error && (
          <div className="flex items-center gap-2 text-sm text-red-600 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 결과 */}
        {!loading && result && (
          <div className="space-y-3">
            {/* 공개 답변 초안 */}
            <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <button
                onClick={() => toggleExpand('reply')}
                className="flex items-center justify-between w-full px-4 py-3 text-left"
              >
                <span className="text-sm font-bold text-gray-800">공개 답변 초안</span>
                {expanded.reply ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expanded.reply && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 mb-2 whitespace-pre-wrap">
                    {result.public_reply}
                  </p>
                  <button
                    onClick={() => copy('reply', result.public_reply)}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    {copiedSection === 'reply'
                      ? <><Check className="w-3.5 h-3.5" /> 복사됨</>
                      : <><Copy className="w-3.5 h-3.5" /> 답변 복사</>}
                  </button>
                </div>
              )}
            </div>

            {/* AI 검색 영향 최소화 팁 */}
            <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
              <button
                onClick={() => toggleExpand('tips')}
                className="flex items-center justify-between w-full px-4 py-3 text-left"
              >
                <span className="text-sm font-bold text-gray-800">AI 검색 부정 영향 최소화 팁</span>
                {expanded.tips ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expanded.tips && (
                <ul className="px-4 pb-4 space-y-2">
                  {result.ai_impact_tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 하지 말아야 할 것 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleExpand('doNot')}
                className="flex items-center justify-between w-full px-4 py-3 text-left"
              >
                <span className="text-sm font-bold text-gray-800">하지 말아야 할 것</span>
                {expanded.doNot ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expanded.doNot && (
                <ul className="px-4 pb-4 space-y-2">
                  {result.do_not_do.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 오프라인 해결 단계 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleExpand('offline')}
                className="flex items-center justify-between w-full px-4 py-3 text-left"
              >
                <span className="text-sm font-bold text-gray-800">오프라인 해결 단계</span>
                {expanded.offline ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expanded.offline && (
                <ol className="px-4 pb-4 space-y-2">
                  {result.offline_steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 font-bold text-sm shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === 'positive') return (
    <span className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
      <ThumbsUp className="w-3 h-3" /> 긍정
    </span>
  )
  if (sentiment === 'negative') return (
    <span className="flex items-center gap-1 text-sm bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
      <ThumbsDown className="w-3 h-3" /> 부정
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
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
      className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
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
  const [result, setResult] = useState<ReviewReplyResult & { used: number; limit: number } | null>(null)
  const [history, setHistory] = useState<ReviewReply[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // 위기관리 가이드 상태
  const [crisisReviewId, setCrisisReviewId] = useState<string | null>(null)
  const [crisisReviewText, setCrisisReviewText] = useState<string>('')

  useEffect(() => {
    const init = async () => {
      const session = await getSafeSession()
      if (!session) return
      setToken(session.access_token)

      const supabase = createClient()
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
      const data = await getReviewReplies(businessId, token)
      setHistory(data)
    } catch (err) {
      console.warn('리뷰 답변 이력 조회 실패:', err)
    }
    setHistoryLoading(false)
  }, [businessId, token])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleDelete = async (replyId: string) => {
    if (!businessId || !token) return
    if (!window.confirm('이 답변 이력을 삭제할까요?')) return
    setDeletingId(replyId)
    try {
      await deleteReviewReply(businessId, replyId, token)
      setHistory(prev => prev.filter(h => h.id !== replyId))
    } catch (err) {
      console.warn('리뷰 답변 삭제 실패:', err)
      setError('삭제 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
    setDeletingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewText.trim() || !businessId || !token) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await generateReviewReply(businessId, reviewText, token)
      setResult(data)
      fetchHistory()
    } catch (err: unknown) {
      const apiErr = err as { code?: string; detail?: { limit?: number; message?: string } }
      if (apiErr?.code === 'PLAN_REQUIRED' || apiErr?.detail?.limit !== undefined) {
        setError(`이번 달 한도(${apiErr.detail?.limit ?? ''}회)를 초과했습니다.`)
      } else {
        setError('답변 생성 실패. 다시 시도해주세요.')
      }
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
          <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Basic 이상</span>
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
            <p className="text-blue-100 text-sm mt-0.5">월 9,900원 · 리뷰 답변 무제한 포함</p>
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
          <span className="text-sm text-gray-400">{reviewText.length} / 300자</span>
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
              <SentimentBadge sentiment={result.tone} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">{result.used}/{result.limit === 999 ? '∞' : result.limit}회 사용</span>
              <CopyButton text={result.draft_response} />
            </div>
          </div>
          <p className="text-blue-900 text-sm leading-relaxed bg-white rounded-xl px-4 py-3 border border-blue-100">
            {result.draft_response}
          </p>
          <p className="text-sm text-blue-600 mt-2">
            위 답변을 네이버·카카오 리뷰 답글란에 붙여넣으세요.
          </p>
        </div>
      )}

      {/* 이력 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">최근 답변 이력</h2>
          {history.length > 0 && (
            <span className="text-sm text-gray-400">{history.length}개</span>
          )}
        </div>
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
                  <div className="flex items-center gap-2 shrink-0">
                    <SentimentBadge sentiment={h.tone} />
                    <button
                      onClick={() => handleDelete(h.id)}
                      disabled={deletingId === h.id}
                      className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="이 이력 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-700 flex-1">{h.draft_response}</p>
                  <CopyButton text={h.draft_response} />
                </div>
                {/* 위기관리 가이드 버튼 (부정 리뷰) */}
                {h.tone === 'negative' && businessId && token && (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        if (crisisReviewId === h.id) {
                          setCrisisReviewId(null)
                          setCrisisReviewText('')
                        } else {
                          setCrisisReviewId(h.id)
                          setCrisisReviewText(h.review_text ?? '')
                        }
                      }}
                      className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50 transition-colors font-medium"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {crisisReviewId === h.id ? '가이드 닫기' : '위기관리 가이드'}
                    </button>
                    {crisisReviewId === h.id && businessId && token && (
                      <CrisisGuidePanel
                        reviewText={crisisReviewText}
                        businessId={businessId}
                        token={token}
                        onClose={() => { setCrisisReviewId(null); setCrisisReviewText('') }}
                      />
                    )}
                  </div>
                )}
                <p className="text-sm text-gray-300 mt-2">{h.created_at.slice(0, 10)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
