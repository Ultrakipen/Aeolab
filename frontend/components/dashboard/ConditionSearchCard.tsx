'use client'

import { useState, useEffect } from 'react'
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
  googlePlaceRegistered?: boolean
  schemaMarkupApplied?: boolean
  blogMentions?: number
}

export default function ConditionSearchCard({
  bizId,
  token,
  isPro,
  googlePlaceRegistered,
  schemaMarkupApplied,
  blogMentions,
}: Props) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)
  const [mentionedCount, setMentionedCount] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isPro) return
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    fetch(`${BACKEND}/api/report/condition-search/${bizId}?cache_only=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json()
          if (data.results && data.results.length > 0) {
            setResults(data.results)
            setMentionedCount(data.mentioned_count || 0)
            setRan(true)
          }
        }
      })
      .catch(() => {})
  }, [bizId, token, isPro])

  const runSearch = async (force = false) => {
    setLoading(true)
    setError('')
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    try {
      const url = `${BACKEND}/api/report/condition-search/${bizId}${force ? '?force=true' : ''}`
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) {
        const data = await r.json()
        setResults(data.results || [])
        setMentionedCount(data.mentioned_count || 0)
        setRan(true)
      } else if (r.status === 401) {
        setError('세션이 만료되었습니다. 페이지를 새로고침(F5)하세요.')
      } else if (r.status === 403) {
        setError('Pro 플랜에서 이용할 수 있습니다.')
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
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-gray-600" />
          <h3 className="text-base font-bold text-gray-700">내 키워드로 AI에서 찾히는지 확인</h3>
          <span className="ml-auto text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Pro</span>
        </div>
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
          <Lock className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-700 leading-relaxed">
              소개글·키워드가 AI 검색 의도에 얼마나 잘 맞는지 분석합니다. (실제 노출 횟수와 별개)
            </p>
            <p className="text-sm text-gray-600 mt-1">Pro 플랜에서 이용 가능합니다.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
      {/* 헤더 */}
      <div className="flex items-start gap-2 mb-4">
        <Search className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900">내 키워드로 AI에서 찾히는지 확인</h3>
            <span className="text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">소개글 적합도 분석</span>
            {ran && (
              <span
                className={
                  'text-sm font-bold px-2 py-0.5 rounded-full ' +
                  (mentionedCount > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700')
                }
              >
                {mentionedCount}/{results.length} 적합
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">
            소개글·키워드가 AI 검색 의도에 얼마나 잘 맞는지 분석합니다
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            ※ 소개글 준비도 평가이며, 실제 Gemini 노출 횟수와는 다릅니다
          </p>
        </div>
      </div>

      {/* 실행 전 안내 */}
      {!ran && (
        <div className="text-center py-6">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm text-gray-600 mb-1 leading-relaxed">
            등록 키워드와 소개글이<br />
            AI 검색 의도에 얼마나 적합한지 분석합니다
          </p>
          <p className="text-sm text-gray-600 mb-5">소요 시간: 약 30초 / 1시간 캐시</p>
          {error && (
            <p className="text-sm text-red-700 mb-3">{error}</p>
          )}
          <button
            onClick={() => runSearch(false)}
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

      {/* 빈 결과 상태 */}
      {ran && results.length === 0 && (
        <p className="text-sm text-gray-600 text-center py-6">
          사업장 키워드를 등록하면 조건 검색 결과를 확인할 수 있습니다.
        </p>
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
                <CheckCircle className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{r.query}</p>
                {r.mentioned && r.excerpt && (
                  <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                    {r.excerpt.slice(0, 80)}{r.excerpt.length > 80 ? '...' : ''}
                  </p>
                )}
                {!r.mentioned && r.gap_reason && (
                  <p className="text-sm text-orange-700 mt-0.5">{r.gap_reason}</p>
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
                <span className="text-sm text-emerald-700 font-semibold flex-shrink-0">
                  적합도 {Math.round(r.confidence * 100)}%
                </span>
              )}
            </div>
          ))}

          {/* 결과 요약 + 재실행 */}
          <div className="pt-2 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {mentionedCount === 0
                ? '소개글·키워드 콘텐츠 보강이 필요합니다.'
                : mentionedCount === results.length
                ? '소개글·키워드 준비 완료 — 아래 항목이 Gemini 실제 노출을 결정합니다.'
                : `${results.length - mentionedCount}개 검색 의도에서 소개글 보강이 필요합니다.`}
            </p>
            <button
              onClick={() => runSearch(true)}
              disabled={loading}
              className="text-sm text-purple-600 hover:underline disabled:opacity-50"
            >
              {loading ? '분석 중...' : '다시 확인'}
            </button>
          </div>

          {/* 5/5 모두 적합일 때: Gemini 실제 노출 결정 요인 (실측 데이터) */}
          {mentionedCount === results.length && (
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Gemini 노출 결정 요인 (실측)</p>
              {googlePlaceRegistered !== undefined && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  {googlePlaceRegistered
                    ? <CheckCircle className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800">구글 비즈니스 프로필</span>
                    <span className={`ml-2 text-sm ${googlePlaceRegistered ? 'text-emerald-700' : 'text-red-700 font-medium'}`}>
                      {googlePlaceRegistered ? '등록됨' : '미등록 — Gemini 노출의 핵심'}
                    </span>
                  </div>
                </div>
              )}
              {schemaMarkupApplied !== undefined && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  {schemaMarkupApplied
                    ? <CheckCircle className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800">웹사이트 Schema.org 마크업</span>
                    <span className={`ml-2 text-sm ${schemaMarkupApplied ? 'text-emerald-700' : 'text-red-700 font-medium'}`}>
                      {schemaMarkupApplied ? '적용됨' : '미적용 — 검색엔진 인식률 향상'}
                    </span>
                  </div>
                </div>
              )}
              {blogMentions !== undefined && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  {blogMentions > 0
                    ? <CheckCircle className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800">온라인 블로그 언급</span>
                    <span className={`ml-2 text-sm ${blogMentions > 0 ? 'text-emerald-700' : 'text-orange-700 font-medium'}`}>
                      {blogMentions > 0 ? `${blogMentions.toLocaleString()}건 발견` : '없음 — 블로그·리뷰 확충 필요'}
                    </span>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-600 pt-1">
                측정 시점·로그인 상태에 따라 달라질 수 있습니다
              </p>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-700 mt-1">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
