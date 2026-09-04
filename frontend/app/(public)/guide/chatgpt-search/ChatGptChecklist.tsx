"use client"

import { useState, useEffect } from "react"

const STORAGE_KEY = "aeolab.chatgpt_checklist"

interface ChecklistItem {
  id: string
  label: string
}

interface Props {
  items: ChecklistItem[]
}

export function ChatGptChecklist({ items }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  // localStorage에서 초기값 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setChecked(JSON.parse(saved) as Record<string, boolean>)
    } catch {
      // localStorage 미지원 환경 무시
    }
  }, [])

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
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

      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="checkbox"
          aria-checked={checked[item.id] ?? false}
          onClick={() => toggle(item.id)}
          className={`w-full flex items-center gap-3 rounded-xl border p-3 md:p-4 text-left transition-colors ${
            checked[item.id]
              ? "bg-green-50 border-green-300 text-green-800"
              : "bg-white border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300"
          }`}
        >
          <span
            className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              checked[item.id]
                ? "bg-green-700 border-green-500 text-white"
                : "bg-white border-gray-400"
            }`}
          >
            {checked[item.id] && (
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <span className="text-sm md:text-base font-medium">{item.label}</span>
        </button>
      ))}

      {doneCount === items.length && (
        <div className="mt-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-center">
          <p className="text-sm md:text-base font-semibold text-green-800">
            모든 항목 완료! 실사용자 ChatGPT 웹검색 노출 준비가 되었습니다.
          </p>
          <p className="text-sm text-green-700 mt-1">
            ※ AEOlab 대시보드의 ChatGPT 점수는 모델 재학습 주기에 따라 별도로 움직이며, 이 체크리스트와는 무관합니다.
          </p>
        </div>
      )}
    </div>
  )
}
