'use client'

import { useState } from 'react'
import { exportReport, exportPdfReport, ApiError } from '@/lib/api'

interface ExportButtonProps {
  bizId: string
  userId: string
  plan: string
}

export function ExportButton({ bizId, userId, plan }: ExportButtonProps) {
  const [loadingCsv, setLoadingCsv] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)

  const isPro = ['pro', 'biz', 'startup', 'enterprise'].includes(plan)

  if (!isPro) {
    return (
      <div className="relative group">
        <button
          disabled
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
        >
          <span>내보내기</span>
          <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Pro</span>
        </button>
        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 w-52 bg-gray-900 text-white text-xs rounded-lg p-2 text-center">
          Pro 플랜(월 29,900원)부터 이용 가능합니다
        </div>
      </div>
    )
  }

  const handleCsv = async () => {
    setLoadingCsv(true)
    try { await exportReport(bizId, userId) }
    catch (e) { if (e instanceof ApiError) alert(e.message) }
    finally { setLoadingCsv(false) }
  }

  const handlePdf = async () => {
    setLoadingPdf(true)
    try { await exportPdfReport(bizId, userId) }
    catch (e) { if (e instanceof ApiError) alert(e.message) }
    finally { setLoadingPdf(false) }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCsv}
        disabled={loadingCsv}
        className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        {loadingCsv ? '다운로드 중...' : 'CSV'}
      </button>
      <button
        onClick={handlePdf}
        disabled={loadingPdf}
        className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
      >
        {loadingPdf ? '생성 중...' : 'PDF 리포트'}
      </button>
    </div>
  )
}
