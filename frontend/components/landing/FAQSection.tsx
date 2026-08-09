"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

type FaqItem = {
  q: string;
  a: string;           // JSON-LD 구조화 데이터용 순수 텍스트
  aNode?: React.ReactNode; // 화면 렌더링용 (없으면 a 사용)
};

const FAQS: FaqItem[] = [
  {
    q: "내 업종도 네이버 AI 브리핑에 노출되나요?",
    a: "'플레이스형' AI 브리핑은 음식점·카페·베이커리·바·숙박 업종이 대상이며 프랜차이즈는 제외됩니다. 대상이 아닌 업종도 ① 블로그·콘텐츠 기반 '정보형 AI 브리핑'(업종 제한 없음), ② 네이버 AI탭(모든 업종, 정식 출시) 노출 준비도 진단, ③ 네이버 플레이스·VIEW 탭 일반 검색 상위 노출 최적화, ④ ChatGPT·Gemini·Google AI 채널 개선 — 네 방향으로 가치를 드립니다. 무료 진단으로 내 업종 채널별 현황을 확인하세요.",
    aNode: (
      <div className="space-y-2.5">
        <p>'플레이스형' AI 브리핑은 음식점·카페·베이커리·바·숙박 업종이 대상이며 프랜차이즈는 제외됩니다.</p>
        <p className="font-medium" style={{ color: "#334155" }}>
          대상이 아닌 업종도 네 가지 방향으로 가치를 드립니다.
        </p>
        <ul className="space-y-2">
          <li className="flex gap-2.5">
            <span className="font-bold shrink-0 mt-px" style={{ color: "#2563EB" }}>①</span>
            <span>
              <strong>정보형 AI 브리핑</strong> — 블로그·콘텐츠가 출처로 채택되면 업종 제한 없이 노출 가능
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="font-bold shrink-0 mt-px" style={{ color: "#2563EB" }}>②</span>
            <span>
              <strong>네이버 AI탭</strong> — 업종·프랜차이즈 제한 없이 모든 사업장 노출 가능
              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>정식 출시 (6.25)</span>
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="font-bold shrink-0 mt-px" style={{ color: "#2563EB" }}>③</span>
            <span>
              <strong>네이버 일반검색 상위 노출</strong> — 스마트플레이스·플레이스 탭·VIEW 탭 최적화로 검색 순위 개선
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="font-bold shrink-0 mt-px" style={{ color: "#2563EB" }}>④</span>
            <span>
              <strong>글로벌 AI 채널</strong> — ChatGPT·Gemini·Google AI 언급률 측정 및 개선
            </span>
          </li>
        </ul>
        <p>무료 진단으로 내 업종 채널별 현황을 바로 확인해 보세요.</p>
      </div>
    ),
  },
  {
    q: "AI가 내 가게를 반드시 추천해 주나요?",
    a: "결과를 100% 보장하지는 않습니다. AI 추천은 가게 정보의 품질, 경쟁사 현황, 각 AI 플랫폼의 알고리즘에 따라 달라지기 때문입니다. AEOlab은 '노출을 높이는 프로세스'를 제공하며, 어떤 상태에서 시작해 어떻게 변화하는지를 측정 데이터로 직접 보여드립니다. 네이버 관련 노출은 2~4주 안에 변화가 나타나며, ChatGPT·Gemini 노출은 수개월이 소요될 수 있습니다.",
  },
  {
    q: "스마트플레이스·블로그를 관리하면 네이버 검색에도 더 잘 나오나요?",
    a: "네, 직접적인 연결 효과가 있습니다. 스마트플레이스 소개글·사진·리뷰·소식을 꾸준히 관리하면 네이버 플레이스 탭 순위가 먼저 오르고, 이 정보 완성도가 높아질수록 네이버 AI 브리핑·AI탭 노출 가능성도 함께 높아집니다. 블로그 후기가 쌓이면 네이버 VIEW탭(블로그 검색)에도 상위 노출되며 AI탭 답변의 소스로 활용됩니다. '네이버 검색 기반'이 AI 노출의 토대입니다.",
  },
  {
    q: "네이버 AI탭은 어떤 업종이 노출되나요?",
    a: "네이버 AI탭(2026년 4월 베타 출시)은 AI 브리핑과 달리 업종·프랜차이즈 제한 없이 모든 사업장이 노출될 수 있습니다. 2026-06-25 전체 사용자 정식 출시됐습니다. 스마트플레이스 소개글·사진·소식을 충실히 관리할수록 노출 가능성이 높아집니다.",
  },
  {
    q: "ChatGPT에 우리 가게를 노출하는 방법이 있나요?",
    a: "ChatGPT는 두 가지 방식으로 가게를 인식합니다. ① 로컬 검색 시 Bing을 실시간으로 검색하므로 Bing Places 비즈니스 등록(무료)이 가장 빠른 노출 경로입니다. ② 학습된 데이터도 참조하므로 구글 비즈니스·외부 블로그·웹사이트에 가게 정보가 충분할수록 인식률이 높아집니다. AEOlab은 학습 데이터 기반으로 50~100회 질의해 언급 여부를 측정합니다 (Bing 실시간 검색과는 별개의 측정값).",
  },
  {
    q: "효과가 나타나는 데 얼마나 걸리나요?",
    a: "네이버 관련 노출(스마트플레이스·AI 브리핑·AI탭)은 개선 조치 후 2~4주 안에 변화가 나타납니다. ChatGPT는 Bing Places 등록·구글 비즈니스 최적화 후 수일~수주 내 반영되고, 블로그·SNS 콘텐츠 변화는 인덱싱 주기에 따라 수주~수개월이 소요될 수 있습니다. Gemini는 구글 생태계 업데이트 주기에 따라 수주~수개월입니다. AEOlab은 7일 후 자동 재측정으로 변화를 추적하고 알려줍니다.",
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
    a: "무료 진단은 현재 AI 노출 상태와 핵심 문제 3가지를 한 번 확인할 수 있습니다. 유료 구독은 7일마다 자동 재측정, 경쟁사 비교, 키워드 갭 분석, AI 개선 가이드, 주간 노출 리포트를 제공합니다. 무료 진단은 '현재 상태를 아는 것', 구독은 '지속적으로 개선하는 것'입니다.",
  },
  {
    q: "다른 AI 노출 관리 서비스와 어떻게 다른가요?",
    a: "국내 다른 AI 노출 서비스들은 ChatGPT·Gemini 등 글로벌 AI만 측정합니다. AEOlab은 한국 소상공인의 핵심 채널인 네이버 AI 브리핑·AI탭을 함께 측정하는 서비스입니다. 또한 월 11,900원 셀프서비스로 직접 관리할 수 있어, 수십만 원대 대행 서비스 없이 운영할 수 있습니다.",
    aNode: (
      <div className="space-y-2.5">
        <p>국내 다른 AI 노출 서비스들은 ChatGPT·Gemini 등 <strong>글로벌 AI만 측정</strong>합니다.</p>
        <p>AEOlab은 두 가지 핵심 차이가 있습니다.</p>
        <ul className="space-y-2">
          <li className="flex gap-2.5">
            <span className="font-bold shrink-0 mt-px" style={{ color: "#2563EB" }}>①</span>
            <span>
              <strong>네이버 AI 브리핑·AI탭 포함</strong> — 한국 소상공인이 가장 많이 쓰는 채널을 글로벌 AI와 함께 측정합니다
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="font-bold shrink-0 mt-px" style={{ color: "#2563EB" }}>②</span>
            <span>
              <strong>월 11,900원 셀프서비스</strong> — 수십만 원대 대행 없이 직접 관리·개선할 수 있습니다
            </span>
          </li>
        </ul>
        <p className="text-sm" style={{ color: "#64748B" }}>※ 업종에 따라 '플레이스형' 네이버 AI 브리핑 대상 여부가 다르며, 대상이 아니어도 '정보형 AI 브리핑'은 노출될 수 있습니다. 무료 진단으로 먼저 확인하세요.</p>
      </div>
    ),
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const faqsToShow = showAll ? FAQS : FAQS.slice(0, 3);

  return (
    <section id="faq" className="px-4 py-8 md:py-12" style={{ background: "transparent" }}>
      {/* FAQPage 구조화 데이터 — Google SERP + AI 검색 인용 */}
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

      <div className="max-w-[720px] mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-6 md:mb-8 fade-up">
          <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
            FAQ
          </p>
          <h2
            className="text-2xl md:text-3xl font-black tracking-tight break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
          >
            자주 묻는 질문
          </h2>
          <p className="text-sm mt-2 break-keep" style={{ color: "#475569" }}>
            AI 노출 구조가 처음이신 분들을 위해
          </p>
        </div>

        {/* 연결된 단일 컨테이너 아코디언 */}
        <div
          className="rounded-xl border overflow-hidden fade-up"
          style={{ borderColor: "#E2E8F0" }}
        >
          {faqsToShow.map((faq, i) => (
            <div
              key={i}
              className={i > 0 ? "border-t" : ""}
              style={i > 0 ? { borderColor: "#E2E8F0" } : {}}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-4 md:p-5 text-left transition-colors hover:bg-[#F8FAFC]"
                style={{ color: "#0F172A" }}
                aria-expanded={openIndex === i}
              >
                <span className="text-base font-semibold pr-4 break-keep">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${openIndex === i ? "rotate-180" : ""}`}
                  style={{ color: "#2563EB" }}
                />
              </button>
              {openIndex === i && (
                <div
                  className="px-4 md:px-5 pb-4 md:pb-5 text-sm md:text-base leading-relaxed break-keep"
                  style={{ color: "#475569", backgroundColor: "#EFF6FF" }}
                >
                  {faq.aNode ?? faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 더보기 버튼 — ghost 스타일 */}
        {!showAll && FAQS.length > 3 && (
          <div className="text-center mt-4 fade-up">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-sm transition-colors underline-offset-4 hover:underline"
              style={{ color: "#2563EB" }}
            >
              더 보기 ({FAQS.length - 3}개)
            </button>
          </div>
        )}
        {showAll && (
          <div className="text-center mt-4 fade-up">
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="text-sm transition-colors underline-offset-4 hover:underline"
              style={{ color: "#2563EB" }}
            >
              접기
            </button>
          </div>
        )}

        <p className="text-center mt-5 fade-up">
          <Link
            href="/faq"
            className="text-sm hover:underline underline-offset-2 transition-colors hover:text-[#1D4ED8]"
            style={{ color: "#2563EB" }}
          >
            전체 FAQ 보기 →
          </Link>
        </p>
      </div>
    </section>
  );
}
