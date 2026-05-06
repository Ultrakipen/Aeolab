'use client'

import { useState, useEffect } from 'react'
import { BarChart2, Copy, Check } from 'lucide-react'
import { PlanGate } from '@/components/common/PlanGate'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface CompletenessCategory {
  name: string
  weight: number
  covered: string[]
  missing: string[]
  covered_pct: number
  condition_search_example: string
}

interface CompletenessResponse {
  category: string
  taxonomy_key: string
  overall_pct: number
  categories: CompletenessCategory[]
  top_missing: string[]
  my_unclassified_keywords: string[]
}

interface Props {
  businessId: string
  authToken: string | null
  currentPlan: string
}

function overallBarColor(pct: number): string {
  if (pct < 40) return 'bg-red-500'
  if (pct < 70) return 'bg-orange-400'
  return 'bg-blue-500'
}

function categoryBarColor(pct: number): string {
  if (pct === 0) return 'bg-red-500'
  if (pct < 50) return 'bg-orange-400'
  if (pct < 80) return 'bg-yellow-400'
  return 'bg-green-500'
}

function overallTextColor(pct: number): string {
  if (pct < 40) return 'text-red-600'
  if (pct < 70) return 'text-orange-500'
  return 'text-blue-600'
}

function CopyBadge({ keyword }: { keyword: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(keyword).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <button
      onClick={handleCopy}
      title={`"${keyword}" 복사`}
      className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2.5 py-1 rounded-full transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-green-500" />
          복사됨
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {keyword}
        </>
      )}
    </button>
  )
}

function KeywordCompletenessContent({ businessId, authToken }: { businessId: string; authToken: string | null }) {
  const [data, setData] = useState<CompletenessResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${BACKEND}/api/guide/${businessId}/keyword-completeness`, {
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
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-full mb-2" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
    )
  }

  if (!data) return null

  const sortedCategories = [...(data.categories ?? [])]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)

  const topMissing = (data.top_missing ?? []).slice(0, 5)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">업종 키워드 충족도 게이지</span>
        </div>
        <span className={`text-2xl font-bold ${overallTextColor(data.overall_pct)}`}>
          {data.overall_pct}%
        </span>
      </div>

      {/* 전체 게이지 */}
      <div className="mb-5">
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${overallBarColor(data.overall_pct)}`}
            style={{ width: `${Math.min(data.overall_pct, 100)}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 mt-1">
          {data.overall_pct < 40
            ? '업종 표준 키워드 대비 커버리지가 낮습니다'
            : data.overall_pct < 70
            ? '주요 키워드를 추가하면 검색 노출이 늘어납니다'
            : '업종 핵심 키워드를 잘 커버하고 있습니다'}
        </p>
      </div>

      {/* 카테고리별 게이지 */}
      {sortedCategories.length > 0 && (
        <div className="space-y-2.5 mb-5">
          <p className="text-sm font-semibold text-gray-700">카테고리별 충족도</p>
          {sortedCategories.map((cat, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 truncate max-w-[60%]">{cat.name}</span>
                <span className="text-sm font-semibold text-gray-600">{cat.covered_pct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${categoryBarColor(cat.covered_pct)}`}
                  style={{ width: `${Math.min(cat.covered_pct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가 추천 키워드 */}
      {topMissing.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">추가 추천 키워드</p>
          <div className="flex flex-wrap gap-1.5">
            {topMissing.map((kw) => (
              <CopyBadge key={kw} keyword={kw} />
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-1.5">배지를 클릭하면 클립보드에 복사됩니다</p>
        </div>
      )}

      <p className="text-sm text-gray-400">
        키워드는 설정 &gt; 사업장 편집에서 추가할 수 있습니다
      </p>
    </div>
  )
}

export function KeywordCompletenessGauge({ businessId, authToken, currentPlan }: Props) {
  const plan = currentPlan ?? 'free'
  if (plan === 'free') {
    return (
      <PlanGate feature="키워드 충족도 분석" requiredPlan="basic" currentPlan={currentPlan}>
        <KeywordCompletenessContent businessId={businessId} authToken={authToken} />
      </PlanGate>
    )
  }
  return <KeywordCompletenessContent businessId={businessId} authToken={authToken} />
}
