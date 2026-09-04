interface ChannelScoreCardsProps {
  naverScore: number
  globalScore: number
  isSmartPlace?: boolean
  isOnKakao?: boolean
  kakaoRank?: number | null
  kakaoCompetitorCount?: number
  naverMentioned?: boolean
  aiTabMentioned?: boolean
  chatgptMentioned?: boolean
  hasWebsite?: boolean
  googlePlaceRegistered?: boolean
  /** 업종 네이버 비중 (DUAL_TRACK_RATIO 기반). 0.55 초과 → 네이버 주력, 0.45 미만 → 글로벌 주력 */
  naverWeight?: number
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const icon = score >= 70 ? "✓" : score >= 40 ? "~" : "!"
  return (
    <svg width="72" height="72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r}
        fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="41" textAnchor="middle" fontSize="16" fontWeight="700" fill={color}>
        {icon}
      </text>
    </svg>
  )
}

export function ChannelScoreCards({
  naverScore,
  globalScore,
  isSmartPlace,
  isOnKakao,
  kakaoRank,
  kakaoCompetitorCount,
  naverMentioned,
  aiTabMentioned,
  chatgptMentioned,
  hasWebsite,
  googlePlaceRegistered,
  naverWeight,
}: ChannelScoreCardsProps) {
  const naverGrade  = naverScore  >= 70 ? 'good'  : naverScore  >= 40 ? 'mid' : 'low'
  const globalGrade = globalScore >= 70 ? 'good'  : globalScore >= 40 ? 'mid' : 'low'

  const isPrimaryNaver  = naverWeight !== undefined && naverWeight  > 0.55
  const isPrimaryGlobal = naverWeight !== undefined && naverWeight  < 0.45

  const naverColor  = naverGrade  === 'good' ? '#22c55e' : naverGrade  === 'mid' ? '#f59e0b' : '#ef4444'
  const globalColor = globalGrade === 'good' ? '#22c55e' : globalGrade === 'mid' ? '#3b82f6' : '#ef4444'

  const kakaoLabel = isOnKakao
    ? `카카오맵 ${kakaoRank ? `${kakaoRank}위 노출` : '등록됨'}`
    : '카카오맵 등록 필요'
  const naverBriefingLabel =
    naverMentioned === undefined ? '네이버 AI 브리핑 측정 불가 (재스캔 권장)' : '네이버 AI 브리핑 노출'
  const naverItems = [
    { label: naverBriefingLabel, ok: !!naverMentioned, unmeasured: naverMentioned === undefined },
    { label: '네이버 AI탭 노출 (정식 출시)', ok: !!aiTabMentioned },
    { label: '스마트플레이스 등록',                ok: !!isSmartPlace },
    { label: kakaoLabel,                           ok: !!isOnKakao },
  ]
  const globalItems = [
    { label: 'ChatGPT 노출',                              ok: !!chatgptMentioned, optional: false },
    { label: hasWebsite ? '독립 웹사이트 보유' : '독립 웹사이트 없음 (선택)', ok: !!hasWebsite, optional: !hasWebsite },
    { label: 'Google Business 등록',                      ok: !!googlePlaceRegistered, optional: false },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 네이버 AI 채널 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4">
          <ScoreRing score={naverScore} color={naverColor} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-bold text-gray-900">네이버 AI 채널</span>
              <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                naverGrade === 'good' ? 'bg-green-100 text-green-700'
                : naverGrade === 'mid' ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
              }`}>
                {naverGrade === 'good' ? '양호' : naverGrade === 'mid' ? '보통' : '개선 필요'}
              </span>
              {isPrimaryNaver && (
                <span className="text-sm px-2 py-0.5 rounded-full font-semibold bg-blue-600 text-white">
                  ★ 이 업종 주력
                </span>
              )}
            </div>
            <p className="text-base text-gray-600 mb-3">
              네이버 AI 브리핑·AI탭·카카오맵 생태계 노출
            </p>
            <div className="space-y-1.5">
              {naverItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span className={item.ok ? 'text-green-700' : item.unmeasured ? 'text-gray-200' : 'text-gray-300'}>
                    {item.ok ? '✓' : item.unmeasured ? '—' : '○'}
                  </span>
                  <span className={item.ok ? 'text-gray-700' : item.unmeasured ? 'text-gray-300' : 'text-gray-600'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            {isOnKakao && kakaoCompetitorCount != null && kakaoCompetitorCount > 0 && (
              <p className="text-base text-gray-600 mt-2">
                카카오맵 검색 상위 {kakaoCompetitorCount}곳 중 {kakaoRank ? `${kakaoRank}위` : '포함'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 글로벌 AI 채널 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4">
          <ScoreRing score={globalScore} color={globalColor} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-bold text-gray-900">글로벌 AI 채널</span>
              <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                globalGrade === 'good' ? 'bg-green-100 text-green-700'
                : globalGrade === 'mid' ? 'bg-blue-100 text-blue-700'
                : 'bg-red-100 text-red-700'
              }`}>
                {globalGrade === 'good' ? '양호' : globalGrade === 'mid' ? '보통' : '개선 필요'}
              </span>
              {isPrimaryGlobal && (
                <span className="text-sm px-2 py-0.5 rounded-full font-semibold bg-purple-600 text-white">
                  ★ 이 업종 주력
                </span>
              )}
            </div>
            <p className="text-base text-gray-600 mb-3">
              ChatGPT · Google AI 인용
            </p>
            <div className="space-y-1.5">
              {globalItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span className={item.ok ? 'text-green-700' : item.optional ? 'text-gray-200' : 'text-gray-300'}>
                    {item.ok ? '✓' : '○'}
                  </span>
                  <span className={item.ok ? 'text-gray-700' : item.optional ? 'text-gray-300' : 'text-gray-600'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
