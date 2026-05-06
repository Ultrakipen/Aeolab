'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Loader2, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24시간

interface CheckItem {
  label: string
  passed: boolean
  score_impact: number
  action_url: string | null
}

interface CheckResult {
  items: CheckItem[]
  total_score: number
  max_score: number
  checkedAt?: string
}

interface Props {
  bizId: string
  naverPlaceUrl: string | null
  accessToken: string
}

function getCacheKey(bizId: string) {
  return `sp_check_${bizId}`
}

function loadCache(bizId: string): CheckResult | null {
  try {
    const raw = localStorage.getItem(getCacheKey(bizId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CheckResult & { _ts: number }
    if (Date.now() - parsed._ts > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(bizId))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveCache(bizId: string, result: CheckResult) {
  try {
    localStorage.setItem(getCacheKey(bizId), JSON.stringify({ ...result, _ts: Date.now() }))
  } catch {}
}

function formatCheckedAt(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '방금 전'
    if (minutes < 60) return `${minutes}분 전`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}시간 전`
    return `${Math.floor(hours / 24)}일 전`
  } catch {
    return ''
  }
}

export default function SmartplaceAutoCheck({ bizId, naverPlaceUrl, accessToken }: Props) {
  const [result, setResult] = useState<CheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkError, setCheckError] = useState(false)
  const [showRefreshHint, setShowRefreshHint] = useState(false)

  // 캐시된 결과 로드 (자동 실행 X)
  useEffect(() => {
    if (!naverPlaceUrl) return
    const cached = loadCache(bizId)
    if (cached) setResult(cached)
  }, [bizId, naverPlaceUrl])

  const runCheck = useCallback(async () => {
    if (!naverPlaceUrl) return
    setLoading(true)
    setCheckError(false)
    try {
      const res = await fetch(`${BACKEND}/api/report/smartplace-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ biz_id: bizId, naver_place_url: naverPlaceUrl }),
      })
      if (!res.ok) throw new Error('check failed')
      const data = await res.json() as CheckResult
      const withTs = { ...data, checkedAt: new Date().toISOString() }
      setResult(withTs)
      saveCache(bizId, withTs)
      setShowRefreshHint(true)
    } catch {
      setCheckError(true)
    } finally {
      setLoading(false)
    }
  }, [bizId, naverPlaceUrl, accessToken])

  if (!naverPlaceUrl) return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
      <span className="text-2xl shrink-0">🏪</span>
      <div>
        <p className="text-sm font-semibold text-gray-700">스마트플레이스 자동 점검 사용 가능</p>
        <p className="text-sm text-gray-500 mt-0.5">
          네이버 플레이스 URL을 등록하면 FAQ·소개글·소식 등 AI 브리핑 영향 항목을 자동으로 점검해 드립니다
        </p>
        <a
          href="/onboarding"
          className="inline-block mt-2 text-sm font-semibold text-blue-600 hover:underline"
        >
          URL 등록하러 가기 →
        </a>
      </div>
    </div>
  )

  const failedItems = result?.items.filter((item) => !item.passed) ?? []
  const passedItems = result?.items.filter((item) => item.passed) ?? []
  const scorePct =
    result && result.max_score > 0
      ? Math.round((result.total_score / result.max_score) * 100)
      : 0

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">스마트플레이스 실시간 점검</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            지금 실제 스마트플레이스 상태를 직접 확인합니다 (위 스캔 점수와 다를 수 있음)
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {result && (
            <span
              className={`text-2xl md:text-3xl font-bold ${
                scorePct >= 70 ? 'text-emerald-600' : scorePct >= 40 ? 'text-amber-600' : 'text-red-600'
              }`}
            >
              {scorePct}점
            </span>
          )}
          <button
            onClick={runCheck}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {loading ? '점검 중...' : result ? '다시 점검' : '점검 시작'}
          </button>
        </div>
      </div>

      {/* 점검 완료 후 점수 새로고침 안내 */}
      {showRefreshHint && !loading && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <p className="text-sm text-blue-700 font-medium">
            점검 완료 — 점수 카드 업데이트를 보려면 페이지를 새로고침하세요
          </p>
          <button
            onClick={() => window.location.reload()}
            className="shrink-0 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg transition-colors"
          >
            새로고침
          </button>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500 text-center">
            스마트플레이스 정보를 읽고 있습니다... (최대 45초)
          </p>
        </div>
      )}

      {/* 오류 */}
      {!loading && checkError && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-center">
          <AlertCircle className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            자동 점검을 사용할 수 없습니다. 수동으로 확인해주세요.
          </p>
          <a
            href="https://smartplace.naver.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline font-medium"
          >
            스마트플레이스 파트너센터 바로가기
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* 결과 없음 (첫 방문, 캐시 없음) */}
      {!loading && !result && !checkError && (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <p className="text-sm text-gray-500">
            점검 시작 버튼을 누르면 FAQ·소개글·소식·영업시간 항목을 자동으로 확인합니다.
          </p>
        </div>
      )}

      {/* 결과 */}
      {!loading && result && (
        <>
          {/* 마지막 점검 시각 + 진행 바 */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-600 font-medium">완성도</span>
              <div className="flex items-center gap-2">
                {result.checkedAt && (
                  <span className="text-xs text-gray-400">
                    마지막 점검: {formatCheckedAt(result.checkedAt)}
                  </span>
                )}
                <span className="text-gray-500">
                  {result.total_score} / {result.max_score}점
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  scorePct >= 70 ? 'bg-emerald-500' : scorePct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${scorePct}%` }}
              />
            </div>
          </div>

          {/* 미통과 항목 */}
          {failedItems.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-red-700 mb-2">
                개선 필요 ({failedItems.length}개)
              </p>
              <div className="space-y-2">
                {failedItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3"
                  >
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-sm text-red-600 mt-0.5">
                        -{item.score_impact}점 손실 중
                      </p>
                    </div>
                    {item.action_url && (
                      <a
                        href={item.action_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                      >
                        지금 등록하기
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 통과 항목 */}
          {passedItems.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-emerald-700 mb-2">
                완료된 항목 ({passedItems.length}개)
              </p>
              <div className="space-y-2">
                {passedItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3"
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    <p className="text-sm font-medium text-gray-800 flex-1">{item.label}</p>
                    <span className="text-sm text-emerald-600 font-semibold shrink-0">
                      +{item.score_impact}점
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {failedItems.length === 0 && (
            <p className="text-sm text-emerald-700 text-center py-2 font-medium">
              모든 항목을 완료했습니다. AI 브리핑 노출 가능성이 높습니다.
            </p>
          )}
        </>
      )}
    </div>
  )
}
