'use client'

import { useState, useEffect } from 'react'
import { FileText, Check, X, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react'
import type { BlogAnalysisResult } from '@/types'
import { analyzeBlog, getBlogResult } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

interface Props {
  businessId: string
  currentPlan?: string
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
  if (!url) return false
  return url.startsWith('http://') || url.startsWith('https://')
}

export function BlogDiagnosisCard({ businessId }: Props) {
  const [blogUrl, setBlogUrl] = useState('')
  const [result, setResult] = useState<BlogAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null)
  const [urlError, setUrlError] = useState('')

  // 기존 분석 결과 로드
  useEffect(() => {
    const load = async () => {
      setChecking(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
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
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setUrlError('로그인 세션이 만료되었습니다. 새로고침 후 다시 시도해주세요.')
        return
      }
      const data = await analyzeBlog(businessId, blogUrl.trim(), token)
      setResult(data)
      setAnalyzedAt(new Date().toISOString())
    } catch {
      setResult({
        platform: 'other',
        post_count: 0,
        latest_post_date: null,
        keyword_coverage: 0,
        covered_keywords: [],
        missing_keywords: [],
        ai_readiness_score: 0,
        ai_readiness_items: [],
        freshness: 'outdated',
        top_recommendation: '',
        error: '블로그에 접근할 수 없습니다. URL을 확인하거나 잠시 후 다시 시도해주세요.',
      })
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

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      {/* 헤더 */}
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

      {/* URL 입력 + 분석 버튼 */}
      <div className="flex gap-2 mb-4">
        <input
          value={blogUrl}
          onChange={(e) => { setBlogUrl(e.target.value); setUrlError('') }}
          placeholder="https://blog.naver.com/내계정 또는 티스토리 주소"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAnalyze() } }}
        />
        <button
          onClick={handleAnalyze}
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

      {/* 분석 중 안내 */}
      {loading && (
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-blue-700">블로그 포스트를 분석하는 중... 잠시만 기다려주세요.</p>
        </div>
      )}

      {/* 에러 상태 */}
      {result?.error && !loading && (
        <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700 mb-0.5">분석 실패</p>
            <p className="text-sm text-red-600">{result.error}</p>
          </div>
        </div>
      )}

      {/* 분석 결과 */}
      {result && !result.error && !loading && (
        <div className="space-y-4">
          {/* 플랫폼 뱃지 + freshness */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
              {PLATFORM_LABEL[result.platform] ?? result.platform}
            </span>
            <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${FRESHNESS_CONFIG[result.freshness]?.color ?? 'bg-gray-100 text-gray-600'}`}>
              {FRESHNESS_CONFIG[result.freshness]?.label ?? result.freshness}
            </span>
            {result.latest_post_date && (
              <span className="text-sm text-gray-500">
                최신 포스트: {new Date(result.latest_post_date).toLocaleDateString('ko-KR')}
              </span>
            )}
            <span className="text-sm text-gray-500">
              총 {result.post_count}개 포스트
            </span>
          </div>

          {/* 키워드 커버리지 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-gray-700">키워드 커버리지</span>
              <span className="text-sm font-bold text-purple-600">{result.keyword_coverage}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-1.5">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${result.keyword_coverage}%` }}
              />
            </div>
            <p className="text-sm text-gray-400">내 블로그에 포함된 업종 키워드 비율</p>
          </div>

          {/* 키워드 현황 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.covered_keywords.length > 0 && (
              <div>
                <div className="text-sm font-medium text-green-700 mb-1.5">포함된 키워드</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.covered_keywords.slice(0, 8).map((kw) => (
                    <span key={kw} className="text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{kw}</span>
                  ))}
                </div>
              </div>
            )}
            {result.missing_keywords.length > 0 && (
              <div>
                <div className="text-sm font-medium text-red-700 mb-1.5">없는 키워드</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.missing_keywords.slice(0, 8).map((kw) => (
                    <span key={kw} className="text-sm bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{kw}</span>
                  ))}
                </div>
                <p className="text-sm text-gray-400 mt-1.5">다음 포스팅에 이 키워드를 사용하세요.</p>
              </div>
            )}
          </div>

          {/* AI 브리핑 준비도 */}
          {result.ai_readiness_items.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-700">AI 브리핑 준비도</div>
                <div className="flex items-center gap-1">
                  <div className="w-12 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${result.ai_readiness_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-blue-600">{result.ai_readiness_score}점</span>
                </div>
              </div>
              <div className="space-y-2">
                {result.ai_readiness_items.map((item, i) => (
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

          {/* 핵심 권고사항 */}
          {result.top_recommendation && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="text-sm font-semibold text-amber-800 mb-1">핵심 권고사항</div>
              <p className="text-sm text-amber-700 leading-relaxed">{result.top_recommendation}</p>
            </div>
          )}

          {/* 다시 분석 버튼 */}
          <div className="flex items-center justify-between pt-1">
            <a
              href={blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              블로그 바로가기 <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              다시 분석
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
