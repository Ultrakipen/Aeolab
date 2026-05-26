const reasons = [
  {
    num: "01",
    title: "AI와 광고는 완전히 다른 채널",
    desc: "네이버 AI 브리핑·ChatGPT는 광고 집행 여부와 무관하게 콘텐츠 신뢰도로 가게를 선택합니다. 광고를 많이 해도 AI 노출에는 영향이 없습니다.",
    borderColor: "border-red-100",
    bgColor: "bg-red-50",
    numColor: "text-red-500 bg-red-100",
  },
  {
    num: "02",
    title: "광고는 클릭, AI는 신뢰도",
    desc: "AI가 가게를 추천하는 기준은 리뷰 수·키워드 밀도·정보 구조입니다. 광고비를 올려도 이 기준은 바뀌지 않습니다.",
    borderColor: "border-orange-100",
    bgColor: "bg-orange-50",
    numColor: "text-orange-600 bg-orange-100",
  },
  {
    num: "03",
    title: "광고 끄면 즉시 사라집니다",
    desc: "파워링크는 예산이 소진되거나 끄는 순간 노출이 멈춥니다. AI 검색 노출은 한 번 올라가면 광고 없이도 지속됩니다.",
    borderColor: "border-yellow-100",
    bgColor: "bg-yellow-50",
    numColor: "text-yellow-700 bg-yellow-100",
  },
];

export default function WhyNotShownSection() {
  return (
    <section className="bg-gray-50 py-8 md:py-10 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-2 break-keep">
          광고를 써도 AI엔 나오지 않는 이유
        </h2>
        <p className="text-base md:text-lg text-center text-gray-600 mb-8 break-keep">
          광고비의 문제가 아닙니다 — 채널이 다릅니다
        </p>
        <div className="space-y-3">
          {reasons.map((r) => (
            <div
              key={r.num}
              className={`flex gap-4 items-start p-4 md:p-5 rounded-xl border ${r.borderColor} ${r.bgColor}`}
            >
              <span className={`text-sm font-bold px-2.5 py-1 rounded-lg shrink-0 mt-0.5 ${r.numColor}`}>
                {r.num}
              </span>
              <div>
                <p className="text-base md:text-lg font-bold text-gray-900 mb-1 break-keep">{r.title}</p>
                <p className="text-base text-gray-700 leading-relaxed break-keep">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* 해결책 연결 박스 */}
        <div className="mt-4 rounded-xl p-4 border border-green-200 bg-green-50">
          <p className="text-sm font-bold text-green-800 mb-1.5 break-keep">그럼 무엇이 효과가 있을까요?</p>
          <p className="text-sm text-green-700 leading-relaxed break-keep">
            스마트플레이스 소개글·사진·리뷰·소식을 꾸준히 관리하면{" "}
            <strong>네이버 검색 상위노출</strong>(플레이스 탭)이 먼저 오르고,
            정보 완성도가 높아질수록{" "}
            <strong>네이버 AI 브리핑·AI탭 노출</strong> 가능성도 함께 올라갑니다.
            하나의 노력으로 두 가지 효과입니다.
          </p>
        </div>

        <div className="text-center mt-6">
          <p className="text-base text-gray-600 mb-3 break-keep">
            내 가게의 네이버 검색·AI 브리핑 노출 상태를 —{" "}
            <span className="font-semibold text-blue-600">지금 바로 확인하세요</span>
          </p>
          <a
            href="/trial"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-base font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors min-h-[44px]"
          >
            지금 바로 진단받기
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
