"use client";

import { getUserGroup, type UserGroup } from "@/lib/userGroup";

export type ChannelDiffVariant = "landing" | "dashboard" | "preview" | "compact";

interface Props {
  category?: string | null;
  isFranchise?: boolean;
  variant?: ChannelDiffVariant;
  /** fetchBriefingCategories()/useBriefingCategories()로 가져온 동적 목록. 미전달 시 하드코딩 fallback. */
  activeOverride?: readonly string[];
  likelyOverride?: readonly string[];
}

// 업종별 분기 메시지 (지시서 원문 그대로)
function getSummaryMessage(group: UserGroup | "unknown"): string {
  if (group === "ACTIVE") {
    return "음식점/카페/바/베이커리/숙박업은 3개 채널 모두에서 노출 가능합니다.";
  }
  if (group === "franchise") {
    return "프랜차이즈 가맹점은 '플레이스형' 네이버 AI 브리핑 대상에서 제외됩니다(네이버 공식 정책). 단, '정보형 AI 브리핑'과 AI탭·ChatGPT·Gemini·Google AI에서는 노출 가능합니다.";
  }
  if (group === "LIKELY") {
    return "현재 AI 탭과 글로벌 AI 2개 채널에서 노출 가능하며, 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다. '플레이스형' AI 브리핑은 곧 확대 예정입니다.";
  }
  if (group === "INACTIVE") {
    return "AI탭과 글로벌 AI 2개 채널에서 노출 가능합니다. '플레이스형' AI 브리핑 비대상이나 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능하며, 핵심 채널 모두 측정합니다.";
  }
  // category=null (비로그인 방문자 등)
  return "당신의 업종에 따라 최적화된 채널을 자동으로 분기하여 측정합니다.";
}

// variant="preview" 업종별 강조 문구
function getPreviewChannelCount(group: UserGroup | "unknown"): string {
  if (group === "ACTIVE") return "3개 채널";
  if (group === "franchise") return "2개 채널";
  if (group === "LIKELY") return "2개 채널 (AI 브리핑 확대 예정)";
  if (group === "INACTIVE") return "2개 채널";
  return "업종 맞춤 채널";
}

interface ChannelCardProps {
  color: "green" | "blue" | "purple";
  title: string;
  badge: string;
  badgeVariant: "active" | "soon" | "excluded" | "all";
  description: string;
  disclaimer: string;
  highlight?: boolean;
  compact?: boolean;
}

function ChannelCard({
  color,
  title,
  badge,
  badgeVariant,
  description,
  disclaimer,
  highlight,
  compact,
}: ChannelCardProps) {
  const borderMap = {
    green: highlight ? "border-green-300 bg-green-50" : "border-gray-200 bg-white",
    blue: highlight ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white",
    purple: highlight ? "border-purple-300 bg-purple-50" : "border-gray-200 bg-white",
  };

  const badgeMap: Record<ChannelCardProps["badgeVariant"], string> = {
    active: "bg-green-100 text-green-800 border border-green-200",
    soon: "bg-blue-100 text-blue-800 border border-blue-200",
    excluded: "bg-gray-100 text-gray-500 border border-gray-200",
    all: "bg-green-100 text-green-800 border border-green-200",
  };

  const dotMap = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
  };

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-2 ${borderMap[color]} ${
        compact ? "min-w-0" : ""
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotMap[color]}`} />
        <span className="text-sm font-bold text-gray-900 leading-snug">{title}</span>
        <span
          className={`inline-flex items-center text-sm font-semibold px-2 py-0.5 rounded-full ${badgeMap[badgeVariant]}`}
        >
          {badge}
        </span>
      </div>

      {!compact && (
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      )}

      <p className="text-sm text-gray-500 leading-snug">{disclaimer}</p>
    </div>
  );
}

export default function ChannelDifferentiationCard({
  category,
  isFranchise = false,
  variant = "dashboard",
  activeOverride,
  likelyOverride,
}: Props) {
  const group: UserGroup | "unknown" =
    category == null
      ? "unknown"
      : getUserGroup(category, isFranchise, activeOverride, likelyOverride);

  // 네이버 AI 브리핑 배지 분기
  const briefingBadge: ChannelCardProps["badgeVariant"] =
    group === "ACTIVE"
      ? "active"
      : group === "LIKELY"
      ? "soon"
      : "excluded";

  const briefingBadgeText =
    group === "ACTIVE"
      ? "활성"
      : group === "LIKELY"
      ? "곧 확대 예정"
      : "대상 외";

  const summaryMessage = getSummaryMessage(group);
  const isCompact = variant === "compact";
  const isLanding = variant === "landing";

  const wrapClass = isCompact
    ? "flex flex-col sm:flex-row gap-3"
    : "flex flex-col gap-3";

  return (
    <div className={`${isLanding ? "rounded-2xl border border-blue-100 bg-white p-5 md:p-7 shadow-sm" : "rounded-xl"}`}>
      {isLanding && (
        <div className="mb-4">
          <p className="text-sm font-bold tracking-widest mb-1" style={{ color: "#2563EB" }}>
            AI 채널 3종 측정
          </p>
          <h3
            className="text-xl md:text-2xl font-black break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.4px" }}
          >
            어떤 업종이든 AI 채널에서 측정합니다
          </h3>
          <p className="text-sm md:text-base mt-1 break-keep" style={{ color: "#475569" }}>
            단 1개 채널도 측정 못 하는 업종은 없습니다. 업종에 따라 강조 채널이 다를 뿐입니다.
          </p>
        </div>
      )}

      {variant === "preview" && (
        <div className="mb-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
          <p className="text-sm font-semibold text-indigo-800">
            당신의 업종은 <span className="font-black">{getPreviewChannelCount(group)}</span>에서 측정됩니다
          </p>
          <p className="text-sm text-indigo-600 mt-0.5">{summaryMessage}</p>
        </div>
      )}

      <div className={wrapClass}>
        {/* 채널 1: 네이버 AI 브리핑 */}
        <ChannelCard
          color="green"
          title="네이버 AI 브리핑"
          badge={briefingBadgeText}
          badgeVariant={briefingBadge}
          description="검색 결과 상단 AI 자동 추천. 음식점·카페·숙박 등 대상 (프랜차이즈 제외)"
          disclaimer="노출 보장 없음 · 네이버 알고리즘 기준"
          highlight={group === "ACTIVE"}
          compact={isCompact}
        />

        {/* 채널 2: 네이버 AI 탭 */}
        <ChannelCard
          color="blue"
          title="네이버 AI 탭"
          badge="참여 가능"
          badgeVariant="all"
          description="검색 'AI' 탭. 업종 제한 없이 모두 노출 가능 (2026-06-25 정식 출시)"
          disclaimer="정식 출시 · 콘텐츠 품질에 따라 다름"
          highlight={group !== "ACTIVE"}
          compact={isCompact}
        />

        {/* 채널 3: ChatGPT·Gemini·Google AI */}
        <ChannelCard
          color="purple"
          title="ChatGPT·Gemini·Google AI"
          badge="측정 중"
          badgeVariant="all"
          description="ChatGPT·Gemini에 가게가 언급되는지 자동 측정. 네이버 검색과 별개의 채널"
          disclaimer="ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다"
          highlight={true}
          compact={isCompact}
        />
      </div>

      {/* 업종별 맞춤 안내 박스 */}
      <div
        className={`mt-3 rounded-xl px-4 py-3 border ${
          group === "ACTIVE"
            ? "bg-green-50 border-green-200"
            : group === "LIKELY"
            ? "bg-blue-50 border-blue-200"
            : group === "franchise"
            ? "bg-purple-50 border-purple-200"
            : group === "INACTIVE"
            ? "bg-amber-50 border-amber-200"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        <p
          className={`text-sm font-semibold leading-relaxed ${
            group === "ACTIVE"
              ? "text-green-800"
              : group === "LIKELY"
              ? "text-blue-800"
              : group === "franchise"
              ? "text-purple-800"
              : group === "INACTIVE"
              ? "text-amber-800"
              : "text-gray-700"
          }`}
        >
          {summaryMessage}
        </p>
      </div>
    </div>
  );
}
