"use client"

import { useState } from "react"
import { Camera } from "lucide-react"

interface Props {
  bizId: string
  accessToken: string
}

export default function CaptureButton({ bizId, accessToken }: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCapture = async () => {
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      const res = await fetch(`${backendUrl}/api/businesses/${bizId}/capture-screenshots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (res.status === 429) {
        setError("1시간에 1회만 캡처가 가능합니다. 잠시 후 다시 시도해주세요.")
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || "스크린샷 캡처 요청에 실패했습니다.")
        return
      }

      setMessage("스크린샷 캡처를 시작했습니다. 1~2분 후 이 페이지를 새로고침해주세요.")
    } catch {
      setError("서버 연결에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
      <p className="text-sm text-amber-700 font-medium mb-2">
        Before 스크린샷이 아직 없습니다.
      </p>
      <p className="text-sm text-amber-600 mb-3">
        아래 버튼을 눌러 현재 AI 검색 결과를 캡처할 수 있습니다.
      </p>
      <button
        onClick={handleCapture}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            캡처 중...
          </>
        ) : (
          <>
            <Camera className="w-4 h-4" />
            지금 스크린샷 캡처하기
          </>
        )}
      </button>
      {message && (
        <p className="text-sm text-green-600 mt-3 font-medium">{message}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 mt-3 font-medium">{error}</p>
      )}
    </div>
  )
}
