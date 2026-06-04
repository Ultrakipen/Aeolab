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
  score: number;
  category: string;
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

  const findingLine =
    missingCount > 0
      ? `우리 ${categoryKo} 진단해보니 키워드 ${missingCount}개만 채우면 네이버 AI·ChatGPT에 뜰 수 있대요`
      : `우리 ${categoryKo} 진단해보니 AI 검색 노출 현황을 한눈에 확인할 수 있었어요`;

  const shareText = [
    `요즘 손님들, AI로 가게 먼저 검색하는 거 아셨어요?`,
    findingLine,
    `진단 결과로 어떤 키워드가 부족한지, 어떻게 개선하면 되는지까지 바로 알려줘요`,
    `사장님 가게도 30초 무료 진단 👉 https://aeolab.co.kr/trial`,
  ].join("\n");

  const handleShare = async () => {
    // 1순위: 클립보드 직접 복사 (PC/모바일 공통 — 텍스트 복사 버튼의 명시적 목적)
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // 클립보드 실패 → alert 폴백
      }
    }

    // 2순위: alert (클립보드 API 미지원 환경)
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
