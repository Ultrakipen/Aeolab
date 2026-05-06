'use client'

import { useCallback, useEffect, useState } from 'react'
import { addExcludedKeyword, getUserKeywords } from '@/lib/api'

interface Props {
  bizId: string
  pioneerKeywords: string[]
  accessToken?: string
}

export default function PioneerKeywordsCard({ bizId, pioneerKeywords, accessToken }: Props) {
  const STORAGE_KEY = `excluded_pioneer_${bizId}`
  const [excluded, setExcluded] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // 초기 로드: DB → 실패 시 localStorage fallback
  useEffect(() => {
    let cancelled = false

    const loadFromCache = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as string[]
          if (!cancelled && Array.isArray(parsed)) setExcluded(parsed)
        }
      } catch {}
    }

    const loadFromDb = async () => {
      if (!accessToken) {
        loadFromCache()
        if (!cancelled) setInitialLoading(false)
        return
      }
      try {
        const data = await getUserKeywords(bizId, accessToken)
        if (cancelled) return
        if (Array.isArray(data?.excluded)) {
          setExcluded(data.excluded)
          // DB 값을 캐시에 백업
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data.excluded)) } catch {}
        } else {
          loadFromCache()
        }
      } catch {
        // DB 실패 시 로컬 캐시 유지
        loadFromCache()
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }

    loadFromDb()
    return () => { cancelled = true }
  }, [bizId, accessToken, STORAGE_KEY])

  const visible = pioneerKeywords.filter((kw) => !excluded.includes(kw))

  const handleExclude = useCallback(async (kw: string) => {
    if (submitting || initialLoading) return
    // 낙관적 업데이트
    const prev = excluded
    const next = [...excluded, kw]
    setExcluded(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}

    if (!accessToken) return

    setSubmitting(true)
    try {
      await addExcludedKeyword(bizId, kw, accessToken)
    } catch {
      // 롤백
      setExcluded(prev)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prev)) } catch {}
    } finally {
      setSubmitting(false)
    }
  }, [accessToken, bizId, excluded, submitting, initialLoading, STORAGE_KEY])

  const handleResetAll = useCallback(() => {
    // 로컬 캐시 초기화만 — DB 제외 해제는 KeywordManagerModal에서 수행
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setExcluded([])
  }, [STORAGE_KEY])

  if (visible.length === 0 && pioneerKeywords.length === 0) return null

  if (visible.length === 0 && excluded.length > 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <div className="text-base font-semibold text-emerald-800">나만의 강점 키워드</div>
        </div>
        <p className="text-sm text-emerald-600">
          모든 키워드를 제외했습니다. 제외 해제는 상단의 &quot;내 키워드 설정&quot;에서 할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={handleResetAll}
          className="mt-2 text-sm text-emerald-700 underline hover:text-emerald-900"
        >
          화면에서만 복원 (로컬)
        </button>
      </div>
    )
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
            className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-sm md:text-base font-medium px-3 py-1.5 rounded-full border border-emerald-200"
          >
            {kw}
            <button
              type="button"
              onClick={() => handleExclude(kw)}
              disabled={submitting || initialLoading}
              className="ml-1 text-emerald-500 hover:text-red-500 font-bold text-base leading-none disabled:opacity-40"
              title={initialLoading ? '로딩 중…' : `"${kw}" 제외`}
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
