'use client'

import { useEffect, useRef, useState } from 'react'

const PLATFORM_LABELS: Record<string, string> = {
  gemini: 'Gemini AI',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  naver: '네이버 AI 브리핑',
  google: 'Google AI Overview',
}

interface ProgressEvent {
  step: string
  status: 'running' | 'done' | 'error' | string
  message?: string
  progress?: number
  result?: Record<string, unknown>
  error?: string
}

interface ScanProgressProps {
  eventSource: EventSource | null
  onComplete: (results: Record<string, unknown>) => void
  onError: () => void
}

export function ScanProgress({ eventSource, onComplete, onError }: ScanProgressProps) {
  const [steps, setSteps] = useState<Record<string, 'waiting' | 'running' | 'done' | 'error'>>({})
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('AI 스캔을 시작합니다...')
  const allResults = useRef<Record<string, unknown>>({})
  const completedRef = useRef(false)

  useEffect(() => {
    allResults.current = {}  // reset on new eventSource
    completedRef.current = false
    if (!eventSource) return

    // 90초 안전망 타임아웃
    const safetyTimer = setTimeout(() => {
      if (!completedRef.current) {
        eventSource.close()
        onError()
      }
    }, 90_000)

    eventSource.onmessage = (e) => {
      try {
        const data: ProgressEvent = JSON.parse(e.data)

        // 서버에서 보낸 에러 이벤트 처리 (스캔 한도 초과 등)
        if (data.error) {
          clearTimeout(safetyTimer)
          eventSource.close()
          onError()
          return
        }

        setProgress(data.progress ?? 0)
        if (data.message) setMessage(data.message)

        if (data.step && data.step !== 'complete') {
          setSteps((prev) => ({ ...prev, [data.step]: data.status as 'running' | 'done' | 'error' }))
          if (data.result) allResults.current[data.step] = data.result
        }

        if (data.step === 'complete' || (data.status === 'done' && data.progress === 100)) {
          clearTimeout(safetyTimer)
          completedRef.current = true
          eventSource.close()
          onComplete(allResults.current)
        }
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = () => {
      // 정상 완료 후 브라우저가 연결을 닫는 경우는 무시
      if (completedRef.current) return
      clearTimeout(safetyTimer)
      eventSource.close()
      onError()
    }

    return () => {
      clearTimeout(safetyTimer)
      eventSource.close()
    }
  }, [eventSource])

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="font-medium text-gray-900">{message}</span>
      </div>

      {/* 전체 진행바 */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 플랫폼별 상태 */}
      <div className="space-y-2">
        {Object.entries(PLATFORM_LABELS).map(([key, label]) => {
          const status = steps[key]
          return (
            <div key={key} className="flex items-center gap-3 text-base">
              <div className="w-5">
                {status === 'running' && (
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin" />
                )}
                {status === 'done' && <span className="text-green-500">✓</span>}
                {status === 'error' && <span className="text-red-400">✗</span>}
                {!status && <span className="text-gray-300">○</span>}
              </div>
              <span className={status === 'done' ? 'text-gray-700' : status === 'running' ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
