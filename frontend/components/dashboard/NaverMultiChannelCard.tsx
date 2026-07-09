import { MessageCircle, HelpCircle } from "lucide-react";

interface CafeResult {
  mentioned: boolean;
  mention_count: number;
  exposure_score: number;
  top_excerpts: string[];
}

interface JisikResult {
  mentioned: boolean;
  mention_count: number;
  exposure_score: number;
  top_excerpts: string[];
}

interface Props {
  cafeResult: CafeResult | null;
  jisikResult: JisikResult | null;
}

function ChannelBlock({
  icon,
  label,
  mentioned,
  mentionCount,
  topExcerpt,
}: {
  icon: React.ReactNode;
  label: string;
  mentioned: boolean;
  mentionCount: number;
  topExcerpt?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">{icon}</span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      {mentioned ? (
        <span className="inline-flex w-fit items-center rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800">
          언급 {mentionCount}건
        </span>
      ) : (
        <span className="inline-flex w-fit items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-500">
          언급 없음
        </span>
      )}
      {topExcerpt && (
        <p className="text-sm text-gray-500 leading-snug line-clamp-2 break-all">
          &ldquo;{topExcerpt.length > 60 ? topExcerpt.slice(0, 60) + "…" : topExcerpt}&rdquo;
        </p>
      )}
    </div>
  );
}

export default function NaverMultiChannelCard({ cafeResult, jisikResult }: Props) {
  // 데이터 없으면 숨김 — NAVER_MULTICH_ENABLED=false 상태
  if (!cafeResult && !jisikResult) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 mb-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">
          네이버 카페·지식인 언급 현황
        </h3>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-sm font-medium text-blue-600 border border-blue-200">
          측정 데이터
        </span>
      </div>

      {/* 2열 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {cafeResult && (
          <ChannelBlock
            icon={<MessageCircle size={16} />}
            label="네이버 카페"
            mentioned={cafeResult.mentioned}
            mentionCount={cafeResult.mention_count}
            topExcerpt={cafeResult.top_excerpts?.[0]}
          />
        )}
        {jisikResult && (
          <ChannelBlock
            icon={<HelpCircle size={16} />}
            label="네이버 지식인"
            mentioned={jisikResult.mentioned}
            mentionCount={jisikResult.mention_count}
            topExcerpt={jisikResult.top_excerpts?.[0]}
          />
        )}
      </div>

      {/* 면책 문구 */}
      <p className="mt-4 text-sm text-gray-500 leading-snug">
        측정 시점·검색어에 따라 달라질 수 있음. 일 25,000건 API 공유 한도 내 측정.
      </p>
    </div>
  );
}
