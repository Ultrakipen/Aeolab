"use client";

import { useState, useCallback } from "react";

interface Props {
  shareUrl: string;
}

/**
 * 성장 카드 공유 랜딩 페이지의 클라이언트 인터랙션 컴포넌트.
 * 페이지 자체는 Server Component(generateMetadata 필요)이므로 분리.
 *
 * 동작:
 *   1. 클립보드에 공유 URL 복사 + 2초 토스트
 *   2. (모바일) navigator.share 지원 시 OS 공유 시트 우선
 */
export default function GrowthShareClient({ shareUrl }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  const handleCopyLink = useCallback(async () => {
    // navigator.share 지원 시 OS 공유 시트 우선 (모바일)
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "내 가게 AI 노출 성장 기록",
          text: "AI 검색 최적화로 점수가 올랐습니다! · AEOlab",
          url: shareUrl,
        });
        return;
      }
    } catch {
      // 취소 또는 미지원 → 클립보드
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("링크가 클립보드에 복사되었습니다");
      window.setTimeout(() => setToast(null), 2200);
    } catch {
      setToast("복사에 실패했습니다. URL을 직접 복사해 주세요.");
      window.setTimeout(() => setToast(null), 2200);
    }
  }, [shareUrl]);

  return (
    <div className="relative flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleCopyLink}
        className="text-sm text-gray-600 hover:text-gray-700 underline underline-offset-2 transition-colors"
      >
        링크 복사해서 공유하기
      </button>
      {toast && (
        <div
          role="status"
          className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] whitespace-nowrap bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg z-50"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
