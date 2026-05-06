'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, ShieldCheck, TrendingUp, TrendingDown } from 'lucide-react'
import { PlanGate } from '@/components/common/PlanGate'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface CompetitorThreat {
  competitor_name: string
  keyword: string
  urgency: 'high' | 'medium'
}

interface DeltaResponse {
  my_gained: string[]
  my_lost: string[]
  competitor_threats: CompetitorThreat[]
  scan_date_current: string | null
  scan_date_previous: string | null
  has_delta: boolean
}

interface Props {
  businessId: string
  authToken: string | null
  currentPlan: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function CompetitorKeywordAlertContent({ businessId, authToken }: { businessId: string; authToken: string | null }) {
  const [data, setData] = useState<DeltaResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${BACKEND}/api/report/competitor-keyword-delta/${businessId}`, {
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
        <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    )
  }

  if (!data) return null

  if (!data.has_delta) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">경쟁사 키워드 위협 분석</span>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 leading-relaxed">
            스캔이 2회 이상 필요합니다.<br />
            재스캔 후 경쟁사 키워드 변화를 추적할 수 있습니다.
          </p>
        </div>
      </div>
    )
  }

  const gained = data.my_gained ?? []
  const lost = data.my_lost ?? []
  const threats = data.competitor_threats ?? []
  const highThreats = threats.filter((t) => t.urgency === 'high')
  const mediumThreats = threats.filter((t) => t.urgency === 'medium')

  const isAllGood = gained.length > 0 && lost.length === 0 && threats.length === 0

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-900">경쟁사 키워드 위협 분석</span>
        </div>
        {data.scan_date_previous && data.scan_date_current && (
          <span className="text-sm text-gray-400">
            {formatDate(data.scan_date_previous)} ~ {formatDate(data.scan_date_current)}
          </span>
        )}
      </div>

      {/* 우위 유지 배너 */}
      {isAllGood && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
          <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-700">경쟁사 대비 우위 유지 중</p>
        </div>
      )}

      {/* 내 키워드 변화 */}
      {(gained.length > 0 || lost.length > 0) && (
        <div className="space-y-2.5 mb-4">
          <p className="text-sm font-semibold text-gray-700">내 키워드 변화</p>

          {gained.length > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  새로 커버된 키워드 {gained.length}개
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {gained.map((kw) => (
                  <span key={kw} className="text-sm bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lost.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                <span className="text-sm font-medium text-red-600">
                  주의: {lost.length}개 키워드 커버리지 감소
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lost.map((kw) => (
                  <span key={kw} className="text-sm bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 경쟁사 위협 */}
      {threats.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">경쟁사 위협 키워드</p>
          <div className="space-y-2">
            {highThreats.length > 0 && (
              <div className="border border-red-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                    긴급
                  </span>
                </div>
                <div className="space-y-1.5">
                  {highThreats.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-700">{t.competitor_name}</span>
                      <span className="text-sm text-gray-400">→</span>
                      <span className="text-sm bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                        {t.keyword}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mediumThreats.length > 0 && (
              <div className="border border-orange-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                    주의
                  </span>
                </div>
                <div className="space-y-1.5">
                  {mediumThreats.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-700">{t.competitor_name}</span>
                      <span className="text-sm text-gray-400">→</span>
                      <span className="text-sm bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                        {t.keyword}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-indigo-600 font-medium mt-2.5">
            이 키워드들을 사업장에 추가하면 경쟁에서 앞설 수 있습니다
          </p>
        </div>
      )}
    </div>
  )
}

export function CompetitorKeywordAlert({ businessId, authToken, currentPlan }: Props) {
  const plan = currentPlan ?? 'free'
  if (plan === 'free') {
    return (
      <PlanGate feature="경쟁사 키워드 모니터링" requiredPlan="basic" currentPlan={currentPlan}>
        <CompetitorKeywordAlertContent businessId={businessId} authToken={authToken} />
      </PlanGate>
    )
  }
  return <CompetitorKeywordAlertContent businessId={businessId} authToken={authToken} />
}
