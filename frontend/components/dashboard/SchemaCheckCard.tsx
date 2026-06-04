import Link from "next/link";
import type { WebsiteCheckResult } from "@/types";

const GOOGLE_BUSINESS_URL = "https://business.google.com";
const GOOGLE_RICHRESULTS_URL = "https://search.google.com/test/rich-results";

interface Props {
  schemaSeoScore: number | null;
  websiteUrl?: string | null;
  websiteCheckResult?: WebsiteCheckResult | null;
  plan: string;
  googlePlaceRegistered?: boolean;
}

// 웹사이트 내용 fetch로 확인하는 항목 (에러 시 unknown 처리)
const CONTENT_ITEMS = [
  {
    key: "has_json_ld" as const,
    label: "AI 자동 인식 코드",
    desc: "ChatGPT·Gemini가 가게 정보를 읽는 핵심 코드",
    priority: "필수" as const,
    fixable: true,
  },
  {
    key: "has_schema_local_business" as const,
    label: "업종·위치 구조화 등록",
    desc: "AI 지도 검색에서 업종·주소 자동 분류",
    priority: "필수" as const,
    fixable: true,
  },
  {
    key: "has_open_graph" as const,
    label: "SNS 공유 미리보기",
    desc: "링크 공유 시 가게 이름·사진 자동 표시",
    priority: "권장" as const,
    fixable: false,
  },
  {
    key: "is_mobile_friendly" as const,
    label: "모바일 화면 최적화",
    desc: "스마트폰에서 정상 표시",
    priority: "권장" as const,
    fixable: false,
  },
];

const PRIORITY_STYLE = {
  필수: "bg-red-100 text-red-700",
  권장: "bg-amber-100 text-amber-700",
  선택: "bg-gray-100 text-gray-500",
} as const;

type ItemState = "done" | "undone" | "unknown";

interface DisplayItem {
  label: string;
  desc: string;
  priority: "필수" | "권장" | "선택";
  state: ItemState;
  fixable?: boolean;
  externalHref?: string;
  externalLabel?: string;
}

export default function SchemaCheckCard({
  schemaSeoScore,
  websiteUrl,
  websiteCheckResult,
  plan,
  googlePlaceRegistered,
}: Props) {
  const canGenerate = plan !== "free";
  const fetchError = websiteCheckResult?.error ?? null;

  // 스캔 데이터 없음
  if (schemaSeoScore === null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-800">AI에 가게 정보 등록</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">설정 현황</span>
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
          <span className="text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">홈페이지 없음</span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed break-keep">
          독립 웹사이트가 없어도 네이버·카카오맵 채널로 이용이 가능합니다.
          ChatGPT·Gemini 노출을 더 높이려면 웹사이트를 추가하거나 카카오맵 비즈니스 채널을 등록하면 됩니다.
        </p>
        <Link
          href="/schema"
          className="mt-3 inline-block text-sm text-blue-600 font-medium underline"
        >
          AI 최적화 소개글·블로그 초안 자동 생성하기 →
        </Link>
      </div>
    );
  }

  // 항목 상태 계산
  // is_https는 URL 파싱 결과라 에러 시에도 유효
  const httpsItem: DisplayItem = {
    label: "보안 웹사이트(HTTPS)",
    desc: "구글 검색 신뢰도에 영향",
    priority: "권장",
    state: websiteCheckResult ? (websiteCheckResult.is_https ? "done" : "undone") : "unknown",
    fixable: false,
  };

  const contentItems: DisplayItem[] = CONTENT_ITEMS.map((item) => ({
    label: item.label,
    desc: item.desc,
    priority: item.priority,
    fixable: item.fixable,
    // 에러이거나 websiteCheckResult가 없으면 unknown
    state: !websiteCheckResult || fetchError
      ? "unknown"
      : (websiteCheckResult[item.key] ? "done" : "undone"),
  }));

  const googleItem: DisplayItem = {
    label: "Google 비즈니스 프로필",
    desc: "구글 지도·AI 검색에 가게 정보 등록",
    priority: "선택",
    state: googlePlaceRegistered ? "done" : "undone",
    externalHref: GOOGLE_BUSINESS_URL,
    externalLabel: googlePlaceRegistered ? "관리하기 →" : "등록하기 →",
  };

  const allItems: DisplayItem[] = [...contentItems, httpsItem, googleItem];

  const doneCount = allItems.filter((i) => i.state === "done").length;
  const totalCount = allItems.length;
  const allDone = allItems.every((i) => i.state === "done");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">AI에 가게 정보 등록</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">설정 현황</span>
        </div>
        <span className={`text-sm font-semibold ${allDone ? "text-emerald-600" : "text-gray-500"}`}>
          {doneCount} / {totalCount} 완료
        </span>
      </div>

      {/* 웹사이트 접근 오류 배너 */}
      {fetchError && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700 break-keep">
          웹사이트 접근 오류 ({fetchError}) — 일부 항목을 확인하지 못했습니다. 스캔을 다시 시도해 주세요.
        </div>
      )}

      {/* 항목 목록 */}
      <div className="space-y-3 mb-4">
        {allItems.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            {/* 상태 아이콘 */}
            <span className={`shrink-0 mt-0.5 text-sm font-bold w-4 text-center ${
              item.state === "done" ? "text-emerald-500" : "text-gray-300"
            }`}>
              {item.state === "done" ? "✓" : item.state === "unknown" ? "?" : "✕"}
            </span>

            {/* 라벨 + 설명 */}
            <div className="flex-1 min-w-0">
              <span className={`text-sm break-keep ${
                item.state === "done"
                  ? "text-gray-400 line-through"
                  : item.state === "unknown"
                  ? "text-gray-400"
                  : "text-gray-700 font-medium"
              }`}>
                {item.label}
              </span>
              {/* 미설정 항목에만 설명 표시 */}
              {item.state === "undone" && (
                <p className="text-xs text-gray-400 mt-0.5 break-keep">{item.desc}</p>
              )}
              {item.state === "unknown" && (
                <p className="text-xs text-gray-400 mt-0.5">확인 불가</p>
              )}
            </div>

            {/* 오른쪽 액션 */}
            {item.state === "undone" && (
              <div className="shrink-0">
                {item.externalHref ? (
                  <a
                    href={item.externalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
                  >
                    {item.externalLabel ?? "등록하기 →"}
                  </a>
                ) : item.fixable && canGenerate ? (
                  <Link
                    href="/schema"
                    className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
                  >
                    생성하기 →
                  </Link>
                ) : (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_STYLE[item.priority]}`}>
                    {item.priority}
                  </span>
                )}
              </div>
            )}
            {/* Google Business — 완료 시에도 관리 링크 표시 */}
            {item.state === "done" && item.externalHref && (
              <a
                href={item.externalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-gray-400 hover:underline whitespace-nowrap mt-0.5"
              >
                {item.externalLabel}
              </a>
            )}
          </div>
        ))}
      </div>

      {/* 미설정 안내 */}
      {!allDone && (
        <p className="text-sm text-gray-500 mb-3 leading-relaxed break-keep">
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
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
            <p className="text-sm text-gray-500 mb-2">AI 검색 코드 자동 생성은 Basic 플랜(월 9,900원)부터</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href="/pricing" className="text-sm font-semibold text-blue-600 hover:underline">
                플랜 업그레이드 →
              </Link>
              <a
                href={GOOGLE_RICHRESULTS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:underline"
              >
                직접 등록 방법 보기 →
              </a>
            </div>
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
