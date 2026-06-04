"use client";

/**
 * HeaderHelpSearch — 랜딩 PC 헤더용 FAQ 검색창 클라이언트 래퍼
 *
 * 서버 컴포넌트(page.tsx)에서 GA4 콜백 함수를 props로 전달할 수 없으므로
 * 이 컴포넌트가 GA4 이벤트를 직접 처리한다.
 */

import { useCallback } from "react";
import HelpSearchInput from "@/components/common/HelpSearchInput";
import {
  trackHelpSearchQuery,
  trackHelpSearchResultClick,
  trackHelpSearchNoResult,
} from "@/lib/analytics";

export default function HeaderHelpSearch() {
  const handleQuery = useCallback((q: string) => {
    trackHelpSearchQuery(q);
  }, []);

  const handleResultClick = useCallback((faqId: number, category: string) => {
    trackHelpSearchResultClick(faqId, category);
  }, []);

  const handleNoResult = useCallback((q: string) => {
    trackHelpSearchNoResult(q);
  }, []);

  return (
    <HelpSearchInput
      placeholder="도움말 검색…"
      maxResults={6}
      showFallback={true}
      onQuery={handleQuery}
      onResultClick={handleResultClick}
      onNoResult={handleNoResult}
      className="w-56"
    />
  );
}
