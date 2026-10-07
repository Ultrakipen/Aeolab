"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Search, X, ArrowRight, ChevronDown } from "lucide-react"
import type { ChannelGroup, ChannelGuideEntry } from "@/lib/channelGuideData"
import { trackEvent } from "@/lib/analytics"

interface GroupBlock {
  group: ChannelGroup
  label: string
  colorClass: string
  entries: ChannelGuideEntry[]
}

export function ChannelGuideList({ groups }: { groups: GroupBlock[] }) {
  const [query, setQuery] = useState("")
  // 그룹 열림 상태 — 기본 모두 열림, 모바일에서 접을 수 있음
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.group, true]))
  )

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => e.label.toLowerCase().includes(q) || e.value.toLowerCase().includes(q)),
      }))
      .filter((g) => g.entries.length > 0)
  }, [groups, query])

  const totalMatches = filteredGroups.reduce((sum, g) => sum + g.entries.length, 0)

  // 검색 시 매칭 그룹 자동 열기
  useEffect(() => {
    if (query.trim()) {
      setOpenGroups((prev) => {
        const next = { ...prev }
        filteredGroups.forEach((g) => { next[g.group] = true })
        return next
      })
    }
  }, [filteredGroups, query])

  // 검색어 입력이 멈춘 뒤 800ms 후에만 발송 — 키 입력마다 이벤트 스팸 방지
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!query.trim()) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      trackEvent("guide_channel_search", { query: query.trim(), results: totalMatches })
    }, 800)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div>
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="업종 이름으로 찾기 (예: 음식점, 미용실, 학원)"
          aria-label="업종 검색"
          className="w-full pl-9 pr-9 py-3 text-sm md:text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="검색어 지우기"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {query && (
        <p className="text-sm text-gray-600 mb-6">
          {totalMatches > 0 ? `"${query}" 검색 결과 ${totalMatches}건` : `"${query}"와 일치하는 업종이 없습니다. 가장 가까운 업종을 선택하거나 무료 진단에서 직접 입력해보세요.`}
        </p>
      )}

      {filteredGroups.map((g) => {
        const isOpen = openGroups[g.group] ?? true
        return (
          <section key={g.group} className="mb-10">
            {/* 모바일: 접이식 토글 헤더 */}
            <button
              type="button"
              className="md:hidden w-full flex items-center justify-between gap-2 mb-3 py-1"
              onClick={() => setOpenGroups((prev) => ({ ...prev, [g.group]: !isOpen }))}
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold border ${g.colorClass}`}>
                  {g.label}
                </span>
                <span className="text-sm text-gray-600">{g.entries.length}개</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {/* 데스크톱: 항상 표시되는 헤더 */}
            <div className="hidden md:flex items-center gap-2 mb-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold border ${g.colorClass}`}>
                {g.label}
              </span>
              <span className="text-sm text-gray-600">{g.entries.length}개 업종</span>
            </div>
            {/* 카드 그리드 — 모바일에서 openGroups에 따라 표시/숨김 */}
            <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${isOpen ? "block" : "hidden md:grid"}`}>
              {g.entries.map((e) => {
                const isNaverFocused = e.naverRatio >= 50
                return (
                  <Link
                    key={e.value}
                    href={`/guide/channels/${e.value}`}
                    className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="font-bold text-gray-900 text-sm md:text-base leading-tight break-keep mb-1">
                      {e.label}
                    </div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium ${isNaverFocused ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>
                        {isNaverFocused ? "네이버 중심" : "글로벌 중심"}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:underline">
                      가이드 보기 <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
