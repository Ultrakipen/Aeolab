interface ChannelTimelineBoxProps {
  briefingEligibility?: "active" | "likely" | "inactive";
  compact?: boolean;
  /** true 시 글로벌 AI 3채널(ChatGPT·Gemini·Google AI)만 표시 */
  globalOnly?: boolean;
}

interface ChannelRow {
  channel: string;
  duration: string;
  durationColor: string;
  note: string;
  extraNote?: string;
  showOnlyFor?: "active_likely";
  isGlobal?: boolean;
}

const CHANNEL_ROWS: ChannelRow[] = [
  {
    channel: "네이버 AI탭",
    duration: "2~4주",
    durationColor: "text-green-600",
    note: "스마트플레이스 최적화 후 반영",
  },
  {
    channel: "네이버 일반검색",
    duration: "2~4주",
    durationColor: "text-green-600",
    note: "소개글·리뷰 업데이트 후 반영",
  },
  {
    channel: "네이버 AI 브리핑",
    duration: "2~4주",
    durationColor: "text-green-600",
    note: "AI 정보 탭 ON + 리뷰 확보 후",
    showOnlyFor: "active_likely",
  },
  {
    channel: "Gemini",
    duration: "수 주~수개월",
    durationColor: "text-blue-600",
    note: "Google 검색 실시간 연동 (GBP 등록 후 반영 시작)",
    isGlobal: true,
  },
  {
    channel: "ChatGPT",
    duration: "수개월~1년",
    durationColor: "text-amber-600",
    note: "AI 학습 데이터 기반 — 단기 변동 없음",
    extraNote: "(지금 낮아도 정상)",
    isGlobal: true,
  },
  {
    channel: "Google AI",
    duration: "수 주~수개월",
    durationColor: "text-orange-500",
    note: "구글 비즈니스 프로필 + JSON-LD 등록 후 반영",
    isGlobal: true,
  },
];

export default function ChannelTimelineBox({
  briefingEligibility,
  compact = false,
  globalOnly = false,
}: ChannelTimelineBoxProps) {
  const isActiveLikely =
    briefingEligibility === "active" || briefingEligibility === "likely";

  const visibleRows = CHANNEL_ROWS.filter((row) => {
    if (globalOnly && !row.isGlobal) return false;
    if (row.showOnlyFor === "active_likely") return isActiveLikely;
    return true;
  });

  /* globalOnly: 1행 가로 나열 */
  if (globalOnly) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 py-1.5">
        {visibleRows.map((row, i) => (
          <span key={row.channel} className="flex items-center gap-1.5 text-sm">
            {i > 0 && <span className="text-gray-300 select-none">·</span>}
            <span className="text-gray-600">{row.channel}</span>
            <span className={`font-bold ${row.durationColor}`}>{row.duration}</span>
          </span>
        ))}
        <span className="text-xs text-gray-500 ml-auto">참고값</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">
        개선 효과가 나타나기까지
      </p>
      <div className="space-y-1.5">
        {visibleRows.map((row) => (
          <div key={row.channel} className="flex items-center gap-2">
            <span
              className="text-sm font-medium text-gray-700 shrink-0"
              style={{ minWidth: "112px" }}
            >
              {row.channel}
            </span>
            <span className={`text-sm font-bold shrink-0 ${row.durationColor}`}>
              {row.duration}
            </span>
            {!compact && (
              <span className="text-sm text-gray-500 min-w-0">
                {row.note}
                {row.extraNote && (
                  <span className="ml-1 text-amber-600 font-medium">
                    {row.extraNote}
                  </span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2 leading-snug">
        꾸준한 관리 활동 기준 참고값입니다
      </p>
    </div>
  );
}
