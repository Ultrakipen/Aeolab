"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

interface FeatureListProps {
  features: string[];
  isHighlight?: boolean;
  /** 모바일에서 기본으로 표시할 항목 수 (기본값 3) */
  mobileShowCount?: number;
  /** 창업 패키지용 2컬럼 그리드 레이아웃 여부 */
  grid?: boolean;
}

export function FeatureList({
  features,
  isHighlight = false,
  mobileShowCount = 3,
  grid = false,
}: FeatureListProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = features.length > mobileShowCount;

  const iconClass = (isUnlimited: boolean) => {
    if (isHighlight) return "text-blue-500";
    if (isUnlimited) return "text-emerald-500";
    return "text-blue-500";
  };

  return (
    <div>
      <ul
        className={
          grid
            ? "grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 mb-5"
            : "space-y-3"
        }
      >
        {features.map((f, i) => {
          const isUnlimited = f.includes("무제한");
          const hiddenOnMobile = !expanded && i >= mobileShowCount;

          return (
            <li
              key={f}
              className={`flex items-start gap-2.5 leading-snug text-base md:text-sm ${
                isUnlimited
                  ? "text-emerald-700 font-medium"
                  : "text-gray-700"
              } ${hiddenOnMobile ? "hidden md:flex" : "flex"}`}
            >
              <CheckCircle2
                className={`w-4 h-4 md:w-5 md:h-5 shrink-0 mt-0.5 ${iconClass(isUnlimited)}`}
              />
              <span>{f}</span>
            </li>
          );
        })}
      </ul>

      {/* 모바일 더보기/접기 버튼 — md 이상에서는 숨김 */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="md:hidden mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              접기
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              {features.length - mobileShowCount}개 더 보기
            </>
          )}
        </button>
      )}
    </div>
  );
}
