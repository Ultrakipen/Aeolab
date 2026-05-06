"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

const CATEGORY_KO: Record<string, string> = {
  restaurant: "음식점",
  cafe: "카페",
  bakery: "베이커리",
  bar: "술집·바",
  beauty: "미용실·뷰티",
  nail: "네일샵",
  medical: "병원·의원",
  pharmacy: "약국",
  fitness: "헬스·피트니스",
  yoga: "요가",
  pet: "반려동물",
  education: "학원·교육",
  tutoring: "과외·학습",
  legal: "법무·법률",
  realestate: "부동산",
  interior: "인테리어",
  auto: "자동차",
  cleaning: "청소·세탁",
  shopping: "쇼핑몰",
  fashion: "패션",
  photo: "사진·영상",
  video: "영상제작",
  design: "디자인",
  accommodation: "숙박",
  other: "기타",
};

interface Props {
  businessName: string;
  score: number;
  category: string;
  region: string;
  topMissingKeywords?: string[];
}

export default function TextShareButton({
  score,
  category,
  topMissingKeywords = [],
}: Props) {
  const [copied, setCopied] = useState(false);

  const categoryKo = CATEGORY_KO[category] ?? category;
  const missingCount = topMissingKeywords.length;

  const shareText = [
    `우리 ${categoryKo} AI 진단 해봤는데 점수 ${score}점이에요`,
    missingCount > 0
      ? `키워드 ${missingCount}개가 부족하다고 나왔어요`
      : `키워드 현황도 확인해봤어요`,
    `무료로 확인해보세요 👉 https://aeolab.co.kr/trial`,
  ].join("\n");

  const handleShare = async () => {
    // 1순위: navigator.share (모바일)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // 취소 또는 실패 → 클립보드로 폴백
      }
    }

    // 2순위: navigator.clipboard
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // 클립보드도 실패 → alert 폴백
      }
    }

    // 3순위: alert
    alert(shareText);
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-medium text-sm md:text-base px-4 py-2.5 rounded-xl transition-colors"
    >
      <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{copied ? "복사 완료!" : "텍스트로 공유"}</span>
    </button>
  );
}
