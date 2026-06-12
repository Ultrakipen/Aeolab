'use client'
import { useState } from 'react'

interface Props {
  stale?: boolean
}

export function RescanBanner({ stale = false }: Props) {
  const storageKey = stale ? 'stale_banner_dismissed' : 'rescan_banner_dismissed'

  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return true
    const dismissed = localStorage.getItem(storageKey)
    const today = new Date().toISOString().slice(0, 10)
    return dismissed !== today
  })

  const handleClose = () => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(storageKey, today)
    setVisible(false)
  }

  if (!visible) return null
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-4">
      <p className="text-sm text-blue-800">
        {stale ? (
          <>
            <span className="font-semibold">마지막 스캔이 7일 이상 지났습니다.</span>{' '}
            최신 AI 검색 노출 현황을 확인하려면 지금 재스캔을 권장합니다.
          </>
        ) : (
          <>
            <span className="font-semibold">AI 스캔이 요청됐습니다.</span>{' '}
            분석에 약 2~3분 소요됩니다. 완료되면 점수가 자동으로 업데이트됩니다.
          </>
        )}
      </p>
      <button
        onClick={handleClose}
        className="text-blue-400 hover:text-blue-600 text-lg leading-none shrink-0"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  )
}
