'use client'

import { useState, useEffect } from 'react'
import { FileText, Check, X, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react'
import { analyzeBlog, getBlogResult } from '@/lib/api'
import { getSafeSession } from '@/lib/supabase/client'

interface Props {
  businessId: string
  currentPlan?: string
}

// 백엔드 /api/blog/analyze 실제 응답 구조
interface BlogApiResult {
  platform?: string
  blog_url?: string
  post_count?: number
  total_post_count?: number
  latest_post_date?: string | null
  citation_score?: number
  freshness_score?: number
  freshness?: string
  keyword_coverage?: { present: string[]; missing: string[] } | number
  missing_keywords?: string[]
  top_recommendation?: string | null
  ai_readiness_items?: Array<{ label: string; passed: boolean; tip: string }>
  analyzed_at?: string
  error?: string | null

  // 신규 필드
  posting_frequency?: {
    monthly_counts: Record<string, number>
    avg_interval_days: number
    consistency: 'active' | 'regular' | 'irregular' | 'inactive'
    recommended_next_date: string
    consistency_message: string
  }
  best_citation_candidate?: {
    title: string
    link: string
    post_score: number
    what_to_add: string
    reason: string
  }
  duplicate_topics?: Array<{
    keyword: string
    count: number
    warning: string
    suggestion: string
  }>
}

const PLATFORM_LABEL: Record<string, string> = {
  naver: '네이버 블로그',
  tistory: '티스토리',
  wordpress: '워드프레스',
  other: '기타 블로그',
}

const FRESHNESS_CONFIG: Record<string, { label: string; color: string }> = {
  fresh:    { label: '최신 (30일 이내)', color: 'bg-green-100 text-green-700' },
  stale:    { label: '오래됨 (30~90일)', color: 'bg-yellow-100 text-yellow-700' },
  outdated: { label: '방치됨 (90일 이상)', color: 'bg-red-100 text-red-700' },
}

function isValidUrl(url: string): boolean {
  return Boolean(url) && (url.startsWith('http://') || url.startsWith('https://'))
}

function parseCoverage(kc: BlogApiResult['keyword_coverage']): {
  present: string[]
  missing: string[]
  pct: number
} {
  if (!kc) return { present: [], missing: [], pct: 0 }
  if (typeof kc === 'number') return { present: [], missing: [], pct: Math.round(kc * 100) }
  const present = kc.present ?? []
  const missing = kc.missing ?? []
  const total = present.length + missing.length
  const pct = total > 0 ? Math.round((present.length / total) * 100) : 0
  return { present, missing, pct }
}

export function BlogDiagnosisCard({ businessId }: Props) {
  const [blogUrl, setBlogUrl] = useState('')
  const [result, setResult] = useState<BlogApiResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null)
  const [urlError, setUrlError] = useState('')

  useEffect(() => {
    const load = async () => {
      setChecking(true)
      try {
        const session = await getSafeSession()
        const token = session?.access_token
        const data = await getBlogResult(businessId, token ?? undefined)
        if (data?.blog_url) setBlogUrl(data.blog_url)
        if (data?.blog_analyzed_at) setAnalyzedAt(data.blog_analyzed_at)
      } catch {}
      setChecking(false)
    }
    load()
  }, [businessId])

  const handleAnalyze = async () => {
    setUrlError('')
    if (!isValidUrl(blogUrl.trim())) {
      setUrlError('http:// 또는 https://로 시작하는 블로그 주소를 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const session = await getSafeSession()
      const token = session?.access_token
      if (!token) {
        setUrlError('로그인 세션이 만료되었습니다. 새로고침 후 다시 시도해주세요.')
        setLoading(false)
        return
      }
      const data = await analyzeBlog(businessId, blogUrl.trim(), token)
      setResult(data as BlogApiResult)
      setAnalyzedAt(new Date().toISOString())
    } catch (err: unknown) {
      let errMsg = '블로그에 접근할 수 없습니다. URL을 확인하거나 잠시 후 다시 시도해주세요.'
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        if (code === 'PLAN_REQUIRED') errMsg = 'Basic 이상 플랜에서 이용 가능합니다. 요금제를 업그레이드해주세요.'
        else if (code === 'SERVER_ERROR') errMsg = '분석 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      }
      setResult({ error: errMsg })
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
    )
  }

  const { present: coveredKws, missing: missingKws, pct: coveragePct } = parseCoverage(result?.keyword_coverage)
  const score = result?.citation_score ?? 0

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          <div className="text-sm font-semibold text-gray-900">내 블로그 AI 최적화 진단</div>
        </div>
        {analyzedAt && (
          <span className="text-sm text-gray-400">
            {new Date(analyzedAt).toLocaleDateString('ko-KR')} 분석
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        블로그 URL을 등록하면 AI 브리핑에 얼마나 최적화됐는지 진단해 드립니다.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          value={blogUrl}
          onChange={(e) => { setBlogUrl(e.target.value); setUrlError('') }}
          placeholder="https://blog.naver.com/내계정 또는 티스토리 주소"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAnalyze() } }}
        />
        <button
          onClick={() => void handleAnalyze()}
          disabled={loading || !blogUrl.trim()}
          className="shrink-0 flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              지금 분석하기
            </>
          )}
        </button>
      </div>

      {urlError && (
        <p className="text-sm text-red-500 mb-3 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {urlError}
        </p>
      )}

      {loading && (
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-blue-700">블로그 포스트를 분석하는 중... 잠시만 기다려주세요. (약 15초)</p>
        </div>
      )}

      {result?.error && !loading && (
        <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700 mb-0.5">분석 실패</p>
            <p className="text-sm text-red-600">{result.error}</p>
          </div>
        </div>
      )}

      {result && !result.error && !loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
              {PLATFORM_LABEL[result.platform ?? ''] ?? (result.platform ?? '블로그')}
            </span>
            {result.freshness && (
              <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${FRESHNESS_CONFIG[result.freshness]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                {FRESHNESS_CONFIG[result.freshness]?.label ?? result.freshness}
              </span>
            )}
            {result.latest_post_date && (
              <span className="text-sm text-gray-500">
                최신 포스트: {new Date(result.latest_post_date).toLocaleDateString('ko-KR')}
              </span>
            )}
            {(result.post_count ?? 0) > 0 && (
              <span className="text-sm text-gray-500">
                {result.total_post_count && result.total_post_count > (result.post_count ?? 0)
                  ? `분석 ${result.post_count}개 / 총 ${result.total_post_count}개 포스트`
                  : `총 ${result.post_count}개 포스트`}
              </span>
            )}
          </div>

          {score > 0 && (
            <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-blue-800">AI 브리핑 준비도</span>
              <span className="text-xl font-bold text-blue-600">
                {score}
                <span className="text-sm font-normal text-blue-400"> / 100</span>
              </span>
            </div>
          )}

          {(coveredKws.length > 0 || missingKws.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-gray-700">키워드 커버리지</span>
                <span className="text-sm font-bold text-purple-600">{coveragePct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-1.5">
                <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${coveragePct}%` }} />
              </div>
              <p className="text-sm text-gray-400">내 블로그에 포함된 업종 키워드 비율</p>
            </div>
          )}

          {(coveredKws.length > 0 || missingKws.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {coveredKws.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-green-700 mb-1.5">포함된 키워드</div>
                  <div className="flex flex-wrap gap-1.5">
                    {coveredKws.slice(0, 8).map((kw) => (
                      <span key={kw} className="text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {missingKws.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-red-700 mb-1.5">없는 키워드</div>
                  <div className="flex flex-wrap gap-1.5">
                    {missingKws.slice(0, 8).map((kw) => (
                      <span key={kw} className="text-sm bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{kw}</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400 mt-1.5">다음 포스팅에 이 키워드를 사용하세요.</p>
                </div>
              )}
            </div>
          )}

          {(result.ai_readiness_items ?? []).length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">AI 브리핑 체크리스트</div>
              <div className={`${(result.ai_readiness_items ?? []).length >= 5 ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-2'}`}>
                {(result.ai_readiness_items ?? []).map((item, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg ${item.passed ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className={`shrink-0 mt-0.5 ${item.passed ? 'text-green-500' : 'text-gray-400'}`}>
                      {item.passed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${item.passed ? 'text-green-700' : 'text-gray-600'}`}>{item.label}</p>
                      {!item.passed && item.tip && (
                        <p className="text-sm text-gray-400 mt-0.5">{item.tip}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.top_recommendation && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="text-sm font-semibold text-amber-800 mb-1">지금 당장 할 수 있는 개선</div>
              <p className="text-sm text-amber-700 leading-relaxed">{result.top_recommendation}</p>
            </div>
          )}

          {result.best_citation_candidate && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-amber-800">AI 브리핑 가장 가까운 포스트</span>
              </div>
              {result.best_citation_candidate.link ? (
                <a
                  href={result.best_citation_candidate.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-700 hover:underline line-clamp-1 block mb-1.5"
                >
                  {result.best_citation_candidate.title}
                </a>
              ) : (
                <p className="text-sm font-medium text-gray-800 line-clamp-1 mb-1.5">
                  {result.best_citation_candidate.title}
                </p>
              )}
              <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                <p className="text-sm font-semibold text-green-800">이것만 추가하면 됩니다</p>
                <p className="text-sm text-green-700 mt-0.5">{result.best_citation_candidate.what_to_add}</p>
              </div>
            </div>
          )}

          {result.posting_frequency && (
            <div className={`rounded-xl p-3.5 border ${
              result.posting_frequency.consistency === 'active' ? 'bg-green-50 border-green-200' :
              result.posting_frequency.consistency === 'regular' ? 'bg-blue-50 border-blue-200' :
              result.posting_frequency.consistency === 'irregular' ? 'bg-amber-50 border-amber-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800">발행 주기</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                  result.posting_frequency.consistency === 'active' ? 'bg-green-200 text-green-800' :
                  result.posting_frequency.consistency === 'regular' ? 'bg-blue-200 text-blue-800' :
                  result.posting_frequency.consistency === 'irregular' ? 'bg-amber-200 text-amber-800' :
                  'bg-red-200 text-red-800'
                }`}>
                  {result.posting_frequency.consistency === 'active' ? '활발' :
                   result.posting_frequency.consistency === 'regular' ? '보통' :
                   result.posting_frequency.consistency === 'irregular' ? '불규칙' : '비활성'}
                </span>
              </div>
              <p className="text-sm text-gray-600">{result.posting_frequency.consistency_message}</p>
              {result.posting_frequency.recommended_next_date && result.posting_frequency.consistency !== 'active' && (
                <p className="text-sm font-medium text-gray-700 mt-1">
                  다음 발행 권장일: {new Date(result.posting_frequency.recommended_next_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          )}

          {(result.duplicate_topics ?? []).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-amber-800">중복 주제 감지</span>
                <span className="text-sm bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                  {result.duplicate_topics!.length}건
                </span>
              </div>
              {result.duplicate_topics!.slice(0, 2).map((t, i) => (
                <p key={i} className="text-sm text-amber-700 mb-1">{t.warning}</p>
              ))}
              <p className="text-sm text-gray-500">AI 브리핑은 같은 주제 중 1개만 인용합니다.</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            <a href={blogUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
              블로그 바로가기 <ExternalLink className="w-3 h-3" />
            </a>
            <div className="flex items-center gap-2">
              <a href="/blog"
                className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                상세 진단 보기 →
              </a>
              <button onClick={() => void handleAnalyze()} disabled={loading}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
                다시 분석
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
