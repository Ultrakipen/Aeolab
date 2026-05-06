"use client";

import { useState } from "react";
import Link from "next/link";

const FAQS = [
  {
    q: "내 업종도 네이버 AI 브리핑에 노출되나요?",
    a: "음식점·카페·베이커리·바·숙박 업종이 대상이며 프랜차이즈는 제외됩니다. 그 외 업종은 ChatGPT·Gemini·Google AI 채널 노출 개선으로 가치를 드립니다. 무료 진단으로 내 업종 해당 여부를 먼저 확인하세요.",
  },
  {
    q: "AI가 내 가게를 반드시 추천해 주나요?",
    a: "결과를 100% 보장하지는 않습니다. AI 추천은 가게 정보의 품질, 경쟁사 현황, 각 AI 플랫폼의 알고리즘에 따라 달라지기 때문입니다. AEOlab은 '점수를 높이는 프로세스'를 제공하며, 어떤 점수에서 시작해 어떻게 변화하는지를 측정 데이터로 직접 보여드립니다. 개선 조치 후 보통 2~4주 안에 점수 변화가 나타납니다.",
  },
  {
    q: "ChatGPT에 우리 가게를 노출하는 방법이 있나요?",
    a: "ChatGPT는 온라인에 공개된 정보를 학습합니다. 가게 정보가 블로그·SNS·웹사이트에 충분히 있고, 지역+업종 키워드 조합이 갖춰져 있을수록 추천될 가능성이 높아집니다. AEOlab은 지금 내 가게가 실제로 언급되는지를 수백 회 질의해서 측정합니다.",
  },
  {
    q: "효과가 나타나는 데 얼마나 걸리나요?",
    a: "키워드 보강 등 개선 조치 후 보통 2~4주 안에 점수 변화가 나타납니다. AEOlab은 7일 후 자동 재측정으로 변화를 추적하고 알려줍니다.",
  },
  {
    q: "작은 동네 가게도 효과가 있나요?",
    a: "오히려 작은 가게에게 더 유리합니다. AI 추천 구조는 대형 브랜드보다 지역 특화 정보를 더 자주 인용하기 때문입니다. 경쟁이 덜 치열한 지금 시작할수록 자리를 선점하기 쉽습니다.",
  },
  {
    q: "스마트플레이스랑 다른 서비스인가요?",
    a: "네이버 스마트플레이스는 가게 정보를 등록하는 플랫폼이고, AEOlab은 그 정보가 AI에 얼마나 잘 노출되는지 측정하고 개선 방향을 제시하는 서비스입니다. 스마트플레이스가 '가게 간판'이라면, AEOlab은 'AI가 그 간판을 제대로 읽고 있는지 확인하는 도구'입니다.",
  },
  {
    q: "무료 진단과 유료 구독의 차이가 뭔가요?",
    a: "무료 진단은 현재 AI 노출 점수와 핵심 문제 3가지를 한 번 확인할 수 있습니다. 유료 구독은 7일마다 자동 재측정, 경쟁사 비교, 키워드 갭 분석, AI 개선 가이드, 주간 점수 리포트를 제공합니다. 무료 진단은 '현재 상태를 아는 것', 구독은 '지속적으로 개선하는 것'입니다.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  // 모바일 집중도 개선: 첫 진입 시 핵심 3개만 노출, 펼침 토글로 나머지 4개 공개
  const visibleFaqs = showAll ? FAQS : FAQS.slice(0, 3);

  return (
    <section id="faq" className="bg-white py-8 md:py-10 px-4 md:px-6">
      {/* FAQPage Schema — Google SERP에 FAQ rich result 노출 + AI 검색이 답변 추출 시 인용 가능 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-2 break-keep">
          자주 묻는 질문
        </h2>
        <p className="text-base md:text-lg text-center text-gray-600 mb-8 break-keep">
          AI 노출 구조가 처음이신 분들을 위해
        </p>
        <div className="space-y-3">
          {visibleFaqs.map((faq, i) => (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors min-h-[56px]"
                aria-expanded={open === i}
              >
                <span className="text-base font-semibold text-gray-800 break-keep">
                  {faq.q}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-500 shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {open === i && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep pt-4">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {!showAll && FAQS.length > 3 && (
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-1 text-base font-semibold text-blue-600 hover:text-blue-700 px-5 py-2.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              + 질문 {FAQS.length - 3}개 더 보기
            </button>
          </div>
        )}
        <p className="text-center mt-6">
          <Link href="/faq" className="text-base text-blue-600 hover:text-blue-700 underline underline-offset-2">
            전체 FAQ 보기 →
          </Link>
        </p>
      </div>
    </section>
  );
}
