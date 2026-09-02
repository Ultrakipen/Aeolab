"use client"

import { useState, useEffect } from "react"

interface ChecklistItem {
  id: string
  label: string
}

interface Props {
  storageKey: string
  items: ChecklistItem[]
}

export function ActionChecklist({ storageKey, items }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  // localStorage에서 초기값 로드 (업종별 키로 분리 저장)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setChecked(JSON.parse(saved) as Record<string, boolean>)
    } catch {
      // localStorage 미지원 환경 무시
    }
  }, [storageKey])

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // 저장 실패 무시
      }
      return next
    })
  }

  const doneCount = items.filter((item) => checked[item.id]).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-2 bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-gray-700 shrink-0">
          {doneCount}/{items.length}
        </span>
      </div>

      {items.map((item, idx) => (
        <button
          key={item.id}
          type="button"
          role="checkbox"
          aria-checked={checked[item.id] ?? false}
          onClick={() => toggle(item.id)}
          className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
            checked[item.id]
              ? "bg-green-50 border-green-300"
              : "bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300"
          }`}
        >
          <span
            className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-colors ${
              checked[item.id]
                ? "bg-green-500 border-green-500 text-white"
                : "bg-blue-100 border-blue-100 text-blue-700"
            }`}
          >
            {checked[item.id] ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              idx + 1
            )}
          </span>
          <span
            className={`text-sm md:text-base font-medium leading-relaxed break-keep mt-0.5 ${
              checked[item.id] ? "text-green-800" : "text-gray-800"
            }`}
          >
            {item.label}
          </span>
        </button>
      ))}

      {doneCount === items.length && (
        <div className="mt-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-center">
          <p className="text-sm md:text-base font-semibold text-green-800">
            5가지 모두 완료! AI 노출 준비가 되었습니다.
          </p>
        </div>
      )}
    </div>
  )
}
