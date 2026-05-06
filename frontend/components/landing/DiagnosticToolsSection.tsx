export default function DiagnosticToolsSection() {
  return (
    <section className="py-6 md:py-8 px-4 md:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-7">
          <span className="inline-block bg-blue-50 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full mb-3">
            Basic 이상 포함 — 추가 진단 도구
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 break-keep">
            점수가 낮다면, 원인까지 찾아드립니다
          </h2>
          <p className="text-base md:text-lg text-gray-600 mt-2 break-keep">
            AI 검색 노출 측정이 핵심입니다. 점수를 올리는 원인 진단 도구 두 가지를 함께 제공합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xl" aria-hidden="true">📝</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base md:text-lg">블로그 AI 진단</p>
                <p className="text-sm text-blue-600 font-medium mt-1 mb-2">AI 브리핑 인용 가능성 분석</p>
                <p className="text-base text-gray-700 leading-relaxed break-keep">
                  내 블로그 글이 네이버 AI 브리핑에 인용되는지 분석합니다. 홍보형·정보형 비율과 개선 제목을 자동 제안합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xl" aria-hidden="true">🏪</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base md:text-lg">스마트플레이스 자동 점검</p>
                <p className="text-sm text-emerald-600 font-medium mt-1 mb-2">FAQ·소개글·소식 누락 자동 확인</p>
                <p className="text-base text-gray-700 leading-relaxed break-keep">
                  스마트플레이스 소개글·Q&A·소식 누락 여부를 자동으로 확인하고 즉시 쓸 수 있는 초안을 제공합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
