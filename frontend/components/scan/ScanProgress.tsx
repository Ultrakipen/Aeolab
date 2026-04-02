'use client'

import { useEffect, useRef, useState } from 'react'

const PLATFORM_LABELS: Record<string, string> = {
  gemini: 'Gemini AI (100회 샘플링)',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  grok: 'Grok AI',
  naver: '네이버 AI 브리핑',
  claude: 'Claude AI',
}

interface ProgressEvent {
  step: string
  status: 'running' | 'done' | 'error' | string
  message?: string
  progress?: number
  result?: Record<string, unknown>
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

  useEffect(() => {
    allResults.current = {}  // reset on new eventSource
    if (!eventSource) return

    eventSource.onmessage = (e) => {
      try {
        const data: ProgressEvent = JSON.parse(e.data)
        setProgress(data.progress ?? 0)
        if (data.message) setMessage(data.message)

        if (data.step && data.step !== 'complete') {
          setSteps((prev) => ({ ...prev, [data.step]: data.status as 'running' | 'done' | 'error' }))
          if (data.result) allResults.current[data.step] = data.result
        }

        if (data.step === 'complete' || data.status === 'done' && data.progress === 100) {
          eventSource.close()
          onComplete(allResults.current)
        }
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = (e) => {
      // DONE 이후 브라우저가 자동으로 연결 종료하는 경우는 에러로 처리하지 않음
      if (eventSource.readyState === EventSource.CLOSED) return
      eventSource.close()
      onError()
    }

    return () => eventSource.close()
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
