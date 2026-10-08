'use client'

import { useState } from 'react'
import { exportReport, exportPdfReport, ApiError } from '@/lib/api'
import { getSafeSession } from '@/lib/supabase/client'
import { PLAN_PRICES } from '@/lib/plans'

interface ExportButtonProps {
  bizId: string
  userId: string
  plan: string
}

// 엑셀 파일: basic+ 이상 가능 (v3.4: Basic에 포함)
// PDF: pro+ 이상 가능
const EXCEL_PLANS  = ['basic', 'startup', 'pro', 'biz', 'enterprise']
const PDF_PLANS  = ['pro', 'biz', 'enterprise']

export function ExportButton({ bizId, userId, plan }: ExportButtonProps) {
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)

  const canExcel = EXCEL_PLANS.includes(plan)
  const canPdf = PDF_PLANS.includes(plan)

  // 둘 다 불가능한 플랜 (free)
  if (!canExcel && !canPdf) {
    return (
      <div className="relative group">
        <button
          disabled
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed"
        >
          <span>내보내기</span>
          <span className="text-sm bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Basic+</span>
        </button>
        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 w-56 bg-gray-900 text-white text-sm rounded-lg p-2 text-center">
          Basic(월 {PLAN_PRICES.basic.toLocaleString()}원)부터 엑셀 파일 내보내기,
          Pro 플랜(월 {PLAN_PRICES.pro.toLocaleString()}원)부터 PDF 리포트 이용 가능합니다
        </div>
      </div>
    )
  }

  const getToken = async (): Promise<string | null> => {
    const session = await getSafeSession()
    return session?.access_token ?? null
  }

  const handleExcel = async () => {
    setLoadingExcel(true)
    try {
      const token = await getToken()
      await exportReport(bizId, userId, token ?? undefined)
    } catch (e) {
      if (e instanceof ApiError) alert(e.message)
    } finally {
      setLoadingExcel(false)
    }
  }

  const handlePdf = async () => {
    setLoadingPdf(true)
    try {
      const token = await getToken()
      await exportPdfReport(bizId, userId, token ?? undefined)
    } catch (e) {
      if (e instanceof ApiError) alert(e.message)
    } finally {
      setLoadingPdf(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* 엑셀 파일 버튼: basic+ */}
      {canExcel ? (
        <button
          onClick={handleExcel}
          disabled={loadingExcel}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {loadingExcel ? '다운로드 중...' : '엑셀 파일'}
        </button>
      ) : (
        <div className="relative group">
          <button
            disabled
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <span>엑셀 파일</span>
            <span className="text-sm bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded whitespace-nowrap">Basic+</span>
          </button>
          <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 w-48 bg-gray-900 text-white text-sm rounded-lg p-2 text-center">
            Basic(월 {PLAN_PRICES.basic.toLocaleString()}원)부터 이용 가능합니다
          </div>

        </div>
      )}

      {/* PDF 버튼: pro+ */}
      {canPdf ? (
        <button
          onClick={handlePdf}
          disabled={loadingPdf}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {loadingPdf ? '생성 중...' : 'PDF 리포트'}
        </button>
      ) : (
        <div className="relative group">
          <button
            disabled
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <span>PDF 리포트</span>
            <span className="text-sm bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded whitespace-nowrap">Pro+</span>
          </button>
          <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 w-48 bg-gray-900 text-white text-sm rounded-lg p-2 text-center">
            Pro 플랜(월 {PLAN_PRICES.pro.toLocaleString()}원)부터 이용 가능합니다
          </div>
        </div>
      )}
    </div>
  )
}
