interface AIResult {
  mentioned: boolean
  exposure_freq?: number
  in_briefing?: boolean
  in_ai_overview?: boolean
  error?: string
}

interface PlatformDistributionChartProps {
  results: Record<string, AIResult>
  naverChannelScore?: number
  globalChannelScore?: number
}

const NAVER_PLATFORMS: { key: string; label: string; color: string }[] = [
  { key: 'naver',  label: '네이버 AI 브리핑', color: '#03c75a' },
]

const GLOBAL_PLATFORMS: { key: string; label: string; color: string }[] = [
  { key: 'gemini',  label: 'Gemini AI',        color: '#4f46e5' },
  { key: 'chatgpt', label: 'ChatGPT',           color: '#10a37f' },
  { key: 'google',  label: 'Google AI Overview', color: '#ea4335' },
]

function PlatformRow({
  platform,
  result,
}: {
  platform: { key: string; label: string; color: string }
  result?: AIResult
}) {
  const mentioned    = result?.mentioned ?? false
  const inBriefing   = result?.in_briefing ?? false
  const inAiOverview = result?.in_ai_overview ?? false
  const exposureFreq = result?.exposure_freq
  const hasError     = !!result?.error

  // 네이버는 in_briefing 기준으로 별도 처리
  if (platform.key === 'naver') {
    const barWidth = inBriefing ? 100 : mentioned ? 50 : 0
    const barColor = inBriefing ? '#03c75a' : mentioned ? '#f59e0b' : 'transparent'
    const labelColor = inBriefing ? '#03c75a' : mentioned ? '#d97706' : undefined
    const statusText = inBriefing
      ? 'AI 브리핑 노출됨'
      : mentioned
      ? '검색만 노출'
      : '미노출'
    const statusClass = inBriefing
      ? 'text-sm font-semibold'
      : mentioned
      ? 'text-sm font-semibold text-amber-600'
      : 'text-sm text-gray-300'

    return (
      <div className="flex items-center gap-3">
        <div className="w-32 shrink-0 text-sm text-gray-600 font-medium truncate">
          {platform.label}
        </div>
        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
          {!hasError && (
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${barWidth}%`, backgroundColor: barColor }}
            />
          )}
        </div>
        <div className="w-20 text-right shrink-0">
          {hasError ? (
            <span className="text-sm text-gray-300">오류</span>
          ) : (
            <span className={statusClass} style={inBriefing ? { color: labelColor! } : undefined}>
              {statusText}
            </span>
          )}
        </div>
      </div>
    )
  }

  // 네이버 외 플랫폼 (기존 로직 유지)
  const barWidth = platform.key === 'gemini' && exposureFreq !== undefined
    ? Math.max(3, exposureFreq)
    : mentioned ? 100 : 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 text-sm text-gray-600 font-medium truncate">
        {platform.label}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        {!hasError && (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${barWidth}%`,
              backgroundColor: mentioned ? platform.color : 'transparent',
            }}
          />
        )}
      </div>
      <div className="w-20 text-right shrink-0">
        {hasError ? (
          <span className="text-sm text-gray-300">오류</span>
        ) : platform.key === 'gemini' && exposureFreq !== undefined ? (
          <span className={`text-sm font-semibold ${mentioned ? 'text-indigo-600' : 'text-gray-400'}`}>
            {exposureFreq}회/100
          </span>
        ) : mentioned ? (
          <span className="text-sm font-semibold" style={{ color: platform.color }}>
            노출됨{inAiOverview ? ' (AI Overview)' : ''}
          </span>
        ) : (
          <span className="text-sm text-gray-300">미노출</span>
        )}
      </div>
    </div>
  )
}

export function PlatformDistributionChart({
  results,
  naverChannelScore,
  globalChannelScore,
}: PlatformDistributionChartProps) {
  const naverMentionCount  = NAVER_PLATFORMS.filter(p => results[p.key]?.mentioned).length
  const globalMentionCount = GLOBAL_PLATFORMS.filter(p => results[p.key]?.mentioned).length

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-medium text-gray-700">AI 플랫폼별 노출 현황</div>
          <p className="text-sm text-gray-400 mt-0.5">
            네이버 생태계와 글로벌 AI 채널을 분리해 보여줍니다
          </p>
        </div>
        <div className="flex gap-3 text-sm text-gray-500">
          <span>
            노출 <strong className="text-gray-800">
              {naverMentionCount + globalMentionCount}
            </strong> / {NAVER_PLATFORMS.length + GLOBAL_PLATFORMS.length}
          </span>
        </div>
      </div>

      {/* 네이버 생태계 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm font-semibold text-gray-600">
            네이버 AI 생태계
            {naverChannelScore !== undefined && (
              <span className="ml-2 text-green-600">{naverChannelScore}점</span>
            )}
          </span>
        </div>
        <div className="space-y-2 pl-4">
          {NAVER_PLATFORMS.map((p) => (
            <PlatformRow key={p.key} platform={p} result={results[p.key]} />
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 my-3" />

      {/* 글로벌 AI 채널 */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-semibold text-gray-600">
            글로벌 AI 채널
            {globalChannelScore !== undefined && (
              <span className="ml-2 text-blue-600">{globalChannelScore}점</span>
            )}
          </span>
          <span className="text-sm text-gray-400 ml-1">
            (ChatGPT 한국 MAU 2,000만+ 대응)
          </span>
        </div>
        <div className="space-y-2 pl-4">
          {GLOBAL_PLATFORMS.map((p) => (
            <PlatformRow key={p.key} platform={p} result={results[p.key]} />
          ))}
        </div>
      </div>
    </div>
  )
}
