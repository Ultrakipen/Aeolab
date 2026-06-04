interface AIResult {
  platform?: string
  mentioned: boolean
  rank?: number
  excerpt?: string | null
  exposure_freq?: number
  exposure_rate?: number
  in_briefing?: boolean
  in_ai_overview?: boolean
  error?: string
  my_rank?: number
  naver_place_rank?: number
  blog_mentions?: number
  is_smart_place?: boolean
  // naver_ai_tab 전용 — null: 스캐너 P2 대기 중, boolean: 실측값
  _naver_ai_tab_visible?: boolean | null
  sample_size?: number
}

interface ResultTableProps {
  results: Record<string, AIResult>
  briefingEligibility?: "active" | "likely" | "inactive"
}

const GLOBAL_KEYS = new Set(['gemini', 'chatgpt', 'google'])

// 네이버 생태계 섹션 — 검색·AI브리핑·AI탭 3행 분리
function NaverSection({
  naver,
  aiTab,
  briefingEligibility,
}: {
  naver?: AIResult
  aiTab?: AIResult
  briefingEligibility?: "active" | "likely" | "inactive"
}) {
  if (!naver && !aiTab) return null

  const placeRank = naver ? (naver.my_rank ?? naver.naver_place_rank ?? naver.rank) : undefined
  const inSearch  = naver ? !!(naver.mentioned || placeRank) : false
  const inBrief   = naver?.in_briefing
  const aiTabVisible = aiTab?._naver_ai_tab_visible

  return (
    <>
      {/* 섹션 헤더 */}
      <tr>
        <td colSpan={3} className="px-4 md:px-6 py-2 bg-gray-50 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          네이버 AI 생태계
        </td>
      </tr>

      {/* ① 네이버 검색 */}
      {naver && (
        <tr className="hover:bg-gray-50">
          <td className="px-4 md:px-6 py-3 font-medium text-gray-800 text-sm">
            네이버 검색
          </td>
          <td className="px-4 md:px-6 py-3">
            {naver.error ? (
              <span className="text-gray-400 text-sm">오류</span>
            ) : inSearch ? (
              <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm">
                ✓ 검색 노출{placeRank ? ` (${placeRank}위)` : ''}
              </span>
            ) : (
              <span className="text-gray-500 text-sm">검색 미노출</span>
            )}
          </td>
          <td className="px-4 md:px-6 py-3">
            {naver.blog_mentions !== undefined ? (
              <span className="text-sm text-gray-500">
                블로그 언급 <strong className="text-gray-700">{naver.blog_mentions}건</strong>
              </span>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </td>
        </tr>
      )}

      {/* ② 네이버 AI 브리핑 */}
      {naver && (
        <tr className={`hover:bg-gray-50 ${inBrief ? 'bg-green-50/40' : ''}`}>
          <td className="px-4 md:px-6 py-3 font-medium text-gray-800 text-sm">
            네이버 AI 브리핑
          </td>
          <td className="px-4 md:px-6 py-3">
            {naver.error ? (
              <span className="text-gray-400 text-sm">오류</span>
            ) : inBrief ? (
              <span className="inline-flex items-center gap-1 bg-green-600 text-white text-sm px-2.5 py-0.5 rounded-full font-medium w-fit">
                🤖 브리핑 포함
              </span>
            ) : briefingEligibility === 'inactive' ? (
              <div className="space-y-1">
                <span className="text-gray-600 text-sm font-medium block">미지원 업종</span>
                <span className="text-gray-500 text-sm block">이 업종은 현재 AI 브리핑 대상이 아닙니다</span>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-amber-600 text-sm font-medium block">미포함</span>
                <span className="text-gray-500 text-sm block">소식·리뷰 응답으로 노출 확률 높아집니다</span>
              </div>
            )}
          </td>
          <td className="px-4 md:px-6 py-3">
            <span className="text-sm text-gray-400">—</span>
          </td>
        </tr>
      )}

      {/* ③ 네이버 AI탭 */}
      {aiTab && (
        <tr className={`hover:bg-gray-50 ${aiTabVisible === true ? 'bg-green-50/40' : ''}`}>
          <td className="px-4 md:px-6 py-3 font-medium text-gray-800 text-sm">
            네이버 AI탭
          </td>
          <td className="px-4 md:px-6 py-3">
            {aiTabVisible === null || aiTabVisible === undefined ? (
              <div className="space-y-1">
                <span className="text-gray-600 text-sm font-medium block">측정 예정 (6월+)</span>
                <span className="text-gray-500 text-sm block">네이버 AI탭 정식 출시 후 자동 측정됩니다</span>
              </div>
            ) : aiTabVisible ? (
              <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm">
                ✓ AI탭 노출됨
              </span>
            ) : (
              <span className="text-gray-500 text-sm">미노출</span>
            )}
          </td>
          <td className="px-4 md:px-6 py-3">
            {aiTabVisible && aiTab.excerpt ? (
              <span className="text-sm text-gray-500 truncate max-w-xs block">&ldquo;{aiTab.excerpt}&rdquo;</span>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// 글로벌 AI 채널 행
function GlobalRow({ platformKey, result }: { platformKey: string; result: AIResult }) {
  const LABELS: Record<string, string> = {
    gemini:  'Gemini AI',
    chatgpt: 'ChatGPT',
    google:  'Google AI Overview',
  }

  const statusCell = () => {
    if (result.error) return (
      platformKey === 'google'
        ? <span className="text-gray-400 text-sm">측정 보류</span>
        : <span className="text-gray-400 text-sm">오류</span>
    )
    if (!result.mentioned) return <span className="text-gray-500 text-sm">미노출</span>
    return (
      <div className="flex items-center flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm">
          ✓ 노출됨
          {result.rank && <span className="text-gray-500 ml-0.5 font-normal">{result.rank}위</span>}
        </span>
        {result.in_ai_overview && (
          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-sm px-2 py-0.5 rounded-full font-medium">
            AI Overview
          </span>
        )}
      </div>
    )
  }

  const detailCell = () => {
    if ((platformKey === 'gemini' || platformKey === 'chatgpt') && result.exposure_freq !== undefined) {
      const sampleSize = result.sample_size ?? 100
      return (
        <span className={`text-sm font-medium ${result.mentioned ? 'text-indigo-600' : 'text-gray-500'}`}>
          {sampleSize}회 중 {result.exposure_freq}회 노출
        </span>
      )
    }
    if (result.in_ai_overview) return <span className="text-sm text-gray-500">Google AI Overview에 포함</span>
    if (result.excerpt) return (
      <span className="text-sm text-gray-500 truncate max-w-xs block">&ldquo;{result.excerpt}&rdquo;</span>
    )
    return <span className="text-sm text-gray-400">—</span>
  }

  return (
    <tr className={`hover:bg-gray-50 ${result.mentioned ? 'bg-green-50/20' : ''}`}>
      <td className="px-4 md:px-6 py-3 font-medium text-gray-800 text-sm">
        {LABELS[platformKey] ?? platformKey}
      </td>
      <td className="px-4 md:px-6 py-3">{statusCell()}</td>
      <td className="px-4 md:px-6 py-3">{detailCell()}</td>
    </tr>
  )
}

export function ResultTable({ results, briefingEligibility }: ResultTableProps) {
  const globalEntries = Object.entries(results).filter(([k]) => GLOBAL_KEYS.has(k))
  const hasNaver = !!(results['naver'] || results['naver_ai_tab'])

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-800">AI별 노출 결과</div>
        <div className="text-sm text-gray-500 mt-0.5">
          각 AI 플랫폼에서 내 가게가 검색 결과에 나타나는지 확인합니다
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 md:px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wide w-[40%]">AI 플랫폼</th>
              <th className="text-left px-4 md:px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wide w-[35%]">노출 여부</th>
              <th className="text-left px-4 md:px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wide w-[25%]">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* 네이버 AI 생태계 */}
            {hasNaver && (
              <NaverSection
                naver={results['naver']}
                aiTab={results['naver_ai_tab']}
                briefingEligibility={briefingEligibility}
              />
            )}
            {/* 글로벌 AI 채널 */}
            {globalEntries.length > 0 && (
              <>
                <tr>
                  <td colSpan={3} className="px-4 md:px-6 py-2 bg-gray-50 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    글로벌 AI 채널
                  </td>
                </tr>
                {globalEntries.map(([key, result]) => (
                  <GlobalRow key={key} platformKey={key} result={result} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
