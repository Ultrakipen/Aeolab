'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight } from 'lucide-react'

// gap_analyzer.py _DIMENSION_LABELS 키와 일치해야 함
const DIMENSION_MESSAGES: Record<string, {
  reason: string
  action: string
  link: string
  linkLabel: string
}> = {
  keyword_gap_score: {
    reason: '업종 핵심 키워드가 부족해 AI 브리핑 조건 검색 노출이 안 됩니다',
    action: 'FAQ·소개글에 없는 키워드를 추가하면 AI 브리핑 노출이 올라갑니다',
    link: '/guide',
    linkLabel: '없는 키워드 확인하기',
  },
  review_quality: {
    reason: '리뷰 수나 키워드 다양성이 경쟁사보다 부족합니다',
    action: '리뷰 답변에 핵심 키워드를 포함시키면 됩니다',
    link: '/guide',
    linkLabel: '리뷰 답변 초안 보기',
  },
  smart_place_completeness: {
    reason: '스마트플레이스 정보가 부족해서 AI가 내 가게를 잘 모릅니다',
    action: '소개글 Q&A·소식을 추가하면 AI 브리핑 노출이 올라갑니다',
    link: '/guide',
    linkLabel: '소개글 편집하러 가기',
  },
  naver_exposure_confirmed: {
    reason: '네이버 AI 브리핑에 아직 가게가 나오지 않습니다',
    action: '소개글 하단에 Q&A 3개를 추가하는 것이 가장 빠른 방법입니다',
    link: '/guide',
    linkLabel: '소개글 Q&A 복사하러 가기',
  },
  multi_ai_exposure: {
    reason: 'ChatGPT·구글 AI에서 내 가게가 검색되지 않습니다',
    action: '구글 비즈니스 프로필 등록 + 네이버 블로그 소개 글이 가장 빠른 방법입니다',
    link: '/guide',
    linkLabel: '개선 가이드 보기',
  },
  schema_seo: {
    reason: '구글·ChatGPT가 가게 정보를 정확히 인식하지 못하고 있습니다',
    action: '가이드 탭의 AI 정보 코드를 가게 홈페이지에 추가하면 됩니다',
    link: '/schema',
    linkLabel: 'AI 정보 코드 생성하기',
  },
}

interface Dimension {
  dimension: string
  current_score: number
  max_score: number
  gap: number
  gap_reason: string
  priority: number
}

interface Props {
  bizId: string
  token: string
  initialDimensions?: Dimension[]
}

export default function TopPriorityActionCard({ bizId, token, initialDimensions }: Props) {
  const [topDimension, setTopDimension] = useState<Dimension | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const key = `top_action_dismissed_${bizId}`
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(key) === today) {
      setDismissed(true)
      setLoading(false)
      return
    }

    // initialDimensions prop이 있으면 API 재호출 불필요
    if (initialDimensions && initialDimensions.length > 0) {
      const sorted = [...initialDimensions].sort((a, b) => b.gap - a.gap)
      setTopDimension(sorted[0])
      setLoading(false)
      return
    }

    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    fetch(`${BACKEND}/api/report/gap/${bizId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.dimensions?.length > 0) {
          const sorted = [...data.dimensions].sort(
            (a: Dimension, b: Dimension) => b.gap - a.gap
          )
          setTopDimension(sorted[0])
        }

      })
      .catch((e) => { console.warn('[TopPriority]', e); setError(true) })
      .finally(() => setLoading(false))
  }, [bizId, token, initialDimensions])

  const handleDismiss = () => {
    const key = `top_action_dismissed_${bizId}`
    const today2 = new Date().toISOString().slice(0, 10)
    localStorage.setItem(key, today2)
    setDismissed(true)
  }

  if (dismissed) return null

  if (loading) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-5 animate-pulse">
        <div className="h-4 bg-amber-200 rounded w-1/3 mb-2" />
        <div className="h-5 bg-amber-200 rounded w-2/3 mb-1" />
        <div className="h-4 bg-amber-100 rounded w-1/2" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-gray-400 shrink-0" />
        <p className="text-sm text-gray-500">개선 분석 정보를 가져올 수 없습니다. 새로고침해 주세요.</p>
      </div>
    )
  }

  if (!topDimension) return null

  const msg = DIMENSION_MESSAGES[topDimension.dimension] ?? {
    reason: topDimension.gap_reason || 'AI 노출 점수를 높일 수 있습니다',
    action: '개선 가이드에서 방법을 확인하세요',
    link: '/guide',
    linkLabel: '가이드 보기',
  }

  const _max = Number(topDimension.max_score)
  const _gap = Number(topDimension.gap)

  const improvablePoints = (_gap > 0) ? Math.round(_gap) : null

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 md:p-5">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          <AlertCircle className="w-6 h-6 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900 mb-1">
            지금 AI 브리핑에 잘 안 나오는 이유
          </p>
          <p className="text-base font-semibold text-amber-800 mb-1">{msg.reason}</p>
          <p className="text-sm text-amber-700 mb-3">{msg.action}</p>



          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={msg.link}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              {msg.linkLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={handleDismiss}
              className="text-xs text-amber-600 underline hover:text-amber-800"
            >
              오늘 하루 숨기기
            </button>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {improvablePoints != null ? (
            <>
              <p className="text-xs text-amber-600">개선 여지</p>
              <p className="text-2xl font-bold text-amber-700 leading-tight mt-0.5">
                +{improvablePoints}점
              </p>
            </>
          ) : (
            <p className="text-xs text-amber-600">개선 가능</p>
          )}
        </div>
      </div>
    </div>
  )
}
