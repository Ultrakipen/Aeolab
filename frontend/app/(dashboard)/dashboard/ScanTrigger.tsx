'use client'

import { useState, useRef, useEffect } from 'react'
import { ScanProgress } from '@/components/scan/ScanProgress'
import { useRouter } from 'next/navigation'
import { getSafeSession } from '@/lib/supabase/client'

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

      const prepRes = await fetch(prepUrl.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!prepRes.ok) {
        const err = await prepRes.json().catch(() => ({}))
        const code = err?.detail?.code
        if (code === 'SCAN_IN_PROGRESS') {
          setError('이미 스캔이 진행 중입니다. 잠시 후 다시 시도해주세요.')
        } else if (code === 'SCAN_LIMIT' || code === 'SCAN_DAILY_LIMIT') {
          setError('오늘 수동 스캔 횟수를 모두 사용했습니다.')
        } else if (code === 'PLAN_REQUIRED') {
          setError('무료 체험 스캔 1회를 이미 사용했습니다. 계속 이용하려면 Basic 플랜으로 업그레이드하세요.')
        } else if (code === 'BIZ_NOT_FOUND') {
          setError('사업장 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.')
        } else {
          setError('스캔을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.')
        }
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
            <p className="text-sm text-gray-400 mt-0.5">잠시 후 대시보드가 자동으로 업데이트됩니다</p>
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
        /* PC: 가로 배치 (키워드 좌측 | 버튼 우측), 모바일: 세로 배치 */
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">

          {/* 키워드 선택 영역 — PC: flex-1 왼쪽, 모바일: 위 */}
          {!limitReached && hasKeywords && keywords && (
            <div className="flex-1 flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-600">검색 키워드 선택</span>
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setSelectedKeyword(kw)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                      selectedKeyword === kw
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 bg-white'
                    }`}
                  >
                    {regionFirst} {kw}
                  </button>
                ))}
              </div>
              {/* 검색어 안내 */}
              {activeKw && (
                <div>
                  <p className="text-sm text-blue-600 font-medium break-keep">
                    검색어: &quot;{regionFirst} {activeKw} 추천&quot;
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5 break-keep">
                    수동: 선택 키워드 스캔 · 자동(새벽 2시): 키워드 순환 스캔
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 스캔 버튼 영역 — PC: 오른쪽 고정, 모바일: 아래 */}
          <div className="flex flex-col items-stretch sm:items-end gap-1.5 sm:shrink-0">
            <button
              onClick={startScan}
              disabled={loading || limitReached}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-base font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {loading ? '준비 중...' : limitReached ? `오늘 스캔 완료 (${scanUsed}/${scanLimit}회)` : 'AI 스캔 시작'}
            </button>

            {/* 스캔 횟수 */}
            {scanLimit > 0 && scanLimit < 999 && (
              <p className={`text-sm text-center sm:text-right ${limitReached ? 'text-gray-500' : 'text-gray-400'}`}>
                {limitReached
                  ? '새벽 2시에 자동 스캔이 실행됩니다'
                  : `오늘 ${scanUsed}/${scanLimit}회 사용`}
              </p>
            )}

            {/* 최근 스캔 키워드 */}
            {lastQueryUsed && (
              <div className="flex items-center justify-center sm:justify-end gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                <span className="text-sm text-gray-500">최근 스캔:</span>
                <span className="text-sm font-semibold text-blue-600 truncate max-w-[140px]">&quot;{lastQueryUsed}&quot;</span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  )
}
