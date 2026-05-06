'use client'

interface Props {
  competitorKeywordSources: Record<string, string[]>
}

export default function CompetitorKeywordCompare({ competitorKeywordSources }: Props) {
  const entries = Object.entries(competitorKeywordSources ?? {}).filter(([, kws]) => Array.isArray(kws) && kws.length > 0)

  if (entries.length === 0) return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
      <span className="text-2xl shrink-0">🔍</span>
      <div>
        <p className="text-sm font-semibold text-gray-700">경쟁사 키워드 비교 준비 중</p>
        <p className="text-sm text-gray-500 mt-0.5">
          경쟁사를 등록하고 스캔이 완료되면 경쟁사에는 있고 내 가게에 없는 키워드를 자동으로 찾아드립니다
        </p>
        <a href="/competitors" className="inline-block mt-2 text-sm font-semibold text-blue-600 hover:underline">
          경쟁사 등록하기 →
        </a>
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🔍</span>
        <div>
          <h3 className="text-base font-bold text-gray-900">경쟁사가 갖고 있는 키워드</h3>
          <p className="text-sm text-gray-500 mt-0.5">이 키워드를 내 스마트플레이스에 추가하면 경쟁력이 높아집니다</p>
        </div>
      </div>
      <div className="space-y-3">
        {entries.map(([competitorName, keywords]) => (
          <div key={competitorName} className="p-3 md:p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm font-semibold text-red-800 mb-2">
              📍 {competitorName}
            </p>
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw: string) => (
                <span
                  key={kw}
                  className="text-sm bg-white border border-red-200 text-red-700 px-3 py-1 rounded-full font-medium"
                >
                  {kw}
                </span>
              ))}
            </div>
            <p className="text-sm text-red-600 mt-2">
              → FAQ나 소개글에 위 키워드를 추가해 보세요
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
