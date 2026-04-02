'use client'
import { useState } from 'react'

export function RescanBanner() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-4">
      <p className="text-sm text-blue-800">
        <span className="font-semibold">AI 스캔이 요청됐습니다.</span>{' '}
        분석에 약 2~3분 소요됩니다. 완료되면 점수가 자동으로 업데이트됩니다.
      </p>
      <button
        onClick={() => setVisible(false)}
        className="text-blue-400 hover:text-blue-600 text-lg leading-none shrink-0"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  )
}
