'use client'

import { useRef, useState } from 'react'
import { ChevronDown, BarChart2, Users, Wrench } from 'lucide-react'

interface DashboardAccordionProps {
  tab1Content: React.ReactNode
  tab2Content: React.ReactNode
  tab3Content: React.ReactNode
}

const SECTIONS = [
  {
    id: 'score',
    label: '내 점수 분석',
    desc: '네이버·ChatGPT·Gemini AI 채널별 노출 결과',
    icon: BarChart2,
    color: 'text-blue-600 bg-blue-50',
    activeBar: 'border-l-4 border-blue-500',
  },
  {
    id: 'competitor',
    label: '경쟁사 비교',
    desc: '경쟁 순위 · 키워드 격차 · FAQ 갭',
    icon: Users,
    color: 'text-orange-600 bg-orange-50',
    activeBar: 'border-l-4 border-orange-500',
  },
  {
    id: 'improve',
    label: '내 가게 개선하기',
    desc: '스마트플레이스 · 카카오맵 · 웹사이트 점검',
    icon: Wrench,
    color: 'text-emerald-600 bg-emerald-50',
    activeBar: 'border-l-4 border-emerald-500',
  },
]

export default function DashboardAccordion({ tab1Content, tab2Content, tab3Content }: DashboardAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const contentMap: Record<string, React.ReactNode> = {
    score:      tab1Content,
    competitor: tab2Content,
    improve:    tab3Content,
  }

  function handleToggle(sectionId: string, isOpen: boolean) {
    if (isOpen) {
      setOpenId(null)
    } else {
      setOpenId(sectionId)
      requestAnimationFrame(() => {
        sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <h2 className="text-lg font-bold text-gray-900">더 자세히 보기</h2>
        <span className="text-sm text-white bg-blue-500 rounded-full px-2 py-0.5 font-medium">탭을 눌러 펼치기</span>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-2">
        {SECTIONS.map((section) => {
          const isOpen = openId === section.id
          const Icon = section.icon
          return (
            <div
              key={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el }}
              className={[
                "rounded-xl border transition-all duration-200",
                isOpen
                  ? "border-gray-300 shadow-sm"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-sm",
              ].join(" ")}
            >
              <button
                onClick={() => handleToggle(section.id, isOpen)}
                aria-expanded={isOpen}
                aria-controls={`${section.id}-panel`}
                className={[
                  "w-full flex items-center justify-between px-4 py-4 transition-colors text-left rounded-xl",
                  isOpen ? "bg-gray-50 rounded-b-none" : "bg-white hover:bg-gray-50",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <span className={["p-2 rounded-lg", section.color].join(" ")}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-gray-800">{section.label}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{section.desc}</p>
                  </div>
                </div>
                <span className={[
                  "flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full transition-colors shrink-0 ml-2",
                  isOpen
                    ? "bg-gray-200 text-gray-600"
                    : "bg-blue-50 text-blue-600",
                ].join(" ")}>
                  <ChevronDown className={["w-3.5 h-3.5 transition-transform duration-200", isOpen ? "rotate-180" : ""].join(" ")} />
                  {isOpen ? "닫기" : "펼치기"}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-gray-100">
                  <div id={`${section.id}-panel`} className={["px-5 pb-5 bg-gray-50/30 rounded-b-xl", section.activeBar].join(" ")}>
                    <div className="pt-4">
                      {contentMap[section.id]}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
