export default function SearchChangeSection() {
  return (
    <section className="bg-white py-8 md:py-10 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-center text-gray-900 mb-2 break-keep">
          손님이 가게를 찾는 방식이 바뀌었습니다
        </h2>
        <p className="text-sm text-center text-gray-500 mb-8 break-keep">
          블로그·광고 시대는 끝났습니다
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {/* 예전 */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <p className="text-xs font-bold text-gray-400 tracking-widest mb-3">예전</p>
            <div className="space-y-3">
              {["네이버 검색", "블로그 광고 클릭", "가게 방문"].map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600">{step}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 지금 */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs font-bold text-blue-500 tracking-widest mb-3">지금</p>
            <div className="space-y-3">
              {[
                '"근처 맛집 추천해줘" (ChatGPT)',
                "AI가 직접 가게 정보 수집",
                "AI가 가게를 손님에게 추천",
              ].map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-blue-800 font-medium break-keep">{step}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-600 font-semibold mt-4 break-keep">
              → AI에 정보가 없으면 추천받을 수 없습니다
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
