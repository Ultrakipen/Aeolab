interface AIResult {
  platform?: string
  mentioned: boolean
  rank?: number
  excerpt?: string
  exposure_freq?: number
  exposure_rate?: number
  in_briefing?: boolean
  in_ai_overview?: boolean
  error?: string
  // 네이버 전용 — API 기반 (Playwright 실패와 무관하게 신뢰 가능)
  my_rank?: number
  naver_place_rank?: number
  blog_mentions?: number
  is_smart_place?: boolean
}

interface ResultTableProps {
  results: Record<string, AIResult>
}

const NAVER_KEYS  = new Set(['naver'])
const GLOBAL_KEYS = new Set(['gemini', 'chatgpt', 'google'])

const PLATFORM_LABELS: Record<string, string> = {
  gemini:     'Gemini AI',
  chatgpt:    'ChatGPT',
  naver:      '네이버 AI 브리핑',
  google:     'Google AI Overview',
}

function StatusBadge({ result, platformKey }: { result: AIResult; platformKey: string }) {
  if (result.error) {
    return <span className="text-gray-400 text-sm">오류</span>
  }

  // 네이버 전용: 검색 결과 노출 + AI 브리핑 분리 표시
  if (platformKey === 'naver') {
    const placeRank = result.my_rank ?? result.naver_place_rank ?? result.rank
    const inSearch  = result.mentioned || !!placeRank
    const inBrief   = result.in_briefing

    if (!inSearch && !inBrief) {
      return (
        <div className="space-y-0.5">
          <span className="text-gray-400 text-sm block">검색 미노출</span>
          <span className="text-gray-300 text-sm block">AI 브리핑 미포함</span>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-1">
        {inSearch ? (
          <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm">
            ✓ 검색 노출{placeRank ? ` (${placeRank}위)` : ''}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">검색 미노출</span>
        )}
        {inBrief ? (
          <span className="inline-flex items-center gap-1 bg-green-600 text-white text-sm px-2 py-0.5 rounded-full font-medium w-fit">
            🤖 AI 브리핑 포함
          </span>
        ) : (
          <span className="text-gray-400 text-sm">AI 브리핑 미포함</span>
        )}
      </div>
    )
  }

  if (!result.mentioned) {
    return <span className="text-gray-400 text-sm">미노출</span>
  }
  return (
    <div className="flex items-center flex-wrap gap-1.5">
      <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm">
        <span>✓</span> 노출됨
        {result.rank && <span className="text-gray-400 ml-0.5">{result.rank}위</span>}
      </span>
      {result.in_briefing && (
        <span className="inline-flex items-center gap-1 bg-green-600 text-white text-sm px-2 py-0.5 rounded-full font-medium">
          AI 브리핑 포함
        </span>
      )}
      {result.in_ai_overview && (
        <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-sm px-2 py-0.5 rounded-full font-medium">
          AI Overview
        </span>
      )}
    </div>
  )
}

function DetailCell({ result, platformKey }: { result: AIResult; platformKey: string }) {
  if (platformKey === 'gemini' && result.exposure_freq !== undefined) {
    return (
      <span className={`text-sm font-medium ${result.mentioned ? 'text-indigo-600' : 'text-gray-400'}`}>
        100회 중 {result.exposure_freq}회 노출
        {result.exposure_freq > 0 && (
          <span className="text-gray-400 ml-1">({result.exposure_freq}%)</span>
        )}
      </span>
    )
  }
  if (result.in_ai_overview) return <span className="text-sm text-gray-500">Google AI Overview에 포함</span>
  if (platformKey === 'naver' && result.blog_mentions !== undefined) {
    return (
      <span className="text-sm text-gray-500">
        블로그 언급 <strong className="text-gray-700">{result.blog_mentions}건</strong>
      </span>
    )
  }
  if (result.in_briefing)    return <span className="text-sm text-gray-500">네이버 AI 브리핑에 포함</span>
  if (result.excerpt)        return <span className="text-sm text-gray-500 truncate max-w-xs block">&ldquo;{result.excerpt}&rdquo;</span>
  return <span className="text-sm text-gray-300">—</span>
}

export function ResultTable({ results }: ResultTableProps) {
  const naverEntries  = Object.entries(results).filter(([k]) => NAVER_KEYS.has(k))
  const globalEntries = Object.entries(results).filter(([k]) => GLOBAL_KEYS.has(k))

  const renderRows = (entries: [string, AIResult][]) =>
    entries.map(([key, result]) => (
      <tr key={key} className={`hover:bg-gray-50 ${result.mentioned && result.in_briefing ? 'bg-green-50/40' : ''}`}>
        <td className="px-4 md:px-6 py-3 font-medium text-gray-900 text-sm">
          {PLATFORM_LABELS[key] ?? key}
        </td>
        <td className="px-4 md:px-6 py-3">
          <StatusBadge result={result} platformKey={key} />
        </td>
        <td className="px-4 md:px-6 py-3">
          <DetailCell result={result} platformKey={key} />
        </td>
      </tr>
    ))

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-700">AI별 노출 결과</div>
        <div className="text-sm text-gray-400 mt-0.5">
          ChatGPT·네이버AI 등 각 AI에서 내 가게가 검색 결과에 나타났는지 확인합니다.
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium">AI 플랫폼</th>
            <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium">노출 여부</th>
            <th className="text-left px-4 md:px-6 py-3 text-sm text-gray-500 font-medium">상세</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {/* 네이버 생태계 */}
          {naverEntries.length > 0 && (
            <>
              <tr>
                <td colSpan={3} className="px-4 md:px-6 py-2 bg-gray-50 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  네이버 AI 생태계
                </td>
              </tr>
              {renderRows(naverEntries)}
            </>
          )}
          {/* 글로벌 AI 채널 */}
          {globalEntries.length > 0 && (
            <>
              <tr>
                <td colSpan={3} className="px-4 md:px-6 py-2 bg-gray-50 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  글로벌 AI 채널
                </td>
              </tr>
              {renderRows(globalEntries)}
            </>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
