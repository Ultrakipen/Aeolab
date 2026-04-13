"use client";

import { useState, useEffect } from "react";
import { Search, ClipboardList, BarChart2, X, Lightbulb } from "lucide-react";
import type { JSX } from "react";

const LS_KEY = "aeolab_edu_seen_v1";

interface Slide {
  icon: JSX.Element;
  title: string;
  body: string;
  highlight: string;
}

const SLIDES: Slide[] = [
  {
    icon: <Search className="w-6 h-6 text-blue-600" />,
    title: "AI 브리핑이란?",
    body: "손님이 네이버에 \"창원 치킨 추천해줘\"라고 입력하면, 검색 결과 맨 위에 AI가 직접 추천하는 가게 목록이 나타납니다. 이것이 바로 네이버 AI 브리핑입니다.",
    highlight: "검색 결과 맨 위 = 클릭률 1위 위치",
  },
  {
    icon: <ClipboardList className="w-6 h-6 text-blue-600" />,
    title: "어떤 가게가 AI에 노출되나요?",
    body: "AI는 리뷰 수·평점, 스마트플레이스 FAQ, 소개글 키워드, 블로그 언급 수를 분석해서 가장 신뢰할 수 있는 가게를 추천합니다. 광고비와 무관합니다.",
    highlight: "FAQ 1개 등록 = AI 브리핑 노출 가능성 즉시 상승",
  },
  {
    icon: <BarChart2 className="w-6 h-6 text-blue-600" />,
    title: "AEOlab이 무엇을 도와주나요?",
    body: "AEOlab은 내 가게가 지금 AI에 얼마나 노출되고 있는지 측정하고, 경쟁 가게와 비교해서 무엇을 먼저 해야 하는지 오늘 할 일로 알려드립니다.",
    highlight: "\"오늘 할 일\" 섹션 → 지금 바로 실행 가능한 1가지",
  },
];

export default function FirstTimeEducationCard() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(LS_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(LS_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  const s = SLIDES[slide];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 md:p-6 mb-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">처음 오셨나요?</span>
          <h3 className="text-lg md:text-xl font-bold text-blue-900 mt-0.5">
            네이버 AI 브리핑 — 30초 핵심 정리
          </h3>
        </div>
        <button
          onClick={dismiss}
          className="text-blue-400 hover:text-blue-600 shrink-0 mt-1"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 슬라이드 */}
      <div className="bg-white rounded-xl p-4 md:p-5 mb-4 min-h-[120px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="shrink-0">{s.icon}</span>
          <span className="text-base md:text-lg font-bold text-gray-900">{s.title}</span>
        </div>
        <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">{s.body}</p>
        <div className="bg-blue-50 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span className="text-sm font-semibold text-blue-700">{s.highlight}</span>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`rounded-full transition-all duration-200 ${
                i === slide ? "w-5 h-2 bg-blue-500" : "w-2 h-2 bg-blue-200 hover:bg-blue-300"
              }`}
              aria-label={`슬라이드 ${i + 1}`}
            />
          ))}
          <span className="text-xs text-blue-400 ml-1">{slide + 1}/{SLIDES.length}</span>
        </div>

        <div className="flex items-center gap-2">
          {slide < SLIDES.length - 1 ? (
            <button
              onClick={() => setSlide(slide + 1)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              다음 →
            </button>
          ) : (
            <button
              onClick={dismiss}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              이해했어요 ✓
            </button>
          )}
          <button
            onClick={dismiss}
            className="text-xs text-blue-400 hover:text-blue-600 underline"
          >
            다시 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
