interface AIResult {
  platform: string
  mentioned: boolean
  rank?: number
  excerpt?: string
  exposure_freq?: number
  exposure_rate?: number
  in_briefing?: boolean
  in_ai_overview?: boolean
  error?: string
}

interface ResultTableProps {
  results: Record<string, AIResult>
}

const PLATFORM_LABELS: Record<string, string> = {
  gemini: 'Gemini AI',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  grok: 'Grok AI',
  naver: '네이버 AI 브리핑',
  claude: 'Claude AI',
  zeta: '뤼튼(Zeta)',
  google: 'Google AI Overview',
}

export function ResultTable({ results }: ResultTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-700">AI별 노출 결과</div>
        <div className="text-xs text-gray-400 mt-0.5">ChatGPT·네이버AI 등 각 AI에서 내 가게가 검색 결과에 나타났는지 확인합니다.</div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">AI 플랫폼</th>
            <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">노출 여부</th>
            <th className="text-left px-6 py-3 text-xs text-gray-500 font-medium">상세</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Object.entries(results).map(([key, result]) => (
            <tr key={key} className="hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">
                {PLATFORM_LABELS[key] ?? key}
              </td>
              <td className="px-6 py-4">
                {result.error ? (
                  <span className="text-gray-400 text-xs">오류</span>
                ) : result.mentioned ? (
                  <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                    <span>✓</span> 노출됨
                    {result.rank && <span className="text-xs text-gray-400 ml-1">{result.rank}위</span>}
                  </span>
                ) : (
                  <span className="text-gray-400">미노출</span>
                )}
              </td>
              <td className="px-6 py-4 text-gray-500 text-xs max-w-xs truncate">
                {key === 'gemini' && result.exposure_freq !== undefined
                  ? `100회 중 ${result.exposure_freq}회 노출`
                  : result.in_ai_overview
                  ? 'Google AI Overview에 포함'
                  : result.in_briefing
                  ? '네이버 AI 브리핑에 포함'
                  : result.excerpt
                  ? `"${result.excerpt}"`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
