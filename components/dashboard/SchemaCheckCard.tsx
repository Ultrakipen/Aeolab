import Link from "next/link";
import type { WebsiteCheckResult } from "@/types";

const GOOGLE_BUSINESS_URL = "https://business.google.com";

interface Props {
  schemaSeoScore: number | null;
  websiteUrl?: string | null;
  websiteCheckResult?: WebsiteCheckResult | null;
  plan: string;
  googlePlaceRegistered?: boolean;
}

const ITEMS = [
  { key: "has_json_ld",               label: "AI가 읽는 가게 정보 코드",       priority: "필수" as const },
  { key: "has_schema_local_business",  label: "가게 종류·위치 등록",             priority: "필수" as const },
  { key: "has_open_graph",             label: "SNS 공유 시 가게 이름·사진 표시", priority: "권장" as const },
  { key: "is_mobile_friendly",         label: "모바일 화면 최적화",              priority: "권장" as const },
] as const;

const PRIORITY_STYLE = {
  필수: "bg-red-100 text-red-700",
  권장: "bg-amber-100 text-amber-700",
  선택: "bg-gray-100 text-gray-500",
};

export default function SchemaCheckCard({ schemaSeoScore, websiteUrl, websiteCheckResult, plan, googlePlaceRegistered }: Props) {
  const canGenerate = plan !== "free";

  // 스캔 데이터 없음
  if (schemaSeoScore === null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-800">AI에 가게 정보 등록</span>
          <span className="text-sm text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">설정 현황</span>
        </div>
        <p className="text-sm text-gray-500">첫 스캔 후 웹사이트 AI 인식 설정 현황이 표시됩니다.</p>
      </div>
    );
  }

  // 홈페이지 없음
  if (!websiteUrl) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-800">AI에 가게 정보 등록</span>
          <span className="text-sm text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">홈페이지 없음</span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed break-keep">
          독립 웹사이트가 없어도 네이버·카카오맵 채널로 이용이 가능합니다.
          ChatGPT·Gemini 노출을 더 높이려면 웹사이트를 추가하거나 카카오맵 비즈니스 채널을 등록하면 됩니다.
        </p>
        <Link
          href="/schema"
          className="mt-3 inline-block text-sm text-blue-600 font-medium underline"
        >
          AI 최적화 소개글 · 블로그 초안 만들기 →
        </Link>
      </div>
    );
  }

  const websiteMissingItems = ITEMS.filter(
    (item) => websiteCheckResult && !websiteCheckResult[item.key],
  );
  const googleMissing = !googlePlaceRegistered;

  const allItems: { label: string; priority: "필수" | "권장" | "선택"; done: boolean }[] = [
    ...ITEMS.map((item) => ({
      label: item.label,
      priority: item.priority,
      done: !!(websiteCheckResult && websiteCheckResult[item.key]),
    })),
    { label: "Google Business 프로필 등록", priority: "선택" as const, done: !googleMissing },
  ];

  const doneCount = allItems.filter((i) => i.done).length;
  const totalCount = allItems.length;
  const allDone = doneCount === totalCount;
  const missingItems = allItems.filter((i) => !i.done);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">AI에 가게 정보 등록</span>
          <span className="text-sm text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">설정 현황</span>
        </div>
        <span className={`text-sm font-semibold ${allDone ? "text-emerald-600" : "text-gray-500"}`}>
          {doneCount} / {totalCount} 설정 완료
        </span>
      </div>

      {/* 항목 목록 */}
      <div className="space-y-2 mb-4">
        {allItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`shrink-0 text-sm ${item.done ? "text-emerald-500" : "text-gray-300"}`}>
              {item.done ? "✓" : "✕"}
            </span>
            <span className={`text-sm flex-1 break-keep ${item.done ? "text-gray-400 line-through" : "text-gray-700"}`}>
              {item.label}
            </span>
            {!item.done && item.label === "Google Business 프로필 등록" && (
              <a
                href={GOOGLE_BUSINESS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
              >
                등록하기 →
              </a>
            )}
            {!item.done && item.label !== "Google Business 프로필 등록" && (
              <span className={`shrink-0 text-sm font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_STYLE[item.priority]}`}>
                {item.priority}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 미설정 안내 */}
      {!allDone && (
        <p className="text-sm text-gray-500 mb-4 leading-relaxed break-keep">
          설정 시 ChatGPT·구글 AI 검색에서 가게 정보 노출 가능성이 높아집니다.
        </p>
      )}

      {/* CTA */}
      {!allDone && (
        canGenerate ? (
          <Link
            href="/schema"
            className="w-full block text-center text-sm font-semibold bg-blue-600 text-white rounded-xl py-2.5 hover:bg-blue-700 transition-colors"
          >
            AI 검색 등록 코드 자동 생성 →
          </Link>
        ) : (
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
            <p className="text-sm text-gray-500">AI 검색 코드 자동 생성은 Basic 플랜(월 9,900원)부터</p>
            <Link href="/pricing" className="text-sm font-semibold text-blue-600 hover:underline">
              플랜 업그레이드 →
            </Link>
          </div>
        )
      )}

      {/* 완료 상태 */}
      {allDone && (
        <p className="text-sm text-emerald-700 font-semibold text-center">
          AI 검색 인식 설정이 모두 완료됐습니다!
        </p>
      )}
    </div>
  );
}
