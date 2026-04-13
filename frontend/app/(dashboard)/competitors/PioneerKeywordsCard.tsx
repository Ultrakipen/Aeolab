'use client'

import { useState, useEffect } from 'react'

interface Props {
  bizId: string
  pioneerKeywords: string[]
}

export default function PioneerKeywordsCard({ bizId, pioneerKeywords }: Props) {
  const STORAGE_KEY = `excluded_pioneer_${bizId}`
  const [excluded, setExcluded] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setExcluded(JSON.parse(stored) as string[])
    } catch {}
  }, [STORAGE_KEY])

  const visible = pioneerKeywords.filter((kw) => !excluded.includes(kw))

  if (visible.length === 0 && pioneerKeywords.length === 0) return null
  if (visible.length === 0 && excluded.length > 0) {
    // 모두 제외된 경우에도 카드 표시 (복원 안내)
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <div className="text-base font-semibold text-emerald-800">나만의 강점 키워드</div>
        </div>
        <p className="text-sm text-emerald-600">
          모든 키워드를 제외했습니다. 페이지를 새로고침하면 복원됩니다.
        </p>
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY)
            setExcluded([])
          }}
          className="mt-2 text-sm text-emerald-700 underline hover:text-emerald-900"
        >
          모두 복원
        </button>
      </div>
    )
  }

  const handleExclude = (kw: string) => {
    const next = [...excluded, kw]
    setExcluded(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
        <div className="text-base font-semibold text-emerald-800">나만의 강점 키워드</div>
      </div>
      <p className="text-sm text-emerald-600 mb-3">
        AI가 분석한 선점 가능 키워드입니다. 실제 제공하지 않는 서비스는 X를 눌러 제외하세요.
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full border border-emerald-200"
          >
            {kw}
            <button
              onClick={() => handleExclude(kw)}
              className="ml-1 text-emerald-500 hover:text-red-500 font-bold text-xs leading-none"
              title={`"${kw}" 제외`}
              aria-label={`"${kw}" 제외`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <p className="text-sm text-emerald-700 mt-3 font-medium">
        이 키워드가 내 가게의 경쟁력입니다. 리뷰·소개글에서 강조하세요.
      </p>
    </div>
  )
}
