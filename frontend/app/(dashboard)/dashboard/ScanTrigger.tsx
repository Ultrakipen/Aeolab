'use client'

import { useState } from 'react'
import { ScanProgress } from '@/components/scan/ScanProgress'
import { useRouter } from 'next/navigation'

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
  const [eventSource, setEventSource] = useState<EventSource | null>(null)

  const startScan = () => {
    setScanning(true)
    const params = new URLSearchParams({
      business_name: businessName,
      category,
      region,
      business_id: businessId,
    })
    const es = new EventSource(`${BACKEND}/api/scan/stream?${params}`)
    setEventSource(es)
  }

  const handleComplete = () => {
    setScanning(false)
    setEventSource(null)
    router.refresh()
  }

  const handleError = () => {
    setScanning(false)
    setEventSource(null)
    alert('스캔 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
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
    <button
      onClick={startScan}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
    >
      AI 스캔 시작
    </button>
  )
}
