import { getScoreTextLabel } from "@/lib/scoreLabels";

export interface StartupReport {
  category: string;
  region: string;
  competitor_count: number;
  avg_competitor_score: number;
  competition_level: string;
  competition_level_color: string;
  competition_level_score: number;
  is_estimated?: boolean;
  top_competitors: Array<{ name: string; score: number; exposure_freq: number }>;
  timing?: {
    timing_label: string;
    timing_color: string;
    opportunity_score: number;
    reasoning: string;
    is_estimated?: boolean;
  };
  strategy: {
    entry_strategy?: string;
    key_actions?: string[];
    ai_optimization_tips?: string[];
    risk_factors?: string[];
    estimated_time_to_visibility?: string;
  };
  search_trend?: {
    trend_direction: "rising" | "falling" | "stable";
    trend_delta: number;
    trend_data: Array<{ period: string; ratio: number }>;
    keywords_used: string[];
    available: boolean;
  };
  real_market?: {
    available: boolean;
    total_count: number;
    samples: Array<{ name: string; address: string; naver_place_url: string }>;
  };
}

const LEVEL_COLORS: Record<string, string> = {
  red: "text-red-600 bg-red-50 border-red-200",
  orange: "text-orange-600 bg-orange-50 border-orange-200",
  yellow: "text-yellow-700 bg-yellow-50 border-yellow-200",
  green: "text-green-700 bg-green-50 border-green-200",
  gray: "text-gray-500 bg-gray-50 border-gray-200",
};

// 실제 API 응답과 목업(startup/mockup) 양쪽에서 공유하는 결과 렌더링 — 한쪽만 고치고
// 다른 쪽을 깜빡하는 drift를 막기 위해 StartupClient.tsx에서 분리(2026-08-30)
export function StartupReportView({ report }: { report: StartupReport }) {
  return (
    <>
      {/* 경쟁 강도 */}
      <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-4">
        <h2 className="text-base font-semibold text-gray-700 mb-1">시장 현황</h2>
        <p className="text-sm text-gray-500 mb-4">아래 수치는 <b>AEOlab에 가입한 사업장</b> 기준입니다. 지역 전체 업체 수가 아니라, 이 서비스로 AI 노출을 관리 중인 사업장들 사이의 경쟁 강도입니다.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4">
          <div className="text-center p-3 md:p-4 bg-gray-50 rounded-xl">
            <div className="text-xl md:text-2xl font-bold text-gray-900">{report.competitor_count}</div>
            <div className="text-sm text-gray-500 mt-1">AEOlab 등록 사업장</div>
          </div>
          <div className="text-center p-3 md:p-4 bg-gray-50 rounded-xl">
            <div className="text-lg md:text-xl font-bold text-gray-900">{getScoreTextLabel(report.avg_competitor_score)}</div>
            <div className="text-sm text-gray-500 mt-1">평균 AI 노출</div>
          </div>
          <div className={`text-center p-3 md:p-4 rounded-xl border ${LEVEL_COLORS[report.competition_level_color] ?? "bg-gray-50"}`}>
            <div className="text-base md:text-lg font-bold">{report.competition_level}</div>
            <div className="text-sm mt-1">경쟁 강도</div>
          </div>
        </div>
        {report.competitor_count === 0 ? (
          <p className="text-sm text-gray-500 -mt-2 mb-2">
            * 이 업종·지역엔 아직 AEOlab 가입 사업장이 없어 비교할 데이터가 없습니다. &quot;경쟁이 없다&quot;는 뜻이 아니라 &quot;아직 측정하지 못했다&quot;는 뜻입니다.
          </p>
        ) : report.is_estimated && (
          <p className="text-sm text-gray-500 -mt-2 mb-2">
            * 등록 사업장 표본이 적어 참고용 추정치입니다. 사업장이 더 등록되면 정확도가 올라갑니다.
          </p>
        )}

        {/* 실제 시장 규모 — AEOlab 가입 여부와 무관한 카카오맵 실측치. 위 "AEOlab 등록
            사업장"이 0건이라도 실제 시장이 비어있는 게 아님을 보여주기 위함(2026-08-30) */}
        {report.real_market?.available && (
          <div className="mt-2 mb-2 bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              참고: 실제 시장 규모(카카오맵 기준, AEOlab 가입 여부와 무관) 약 {report.real_market.total_count}개
            </p>
            <p className="text-sm text-blue-800 leading-relaxed">
              위 &quot;AEOlab 등록 사업장&quot;은 이 서비스에 가입한 곳만 집계한 숫자입니다. 실제 카카오맵 기준으로는
              이 업종·지역에 약 {report.real_market.total_count}개의 사업장이 있습니다.
            </p>
            {report.real_market.samples.length > 0 && (
              <ul className="mt-2 space-y-1">
                {report.real_market.samples.slice(0, 5).map((s, i) => (
                  <li key={i} className="text-sm text-blue-700">
                    {s.naver_place_url ? (
                      <a href={s.naver_place_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}
                    <span className="text-blue-500"> — {s.address}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 창업 타이밍 지수 */}
        {report.timing && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-600 mb-1">창업 타이밍 지수</p>
            <p className="text-sm text-gray-500 mb-2">최근 30일간 AI 노출 점수 변화 추세로, 지금 진입하기 좋은 시점인지를 알려줍니다.</p>
            <div className={`rounded-xl p-4 ${report.timing.timing_color === "emerald" ? "bg-emerald-50 border border-emerald-200" : report.timing.timing_color === "blue" ? "bg-blue-50 border border-blue-200" : report.timing.timing_color === "red" ? "bg-red-50 border border-red-200" : report.timing.timing_color === "amber" ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base font-bold">{report.timing.timing_label}</span>
                {report.timing.is_estimated && (
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">추정</span>
                )}
              </div>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed">{report.timing.reasoning}</p>
            </div>
          </div>
        )}

        {report.top_competitors.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-600 mb-3">상위 경쟁사</p>
            <div className="space-y-2.5">
              {report.top_competitors.map((c, i) => {
                // 스캔 표본 크기(Basic 50회/Full 100회)를 알 수 없어 분수 대신 구간 레이블로 표시
                const freqLabel = c.exposure_freq >= 30 ? "자주 노출" : c.exposure_freq >= 10 ? "가끔 노출" : c.exposure_freq > 0 ? "노출 적음" : "노출 없음"
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm md:text-base text-gray-700 font-medium">{i + 1}. {c.name}</span>
                    <span className="text-sm text-gray-500">{freqLabel}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* 네이버 검색 수요 트렌드 */}
      {report.search_trend?.available && (
        <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-4">
          <h2 className="text-base font-semibold text-gray-700 mb-3">네이버 검색 수요 트렌드</h2>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
              report.search_trend.trend_direction === "rising" ? "bg-blue-50 text-blue-700"
              : report.search_trend.trend_direction === "falling" ? "bg-amber-50 text-amber-700"
              : "bg-gray-50 text-gray-600"
            }`}>
              {report.search_trend.trend_direction === "rising" ? "상승세"
                : report.search_trend.trend_direction === "falling" ? "하락세" : "안정"}
            </span>
            <span className="text-sm text-gray-500">
              최근 3개월 {report.search_trend.trend_delta >= 0 ? "+" : ""}{report.search_trend.trend_delta.toFixed(1)}% 변화
            </span>
          </div>
          {report.search_trend.keywords_used.length > 0 && (
            <p className="text-sm text-gray-500 mb-2">측정 키워드: {report.search_trend.keywords_used.join(", ")}</p>
          )}
          <p className="text-sm text-gray-500">* 네이버 DataLab 모바일 검색 기준. 측정 시점·기기에 따라 달라질 수 있음.</p>
        </section>
      )}

      {/* 진입 전략 */}
      {report.strategy && (
        <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-4">
          <h2 className="text-base font-semibold text-gray-700 mb-1">AI 진입 전략</h2>
          <p className="text-sm text-gray-500 mb-3">위 시장 현황을 바탕으로 Claude AI가 제안하는 창업·AI 노출 전략입니다.</p>
          {report.strategy.entry_strategy && (
            <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">{report.strategy.entry_strategy}</p>
          )}
          {report.strategy.key_actions && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">핵심 액션</p>
              <ul className="space-y-2">
                {report.strategy.key_actions.map((a, i) => (
                  <li key={i} className="text-sm md:text-base text-gray-700 flex gap-2 leading-relaxed">
                    <span className="text-blue-600 shrink-0 mt-0.5">→</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.strategy.ai_optimization_tips && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">AI 최적화 팁</p>
              <ul className="space-y-2">
                {report.strategy.ai_optimization_tips.map((t, i) => (
                  <li key={i} className="text-sm md:text-base text-gray-700 flex gap-2 leading-relaxed">
                    <span className="text-green-700 shrink-0 mt-0.5">✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.strategy.risk_factors && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">주의사항</p>
              <ul className="space-y-2">
                {report.strategy.risk_factors.map((r, i) => (
                  <li key={i} className="text-sm md:text-base text-orange-700 flex gap-2 leading-relaxed">
                    <span className="shrink-0 mt-0.5">⚠</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.strategy.estimated_time_to_visibility && (
            <div className="bg-blue-50 rounded-xl p-4 text-sm md:text-base text-blue-700">
              예상 AI 노출 기간: {report.strategy.estimated_time_to_visibility}
            </div>
          )}
        </section>
      )}

      {/* 다음 단계 */}
      <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-4">
        <h2 className="text-base font-semibold text-gray-700 mb-2">다음 단계</h2>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">창업을 진행하신다면, 사업장을 등록하고 실제 AI 검색 노출을 직접 스캔·관리해보세요. 위 진입 전략을 실행 가이드로 이어서 받아볼 수 있습니다.</p>
        <a
          href="/dashboard"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          사업장 등록하고 시작하기
        </a>
      </section>
    </>
  );
}
