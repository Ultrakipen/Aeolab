"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

/**
 * 빈 상태 공통 컴포넌트.
 *
 * 모든 데이터 부재 카드는 이 컴포넌트로 통일.
 * - 일관된 padding (py-8 md:py-10)
 * - 일관된 아이콘 톤 (text-gray-300)
 * - 일관된 텍스트 크기·색상 (text-sm md:text-base, text-gray-600)
 * - 선택적 CTA 버튼 또는 보조 액션
 */

type Tone = "default" | "info" | "warning";

const TONE_STYLES: Record<Tone, { icon: string; title: string; desc: string }> = {
  default: {
    icon: "text-gray-300",
    title: "text-gray-800",
    desc: "text-gray-600",
  },
  info: {
    icon: "text-blue-300",
    title: "text-blue-900",
    desc: "text-blue-700",
  },
  warning: {
    icon: "text-amber-300",
    title: "text-amber-900",
    desc: "text-amber-700",
  },
};

interface Props {
  /** 표시 아이콘 (lucide-react element). 미지정 시 Inbox 사용 */
  icon?: ReactNode;
  /** 빈 상태 제목 (선택, 짧은 한 줄) */
  title?: string;
  /** 빈 상태 설명 (필수) */
  description: string;
  /** 우선 액션 버튼 (선택) */
  action?: ReactNode;
  /** 톤: default(회색) / info(파랑) / warning(주황) */
  tone?: Tone;
  /** 카드 외곽선 포함 여부 (기본 false — 부모 카드 안에 들어갈 때) */
  bordered?: boolean;
  /** 추가 클래스 */
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "default",
  bordered = false,
  className = "",
}: Props) {
  const t = TONE_STYLES[tone];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center py-8 md:py-10 px-4 gap-3 ${
        bordered ? "rounded-xl border border-dashed border-gray-200 bg-gray-50" : ""
      } ${className}`}
    >
      <div className={`${t.icon}`} aria-hidden="true">
        {icon ?? <Inbox className="w-10 h-10 md:w-12 md:h-12" strokeWidth={1.5} />}
      </div>
      {title && (
        <p className={`text-sm md:text-base font-semibold ${t.title} break-keep`}>
          {title}
        </p>
      )}
      <p className={`text-sm md:text-base ${t.desc} leading-snug max-w-md break-keep`}>
        {description}
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
