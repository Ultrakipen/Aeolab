interface AIResult {
  mentioned: boolean
  exposure_freq?: number
  sample_size?: number
  in_briefing?: boolean
  in_ai_overview?: boolean
  _naver_ai_tab_visible?: boolean | null
  error?: string
}

interface PlatformDistributionChartProps {
  results: Record<string, AIResult>
  naverChannelScore?: number
  globalChannelScore?: number
  briefingEligibility?: "active" | "likely" | "inactive"
}

const NAVER_PLATFORMS: { key: string; label: string; color: string }[] = [
  { key: 'naver',        label: '네이버 AI 브리핑',            color: '#03c75a' },
  { key: 'naver_ai_tab', label: '네이버 AI탭', color: '#0ea5e9' },
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
      ? 'AI 브리핑 미선정'
      : '미노출'
    const statusClass = inBriefing
      ? 'text-sm font-semibold'
      : mentioned
      ? 'text-sm font-semibold text-amber-700'
      : 'text-sm text-gray-300'

    return (
      <div className="flex items-center gap-3">
        <div className="w-36 shrink-0 text-sm text-gray-600 font-medium truncate">
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

  // AI탭 처리 (모든 업종 해당, 베타)
  if (platform.key === 'naver_ai_tab') {
    const tabVisible = result?._naver_ai_tab_visible
    const barWidth = tabVisible === true ? 100 : 0
    const statusText = tabVisible === true
      ? 'AI탭 노출됨'
      : tabVisible === false
      ? '미노출'
      : '측정 예정'
    const statusClass = tabVisible === true
      ? 'text-sm font-semibold'
      : tabVisible === null || tabVisible === undefined
      ? 'text-sm text-amber-700'
      : 'text-sm text-gray-300'
    const barColor = tabVisible === true ? '#0ea5e9' : 'transparent'

    return (
      <div className="flex items-center gap-3">
        <div className="w-36 shrink-0 text-sm text-gray-600 font-medium truncate">
          {platform.label}
        </div>
        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barWidth}%`, backgroundColor: barColor }}
          />
        </div>
        <div className="w-20 text-right shrink-0">
          <span
            className={statusClass}
            style={tabVisible === true ? { color: '#0ea5e9' } : undefined}
          >
            {statusText}
          </span>
        </div>
      </div>
    )
  }

  // 네이버 외 플랫폼 (기존 로직 유지)
  const sampleSize = result?.sample_size ?? 100
  const barWidth = platform.key === 'gemini' && exposureFreq !== undefined
    ? Math.max(sampleSize > 0 && exposureFreq > 0 ? 3 : 0, Math.round(exposureFreq / sampleSize * 100))
    : mentioned ? 100 : 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0 text-sm text-gray-600 font-medium truncate">
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
          platform.key === 'google' ? (
            <span className="text-sm text-gray-600">측정 보류</span>
          ) : (
            <span className="text-sm text-gray-300">오류</span>
          )
        ) : platform.key === 'gemini' && exposureFreq !== undefined ? (
          <span className={`text-sm font-semibold ${mentioned ? 'text-indigo-600' : 'text-gray-600'}`}>
            {exposureFreq}회/{sampleSize}
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
  briefingEligibility,
}: PlatformDistributionChartProps) {
  const isNaverInactive = briefingEligibility === "inactive"
  const aiTabMentioned = results['naver_ai_tab']?._naver_ai_tab_visible === true
  const briefingMentionCount = isNaverInactive ? 0 : (results['naver']?.mentioned ? 1 : 0)
  const naverMentionCount = briefingMentionCount + (aiTabMentioned ? 1 : 0)
  const globalMentionCount = GLOBAL_PLATFORMS.filter(p => results[p.key]?.mentioned).length
  const briefingPlatformCount = isNaverInactive ? 0 : 1  // AI 브리핑
  const aiTabPlatformCount = 1  // AI탭은 항상 포함
  const totalPlatforms = briefingPlatformCount + aiTabPlatformCount + GLOBAL_PLATFORMS.length

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-medium text-gray-700">AI 플랫폼별 노출 현황</div>
          <p className="text-sm text-gray-600 mt-0.5">
            네이버 생태계와 글로벌 AI 채널을 분리해 보여줍니다
          </p>
        </div>
        <div className="flex gap-3 text-sm text-gray-600">
          <span>
            노출 <strong className="text-gray-800">
              {naverMentionCount + globalMentionCount}
            </strong> / {totalPlatforms}
          </span>
        </div>
      </div>

      {/* 네이버 생태계 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm font-semibold text-gray-600">
            네이버 AI 생태계
          </span>
        </div>
        <div className="space-y-2 pl-4">
          {isNaverInactive ? (() => {
            // 플레이스형(가게 카드 요약형)만 이 업종 미대상 — 정보형(블로그·콘텐츠 출처 멀티출처형)은
            // 업종 제한이 없어 실측 노출될 수 있음. scoreLabels.ts briefingTile()과 동일 문구로 통일.
            const infoTypeExposed = results['naver']?.in_briefing === true
            return (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-36 shrink-0 text-sm text-gray-600 font-medium truncate">
                    네이버 AI 브리핑
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    {infoTypeExposed && (
                      <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: '100%' }} />
                    )}
                  </div>
                  <div className="w-20 text-right shrink-0">
                    {infoTypeExposed ? (
                      <span className="text-sm font-semibold text-green-700">정보형 노출 중</span>
                    ) : (
                      <span className="text-sm text-gray-600">플레이스형 해당 없음</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 pl-1">
                  {infoTypeExposed
                    ? '→ 블로그·콘텐츠 기반 정보형 AI 브리핑에 노출 중입니다 (가게 카드형은 이 업종 미대상)'
                    : '→ 블로그·콘텐츠로 정보형 AI 브리핑 노출 가능 · 네이버 일반 검색 상위노출(C-Rank · 리뷰·소식 최적화) 집중 권장'}
                </p>
                <PlatformRow
                  platform={{ key: 'naver_ai_tab', label: '네이버 AI탭', color: '#0ea5e9' }}
                  result={results['naver_ai_tab']}
                />
              </>
            )
          })() : (
            NAVER_PLATFORMS.map((p) => (
              <PlatformRow key={p.key} platform={p} result={results[p.key]} />
            ))
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 my-3" />

      {/* 글로벌 AI 채널 */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm font-semibold text-gray-600">
            글로벌 AI 채널
          </span>
          <span className="text-sm text-gray-600 ml-1">
            (ChatGPT 한국 MAU 2,000만+ 대응)
          </span>
        </div>
        <div className="space-y-2 pl-4">
          {GLOBAL_PLATFORMS.map((p) => {
            const result = results[p.key]
            const isMentioned = result?.mentioned ?? false
            const hasError = !!result?.error

            // 수정 C: 미노출 시 채널별 성격 라벨 추가 — 3개 채널 모두 표시해 경계를 대칭적으로 명확화
            // (Gemini만/ChatGPT만 있고 Google만 없으면 바로 위 힌트가 Google 것으로 오인되기 쉬움, 2026-07-14)
            const showChannelHint = !isMentioned && !hasError
            const channelHint = p.key === 'gemini'
              ? '구글 비즈니스 등록 시 개선 가능'
              : p.key === 'chatgpt'
              ? '학습 데이터 기반 · 단기 개선 어려움'
              : '실시간 검색 기반 · 웹사이트 SEO 개선 시 반영'

            return (
              <div key={p.key}>
                <PlatformRow platform={p} result={result} />
                {showChannelHint && channelHint && (
                  <div className="pl-[140px] mt-0.5 mb-0.5">
                    <span className="text-sm">
                      <span className="font-medium" style={{ color: p.color }}>{p.label}</span>
                      <span className="text-gray-600"> — {channelHint}</span>
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 수정 D: 글로벌 채널 전체 미노출 시 안내 박스 */}
        {(() => {
          const chatgptNotExposed = !(results['chatgpt']?.mentioned)
          const geminiNotExposed  = !(results['gemini']?.mentioned)
          const googleNotExposed  = !(results['google']?.mentioned) || !!results['google']?.error
          if (chatgptNotExposed && geminiNotExposed && googleNotExposed) {
            return (
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-sm text-blue-800 leading-relaxed">
                  3개 채널 모두 미노출은 한국 소상공인의 일반적인 현재 상태입니다.<br />
                  Gemini는 구글 비즈니스 프로필 등록 후 수주 내 개선 가능합니다.<br />
                  ChatGPT는 학습 데이터 기반으로 단기 개선이 어렵습니다.<br />
                  Google AI Overview는 실시간 검색 기반이라 웹사이트 SEO 개선이 반영되면 비교적 빠르게 변화합니다.
                </p>
              </div>
            )
          }
          return null
        })()}
      </div>
    </div>
  )
}
