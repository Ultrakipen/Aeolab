'use client'

import { useState } from 'react'
import { ScanProgress } from '@/components/scan/ScanProgress'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Props {
  businessId: string
  businessName: string
  category: string
  region: string
}

export function ScanTrigger({ businessId, businessName, category, region }: Props) {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const [error, setError] = useState('')

  const startScan = async () => {
    setError('')
    setLoading(true)

    try {
      // 1단계: Supabase 세션에서 access_token 획득
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('로그인이 필요합니다.')
        setLoading(false)
        return
      }

      // 2단계: stream_token 발급 (60초 유효)
      const prepRes = await fetch(
        `${BACKEND}/api/scan/stream/prepare?biz_id=${encodeURIComponent(businessId)}`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      if (!prepRes.ok) {
        const err = await prepRes.json().catch(() => ({}))
        const code = err?.detail?.code
        if (code === 'SCAN_IN_PROGRESS') {
          setError('이미 스캔이 진행 중입니다. 잠시 후 다시 시도해주세요.')
        } else if (code === 'SCAN_LIMIT') {
          setError('이번 달 스캔 횟수를 모두 사용했습니다.')
        } else {
          setError('스캔을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.')
        }
        setLoading(false)
        return
      }
      const { stream_token } = await prepRes.json()

      // 3단계: SSE 연결
      const es = new EventSource(
        `${BACKEND}/api/scan/stream?stream_token=${encodeURIComponent(stream_token)}`
      )
      setEventSource(es)
      setScanning(true)
    } catch {
      setError('스캔 시작 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    setScanning(false)
    setEventSource(null)
    router.refresh()
  }

  const handleError = () => {
    setScanning(false)
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

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={startScan}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? '준비 중…' : 'AI 스캔 시작'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
