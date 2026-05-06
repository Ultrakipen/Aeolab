"use client";

import { useState, useCallback } from "react";
import { trackKakaoShareClick } from "@/lib/analytics";

interface KakaoShareButtonProps {
  score: number;
  businessName: string;
  category: string;
  region: string;
  /** trial_id — 서버 이미지 카드 생성에 사용. 없으면 쿼리 파라미터 폴백으로 이미지 URL 구성. */
  trialId?: string;
  /** 업종 평균 점수 — 본문 문구에 포함(선택) */
  benchmarkAvg?: number;
  className?: string;
}

/**
 * 카카오톡 공유 버튼 — Trial 결과 페이지에서 사용.
 *
 * 동작 우선순위:
 *   1. window.Kakao.Share.sendDefault({ objectType: 'feed', ... })
 *      — SDK 로드 성공 + Kakao.init 완료 시
 *   2. navigator.share() — 모바일 OS 공유 시트
 *   3. 클립보드 복사 + 2초 토스트
 *
 * 공유 카드 이미지:
 *   - trialId 있음 → {BACKEND}/api/share/image/{trialId} (Pillow 600x400 PNG)
 *   - trialId 없음 → 쿼리 파라미터 폴백 {BACKEND}/api/share/image?score=..&name=..&category=..&region=..
 *
 * GA4: kakao_share_click — 매 클릭 발화.
 */
export default function KakaoShareButton({
  score,
  businessName,
  category,
  region,
  trialId,
  benchmarkAvg,
  className,
}: KakaoShareButtonProps) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const buildShareImageUrl = useCallback(() => {
    const backend =
      process.env.NEXT_PUBLIC_BACKEND_URL || "https://aeolab.co.kr";
    if (trialId) {
      return `${backend}/api/share/image/${encodeURIComponent(trialId)}`;
    }
    const qs = new URLSearchParams({
      score: String(Math.round(score)),
      name: businessName,
      category,
      region,
    });
    return `${backend}/api/share/image?${qs.toString()}`;
  }, [trialId, score, businessName, category, region]);

  const buildDescription = useCallback(() => {
    const parts: string[] = [];
    parts.push(`점수 ${Math.round(score)}점 / 100점`);
    if (benchmarkAvg && benchmarkAvg > 0) {
      parts.push(
        `"${region} ${category}" 업종 평균 ${Math.round(benchmarkAvg)}점`,
      );
    } else if (category || region) {
      parts.push(`${region || ""} ${category || ""}`.trim());
    }
    parts.push("무료 진단 · 회원가입 불필요");
    return parts.join(" · ");
  }, [score, benchmarkAvg, category, region]);

  const handleShare = useCallback(async () => {
    trackKakaoShareClick({ trial_id: trialId, score: Math.round(score) });

    const siteUrl = "https://aeolab.co.kr";
    const landingUrl = `${siteUrl}/?ref=kakao_share`;
    const trialUrl = `${siteUrl}/trial?ref=kakao_share`;
    const imageUrl = buildShareImageUrl();
    const title = "내 가게 AI 노출 진단 결과";
    const description = buildDescription();

    // 1) Kakao SDK 경로
    try {
      if (
        typeof window !== "undefined" &&
        window.Kakao &&
        window.Kakao.isInitialized() &&
        window.Kakao.Share
      ) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title,
            description,
            imageUrl,
            imageWidth: 600,
            imageHeight: 400,
            link: { mobileWebUrl: landingUrl, webUrl: landingUrl },
          },
          buttons: [
            {
              title: "내 가게도 무료 진단",
              link: { mobileWebUrl: trialUrl, webUrl: trialUrl },
            },
            {
              title: "AEOlab 자세히 보기",
              link: { mobileWebUrl: landingUrl, webUrl: landingUrl },
            },
          ],
        });
        return;
      }
    } catch {
      // SDK 호출 실패 → 아래 fallback
    }

    // 2) navigator.share 경로
    const fallbackText = `${title}\n${description}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title,
          text: fallbackText,
          url: landingUrl,
        });
        return;
      }
    } catch {
      // 사용자 취소 또는 미지원 → 클립보드로
    }

    // 3) 클립보드 폴백
    try {
      await navigator.clipboard.writeText(`${fallbackText}\n${landingUrl}`);
      showToast("링크가 클립보드에 복사되었습니다");
    } catch {
      showToast("공유에 실패했습니다. 링크를 직접 복사해 주세요.");
    }
  }, [
    trialId,
    score,
    buildShareImageUrl,
    buildDescription,
    showToast,
  ]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleShare}
        aria-label="카카오톡으로 진단 결과 공유"
        className={
          className ??
          "inline-flex items-center justify-center gap-2 bg-yellow-400 text-yellow-900 text-sm md:text-base font-bold px-4 py-2.5 rounded-xl hover:bg-yellow-500 transition-colors shadow-sm"
        }
      >
        카톡으로 공유
      </button>
      {toast && (
        <div
          role="status"
          className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] whitespace-nowrap bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg z-50"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
