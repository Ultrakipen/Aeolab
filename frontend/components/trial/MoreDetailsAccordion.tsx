"use client";

import { useState, ReactNode } from "react";

interface MoreDetailsAccordionProps {
  children: ReactNode;
  /** 헤더 라벨 — 미지정시 기본 문구 */
  label?: string;
}

/**
 * 더 자세히 보기 아코디언 (4섹션 구조 하단)
 *
 * - 기본 닫힌 상태
 * - 펼치면 항목별 점수·벤치마크·키워드 등 기존 상세 섹션 노출
 */
export default function MoreDetailsAccordion({
  children,
  label = "더 자세히 보기 (점수 항목·벤치마크·키워드)",
}: MoreDetailsAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden mb-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 md:px-6 py-4 md:py-5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-base md:text-lg font-bold text-gray-800 break-keep">
          <span className={`text-base md:text-lg transition-transform inline-block ${open ? "rotate-180" : ""}`}>
            ▼
          </span>
          {label}
        </span>
        <span className="text-xs md:text-sm text-gray-500 shrink-0">
          {open ? "접기" : "펼치기"}
        </span>
      </button>

      {open && (
        <div className="px-4 md:px-6 pb-5 md:pb-6 pt-1 border-t border-gray-100 space-y-4">
          {children}
        </div>
      )}
    </section>
  );
}
