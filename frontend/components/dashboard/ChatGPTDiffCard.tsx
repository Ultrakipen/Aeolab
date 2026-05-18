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
}: Props) {
  const gN = geminiSampleSize && geminiSampleSize > 0 ? geminiSampleSize : 100;
  const cN = chatgptSampleSize && chatgptSampleSize > 0 ? chatgptSampleSize : 0;
  const chatgptHasSamples = cN >= 10 && chatgptCount !== undefined;
  const items = [
    {
      label: `Gemini AI에 ${gN}회 자동 질의한 결과`,
      value: `${gN}회 중 ${geminiCount}회 언급`,
      detail: `AEOlab이 Gemini API를 ${gN}회 프로그래매틱 호출해 측정한 수치입니다`,
      highlight: geminiCount > 0,
    },
    ...(chatgptHasSamples ? [{
      label: `ChatGPT에 ${cN}회 자동 질의한 결과`,
      value: `${cN}회 중 ${chatgptCount}회 언급`,
      detail: `OpenAI GPT-4o-mini를 ${cN}회 호출해 ChatGPT가 내 가게를 얼마나 자주 추천하는지 직접 측정했습니다`,
      highlight: (chatgptCount ?? 0) > 0,
    }] : []),
    {
      label: "네이버 AI 브리핑 실시간 확인",
      value: naverBriefing ? "현재 노출 중" : "현재 미노출",
      detail: "실제 네이버 검색 결과를 직접 파싱합니다. ChatGPT는 네이버 결과를 볼 수 없습니다",
      highlight: naverBriefing,
    },
    {
      label: "경쟁사 비교 분석",
      value: competitorCount > 0
        ? topCompetitorGap !== undefined
          ? `1위보다 ${topCompetitorGap}점 부족`
          : `경쟁사 ${competitorCount}곳 비교 중`
        : "경쟁사를 등록하면 비교 시작",
      detail: "ChatGPT는 경쟁 가게들의 AI 노출 점수를 알 수 없습니다",
      highlight: competitorCount > 0,
    },
    {
      label: "없는 키워드 특정",
      value: topMissingKeywords.length > 0
        ? topMissingKeywords.map((kw) => `'${kw}'`).join(" · ") + " 미보유"
        : "업종별 키워드 분석 완료",
      detail: "ChatGPT는 내 가게에 '어떤 키워드가 없는지' 구체적으로 알 수 없습니다",
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-slate-100 p-3 flex flex-col gap-1"
          >
            <p className="text-sm font-semibold text-slate-600">{item.label}</p>
            <p className={`text-sm font-bold ${item.highlight ? "text-blue-700" : "text-slate-700"}`}>
              {item.value}
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500 mt-3 text-center">
        Gemini·ChatGPT 자동 측정 · 네이버 AI 브리핑 DOM 파싱 · 경쟁사 자동 비교 — 대화형 ChatGPT로는 자동화할 수 없는 영역입니다
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
                <span className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                  {chatgptTopQuery}
                </span>
              </span>
            </li>
          )}
        </ul>
        <p className="mt-2 text-xs text-indigo-400">
          ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다
        </p>
      </div>
    </div>
  );
}
