'use client'

import { useState } from 'react'

const TABS = [
  { id: 'competitor', label: '경쟁사 비교' },
  { id: 'ai', label: 'AI 채널 분석' },
  { id: 'detail', label: '상세 지표' },
  { id: 'guide', label: '가이드' },
]

interface DashboardTabsProps {
  tab1: React.ReactNode
  tab2: React.ReactNode
  tab3: React.ReactNode
  tab4: React.ReactNode
}

export default function DashboardTabs({ tab1, tab2, tab3, tab4 }: DashboardTabsProps) {
  const [active, setActive] = useState('competitor')

  const content: Record<string, React.ReactNode> = {
    competitor: tab1,
    ai: tab2,
    detail: tab3,
    guide: tab4,
  }

  return (
    <div>
      <div className="flex gap-0.5 border-b border-gray-200 mb-5 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              active === tab.id
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="space-y-5">
        {content[active]}
      </div>
    </div>
  )
}
