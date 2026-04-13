'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, ExternalLink, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

const IMPACT_LABEL: Record<string, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
}
const IMPACT_COLOR: Record<string, string> = {
  high: 'text-red-600 bg-red-50',
  medium: 'text-yellow-600 bg-yellow-50',
  low: 'text-gray-500 bg-gray-50',
}
const GRADE_COLOR: Record<string, string> = {
  A: 'text-green-700 bg-green-50 border-green-200',
  B: 'text-blue-700 bg-blue-50 border-blue-200',
  C: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  D: 'text-red-700 bg-red-50 border-red-200',
}

interface Check {
  key: string
  label: string
  done: boolean
  impact: string
  action: string
  effect: string
  deeplink?: string | null
  count?: number
  score?: number
  rate?: number
  has_website?: boolean
  has_json_ld?: boolean
}

interface ScorecardData {
  business_name: string
  completion_pct: number
  done_count: number
  total_count: number
  grade: string
  grade_label: string
  checks: Check[]
  top_actions: Check[]
  smartplace_url: string
  naver_place_id?: string
}

interface Props {
  businessId: string
}

export function SmartPlaceScorecard({ businessId }: Props) {
  const [data, setData] = useState<ScorecardData | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setLoading(false); return }
    try {
      const r = await fetch(`${BACKEND}/api/report/smartplace/${businessId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = r.ok ? await r.json() : null
      setData(d)
    } catch {
      setError('스마트플레이스 정보를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleMarkDone = async (key: string) => {
    if (confirming) return
    setConfirming(key)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setConfirming(null); return }

    const body: Record<string, boolean> = {}
    if (key === 'photos') body.has_photos = true
    if (key === 'review_response') body.has_review_response = true

    try {
      await fetch(`${BACKEND}/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      await fetchData()
    } finally {
      setConfirming(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
    )
  }
  if (!loading && !data) {
    return (
      <div className="bg-white rounded-xl border p-4 text-sm text-gray-400 text-center">
        {error || '스마트플레이스 정보를 불러올 수 없습니다.'}
      </div>
    )
  }

  const undoneHigh = data!.checks.filter((c) => !c.done && c.impact === 'high').length

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">스마트플레이스 최적화</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded border ${GRADE_COLOR[data!.grade] ?? ''}`}
            >
              {data!.grade}등급 · {data!.grade_label}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            네이버 AI 브리핑 직결 항목 {data!.done_count}/{data!.total_count}개 완성
          </p>
        </div>
        <a
          href={data!.smartplace_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
        >
          관리 →<ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* 완성도 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>완성도</span>
          <span className="font-medium text-gray-700">{data!.completion_pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              data!.completion_pct >= 85 ? 'bg-green-500' :
              data!.completion_pct >= 65 ? 'bg-blue-500' :
              data!.completion_pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${data!.completion_pct}%` }}
          />
        </div>
      </div>

      {/* 즉시 해야 할 상위 3개 액션 */}
      {data!.top_actions.length > 0 && (
        <div className="mb-4 space-y-2">
          {undoneHigh > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">지금 바로 해야 할 항목 {undoneHigh}개</span>
            </div>
          )}
          {data!.top_actions.map((action) => (
            <div key={action.key} className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl">
              <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-800">{action.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${IMPACT_COLOR[action.impact] ?? ''}`}>
                    효과 {IMPACT_LABEL[action.impact]}
                  </span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{action.action}</p>
                <p className="text-sm text-green-600 mt-1">{action.effect}</p>
                {(action.key === 'photos' || action.key === 'review_response') && (
                  <button
                    onClick={() => handleMarkDone(action.key)}
                    disabled={confirming === action.key}
                    className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirming === action.key ? '처리 중…' : '이미 완료했어요 ✓'}
                  </button>
                )}
                {action.deeplink && (
                  <a
                    href={action.deeplink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1 ml-3"
                  >
                    바로 가기 <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 전체 체크리스트 토글 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
      >
        <span>전체 항목 보기</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {data!.checks.map((check) => (
            <div key={check.key} className="flex items-center gap-2.5">
              {check.done ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300 shrink-0" />
              )}
              <span className={`text-sm ${check.done ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                {check.label}
              </span>
              {!check.done && check.deeplink && (
                <a
                  href={check.deeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline ml-auto shrink-0"
                >
                  바로가기
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
