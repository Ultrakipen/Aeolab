"use client";

import { useState } from "react";

/**
 * 모바일에서만 접히는 섹션 래퍼.
 * - 모바일(기본): 버튼만 노출, 본문은 display:none → 첫 페인트부터 접힘(플래시 없음)
 * - 모바일 탭: 본문 펼침
 * - 데스크톱(md+): 버튼 숨김 + 본문 항상 노출 → 지금과 100% 동일
 * 본문은 항상 DOM에 존재(hidden=display:none)하므로 SEO/크롤러에 그대로 노출.
 */
export function MobileAccordion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 요약 버튼 — 모바일 전용 */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="md:hidden w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl text-left text-base font-bold transition-colors active:scale-[0.99]"
        style={{
          color: "#1D4ED8",
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          boxShadow: "var(--aeo-shadow-float)",
        }}
      >
        <span className="break-keep leading-snug">{label}</span>
        <span
          className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-sm font-black text-white transition-transform"
          style={{
            background: "#2563EB",
            transform: open ? "rotate(180deg)" : "none",
          }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* 본문 — 모바일은 open일 때만, md+는 항상 노출 */}
      <div className={`${open ? "block" : "hidden"} md:block`}>{children}</div>
    </>
  );
}
