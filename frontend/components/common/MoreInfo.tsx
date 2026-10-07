import type { ReactNode } from "react";

/**
 * 공개 페이지 공용 "자세히 보기" 접이식 (2026-10-07).
 * 쉬운 안내는 본문에, 보충·근거·전문용어 풀이는 이 안에 둔다.
 * 네이티브 <details> — 서버 컴포넌트에서도 동작하고, 접힌 내용도 DOM에 남아 검색엔진이 읽는다.
 */
export function MoreInfo({
  summary = "자세히 보기",
  children,
  defaultOpen = false,
  tone = "light",
  className = "",
}: {
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: "light" | "dark" | "soft";
  className?: string;
}) {
  const wrap =
    tone === "dark"
      ? "border-white/15 text-white"
      : tone === "soft"
        ? "border-blue-100 bg-blue-50/60 text-gray-800"
        : "border-gray-200 bg-white text-gray-800";
  const sum = tone === "dark" ? "text-white" : "text-blue-700";
  const sign = tone === "dark" ? "text-blue-100" : "text-blue-600";
  return (
    <details open={defaultOpen} className={`group rounded-2xl border ${wrap} ${className}`}>
      <summary
        className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[15px] font-bold md:text-base [&::-webkit-details-marker]:hidden ${sum}`}
      >
        <span className="break-keep">{summary}</span>
        <span className={`text-xl leading-none ${sign}`} aria-hidden="true">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-[15px] leading-relaxed break-keep">{children}</div>
    </details>
  );
}
