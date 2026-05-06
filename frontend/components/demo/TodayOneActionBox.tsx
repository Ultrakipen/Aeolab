"use client";

import { useState } from "react";

const FAQ_BY_CATEGORY: Record<string, { q: string; a: string; tip: string }> = {
  restaurant: {
    q: "주차 가능한가요?",
    a: "네, 매장 앞에 무료 주차장이 있습니다. (5대 가능)",
    tip: "예약·단체 가능 여부도 함께 적으면 AI 노출 확률이 더 높아집니다.",
  },
  cafe: {
    q: "노트북 작업 가능한가요?",
    a: "네, 매장 곳곳에 콘센트가 있고 와이파이도 무료로 제공됩니다. 평일 낮은 한산합니다.",
    tip: "콘센트 수, 와이파이 속도를 적으면 검색 노출이 더 좋아집니다.",
  },
  beauty: {
    q: "예약 없이 방문해도 되나요?",
    a: "예약 우선이지만 평일 오후 2~5시에는 워크인 가능합니다. 카카오톡 채널로 미리 문의 주세요.",
    tip: "주력 시술과 평균 소요 시간을 함께 적으면 AI가 더 잘 추천합니다.",
  },
  academy: {
    q: "맛보기 수업이 있나요?",
    a: "네, 신규 등록 전 1회 무료 체험 수업을 제공합니다. 학년별 테스트 후 반 배정해 드립니다.",
    tip: "학년별 커리큘럼·강사 경력을 적으면 학부모 검색 노출이 늘어납니다.",
  },
  clinic: {
    q: "초진 시 준비할 것이 있나요?",
    a: "신분증과 보험증을 지참해 주세요. 평일 야간(18~21시) 진료도 가능합니다.",
    tip: "전문 진료 분야와 야간·주말 진료 여부를 명시하세요.",
  },
};

interface Props {
  category: string;
}

export default function TodayOneActionBox({ category }: Props) {
  const [copied, setCopied] = useState(false);
  const faq = FAQ_BY_CATEGORY[category] ?? FAQ_BY_CATEGORY.restaurant;

  const text = `Q: ${faq.q}\nA: ${faq.a}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — 일부 환경에서 clipboard API 차단 시
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">👉</span>
        <p className="text-base md:text-lg font-bold text-amber-900">오늘 딱 이거 하나만 하세요</p>
      </div>
      <p className="text-sm md:text-base text-gray-700 mb-3 break-keep">
        스마트플레이스 소개글 안 Q&A에 이 문구를 추가하세요
      </p>
      <div className="bg-white border border-amber-200 rounded-xl p-3 md:p-4 mb-3">
        <p className="text-sm md:text-base text-gray-800 mb-1">
          <span className="font-semibold text-gray-500">Q:</span> {faq.q}
        </p>
        <p className="text-sm md:text-base text-gray-800 break-keep leading-relaxed">
          <span className="font-semibold text-gray-500">A:</span> {faq.a}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm md:text-base font-semibold transition-colors ${
            copied
              ? "bg-green-600 text-white"
              : "bg-amber-500 text-white hover:bg-amber-600"
          }`}
        >
          {copied ? "✓ 복사 완료" : "📋 문구 복사하기"}
        </button>
        <p className="text-sm text-gray-600 break-keep">
          예상 소요: 2분 · 7일 후 효과 자동 측정
        </p>
      </div>
      <p className="text-sm text-amber-800 mt-3 break-keep">
        💡 {faq.tip}
      </p>
    </div>
  );
}
