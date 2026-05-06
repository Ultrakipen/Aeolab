'use client'

import { useState } from 'react'
import { Search, CheckCircle, XCircle, Loader2, Lock } from 'lucide-react'

interface SearchResult {
  query: string
  mentioned: boolean
  excerpt: string
  confidence: number
  gap_reason: string | null
  gap_missing_keyword: string | null
}

interface Props {
  bizId: string
  token: string
  isPro: boolean
}

export default function ConditionSearchCard({ bizId, token, isPro }: Props) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)
  const [mentionedCount, setMentionedCount] = useState(0)
  const [error, setError] = useState('')

  const runSearch = async () => {
    setLoading(true)
    setError('')
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    try {
      const r = await fetch(`${BACKEND}/api/report/condition-search/${bizId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) {
        const data = await r.json()
        setResults(data.results || [])
        setMentionedCount(data.mentioned_count || 0)
        setRan(true)
      } else {
        setError('분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      }
    } catch (e) {
      setError('네트워크 오류가 발생했습니다.')
    }
    setLoading(false)
  }

  if (!isPro) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-gray-400" />
          <h3 className="text-base font-bold text-gray-700">내 키워드로 AI에서 찾히는지 확인</h3>
          <span className="ml-auto text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Pro</span>
        </div>
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
          <Lock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-700 leading-relaxed">
              내 가게에 등록한 키워드로 AI 검색 시 노출 여부를 확인합니다.
            </p>
            <p className="text-sm text-gray-400 mt-1">Pro 플랜에서 이용 가능합니다.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
      {/* 헤더 */}
      <div className="flex items-start gap-2 mb-4">
        <Search className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900">내 키워드로 AI에서 찾히는지 확인</h3>
            {ran && (
              <span
                className={
                  'text-sm font-bold px-2 py-0.5 rounded-full ' +
                  (mentionedCount > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700')
                }
              >
                {mentionedCount}/{results.length} 노출
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            내 가게에 등록한 키워드로 AI 노출 여부를 확인합니다
          </p>
        </div>
      </div>

      {/* 실행 전 안내 */}
      {!ran && (
        <div className="text-center py-6">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm text-gray-600 mb-1 leading-relaxed">
            사업장에 등록한 키워드로<br />
            AI 검색 노출 여부를 확인합니다
          </p>
          <p className="text-sm text-gray-400 mb-5">소요 시간: 약 30초 / 1시간 캐시</p>
          {error && (
            <p className="text-sm text-red-500 mb-3">{error}</p>
          )}
          <button
            onClick={runSearch}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-base font-semibold px-5 py-3 rounded-xl transition-colors disabled:opacity-60 min-h-[44px]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {loading ? '분석 중...' : '조건 검색 확인하기'}
          </button>
        </div>
      )}

      {/* 결과 목록 */}
      {ran && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={
                'flex items-start gap-3 p-3 rounded-xl border ' +
                (r.mentioned
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200')
              }
            >
              {r.mentioned ? (
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{r.query}</p>
                {r.mentioned && r.excerpt && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                    {r.excerpt.slice(0, 80)}{r.excerpt.length > 80 ? '...' : ''}
                  </p>
                )}
                {!r.mentioned && (
                  <p className="text-sm text-red-500 mt-0.5">
                    FAQ·소개글에 이 조건 키워드를 추가해 보세요
                  </p>
                )}
                {!r.mentioned && r.gap_reason && (
                  <p className="text-sm text-orange-600 mt-1">{r.gap_reason}</p>
                )}
                {!r.mentioned && r.gap_missing_keyword && (
                  <a
                    href={`/guide?keyword=${encodeURIComponent(r.gap_missing_keyword)}`}
                    className="inline-block text-sm text-blue-600 hover:underline mt-1 font-medium"
                  >
                    가이드에서 해결법 보기 →
                  </a>
                )}
              </div>
              {r.mentioned && (
                <span className="text-sm text-emerald-600 font-semibold flex-shrink-0">
                  {Math.round(r.confidence * 100)}%
                </span>
              )}
            </div>
          ))}

          {/* 결과 요약 + 재실행 */}
          <div className="pt-2 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {mentionedCount === 0
                ? '아직 조건 검색에 노출되지 않습니다. FAQ와 소개글을 보강해 보세요.'
                : mentionedCount === results.length
                ? '모든 조건 검색에 노출되고 있습니다!'
                : `${results.length - mentionedCount}개 조건에서 노출 개선이 필요합니다.`}
            </p>
            <button
              onClick={runSearch}
              disabled={loading}
              className="text-sm text-purple-600 hover:underline disabled:opacity-50"
            >
              {loading ? '분석 중...' : '다시 확인'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
