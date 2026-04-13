import Link from 'next/link'
import { WebsiteCheckResult } from '@/types'

interface WebsiteCheckCardProps {
  websiteUrl?: string
  checkResult?: WebsiteCheckResult | null
}

interface CheckItem {
  label: string
  ok: boolean
  impact: 'high' | 'medium' | 'low'
  tip: string
}

export function WebsiteCheckCard({ websiteUrl, checkResult }: WebsiteCheckCardProps) {
  if (!websiteUrl) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-dashed border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-1">웹사이트 AI 인식 점검</div>
        <p className="text-sm text-gray-400 mb-4">
          독립 웹사이트가 없으면 ChatGPT·Perplexity에서 인용되기 어렵습니다.
          네이버는 AI 크롤링을 차단하고 있어, 글로벌 AI는 독립 웹사이트를 소스로 사용합니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <a
            href="https://imweb.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-center bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl py-2.5 px-3 transition-colors"
          >
            아임웹으로 웹사이트 만들기 →
          </a>
          <Link
            href="/schema"
            className="text-sm text-center bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl py-2.5 px-3 transition-colors"
          >
            AI 검색 등록 →
          </Link>
        </div>
      </div>
    )
  }

  if (!checkResult) return null

  if (checkResult.error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-sm font-medium text-gray-700 mb-1">웹사이트 AI 인식 점검</div>
        <p className="text-sm text-red-400">{checkResult.error} — 사이트 접속 후 재스캔하세요.</p>
      </div>
    )
  }

  const items: CheckItem[] = [
    {
      label: 'HTTPS (보안 연결)',
      ok: checkResult.is_https,
      impact: 'high',
      tip: 'HTTP 사이트는 AI 크롤러가 우선순위를 낮게 처리합니다.',
    },
    {
      label: 'AI 인식 정보 코드',
      ok: checkResult.has_json_ld,
      impact: 'high',
      tip: 'AI가 내 가게 정보를 정확히 읽어가는 핵심 항목입니다.',
    },
    {
      label: '가게 유형 정보 등록',
      ok: checkResult.has_schema_local_business,
      impact: 'high',
      tip: '가게 유형 정보를 등록하면 AI 노출 확률이 높아집니다.',
    },
    {
      label: 'SNS 공유 설정',
      ok: checkResult.has_open_graph,
      impact: 'medium',
      tip: 'SNS 공유 시 썸네일·설명이 표시되어 브랜드 인지도를 높입니다.',
    },
    {
      label: '모바일 최적화 (viewport)',
      ok: checkResult.is_mobile_friendly,
      impact: 'medium',
      tip: '모바일 사용자 비율이 80%+ — 미설정 시 검색 순위에 불이익.',
    },
    {
      label: 'favicon 설정',
      ok: checkResult.has_favicon,
      impact: 'low',
      tip: '브랜드 신뢰도와 북마크 인식률에 영향을 줍니다.',
    },
  ]

  const passCount = items.filter((i) => i.ok).length
  const failCount = items.length - passCount
  const highFailCount = items.filter((i) => !i.ok && i.impact === 'high').length

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm font-medium text-gray-700">웹사이트 AI 인식 점검</div>
          {checkResult.title && (
            <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{checkResult.title}</p>
          )}
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${passCount >= 5 ? 'text-green-600' : passCount >= 3 ? 'text-amber-600' : 'text-red-500'}`}>
            {passCount}/{items.length}
          </div>
          <div className="text-sm text-gray-400">통과</div>
        </div>
      </div>

      {highFailCount > 0 && (
        <div className="bg-red-50 rounded-xl px-3 py-2 mb-3 text-sm text-red-600">
          중요 항목 {highFailCount}개 미흡 — ChatGPT·Perplexity 인용 가능성이 낮습니다
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2.5">
            <span className={`mt-0.5 shrink-0 text-sm ${item.ok ? 'text-green-500' : item.impact === 'high' ? 'text-red-400' : 'text-gray-300'}`}>
              {item.ok ? '✓' : '✕'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-sm font-medium ${item.ok ? 'text-gray-700' : 'text-gray-500'}`}>
                  {item.label}
                </span>
                {!item.ok && item.impact === 'high' && (
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">중요</span>
                )}
              </div>
              {!item.ok && (
                <p className="text-sm text-gray-400 mt-0.5">{item.tip}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {failCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
          {!checkResult.has_json_ld && (
            <Link
              href="/schema"
              className="flex-1 text-center text-sm bg-blue-600 text-white rounded-xl py-2.5 hover:bg-blue-700 transition-colors font-medium"
            >
              AI 검색 등록 →
            </Link>
          )}
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm bg-gray-100 text-gray-700 rounded-xl py-2.5 hover:bg-gray-200 transition-colors"
          >
            사이트 직접 확인
          </a>
        </div>
      )}
    </div>
  )
}
