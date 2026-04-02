'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, AlertCircle } from 'lucide-react'

interface Notice {
  id?: string | number
  title: string
  content: string
  created_at?: string
  importance?: 'high' | 'normal' | 'low'
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function NoticeCard({ notice }: { notice: Notice }) {
  const [expanded, setExpanded] = useState(false)
  const isHigh = notice.importance === 'high'
  const preview = notice.content.length > 120 ? notice.content.slice(0, 120) + '…' : notice.content

  return (
    <div
      className={`border rounded-xl p-4 md:p-5 bg-white transition-shadow hover:shadow-sm ${
        isHigh ? 'border-orange-300' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {isHigh ? (
          <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
        ) : (
          <Bell className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 truncate">{notice.title}</h3>
            {notice.created_at && (
              <span className="text-sm text-gray-400 flex-shrink-0">{formatDate(notice.created_at)}</span>
            )}
          </div>
          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
            {expanded ? notice.content : preview}
          </p>
          {notice.content.length > 120 && (
            <button
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '접기' : '더 보기'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    fetch(`${BACKEND}/api/notices`)
      .then((res) => {
        if (!res.ok) throw new Error('API error')
        return res.json()
      })
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setNotices(data as Notice[])
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-bold text-blue-600">AEOlab</span>
          </Link>
          <nav className="flex items-center gap-3 md:gap-6">
            <Link href="/faq" className="hidden sm:block text-base text-gray-600 hover:text-gray-900">
              FAQ
            </Link>
            <Link href="/pricing" className="hidden sm:block text-base text-gray-600 hover:text-gray-900">
              요금제
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">공지사항</h1>
          <p className="text-base md:text-lg text-gray-500">AEOlab 서비스 업데이트 및 공지를 확인하세요.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-base text-red-700">공지사항을 불러오는 중 오류가 발생했습니다.</p>
            <p className="text-sm text-red-500 mt-1">잠시 후 다시 시도해주세요.</p>
          </div>
        ) : notices.length === 0 ? (
          <div className="p-8 bg-white border border-gray-200 rounded-xl text-center">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-base text-gray-500">등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((notice, idx) => (
              <NoticeCard key={notice.id ?? idx} notice={notice} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
