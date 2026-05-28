"use client";

interface Props {
  geminiCount: number             // latestScan.gemini_result?.exposure_freq
  geminiSampleSize?: number       // 100 (full) 또는 50 (Basic 자동) 또는 10 (Quick) — 미지정 시 100 가정
  chatgptCount?: number           // latestScan.chatgpt_result?.exposure_freq
  chatgptSampleSize?: number      // 100 (full) / 50 (Basic 자동 A안) / 10 (Quick) / 미지정(legacy boolean)
  competitorCount: number    // 등록된 경쟁사 수
  topCompetitorGap?: number  // 1위 경쟁사와의 점수 차 (없으면 undefined)
  naverBriefing: boolean     // 네이버 AI 브리핑 노출 여부
  topMissingKeywords?: string[] // 없는 키워드 목록
  chatgptTopQuery?: string   // 신규: ChatGPT에서 실제로 언급된 대표 쿼리
  briefingEligibility?: "active" | "likely" | "inactive"
}

export default function ChatGPTDiffCard({
  geminiCount,
  geminiSampleSize,
  chatgptCount,
  chatgptSampleSize,
  competitorCount,
  topCompetitorGap,
  naverBriefing,
  topMissingKeywords = [],
  chatgptTopQuery,
  briefingEligibility,
}: Props) {
  const isNaverInactive = briefingEligibility === "inactive"
  const gN = geminiSampleSize && geminiSampleSize > 0 ? geminiSampleSize : 100;
  const cN = chatgptSampleSize && chatgptSampleSize > 0 ? chatgptSampleSize : 0;
  const chatgptHasSamples = cN >= 10 && chatgptCount !== undefined;
  const isQuickScan = gN <= 15;
  const items = [
    {
      label: isQuickScan
        ? `Gemini AI 빠른 진단 (${gN}회)`
        : `Gemini AI에 ${gN}회 자동 질의한 결과`,
      value: `${gN}회 중 ${geminiCount}회 언급`,
      detail: isQuickScan
        ? `수동 스캔 빠른 진단 결과 (${gN}회). 자동 스캔 시 50회 정밀 측정됩니다`
        : `AEOlab이 Gemini API를 ${gN}회 프로그래매틱 호출해 측정한 수치입니다`,
      highlight: geminiCount > 0,
    },
    ...(chatgptHasSamples ? [{
      label: cN <= 15
        ? `ChatGPT 빠른 진단 (${cN}회)`
        : `ChatGPT에 ${cN}회 자동 질의한 결과`,
      value: `${cN}회 중 ${chatgptCount}회 언급`,
      detail: cN <= 15
        ? `수동 스캔 빠른 진단 결과 (${cN}회). 자동 스캔 시 50회 정밀 측정됩니다`
        : `OpenAI GPT-4.1-mini를 ${cN}회 호출해 ChatGPT가 내 가게를 얼마나 자주 추천하는지 직접 측정했습니다`,
      highlight: (chatgptCount ?? 0) > 0,
    }] : []),
    {
      label: "네이버 AI 브리핑 실시간 확인",
      value: isNaverInactive
        ? "이 업종 해당 없음"
        : naverBriefing ? "현재 노출 중" : "현재 미노출",
      detail: isNaverInactive
        ? "이 업종은 네이버 AI 브리핑 노출 대상이 아닙니다. 글로벌 AI 채널 중심으로 최적화하세요."
        : "실제 네이버 검색 결과를 직접 파싱합니다. ChatGPT는 네이버 결과를 볼 수 없습니다",
      highlight: !isNaverInactive && naverBriefing,
      inactive: isNaverInactive,
    },
    {
      label: "네이버 AI탭 노출 확인",
      value: "6월 전체 확대 후 자동 측정",
      detail: "6월 AI탭 전체 확대 후 실시간 자동 측정됩니다. ChatGPT는 네이버 AI탭 결과를 알 수 없습니다",
      highlight: false,
      inactive: true,
    },
    {
      label: "경쟁사 비교 분석",
      value: competitorCount > 0
        ? topCompetitorGap !== undefined
          ? topCompetitorGap === 0
            ? "경쟁사 중 1위!"
            : `1위보다 ${topCompetitorGap}점 부족`
          : `경쟁사 ${competitorCount}곳 비교 중`
        : "경쟁사를 등록하면 비교 시작",
      detail: "ChatGPT는 경쟁 가게들의 AI 인식도를 알 수 없습니다",
      highlight: competitorCount > 0,
    },
    {
      label: "없는 키워드 특정",
      value: topMissingKeywords.length > 0
        ? topMissingKeywords.map((kw) => `'${kw}'`).join(" · ") + " 누락"
        : "업종별 키워드 분석 완료",
      detail: topMissingKeywords.length > 0
        ? "업종 핵심 키워드 중 소개글·리뷰에서 발견되지 않은 키워드입니다. 소개글·소식에 추가하면 키워드 점수가 다음 스캔에서 오르고, 네이버 AI 브리핑 노출 가능성도 개선됩니다."
        : "ChatGPT는 내 가게에 '어떤 키워드가 없는지' 구체적으로 알 수 없습니다",
      highlight: topMissingKeywords.length > 0,
    },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">
          ChatGPT가 알 수 없는 것
        </span>
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-sm text-slate-500">AEOlab 자동 측정</span>
      </div>

      {/* ChatGPT 단기 개선 불가 안내 */}
      <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
        <span className="text-amber-500 text-sm mt-0.5 shrink-0">⚠</span>
        <p className="text-sm text-amber-800 leading-snug">
          <span className="font-semibold">ChatGPT 인식은 학습 데이터(컷오프 2024.06) 기반입니다.</span>{" "}
          블로그·소개글 작성으로 단기 변동이 없으며, 수개월~1년 후 모델 업데이트 시 반영됩니다. <span className="font-medium">현재 인식 현황 파악 목적으로 활용하세요.</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border p-3 flex flex-col gap-1 ${'inactive' in item && item.inactive ? 'bg-gray-50 border-gray-100' : 'bg-white border-slate-100'}`}
          >
            <p className={`text-sm font-semibold ${'inactive' in item && item.inactive ? 'text-gray-400' : 'text-slate-600'}`}>{item.label}</p>
            <p className={`text-sm font-bold ${'inactive' in item && item.inactive ? 'text-gray-400' : item.highlight ? 'text-blue-700' : 'text-slate-700'}`}>
              {item.value}
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500 mt-3 text-center">
        Gemini·ChatGPT 자동 측정 · 네이버 AI 브리핑·AI탭 DOM 파싱 · 경쟁사 자동 비교 — 대화형 ChatGPT로는 자동화할 수 없는 영역입니다
      </p>

      {/* ChatGPT 대비 차별화 — 실측 데이터 강조 */}
      <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
        <p className="text-sm font-semibold text-indigo-800 mb-1">
          ChatGPT가 절대 알 수 없는 것
        </p>
        <ul className="space-y-1 text-sm text-indigo-700">
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-indigo-400 shrink-0">✓</span>
            <span>인근 경쟁사 {competitorCount > 0 ? `${competitorCount}곳의` : ""} 실제 AI 노출 점수</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-indigo-400 shrink-0">✓</span>
            <span>매주 자동 측정 + 점수 변화 알림</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 text-indigo-400 shrink-0">✓</span>
            <span>네이버 AI 브리핑·AI탭 노출 직접 파싱</span>
          </li>
          {chatgptTopQuery && (
            <li className="flex items-start gap-1.5">
              <span className="mt-0.5 text-emerald-500 shrink-0">🔍</span>
              <span>
                <span className="font-semibold">실측 인용 쿼리:</span>{" "}
                <span className="font-mono text-sm bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                  {chatgptTopQuery}
                </span>
              </span>
            </li>
          )}
        </ul>
        <p className="mt-2 text-sm text-indigo-600 leading-snug">
          <strong>측정 원리 차이:</strong> ChatGPT(gpt-4.1-mini)는 학습 데이터(컷오프 2024.06) 기반 — 한국 지역 소상공인은 데이터 포함률이 낮아 낮은 점수가 일반적입니다. Gemini는 Google Search 실시간 그라운딩 기반으로 현재 웹 콘텐츠를 반영합니다.
        </p>
      </div>
    </div>
  );
}
