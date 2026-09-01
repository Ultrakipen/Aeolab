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
    keyword_volumes?: Array<{ keyword: string; monthly_volume: number }>;
    available: boolean;
  };
  real_market?: {
    available: boolean;
    total_count: number;
    samples: Array<{ name: string; address: string; naver_place_url: string }>;
    source?: "sbiz" | "kakao";
    stdr_ym?: string | null;
    radius_m?: number;
    density_per_km2?: number;
    confidence?: "good" | "medium" | "low";
    partial_failure?: boolean;
  };
  market_comparison?: {
    available: boolean;
    compare_region?: string;
    compare_density_per_km2?: number;
    compare_total_count?: number;
    compare_radius_m?: number;
    compare_confidence?: "good" | "medium" | "low";
    diff_pct?: number;
    comparison?: "lower" | "similar" | "higher";
    low_confidence?: boolean;
  };
  competitor_readiness?: {
    available: boolean;
    checked: number;
    no_intro_count?: number;
    no_recent_post_count?: number;
    items?: Array<{ name: string; has_intro: boolean; has_recent_post: boolean; photo_count: number; review_count: number }>;
  };
  closure_rate?: {
    available: boolean;
    reason?: string;
    closure_rate?: number;
    active_count?: number;
    closed_count?: number;
    national_avg?: number | null;
    comparison?: "lower" | "similar" | "higher";
  };
  ai_benchmark?: {
    available: boolean;
    level?: "주의 필요" | "미흡" | "보통" | "양호" | "우수";
    sample_count?: number;
    is_national_fallback?: boolean;
  };
}

// 섹션 제목 공통 스타일 — 본문(text-sm/base)과 뚜렷이 구분되는 위계를 위해 크게·굵게
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight mb-1">{children}</h2>;
}

// 소제목(핵심 액션·AI 최적화 팁 등) 공통 스타일 — 대문자+자간으로 "보고서 라벨" 느낌
function SubLabel({ children, colorClass = "text-gray-500" }: { children: React.ReactNode; colorClass?: string }) {
  return <p className={`text-[11px] font-bold uppercase tracking-wider ${colorClass} mb-2.5`}>{children}</p>;
}

// 실제 API 응답과 목업(startup/mockup) 양쪽에서 공유하는 결과 렌더링 — 한쪽만 고치고
// 다른 쪽을 깜빡하는 drift를 막기 위해 StartupClient.tsx에서 분리(2026-08-30)
// 신호 요약 칩 — 상세 섹션과 동일한 값을 재사용해 상단에서 스캔 가능하게 압축(2026-09-02).
// color: "good"(파랑·기회 방향) | "warn"(주황·주의 방향) | "neutral"(회색·정보성)
function SignalChip({ label, color }: { label: string; color: "good" | "warn" | "neutral" }) {
  const cls =
    color === "good" ? "bg-blue-50 text-blue-700 border-blue-200"
    : color === "warn" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-gray-50 text-gray-600 border-gray-200";
  return <span className={`inline-block text-xs md:text-sm font-semibold px-2.5 py-1.5 rounded-full border ${cls}`}>{label}</span>;
}

export function StartupReportView({ report }: { report: StartupReport }) {
  return (
    <>
      {/* AI 종합 판단 — Claude의 핵심 요약을 페이지 최상단으로 이동(2026-09-02 재구성).
          "사용자가 상세 수치를 다 훑기 전에 결론부터 알고 싶어한다"는 피드백 반영 —
          기존엔 맨 아래 AI 진입 전략 섹션에 있던 문단을 그대로 재사용(중복 방지를 위해
          아래 섹션에서는 제거, 새 텍스트 생성 아님). 신호 칩도 아래 상세 섹션과 동일한
          값만 재사용 — 새 판단 로직 없음. */}
      {report.strategy?.entry_strategy && (
        <section className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 md:p-7 shadow-sm mb-5">
          <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-2">AI 종합 판단</p>
          <p className="text-base md:text-lg text-gray-900 leading-relaxed font-medium mb-4">
            {report.strategy.entry_strategy}
          </p>
          <div className="flex flex-wrap gap-2">
            {report.market_comparison?.available && (() => {
              const mc = report.market_comparison!;
              const label = { lower: "낮음", similar: "비슷함", higher: "높음" }[mc.comparison ?? "similar"];
              return <SignalChip label={`밀도 ${label}(${mc.compare_region} 대비)`} color={mc.comparison === "higher" ? "warn" : "neutral"} />;
            })()}
            {report.closure_rate?.available && report.closure_rate.comparison && (() => {
              const cr = report.closure_rate!;
              const label = { lower: "낮음", similar: "비슷함", higher: "높음" }[cr.comparison!];
              return <SignalChip label={`생존율 전국대비 ${label}`} color={cr.comparison === "higher" ? "warn" : "neutral"} />;
            })()}
            {report.ai_benchmark?.available && (() => {
              const ab = report.ai_benchmark!;
              const isOpportunity = ab.level === "미흡" || ab.level === "주의 필요";
              const isCompetitive = ab.level === "양호" || ab.level === "우수";
              return (
                <SignalChip
                  label={isOpportunity ? "AI노출 선점 기회" : isCompetitive ? "AI노출 경쟁 치열" : "AI노출 보통"}
                  color={isOpportunity ? "good" : isCompetitive ? "warn" : "neutral"}
                />
              );
            })()}
            {report.search_trend?.available && (
              <SignalChip
                label={
                  report.search_trend.trend_direction === "rising" ? "검색수요 상승세"
                  : report.search_trend.trend_direction === "falling" ? "검색수요 하락세"
                  : "검색수요 안정"
                }
                color={report.search_trend.trend_direction === "rising" ? "good" : report.search_trend.trend_direction === "falling" ? "warn" : "neutral"}
              />
            )}
          </div>
        </section>
      )}

      {/* 시장 현황 — 실제 상권 규모(정부·카카오 실측) 중심. AEOlab 자체 가입 사업장 데이터
          (경쟁 강도·타이밍 지수 등)는 2026-08-31부터 이 페이지에 표시하지 않음 — 창업
          예정자에게 필요한 건 AEOlab 내부 고객 현황이 아니라 실제 지역 상권 분석이라는
          목적에 맞춰 재구성(사용자 방향 확정). 백엔드는 그 데이터를 계속 계산·기록하되
          (차후 내부 활용 목적), 이 페이지 화면에는 노출하지 않는다. */}
      <section className="bg-white rounded-2xl p-5 md:p-7 shadow-sm mb-5">
        <SectionTitle>시장 현황</SectionTitle>
        <p className="text-sm text-gray-500 mb-4">국세청·카드사 등록 통계(또는 카카오맵 실측) 기준 실제 상권 규모와 생존 현황입니다.</p>

        {/* source="sbiz"(소상공인시장진흥공단 상가정보, 국세청·카드사 기반)가 있으면
            우선 사용 — 더 권위 있는 실제 등록 사업자 수. 없으면 카카오맵 키워드 검색
            기준으로 폴백 */}
        {report.real_market?.available && (() => {
          const isSbiz = report.real_market.source === "sbiz";
          const ym = report.real_market.stdr_ym;
          const ymLabel = ym && ym.length === 6 ? `${ym.slice(0, 4)}년 ${parseInt(ym.slice(4), 10)}월` : null;
          const radiusKm = report.real_market.radius_m ? (report.real_market.radius_m / 1000).toFixed(1).replace(/\.0$/, "") : null;
          const sourceLabel = isSbiz ? "국세청·카드사 등록 기준" : "카카오맵 검색 기준";
          const density = report.real_market.density_per_km2;
          const isLowConfidence = isSbiz && report.real_market.confidence === "low";
          const isPartialFailure = isLowConfidence && report.real_market.partial_failure === true;
          return (
            <div className="mb-3">
              {/* 한눈에 보는 핵심 수치 — 본문을 안 읽어도 규모·밀도가 바로 눈에 들어오도록 */}
              <div className={`grid ${density != null ? "grid-cols-2" : "grid-cols-1"} gap-3 mb-3`}>
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3.5 text-center">
                  <div className="text-2xl md:text-3xl font-extrabold text-blue-700 tabular-nums leading-none">
                    {report.real_market.total_count.toLocaleString()}
                    <span className="text-sm font-semibold text-blue-400 ml-0.5">개</span>
                  </div>
                  <div className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mt-1.5">실제 시장 규모</div>
                </div>
                {density != null && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3.5 text-center">
                    <div className="text-2xl md:text-3xl font-extrabold text-blue-700 tabular-nums leading-none">
                      {density}
                      <span className="text-sm font-semibold text-blue-400 ml-0.5">/㎢</span>
                    </div>
                    <div className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mt-1.5">밀도</div>
                  </div>
                )}
              </div>

              {/* 밀도 비교 배지 — 전국평균 대신 사용자가 지정한 지역과 실측 비교(2026-09-01).
                  전국평균은 농어촌 지역에 의해 도심 상권이 항상 "높음"으로 나오는 통계적
                  왜곡이 있어 배제하고, 사용자가 실제 비교하고 싶은 후보지를 직접 지정하는
                  방식으로 대체 — closure_rate의 bar national_avg 제거와 동일한 판단 기준. */}
              {report.market_comparison?.available && (() => {
                const mc = report.market_comparison;
                const label = { lower: "낮음", similar: "비슷함", higher: "높음" }[mc.comparison ?? "similar"];
                const badgeColor =
                  mc.comparison === "higher" ? "bg-rose-50 text-rose-700 border-rose-200"
                  : mc.comparison === "lower" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-50 text-gray-700 border-gray-200";
                return (
                  <div className="mb-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                      &apos;{mc.compare_region}&apos; 대비 밀도 {label}
                      {mc.diff_pct != null && ` (${mc.diff_pct > 0 ? "+" : ""}${mc.diff_pct}%)`}
                    </span>
                    {mc.compare_density_per_km2 != null && (
                      <span className="text-xs text-gray-500 ml-2">
                        {mc.compare_region}: {mc.compare_density_per_km2}/㎢
                      </span>
                    )}
                    {mc.low_confidence && (
                      <span className="block text-xs text-amber-700 mt-1.5">
                        ⚠ 두 지역 중 한쪽의 추정 신뢰도가 낮아 이 비교 수치는 근사치입니다.
                      </span>
                    )}
                  </div>
                );
              })()}

              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                <p className="text-sm text-blue-800 leading-relaxed">
                  <span className="font-semibold">{sourceLabel}</span> — 이 업종·지역 반경 내에 약 {report.real_market.total_count}개의 사업장이 있습니다.
                  {density != null && !report.market_comparison?.available && " 밀도(1㎢당 개수)로 다른 지역·업종과 상대 비교에 활용하세요."}
                </p>
                {isLowConfidence && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2.5 flex gap-2">
                    <span className="flex-none">⚠</span>
                    {isPartialFailure ? (
                      <span>일부 데이터 조회가 일시적으로 실패해 실제보다 적게 집계됐을 수 있습니다 — 잠시 후 다시 분석해 보세요.</span>
                    ) : (
                      <span>이 지역은 추정 신뢰도가 낮습니다 — 군·특별자치시처럼 면적이 넓은 지역은 반경이 행정구역 전체를 다 덮지 못해, 실제 사업장 수가 위 숫자보다 훨씬 많을 수 있습니다.</span>
                    )}
                  </p>
                )}
                {report.real_market.samples.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {report.real_market.samples.slice(0, 5).map((s, i) => (
                      <li key={i} className="text-sm text-blue-700 flex gap-1.5">
                        <span className="text-blue-300 flex-none">·</span>
                        <span>
                          {s.naver_place_url ? (
                            <a href={s.naver_place_url} target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-blue-900">
                              {s.name}
                            </a>
                          ) : (
                            <span className="font-medium">{s.name}</span>
                          )}
                          <span className="text-blue-500"> — {s.address}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-blue-400 mt-3 leading-relaxed">
                  {isSbiz
                    ? `* 소상공인시장진흥공단 상가정보(국세청·카드사 기반)${ymLabel ? `, ${ymLabel} 기준` : ""} 입력 지역 중심 반경${radiusKm ? ` ${radiusKm}km` : ""} 내 등록 사업자 수입니다. 동/구/군 등 행정구역 넓이에 맞춰 반경을 자동 조정하지만 실제 행정구역 경계와 정확히 일치하지는 않는 근사치이며, 실시간이 아니라 다소 지연된 통계입니다.`
                    : "* 카카오맵 키워드 검색 기준 추정치입니다. 실제 사업자 등록 현황과 다를 수 있고, 인접 지역 업체가 일부 포함될 수 있습니다."}
                  {" "}측정 시점에 따라 달라질 수 있음.
                </p>
              </div>
            </div>
          );
        })()}

        {/* 폐업율/생존 현황 — 행정안전부 지방행정 인허가 누적 데이터 기반.
            available=false(커버 불가 업종 포함)면 이 서브블록만 조용히 생략.
            섹션 자체(시장 규모·경쟁사 준비도)는 유지됨. */}
        {report.closure_rate?.available && (() => {
          const cr = report.closure_rate!;
          const compLabel =
            cr.comparison === "lower" ? "낮음"
            : cr.comparison === "similar" ? "비슷함"
            : cr.comparison === "higher" ? "높음"
            : null;
          const compBadgeClass =
            cr.comparison === "lower"
              ? "text-green-700 bg-green-50 border border-green-200"
              : cr.comparison === "similar"
              ? "text-yellow-700 bg-yellow-50 border border-yellow-200"
              : cr.comparison === "higher"
              ? "text-red-700 bg-red-50 border border-red-200"
              : "text-gray-600 bg-gray-50 border border-gray-200";
          const hasNationalAvg = cr.national_avg != null;
          return (
            <div className="mb-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">생존 현황</p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {cr.closure_rate != null && (
                    <div>
                      <div className="text-2xl md:text-3xl font-extrabold text-slate-800 tabular-nums leading-none">
                        {cr.closure_rate.toFixed(1)}
                        <span className="text-sm font-semibold text-slate-500 ml-0.5">%</span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">역대 누적 폐업율</div>
                    </div>
                  )}
                  {compLabel && (
                    <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${compBadgeClass}`}>
                      {hasNationalAvg ? `전국 평균 대비 ${compLabel}` : compLabel}
                    </span>
                  )}
                </div>
                {hasNationalAvg && (
                  <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">
                    전국 평균: <span className="font-semibold">{cr.national_avg!.toFixed(1)}%</span>
                    {cr.active_count != null && cr.closed_count != null && (
                      <span className="text-slate-400"> · 이 지역 영업 {cr.active_count.toLocaleString()}개 · 폐업 이력 {cr.closed_count.toLocaleString()}개</span>
                    )}
                  </p>
                )}
                {!hasNationalAvg && cr.active_count != null && cr.closed_count != null && (
                  <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">
                    이 지역 영업 <span className="font-semibold">{cr.active_count.toLocaleString()}개</span> · 폐업 이력 <span className="font-semibold">{cr.closed_count.toLocaleString()}개</span>
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  자영업은 업종 특성상 폐업 회전율 자체가 구조적으로 높습니다 — 이 숫자만으로 창업 여부를 단정하지 마세요.
                </p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  * 역대 누적 기준 — 연간 폐업율이 아닙니다. 행정안전부 지방행정 인허가 데이터 기준이며, 측정 시점에 따라 달라질 수 있음.
                </p>
              </div>
            </div>
          );
        })()}

        {/* AI 검색 노출 벤치마크(2026-09-01 신설) — SBIZ·오픈업 등 어떤 상권분석 서비스도
            갖지 못한 AEOlab 고유 실측 데이터. CLAUDE.md 점수 표시 원칙 준수 — 숫자는
            응답에 아예 없고 텍스트 레벨만 전달됨(백엔드에서 이미 변환 완료). 표본 부족
            시(현재 구독자 규모에서 흔함) available=false로 조용히 생략. */}
        {report.ai_benchmark?.available && (() => {
          const ab = report.ai_benchmark!;
          // 색상 방향 주의(2026-09-02 정정): "미흡·주의 필요"는 경쟁사가 AI 노출을 못
          // 챙기고 있다는 뜻이라 예비 창업자에겐 오히려 긍정 신호(기회) — 경고색(주황)이
          // 아닌 기회색(파랑)으로 표시. 반대로 "양호·우수"는 경쟁사가 이미 AI 노출을
          // 잘 챙기고 있다는 뜻이라 신규 진입자에겐 경쟁이 치열하다는 주의 신호.
          const isOpportunity = ab.level === "미흡" || ab.level === "주의 필요";
          const isCompetitive = ab.level === "양호" || ab.level === "우수";
          const levelBadgeClass = isOpportunity
            ? "text-blue-700 bg-blue-50 border border-blue-200"
            : isCompetitive
            ? "text-amber-700 bg-amber-50 border border-amber-200"
            : "text-gray-600 bg-gray-50 border border-gray-200";
          return (
            <div className="mb-3">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-2.5">AI 검색 노출 수준</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${levelBadgeClass}`}>
                    {ab.level}
                  </span>
                  <span className="text-sm text-indigo-800">
                    이 업종{ab.is_national_fallback ? "의 전국" : "·지역의"} 등록 사업장들이 네이버 AI브리핑·ChatGPT·Gemini 등에 노출되는 평균 수준입니다.
                  </span>
                </div>
                {isOpportunity && (
                  <p className="text-sm text-blue-700 mt-2.5 leading-relaxed">
                    경쟁사 대부분이 AI 검색 노출 관리를 못 하고 있다는 뜻 — 지금 시작하면 선점 기회가 될 수 있습니다.
                  </p>
                )}
                {isCompetitive && (
                  <p className="text-sm text-amber-700 mt-2.5 leading-relaxed">
                    경쟁사들이 이미 AI 검색 노출을 잘 관리하고 있다는 뜻 — 신규 진입 시 AI 채널 경쟁이 치열할 수 있습니다.
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                  * AEOlab 등록 사업장{ab.is_national_fallback ? "(지역 표본 부족으로 전국 기준)" : ""} 실측 데이터 기준(표본 {ab.sample_count}곳) — 표본이 작아 조회 시점에 따라 등급이 바뀔 수 있습니다.
                </p>
              </div>
            </div>
          );
        })()}

        {/* 실제 경쟁사 스마트플레이스 공개 완성도 — 로그인 불필요한 공개 페이지만 조사
            (2026-08-31 신설). 매칭 실패가 잦을 수 있어(소규모 업체는 네이버플레이스
            자체가 없는 경우 많음) available=false면 조용히 숨김(그레이스풀). */}
        {report.competitor_readiness?.available && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-sm font-bold text-emerald-900 mb-1.5">
              실제 경쟁사 스마트플레이스 공개 조사 <span className="font-normal text-emerald-600">({report.competitor_readiness.checked}곳)</span>
            </p>
            <p className="text-sm text-emerald-800 leading-relaxed">
              소개글 없음 <span className="font-semibold">{report.competitor_readiness.no_intro_count ?? 0}곳</span>, 최근 소식 없음 <span className="font-semibold">{report.competitor_readiness.no_recent_post_count ?? 0}곳</span>
              {(report.competitor_readiness.no_intro_count || report.competitor_readiness.no_recent_post_count)
                ? " — 이런 항목을 먼저 채우면 상대적으로 눈에 띄기 쉽습니다."
                : " — 조사된 경쟁사들은 기본 항목을 이미 채워둔 상태입니다."}
            </p>
            {!!report.competitor_readiness.items?.length && (
              <ul className="mt-2.5 space-y-1.5">
                {report.competitor_readiness.items.map((it, i) => (
                  <li key={i} className="text-sm text-emerald-700">
                    <span className="font-medium text-emerald-900">{it.name}</span> — 소개글 {it.has_intro ? "있음" : "없음"} · 최근 소식 {it.has_recent_post ? "있음" : "없음"} · 리뷰 {it.review_count}개
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-emerald-400 mt-3 leading-relaxed">
              * 네이버 스마트플레이스 공개 페이지 기준(로그인 불필요). 위 실제 시장 규모 예시 업체 중 네이버플레이스가 확인된 곳만 표시 — 소규모 업체는 네이버플레이스가 없는 경우가 많아 일부만 표시될 수 있습니다.
            </p>
          </div>
        )}
      </section>

      {/* 네이버 검색 수요 트렌드 */}
      {report.search_trend?.available && (
        <section className="bg-white rounded-2xl p-5 md:p-7 shadow-sm mb-5">
          <SectionTitle>네이버 검색 수요 트렌드</SectionTitle>
          <div className="flex items-center gap-2 mt-3 mb-3">
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${
              report.search_trend.trend_direction === "rising" ? "bg-blue-50 text-blue-700"
              : report.search_trend.trend_direction === "falling" ? "bg-amber-50 text-amber-700"
              : "bg-gray-50 text-gray-600"
            }`}>
              {report.search_trend.trend_direction === "rising" ? "상승세"
                : report.search_trend.trend_direction === "falling" ? "하락세" : "안정"}
            </span>
            <span className="text-sm text-gray-500 tabular-nums">
              최근 3개월 {report.search_trend.trend_delta >= 0 ? "+" : ""}{report.search_trend.trend_delta.toFixed(1)}% 변화
            </span>
          </div>
          {report.search_trend.keywords_used.length > 0 && (
            <p className="text-sm text-gray-500 mb-2">측정 키워드: {report.search_trend.keywords_used.join(", ")}</p>
          )}
          {/* 절대 검색량 — DataLab 트렌드(%)는 방향만 알려주고 "한 달에 몇 번 검색되는지"라는
              규모는 안 줌. 이미 성장 리포트·블로그 진단이 쓰는 SearchAd 병합 패턴 재사용(2026-09-01). */}
          {!!report.search_trend.keyword_volumes?.length && (
            <div className="mb-3">
              <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-1.5">월간 검색량 (네이버 SearchAd)</p>
              <div className="flex flex-wrap gap-1.5">
                {report.search_trend.keyword_volumes.map((v, i) => (
                  <span key={i} className="text-sm bg-amber-50 text-amber-800 border border-amber-100 rounded-full px-3 py-1 tabular-nums">
                    {v.keyword} <span className="font-semibold">월 {v.monthly_volume.toLocaleString()}회</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400">* 네이버 DataLab 모바일 검색 기준. 측정 시점·기기에 따라 달라질 수 있음.</p>
        </section>
      )}

      {/* 진입 전략 — Claude가 위 실측 데이터를 종합해 만든 결과물이라는 걸 시각적으로도
          구분하기 위해 인디고 계열 강조를 이 섹션에서만 사용(시장 데이터=블루,
          경쟁사=에메랄드와 구분). 핵심 요약은 좌측 강조바, 핵심 액션은 번호 배지로
          "그냥 나열된 텍스트"가 아니라 우선순위가 있는 항목처럼 보이게 함. */}
      {report.strategy && (
        <section className="bg-white rounded-2xl p-5 md:p-7 shadow-sm mb-5">
          <SectionTitle>AI 진입 전략 상세</SectionTitle>
          <p className="text-sm text-gray-500 mb-4">위 "AI 종합 판단"의 근거가 된 구체적 실행 방안입니다.</p>

          {report.strategy.key_actions && (
            <div className="mb-5">
              <SubLabel colorClass="text-indigo-500">핵심 액션</SubLabel>
              <ol className="space-y-3">
                {report.strategy.key_actions.map((a, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm md:text-base text-gray-700 leading-relaxed">{a}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {report.strategy.ai_optimization_tips && (
            <div className="mb-5">
              <SubLabel colorClass="text-green-600">AI 최적화 팁</SubLabel>
              <ul className="space-y-3">
                {report.strategy.ai_optimization_tips.map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-none w-6 h-6 rounded-full bg-green-100 text-green-700 text-sm font-bold flex items-center justify-center mt-0.5">
                      ✓
                    </span>
                    <span className="text-sm md:text-base text-gray-700 leading-relaxed">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.strategy.risk_factors && (
            <div className="mb-5">
              <SubLabel colorClass="text-orange-500">주의사항</SubLabel>
              <div className="space-y-2.5">
                {report.strategy.risk_factors.map((r, i) => (
                  <div key={i} className="flex gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                    <span className="flex-none text-orange-600 font-bold">⚠</span>
                    <span className="text-sm md:text-base text-orange-900 leading-relaxed">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.strategy.estimated_time_to_visibility && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-1">예상 AI 노출 기간</p>
              <p className="text-sm md:text-base text-blue-800 leading-relaxed">{report.strategy.estimated_time_to_visibility}</p>
            </div>
          )}
        </section>
      )}

      {/* 다음 단계 */}
      <section className="bg-white rounded-2xl p-5 md:p-7 shadow-sm mb-5">
        <SectionTitle>다음 단계</SectionTitle>
        <p className="text-sm text-gray-600 mt-2 mb-4 leading-relaxed">창업을 진행하신다면, 사업장을 등록하고 실제 AI 검색 노출을 직접 스캔·관리해보세요. 위 진입 전략을 실행 가이드로 이어서 받아볼 수 있습니다.</p>
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
