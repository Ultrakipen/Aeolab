"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Search, X } from "lucide-react"
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="업종 이름으로 찾기 (예: 음식점, 미용실, 학원)"
          aria-label="업종 검색"
          className="w-full pl-9 pr-9 py-3 text-sm md:text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="검색어 지우기"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {query && (
        <p className="text-sm text-gray-500 mb-6">
          {totalMatches > 0 ? `"${query}" 검색 결과 ${totalMatches}건` : `"${query}"와 일치하는 업종이 없습니다. 가장 가까운 업종을 선택하거나 무료 진단에서 직접 입력해보세요.`}
        </p>
      )}

      {filteredGroups.map((g) => (
        <section key={g.group} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold border ${g.colorClass}`}>
              그룹 {g.group} — {g.label}
            </span>
            <span className="text-sm text-gray-500">{g.entries.length}개 업종</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {g.entries.map((e) => (
              <Link
                key={e.value}
                href={`/guide/channels/${e.value}`}
                className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="font-bold text-gray-900 text-sm md:text-base leading-tight break-keep mb-1">
                  {e.label}
                </div>
                <p className="text-sm text-gray-500 leading-snug break-keep mb-2">
                  네이버 {e.naverRatio}% · 글로벌 {e.globalRatio}%
                </p>
                <span className="text-sm font-medium text-blue-600 group-hover:underline">가이드 보기 →</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
