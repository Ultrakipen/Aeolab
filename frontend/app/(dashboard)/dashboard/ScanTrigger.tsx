'use client'

import { useState, useRef, useEffect } from 'react'
import { ScanProgress } from '@/components/scan/ScanProgress'
import { useRouter } from 'next/navigation'
import { getSafeSession } from '@/lib/supabase/client'
import { getScanErrorInfo, SCAN_TIMEOUT_MESSAGE } from '@/lib/scanErrorMessages'
import { FeedbackPopup } from '@/components/dashboard/FeedbackPopup'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export interface ScanCompleteResult {
  topMissingKeyword?: string;
  faqCopyText?: string;
}

interface Props {
  businessId: string
  businessName: string
  category: string
  region: string
  keywords?: string[]
  scanUsed?: number
  scanLimit?: number
  plan?: string
  lastQueryUsed?: string
  stacked?: boolean
  /** 이미 스캔 결과가 있는 재방문 사용자 — 스캔을 보조 행동으로 강등(주행동은 '개선 실행') */
  secondary?: boolean
  onScanComplete?: (data: ScanCompleteResult) => void
}

export function ScanTrigger({
  businessId,
  businessName,
  category,
  region,
  keywords,
  scanUsed = 0,
  scanLimit = 0,
  plan,
  lastQueryUsed,
  stacked = false,
  secondary = false,
  onScanComplete,
}: Props) {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const [scannedKeyword, setScannedKeyword] = useState<string>('')
  const [feedbackTriggered, setFeedbackTriggered] = useState(false)

  const hasKeywords = (keywords?.length ?? 0) >= 1
  const _lastUsedKw = keywords?.find(kw => lastQueryUsed?.includes(kw)) ?? keywords?.[0] ?? ''
  const [selectedKeyword, setSelectedKeyword] = useState<string>(_lastUsedKw)

  useEffect(() => {
    if (keywords && keywords.length > 0) {
      const kw = keywords.find(k => lastQueryUsed?.includes(k)) ?? keywords[0]
      setSelectedKeyword(kw)
    }
  }, [keywords, lastQueryUsed])

  const limitReached = scanLimit > 0 && scanLimit < 999 && scanUsed >= scanLimit

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  const startScan = async () => {
    setError('')
    setLoading(true)

    try {
      const session = await getSafeSession()
      if (!session?.access_token) {
        setError('로그인이 필요합니다.')
        setLoading(false)
        return
      }

      const prepUrl = new URL(`${BACKEND}/api/scan/stream/prepare`)
      prepUrl.searchParams.set('biz_id', businessId)
      const kwToSend = selectedKeyword || keywords?.[0] || ''
      if (kwToSend) {
        prepUrl.searchParams.set('selected_keyword', kwToSend)
      }
      setScannedKeyword(kwToSend)

      let prepRes: Response
      try {
        prepRes = await fetch(prepUrl.toString(), {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      } catch {
        // 네트워크 오류
        const info = getScanErrorInfo(0)
        setError(info.message)
        setLoading(false)
        return
      }

      if (!prepRes.ok) {
        const err = await prepRes.json().catch(() => ({}))
        const code = (err?.detail?.code as string) ?? ''
        const info = getScanErrorInfo(prepRes.status, code)
        setError(info.message)
        setLoading(false)
        return
      }
      const { stream_token } = await prepRes.json()

      const es = new EventSource(
        `${BACKEND}/api/scan/stream?stream_token=${encodeURIComponent(stream_token)}`
      )
      eventSourceRef.current = es
      setEventSource(es)
      setScanning(true)

      // 60초 타임아웃: 응답 없으면 사용자 안내
      const timeoutId = setTimeout(() => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
          setEventSource(null)
          setScanning(false)
          setError(SCAN_TIMEOUT_MESSAGE)
        }
      }, 60_000)
      es.addEventListener('close', () => clearTimeout(timeoutId))
      es.addEventListener('error', () => clearTimeout(timeoutId))
    } catch {
      setError('스캔 시작 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = (scanData?: { top_missing_keywords?: string[]; faq_copy_text?: string }) => {
    setScanning(false)
    eventSourceRef.current = null
    setEventSource(null)
    setCompleted(true)
    setFeedbackTriggered(true)
    if (onScanComplete) {
      onScanComplete({
        topMissingKeyword: scanData?.top_missing_keywords?.[0] ?? undefined,
        faqCopyText: scanData?.faq_copy_text ?? undefined,
      })
    }
    setTimeout(() => {
      window.location.href = `/dashboard?biz_id=${encodeURIComponent(businessId)}`
    }, 10000)
  }

  const handleError = () => {
    setScanning(false)
    eventSourceRef.current = null
    setEventSource(null)
    setError('스캔 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
  }

  if (scanning) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ScanProgress
            eventSource={eventSource}
            onComplete={handleComplete}
            onError={handleError}
          />
        </div>
      </div>
    )
  }

  const regionFirst = region?.split(' ')[0] || ''
  const activeKw = selectedKeyword || keywords?.[0] || ''

  return (
    <div className="w-full">
      {/* 완료 상태 */}
      {completed && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex-1">
            <p className="text-base text-green-700 font-semibold">스캔 완료! 결과를 분석했습니다.</p>
            {scannedKeyword && (
              <p className="text-sm text-gray-600 mt-0.5">
                검색어: <span className="font-semibold text-blue-600">&quot;{regionFirst} {scannedKeyword} 추천&quot;</span>
              </p>
            )}
            <p className="text-sm text-gray-500 mt-0.5">잠시 후 대시보드가 자동으로 업데이트됩니다</p>
          </div>
          <a
            href="/guide"
            className="shrink-0 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors text-center"
          >
            AI 개선 가이드 보기
          </a>
        </div>
      )}

      {!completed && (
        /* stacked: 항상 세로(좁은 컬럼용) · 기본: PC 가로(키워드 좌측 | 버튼 우측), 모바일 세로 */
        <div className={stacked ? "flex flex-col gap-3" : "flex flex-col sm:flex-row sm:items-start gap-3"}>

          {/* 키워드 선택 영역 — PC: flex-1 왼쪽, 모바일: 위 */}
          {!limitReached && hasKeywords && keywords && (
            <div className="flex-1 flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">검색 키워드 선택</span>
              <div className="relative sm:contents">
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
                  {keywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => setSelectedKeyword(kw)}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                        selectedKeyword === kw
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 bg-white'
                      }`}
                    >
                      {regionFirst} {kw}
                    </button>
                  ))}
                </div>
                {keywords.length > 2 && (
                  <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white to-transparent sm:hidden" />
                )}
              </div>
              {/* 검색어 안내 */}
              {activeKw && (
                <div>
                  <p className="text-sm text-blue-600 font-medium break-keep">
                    검색어: &quot;{regionFirst} {activeKw} 추천&quot;
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5 break-keep hidden sm:block">
                    수동: 선택 키워드 스캔 · 자동(새벽 2시): 키워드 순환 스캔
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 스캔 버튼 영역 — stacked: 항상 세로 full · 기본: PC 오른쪽 고정, 모바일 아래 */}
          <div className={stacked ? "flex flex-col items-stretch gap-1.5" : "flex flex-col items-stretch sm:items-end gap-1.5 sm:shrink-0"}>
            <button
              onClick={startScan}
              disabled={loading || limitReached}
              className={`${
                secondary
                  ? "bg-white text-blue-700 border border-blue-300 hover:bg-blue-50"
                  : "bg-blue-600 text-white border border-blue-600 hover:bg-blue-700"
              } px-5 py-2.5 rounded-lg text-base font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${stacked ? "w-full" : "w-full sm:w-auto"}`}
            >
              {loading ? '준비 중...' : limitReached ? `오늘 스캔 완료 (${scanUsed}/${scanLimit}회)` : secondary ? '🔄 AI 다시 스캔' : 'AI 스캔 시작'}
            </button>

            {/* 스캔 횟수 */}
            {scanLimit > 0 && scanLimit < 999 && (
              <p className={`text-sm ${stacked ? 'text-center' : 'text-center sm:text-right'} text-gray-500`}>
                {limitReached
                  ? '새벽 2시에 자동 스캔이 실행됩니다'
                  : `오늘 ${scanUsed}/${scanLimit}회 사용`}
              </p>
            )}

            {/* 최근 스캔 키워드 */}
            {lastQueryUsed && (
              <div className={`flex items-center ${stacked ? 'justify-center' : 'justify-center sm:justify-end'} gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5`}>
                <span className="text-sm text-gray-500">최근 스캔:</span>
                <span className="text-sm font-semibold text-blue-600 truncate max-w-[140px]">&quot;{lastQueryUsed}&quot;</span>
              </div>
            )}
          </div>
        </div>
      )}

      <FeedbackPopup eventType="scan_complete" trigger={feedbackTriggered} />

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {/* 재시도 버튼 — 타임아웃·네트워크·500 오류에서만 표시 */}
            {!limitReached && !error.includes('업그레이드') && !error.includes('무료 체험') && (
              <button
                onClick={startScan}
                className="text-sm font-semibold text-red-700 underline hover:text-red-900 transition-colors"
              >
                다시 시도
              </button>
            )}
            <a
              href="mailto:support@aeolab.co.kr"
              className="text-sm font-semibold text-gray-500 underline hover:text-gray-700 transition-colors"
            >
              문제 지속 시 문의하기
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
