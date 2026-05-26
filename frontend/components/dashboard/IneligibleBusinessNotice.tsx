"use client";

interface Props {
  category: string;
  categoryLabel: string;
  eligibility: "active" | "likely" | "inactive";
  isFranchise?: boolean;
}

export function IneligibleBusinessNotice({ categoryLabel, eligibility, isFranchise = false }: Props) {
  if (eligibility === "active") return null;

  const isInactive = eligibility === "inactive";

  const title = isFranchise
    ? "프랜차이즈 가맹점 — AI탭(전 업종) + 글로벌 AI 채널 집중 관리"
    : isInactive
    ? `${categoryLabel} 업종 — 네이버 AI탭(전 업종 베타) + ChatGPT·Gemini 장기 최적화 지원`
    : `${categoryLabel} 업종 — AI 브리핑 확대 예정 + 글로벌 AI 최적화 병행`;

  const description = isFranchise
    ? "네이버 AI 브리핑은 프랜차이즈 가맹점을 현재 지원하지 않습니다(추후 확대 예정). 대신 네이버 AI탭(모든 업종 가능, 베타)과 ChatGPT·Gemini·Google AI 노출을 집중 측정·개선합니다."
    : isInactive
    ? `${categoryLabel} 업종도 네이버 AI탭(2026-04-27 베타, 모든 업종 가능)을 통해 네이버에 노출될 수 있습니다. AEOlab이 AI탭 포함 4개 채널 노출 현황을 자동 측정하고 개선 방향을 제시합니다.`
    : "네이버 AI 브리핑 확대 시 즉시 활성화됩니다. 지금은 글로벌 AI 채널 데이터를 누적 중입니다.";

  const channels = isInactive || isFranchise
    ? [
        { icon: "✅", text: "네이버 AI 탭 — 2026-04-27 베타 공개, 전 업종 대상 대화형 검색 노출" },
        { icon: "🎯", text: "ChatGPT — 콘텐츠 구조화로 언급 가능성 장기 축적 (현재 측정 지원)" },
        { icon: "🎯", text: "Gemini — 사업장 정보 구조화 + 글로벌 웹 노출 기반 마련 (측정 지원)" },
        { icon: "🎯", text: "Google AI Overview — JSON-LD 구조화 데이터 생성 지원" },
        { icon: "✅", text: "네이버 블로그 · 일반 검색 — 지역 키워드 노출" },
      ]
    : [
        { icon: "✅", text: "네이버 AI 브리핑 (확대 즉시 활성화)" },
        { icon: "🎯", text: "ChatGPT · Gemini · Google AI — 글로벌 채널 측정 지원" },
        { icon: "✅", text: "네이버 AI 탭 — 전 업종 대상 대화형 검색" },
        { icon: "✅", text: "네이버 블로그 · 일반 검색" },
      ];

  return (
    <div
      className={`rounded-lg border p-4 md:p-6 mb-4 ${
        isInactive || isFranchise
          ? "bg-blue-50 border-blue-200"
          : "bg-indigo-50 border-indigo-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">
          {isFranchise ? "🌐" : isInactive ? "🌐" : "🔮"}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 break-keep">
            {title}
          </h3>
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed break-keep">
            {description}
          </p>
          <ul className="space-y-1.5 text-sm md:text-base text-gray-700">
            {channels.map((ch) => (
              <li key={ch.text}>{ch.icon} {ch.text}</li>
            ))}
          </ul>
          {(isInactive || isFranchise) && (
            <p className="mt-3 text-xs text-gray-400 leading-relaxed">
              🎯 ChatGPT·Gemini·Google AI Overview 노출은 AI 학습 데이터 기반이며 즉각적인 노출을 보장하지 않습니다. 콘텐츠·구조화 데이터 최적화를 통해 장기적 노출 가능성을 높입니다.
            </p>
          )}
          {isFranchise && (
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              출처:{" "}
              <a
                href="https://help.naver.com/service/30026/contents/24632"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                네이버 스마트플레이스 공식 안내
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
