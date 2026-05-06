"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";

const COLUMNS = [
  {
    title: "네이버 파워링크 광고",
    subtitle: "클릭당 비용 지불",
    highlight: false,
    items: [
      { text: "클릭당 1,000~5,000원", good: false },
      { text: "예산 소진 시 즉시 중단", good: false },
      { text: "네이버 AI 브리핑과 무관", good: false },
      { text: "월 30~90만원+ 고정 지출", good: false },
    ],
  },
  {
    title: "네이버 플레이스",
    subtitle: "방문자 후기 관리",
    highlight: false,
    items: [
      { text: "사진·메뉴 등록", good: false },
      { text: "리뷰 답변 관리", good: false },
      { text: "네이버 AI 브리핑 측정 불가", good: false },
      { text: "변화: 수주", good: false },
    ],
  },
  {
    title: "AEOlab (AEO)",
    subtitle: "네이버 AI 브리핑에 추천됨",
    highlight: true,
    items: [
      { text: "질문-답변 구조화", good: true },
      { text: "경쟁사 갭 분석", good: true },
      { text: "네이버 AI 브리핑 노출 측정", good: true },
      { text: "월 9,900원 · 광고비 없음", good: true },
    ],
  },
];

export default function AEOvsTraditionalSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="py-6 md:py-8 px-4 md:px-6 border-t border-gray-200">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-2 break-keep">
          광고 말고 다른 방법이 있나요?
        </h2>
        <p className="text-base md:text-lg text-center text-gray-600 mb-8 break-keep">
          있습니다 — AI 검색 시대에는 최적화 방식이 다릅니다
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5">
          {COLUMNS.map((col) => (
            <div
              key={col.title}
              className={`rounded-2xl border p-3.5 md:p-5 flex flex-col gap-3 ${
                col.highlight
                  ? "ring-2 ring-blue-500 border-blue-200 bg-blue-50/30"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <div>
                {col.highlight && (
                  <span className="inline-block text-sm font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full mb-1.5">
                    추천
                  </span>
                )}
                <p className="text-base md:text-lg font-bold text-gray-900 break-keep">{col.title}</p>
                <p className="text-sm text-gray-600 break-keep">{col.subtitle}</p>
              </div>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item.text} className="flex items-start gap-2">
                    {item.good ? (
                      <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      <X size={16} className="text-gray-400 shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden="true" />
                    )}
                    <span
                      className={`text-sm md:text-base break-keep leading-snug ${
                        item.good ? "text-gray-800 font-medium" : "text-gray-600"
                      }`}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 text-base text-blue-600 hover:text-blue-700 underline underline-offset-2"
            aria-expanded={open}
          >
            {open ? (
              <>
                닫기
                <ChevronUp size={18} aria-hidden="true" />
              </>
            ) : (
              <>
                AEO가 무엇인지 더 알아보기
                <ChevronDown size={18} aria-hidden="true" />
              </>
            )}
          </button>
          {open && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 md:p-5 mt-4 text-left">
              <p className="text-base md:text-lg font-bold text-gray-900 mb-2 break-keep">
                AEO(AI Engine Optimization)란?
              </p>
              <p className="text-base text-gray-700 leading-relaxed break-keep mb-2">
                ChatGPT·네이버 AI·Google AI처럼 검색 결과를 직접 답변으로 제시하는 AI 검색 시대에 맞게 가게 정보를 최적화하는 방법입니다.
              </p>
              <p className="text-base text-gray-700 leading-relaxed break-keep mb-3">
                기존 SEO가 &ldquo;검색 목록 상위 노출&rdquo;이라면, AEO는 &ldquo;AI가 질문에 답할 때 내 가게를 직접 언급하도록 만드는 것&rdquo;입니다.
              </p>
              <p className="text-base text-gray-700 bg-white border border-blue-100 rounded-lg px-3 py-2 mb-4 break-keep">
                <span className="font-medium text-gray-800">예시:</span> &ldquo;창원 맛집 추천해줘&rdquo; → ChatGPT가 &ldquo;OO식당이 좋습니다&rdquo;라고 답변
              </p>
              <Link
                href="/trial"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold px-5 py-3 rounded-lg transition-colors min-h-[44px]"
              >
                지금 내 가게 진단하기 →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
