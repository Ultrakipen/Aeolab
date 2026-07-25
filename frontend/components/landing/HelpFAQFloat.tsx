"use client";

/**
 * HelpFAQFloat — 모바일 우하단 FAQ 물음표 버튼 + bottom-sheet (랜딩 `app/layout.tsx` + 대시보드 `(dashboard)/layout.tsx` 공용)
 *
 * - md:hidden — PC에서는 완전히 숨김
 * - fixed bottom-[92px] right-4 z-40 — 랜딩 MobileFloatingCTA(bottom-0, z-50)·대시보드 하단 탭바와
 *   겹치지 않도록 여유 확보. AIAssistant(❓ AI도우미, /dashboard 유료전용)와는 겹칠 수 있어
 *   그 쪽을 bottom-[152px]로 위에 배치 (2026-07-25 플로팅 버튼 정리 — 1:1문의 버튼 제거로 2개만 유지)
 * - 클릭 시 bottom-sheet 모달로 HelpSearchInput 노출
 * - 결과 없을 때 /support 링크 fallback 표시
 * - safe-area-inset-bottom 적용
 * - 경로 변경 시 자동 닫힘(usePathname) — 열어둔 채 다른 페이지로 이동해도 다음 화면을 가리지 않음
 * - GA4 이벤트: help_search_query / help_search_result_click / help_search_no_result
 */

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X, HelpCircle } from "lucide-react";
import HelpSearchInput from "@/components/common/HelpSearchInput";
import {
  trackHelpSearchQuery,
  trackHelpSearchResultClick,
  trackHelpSearchNoResult,
} from "@/lib/analytics";

export default function HelpFAQFloat() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 페이지 이동 시 열려있던 패널 자동 닫기 (다음 화면의 바텀탭·콘텐츠를 가리는 것 방지)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // bottom-sheet 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleQuery = useCallback((q: string) => {
    trackHelpSearchQuery(q);
  }, []);

  const handleResultClick = useCallback((faqId: number, category: string) => {
    trackHelpSearchResultClick(faqId, category);
    setOpen(false);
  }, []);

  const handleNoResult = useCallback((q: string) => {
    trackHelpSearchNoResult(q);
  }, []);

  return (
    <>
      {/* 물음표 버튼 — md:hidden (모바일 전용) */}
      <button
        onClick={() => setOpen(true)}
        aria-label="도움말 검색 열기"
        className="md:hidden fixed bottom-[92px] right-4 z-40 w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
        style={{ paddingBottom: 0 }}
      >
        <HelpCircle className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* 배경 오버레이 — z-[60]: MobileFloatingCTA(z-50) 위에 표시 */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom-sheet — z-[70]: 오버레이 위 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="도움말 검색"
        className={`md:hidden fixed left-0 right-0 bottom-0 z-[70] bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pb-3 pt-2 border-b border-gray-100">
          <span className="text-base font-bold text-gray-900">도움말 검색</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="닫기"
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* 검색 영역 */}
        <div className="px-4 pt-4 pb-6">
          <HelpSearchInput
            placeholder="도움말 검색…"
            maxResults={8}
            showFallback={true}
            onQuery={handleQuery}
            onResultClick={handleResultClick}
            onNoResult={handleNoResult}
            className="w-full"
          />
          <p className="mt-3 text-sm text-gray-500 text-center">
            요금제, 스캔, 개선 가이드 등을 검색해보세요
          </p>
        </div>
      </div>
    </>
  );
}
