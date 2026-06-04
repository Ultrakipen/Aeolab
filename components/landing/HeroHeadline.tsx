"use client";
import { useState, useEffect } from "react";

const HEADLINES = [
  {
    line1: "파워링크 끄면 사라집니다.",
    highlight: "네이버 AI 브리핑은",
    line3: "광고 없이도 쌓입니다",
  },
  {
    line1: "광고하는 옆 가게보다",
    highlight: "네이버 AI 브리핑에 먼저 나오는",
    line3: "방법이 있습니다",
  },
  {
    line1: "월 90만원 광고 대신",
    highlight: "9,900원으로",
    line3: "네이버 AI 브리핑 노출 시작",
  },
  {
    line1: "손님이 '근처 맛집' 물을 때",
    highlight: "네이버 AI 브리핑이 추천하는 가게,",
    line3: "내 가게도 될 수 있습니다",
  },
  {
    line1: "경쟁 가게는 AI 브리핑에 나오는데",
    highlight: "우리 가게는",
    line3: "광고만 하고 있나요?",
  },
  {
    line1: "한 번 올라가면 계속됩니다.",
    highlight: "네이버 AI 브리핑 노출,",
    line3: "광고와 완전히 다릅니다",
  },
  {
    line1: "광고비 없이도",
    highlight: "네이버 AI 브리핑이 먼저 추천하는 가게,",
    line3: "될 수 있습니다",
  },
];

// 현재 노출 중인 헤드라인 인덱스를 sessionStorage에 저장 → TrackedCTA가 hero CTA 클릭 시 첨부
const STORAGE_KEY = "aeolab_headline_index";
function persistIndex(i: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(i));
  } catch {
    // 차단 시 무시
  }
}

export default function HeroHeadline() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    persistIndex(0);
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => {
          const next = (i + 1) % HEADLINES.length;
          persistIndex(next);
          return next;
        });
        setVisible(true);
      }, 500);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const { line1, highlight, line3 } = HEADLINES[index];

  return (
    // min-h 고정 — 헤드라인 회전 시 줄 수 변화로 인한 CLS(Layout Shift) 방지
    <h1
      className="text-[1.9rem] sm:text-3xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-2 leading-tight break-keep transition-opacity duration-500 min-h-[7.5rem] sm:min-h-[10rem] lg:min-h-[8.5rem] xl:min-h-[10rem]"
      style={{ opacity: visible ? 1 : 0 }}
      aria-live="polite"
    >
      {line1}{" "}
      <br className="hidden sm:block" />
      <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
        {highlight}
      </span>{" "}
      <br className="hidden sm:block" />
      {line3}
    </h1>
  );
}
