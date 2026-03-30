import Link from 'next/link'

interface GlobalAIBannerProps {
  globalScore: number
  hasWebsite: boolean
}

export function GlobalAIBanner({ globalScore, hasWebsite }: GlobalAIBannerProps) {
  // 글로벌 AI 채널 점수가 30점 미만일 때만 표시
  if (globalScore >= 30) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-amber-600 text-sm">!</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-800 mb-1">
            ChatGPT · Perplexity에서 이 사업장이 검색되지 않습니다
          </p>
          <p className="text-xs text-amber-700 leading-relaxed mb-3">
            <strong>네이버는 ChatGPT·Gemini의 크롤링을 차단</strong>하고 있습니다.
            네이버 스마트플레이스·블로그를 잘 관리해도 ChatGPT에서는 노출되지 않는 이유입니다.
            글로벌 AI에서 인용되려면 <strong>독립 웹사이트</strong>와{' '}
            <strong>Google 비즈니스 프로필</strong>이 필요합니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {!hasWebsite && (
              <div className="bg-white rounded-xl px-3 py-2.5 border border-amber-200">
                <p className="text-xs font-semibold text-gray-800 mb-0.5">독립 웹사이트 만들기</p>
                <p className="text-xs text-gray-500">
                  카페24·아임웹으로 간단히 개설. JSON-LD 스키마 등록 필수.
                </p>
              </div>
            )}
            <Link
              href="/schema"
              className="bg-white rounded-xl px-3 py-2.5 border border-amber-200 hover:border-amber-400 transition-colors block"
            >
              <p className="text-xs font-semibold text-gray-800 mb-0.5">JSON-LD 자동 생성 →</p>
              <p className="text-xs text-gray-500">
                AI가 사업장 정보를 인식하는 구조화 마크업을 자동 생성합니다.
              </p>
            </Link>
            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl px-3 py-2.5 border border-amber-200 hover:border-amber-400 transition-colors block"
            >
              <p className="text-xs font-semibold text-gray-800 mb-0.5">Google 비즈니스 등록 →</p>
              <p className="text-xs text-gray-500">
                Google 검색·AI Overview·Maps 동시 최적화. 무료.
              </p>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
