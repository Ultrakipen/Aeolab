'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface FAQItem {
  id?: string | number
  question: string
  answer: string
  category?: string
}

const DEFAULT_FAQS: FAQItem[] = [
  {
    id: 1,
    question: 'AEOlab이 무엇인가요?',
    answer: 'AEOlab은 소상공인을 위한 AI 검색 최적화 플랫폼입니다. 네이버 AI 브리핑, ChatGPT, Gemini 등 7개 AI에서 내 사업장이 얼마나 노출되는지 분석하고 개선 방법을 제공합니다.',
    category: '서비스 소개',
  },
  {
    id: 2,
    question: '무료로 사용할 수 있나요?',
    answer: '회원가입 없이 하루 3회 무료 체험 스캔이 가능합니다. 정기 스캔과 상세 분석은 월 9,900원 Basic 플랜부터 이용하실 수 있습니다.',
    category: '요금제',
  },
  {
    id: 3,
    question: '네이버 AI 브리핑이 무엇인가요?',
    answer: '네이버 검색 결과 상단에 AI가 자동으로 생성하는 요약 정보입니다. 여기에 내 사업장이 노출되면 클릭률이 27% 이상 향상됩니다.',
    category: '서비스 이해',
  },
  {
    id: 4,
    question: '스캔 결과는 얼마나 정확한가요?',
    answer: 'Gemini Flash로 10회 샘플링하여 통계적 노출 빈도를 측정합니다. 실제 AI 검색 결과를 직접 확인하므로 높은 정확도를 보장합니다.',
    category: '기술',
  },
  {
    id: 5,
    question: '경쟁사 분석은 어떻게 작동하나요?',
    answer: '카카오맵 데이터 기반으로 같은 지역·업종의 경쟁사를 검색하고, 내 사업장과 AI 노출 점수를 비교 분석합니다.',
    category: '기능',
  },
]

function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 md:p-5 text-left bg-white hover:bg-gray-50 transition-colors min-h-[52px]"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="text-base md:text-lg font-medium text-gray-900 pr-4">{item.question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 md:px-5 pb-4 md:pb-5 bg-gray-50 border-t border-gray-200">
          <p className="text-sm md:text-base text-gray-700 leading-relaxed pt-4">{item.answer}</p>
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>(DEFAULT_FAQS)
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    fetch(`${BACKEND}/api/faq`)
      .then((res) => {
        if (!res.ok) throw new Error('API error')
        return res.json()
      })
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) {
          setFaqs(data as FAQItem[])
        }
      })
      .catch(() => {
        // API 실패 시 기본 FAQ 유지
      })
      .finally(() => setLoading(false))
  }, [])

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-bold text-blue-600">AEOlab</span>
          </Link>
          <nav className="flex items-center gap-3 md:gap-6">
            <Link href="/pricing" className="hidden sm:block text-base text-gray-600 hover:text-gray-900">
              요금제
            </Link>
            <Link href="/notices" className="hidden sm:block text-base text-gray-600 hover:text-gray-900">
              공지사항
            </Link>
            <Link
              href="/trial"
              className="bg-blue-600 text-white text-sm md:text-base px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              무료 체험
            </Link>
          </nav>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="mb-6 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">자주 묻는 질문</h1>
          <p className="text-base md:text-lg text-gray-500">
            AEOlab 이용에 관한 궁금한 점을 확인하세요.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((item, idx) => (
              <AccordionItem
                key={item.id ?? idx}
                item={item}
                isOpen={openIndex === idx}
                onToggle={() => toggle(idx)}
              />
            ))}
          </div>
        )}

        <div className="mt-10 md:mt-12 p-4 md:p-6 bg-blue-50 border border-blue-200 rounded-xl text-center">
          <p className="text-base md:text-lg font-semibold text-blue-900 mb-2">
            더 궁금한 점이 있으신가요?
          </p>
          <p className="text-sm md:text-base text-blue-700 mb-4">
            먼저 무료 체험으로 AEOlab을 경험해보세요.
          </p>
          <Link
            href="/trial"
            className="inline-block bg-blue-600 text-white text-base font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            무료 체험 시작
          </Link>
        </div>
      </main>
    </div>
  )
}
