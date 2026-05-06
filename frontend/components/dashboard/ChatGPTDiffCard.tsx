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
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          ChatGPT가 알 수 없는 것
        </span>
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">AEOlab 자동 측정</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-slate-100 p-3 flex flex-col gap-1"
          >
            <p className="text-xs font-semibold text-slate-500">{item.label}</p>
            <p className={`text-sm font-bold ${item.highlight ? "text-blue-700" : "text-slate-700"}`}>
              {item.value}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500 mt-3 text-center">
        Gemini·ChatGPT 자동 측정 · 네이버 AI 브리핑 DOM 파싱 · 경쟁사 자동 비교 — 대화형 ChatGPT로는 자동화할 수 없는 영역입니다
      </p>
    </div>
  );
}
