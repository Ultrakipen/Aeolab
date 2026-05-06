export default function TrialResultPreview() {
  return (
    <section className="bg-gray-50 py-8 md:py-10 px-4 md:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 break-keep">
            진단하면 이런 결과를 받습니다
          </h2>
          <p className="text-sm text-gray-500 break-keep">
            가입 없이 — 실제 진단 결과 미리보기
          </p>
        </div>

        {/* 목업 카드 */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-md bg-white">
          {/* 헤더 */}
          <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">창원 OO 치킨</p>
              <p className="text-sm text-gray-500">음식점 · 창원 의창구</p>
            </div>
            <span className="bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full">
              주의 필요
            </span>
          </div>

          <div className="p-5">
            {/* 점수 3칸 */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="text-center bg-red-50 rounded-xl p-3 border border-red-100">
                <p className="text-2xl font-bold text-red-600">32점</p>
                <p className="text-xs text-gray-500 mt-0.5">AI 노출 점수</p>
                <p className="text-xs text-red-500 mt-0.5">업종 평균 61점</p>
              </div>
              <div className="text-center bg-orange-50 rounded-xl p-3 border border-orange-100">
                <p className="text-2xl font-bold text-orange-600">3%</p>
                <p className="text-xs text-gray-500 mt-0.5">AI 노출률</p>
                <p className="text-xs text-orange-500 mt-0.5">100번 중 3번</p>
              </div>
              <div className="text-center bg-amber-50 rounded-xl p-3 border border-amber-100">
                <p className="text-2xl font-bold text-amber-600">14개</p>
                <p className="text-xs text-gray-500 mt-0.5">키워드 공백</p>
                <p className="text-xs text-amber-500 mt-0.5">경쟁사 보유</p>
              </div>
            </div>

            {/* 발견된 문제 */}
            <div className="bg-red-50 rounded-xl p-4 mb-4 border border-red-100">
              <p className="text-sm font-bold text-red-700 mb-2">발견된 문제 3가지</p>
              <ul className="space-y-1.5">
                {[
                  "소개글 Q&A 섹션 없음 — AI 인용 후보 경로 미확보",
                  "지역+업종 키워드 14개 경쟁사 대비 공백",
                  "최근 30일 업데이트 없음 — AI가 비활성 가게로 인식",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 break-keep">
                    <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 오늘 할 일 */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-sm font-bold text-blue-700 mb-2">오늘 할 수 있는 개선 1순위</p>
              <p className="text-sm text-gray-700 break-keep leading-relaxed">
                스마트플레이스 소개글 안 Q&A에{" "}
                <strong>&ldquo;창원 치킨 배달, 의창구 야식 추천&rdquo;</strong> 등
                지역+업종 키워드 10개를 추가하면 AI 인용 후보 가능성이 즉시 높아집니다
              </p>
            </div>
          </div>
        </div>

        <p className="text-center mt-4">
          <span className="inline-block text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-3 py-1">
            샘플 화면 — 내 가게 이름을 입력하면 실제 결과를 받습니다
          </span>
        </p>
      </div>
    </section>
  );
}
