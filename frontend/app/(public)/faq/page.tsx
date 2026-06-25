import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/common/SiteFooter";

export const metadata: Metadata = {
  title: "자주 묻는 질문 | AEOlab",
  description:
    "ChatGPT·네이버 AI 브리핑이 가게를 추천하는 기준, AEOlab 점수 계산 방식, 구독 해지 방법 등 자주 묻는 질문에 답합니다.",
  openGraph: {
    title: "자주 묻는 질문 | AEOlab",
    description:
      "ChatGPT·네이버 AI 브리핑이 가게를 추천하는 기준, AEOlab 점수 계산 방식, 구독 해지 방법 등 자주 묻는 질문에 답합니다.",
    url: "https://aeolab.co.kr/faq",
  },
};

const AI_FAQS = [
  {
    q: "내 업종도 네이버 AI 브리핑에 노출될 수 있나요?",
    a: "네이버 AI 브리핑 네이버 플레이스 노출 대상 업종은 음식점·카페·베이커리·주점·숙박입니다. 미용·네일·피트니스·요가·반려동물 업종은 AI 브리핑 LIKELY(확대 검토 중) 상태로, 현재 AI 브리핑 노출 여부가 불확실합니다. 단, 네이버 AI탭은 업종 제한 없이 모든 사업장이 노출 대상입니다. 프랜차이즈 사업장은 업종에 상관없이 네이버 정책상 AI 브리핑 대상에서 제외됩니다. 그 외 업종(학원·병원·법무사·부동산 등)은 ChatGPT·Gemini·Google AI 노출 최적화가 더 효과적이며, AEOlab은 이 채널도 함께 측정합니다. 정확한 업종 여부는 무료 체험에서 바로 확인할 수 있습니다.",
  },
  {
    q: "네이버 AI탭과 AI 브리핑은 어떻게 다른가요?",
    a: "AI 브리핑은 검색 결과 상단에 자동으로 뜨는 추천 박스로, 음식점·카페·숙박 등 일부 업종만 해당합니다. AI탭은 검색창 상단 'AI' 탭을 클릭하면 나오는 화면으로, 업종 제한 없이 모든 사업장이 노출될 수 있습니다. (2026-04-27 베타 출시 · 2026-06-25 정식 출시됨)",
  },
  {
    q: "ChatGPT는 어떤 기준으로 가게를 추천하나요?",
    a: "실사용자의 ChatGPT는 Bing 웹검색 기반으로 답변합니다. 구글 비즈니스 프로필·자체 웹사이트·트립어드바이저 등 Bing이 인덱싱하는 콘텐츠를 참조합니다. 네이버 블로그·스마트플레이스는 Bing 인덱싱이 제한적이어서 ChatGPT 웹검색에 직접 영향이 없습니다. AEOlab의 ChatGPT 스캐너는 AI 학습 데이터 기반으로 측정하며, 실시간 웹검색 결과와 다를 수 있습니다.",
  },
  {
    q: "네이버 AI 브리핑에 내 가게가 나오려면 무엇이 필요한가요?",
    a: "네이버 AI 브리핑은 스마트플레이스 정보 완성도(업종·소개·영업 시간·사진 등)와 최근 리뷰 활동, 네이버 블로그 언급량, 소개글 안 Q&A 여부를 종합적으로 평가합니다. 특히 소개글에 우리 가게가 무엇을 잘하는지를 구체적인 키워드로 설명하는 것이 중요합니다. AEOlab은 이 요소들을 자동으로 스캔하고 점수로 보여 줍니다.",
  },
  {
    q: "리뷰가 100개인데 AI에 노출이 안 되는 이유는?",
    a: "리뷰 숫자가 많아도 AI 노출이 낮은 경우가 많습니다. AI가 참고하는 것은 리뷰 수보다 최신성, 키워드 정합성, 리뷰 응답률입니다. 또한 스마트플레이스 소개글에 AI가 인식할 수 있는 키워드가 없거나, 블로그 언급이 없는 경우에도 AI 브리핑에서 누락될 수 있습니다. AEOlab 진단 결과에서 어떤 항목이 부족한지 확인할 수 있습니다.",
  },
  {
    q: "소개글 Q&A 추가가 AI 추천에 어떤 영향을 주나요?",
    a: "스마트플레이스의 소개글과 톡톡 채팅방 메뉴는 네이버 AI 브리핑·AI탭의 노출 후보 텍스트로 활용됩니다. 주차·예약 등 자주 묻는 질문을 소개글 안에 Q&A 구조로 넣으면 네이버 AI가 해당 내용을 인용할 가능성이 높아집니다. ChatGPT·Gemini는 구글 비즈니스 프로필·자체 웹사이트가 핵심 경로이며 스마트플레이스 소개글의 직접 효과는 낮습니다. (※ 스마트플레이스 사장님 Q&A 탭은 2026년 5월 기준 폐기되었으며, 현재는 소개글과 톡톡 채팅방 메뉴가 대체 경로입니다.)",
  },
  {
    q: "AI 노출과 네이버 광고는 다른가요?",
    a: "완전히 다릅니다. 네이버 광고(파워링크·플레이스 광고)는 비용을 지불하는 동안만 노출되며, 중단하면 즉시 사라집니다. AI 브리핑 노출은 스마트플레이스 정보와 콘텐츠 품질로 결정되는 유기적 노출입니다. 한 번 최적화하면 광고비 없이도 지속적으로 노출될 수 있습니다. AEOlab은 광고 대신 이 유기적 노출을 높이는 데 집중합니다.",
  },
  {
    q: "개선 후 AI에 반영되기까지 얼마나 걸리나요?",
    a: "채널마다 반영 기간이 다릅니다. 네이버 AI 브리핑·AI탭: 소개글·소식 업데이트 후 2~4주. Gemini: 구글 비즈니스 프로필 업데이트 후 수주 내 반영 (Google 실시간 검색 연동으로 빠름). ChatGPT: AEOlab 스캐너 점수는 ChatGPT 학습 데이터 기반이므로 모델 재학습 주기(수개월~1년)에 의존합니다. 실사용자 ChatGPT 웹검색(Bing 기반)은 구글 비즈니스 프로필 등록 후 1~4주 내 반영됩니다.",
  },
  {
    q: "Google AI 스캔은 어떻게 진행되나요?",
    a: "Google AI Overview(SGE)는 실제 Google 검색 결과를 조회해 측정합니다. 스캔 쿼리별로 AI Overview 영역에 내 사업장이 포함되는지 직접 확인하며, 안정적으로 측정되고 CAPTCHA 차단 없이 정상 작동합니다.",
  },
  {
    q: "네이버 지도·플레이스 상위노출은 어떻게 결정되나요?",
    a: "네이버 플레이스 순위는 C-rank 알고리즘 기반으로 결정됩니다. 핵심 요소는 ① 리뷰 수·평점·최신성, ② 스마트플레이스 정보 완성도(사진·영업시간·소개글·편의시설 등), ③ 블로그·카페·지식인 등 네이버 생태계 언급량, ④ 방문자 수·예약·주문 활동입니다. 특히 최근 3개월 리뷰 활동과 소개글의 키워드 구체성이 AI 브리핑 노출 여부에도 직결됩니다. AEOlab은 이 요소들을 항목별로 점수화해 어떤 항목이 경쟁사 대비 부족한지 보여 줍니다.",
  },
  {
    q: "네이버 AI탭에 노출되려면 무엇을 준비해야 하나요?",
    a: "네이버 AI탭(2026-04-27 베타 출시 · 2026-06-25 정식 출시됨)은 모든 업종이 노출 대상입니다. 최적화 핵심 5가지: ① 소개글 — 업종·특징·서비스를 자연어로 구체적으로 작성, ② 사진 — 업종별 필수 카테고리(음식·공간·메뉴판 등) 최신 사진 등록, ③ 예약·주문 — 네이버 예약/스마트주문 연동, ④ 리뷰 답변 — 최근 리뷰에 키워드 포함 답변, ⑤ 블로그 UGC — 실제 방문자 블로그 리뷰 축적. AI탭은 사용자 질문에 맞는 정보를 인용하므로, 소개글에 자주 받는 질문(주차 가능 여부·예약 방법 등)을 미리 Q&A 형식으로 넣으면 인용 가능성이 높아집니다.",
  },
  {
    q: "Gemini는 어떤 기준으로 사업장을 추천하나요?",
    a: "Google의 Gemini는 Google 비즈니스 프로필(구 구글 마이비즈니스)과 Google 지도 데이터, 그리고 웹 전반의 콘텐츠를 기반으로 답변합니다. 구글 비즈니스 프로필에 등록된 업종·설명·리뷰·사진·영업 시간이 Gemini 답변에 직접 반영됩니다. 네이버 스마트플레이스는 Gemini 답변에 거의 영향을 주지 않습니다. 구글 비즈니스 프로필 업데이트 후 Gemini 반영까지는 수 주 내외가 소요됩니다. AEOlab은 Gemini 스캐너로 50~100회 샘플 쿼리를 실행해 실제 인용 빈도를 측정합니다.",
  },
  {
    q: "내 업종은 어떤 AI 채널에 집중해야 하나요?",
    a: "업종별 권장 채널이 다릅니다. ▪ 음식점·카페·베이커리·주점·숙박: 네이버 AI 브리핑 + AI탭이 핵심. 스마트플레이스 완성도·리뷰·블로그가 최우선. ▪ 미용·네일·피트니스·요가·반려동물: AI탭(모든 업종 가능) + ChatGPT·Gemini 병행. AI 브리핑은 확대 예정이나 현재 불확실. ▪ 학원·병원·법무사·부동산·인테리어 등: 네이버 플레이스 일반 검색 상위노출 + ChatGPT·Gemini 위주. 구글 비즈니스 프로필 등록이 특히 중요. AEOlab 진단을 받으면 내 업종·지역의 경쟁사가 어느 채널에서 노출 중인지와 내가 부족한 채널을 함께 확인할 수 있습니다.",
  },
];

const SERVICE_FAQS = [
  {
    q: "AEOlab 점수는 어떻게 계산되나요?",
    a: "AEOlab은 네이버 점수와 글로벌 AI 점수를 업종별 비중에 맞게 합산합니다. 네이버 점수는 스마트플레이스 완성도, 네이버 생태계 활동, 리뷰 수, 키워드 커버리지를 측정하고, 글로벌 AI 점수는 Gemini·ChatGPT 언급률, Google AI Overview 노출 여부, 웹사이트 정보 구조, 콘텐츠 품질을 평가합니다. 업종마다 기준 비중이 다릅니다. 예를 들어 음식점은 네이버 70%, 법률 서비스는 글로벌 AI 80% 비중입니다.",
  },
  {
    q: "무료 체험과 유료 구독의 차이는?",
    a: "무료 체험은 업종·지역을 입력하면 경쟁사 현황과 기본 점수를 한 번 확인할 수 있습니다. 유료 구독(Basic 9,900원/월)은 내 사업장을 등록하고, AI 4종 자동 스캔(네이버·ChatGPT·Gemini·Google AI Overview) + 경쟁사 비교, 30일 트렌드, 월별 개선 가이드를 이용할 수 있습니다. 첫 달은 4,950원으로 시작할 수 있습니다.",
  },
  {
    q: "결과가 나오기까지 얼마나 걸리나요?",
    a: "무료 체험은 약 30초, 유료 전체 스캔은 약 2~3분 소요됩니다. AI 4종을 병렬로 실행하고, 네이버 AI 브리핑은 실시간 크롤링 방식이라 네트워크 상황에 따라 조금 더 걸릴 수 있습니다. 스캔 진행률은 실시간으로 표시됩니다.",
  },
  {
    q: "언제든지 해지할 수 있나요?",
    a: "네, 언제든지 해지할 수 있습니다. 구독 설정 페이지에서 직접 해지하면 다음 결제일부터 청구되지 않습니다. 남은 기간은 그대로 이용할 수 있으며, 위약금이나 추가 비용은 없습니다. 토스페이먼츠 카드 자동결제 방식으로 매월 결제됩니다(카드 최초 1회 등록 필요). 해지는 설정 페이지에서 언제든 직접 할 수 있습니다.",
  },
];

interface FAQItemProps {
  q: string;
  a: string;
  index: number;
}

function FAQItem({ q, a, index }: FAQItemProps) {
  return (
    <details className="border border-gray-200 rounded-xl overflow-hidden group">
      <summary className="px-5 py-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer list-none flex items-start gap-3">
        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <h3 className="text-base font-semibold text-gray-900 break-keep leading-snug flex-1">{q}</h3>
        <span className="shrink-0 ml-2 text-gray-400 group-open:rotate-180 transition-transform duration-200" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </summary>
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
        <p className="text-sm text-gray-700 leading-relaxed break-keep pl-9">{a}</p>
      </div>
    </details>
  );
}

export default function FAQPage() {
  const allFaqs = [...AI_FAQS, ...SERVICE_FAQS];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allFaqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="min-h-screen bg-white">
        {/* 헤더 */}
        <header className="border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-blue-600">AEOlab</span>
              <span className="text-sm text-gray-500 hidden sm:block">
                네이버·ChatGPT·Google AI 노출 관리
              </span>
            </Link>
            <nav className="flex items-center gap-3 lg:gap-6">
              <Link
                href="/how-it-works"
                className="hidden lg:block text-base text-gray-600 hover:text-gray-900 whitespace-nowrap"
              >
                서비스 안내
              </Link>
              <Link
                href="/faq"
                className="hidden md:block text-base text-blue-600 font-semibold"
                aria-current="page"
              >
                FAQ
              </Link>
              <Link
                href="/pricing"
                className="hidden sm:block text-base text-gray-600 hover:text-gray-900"
              >
                요금제
              </Link>
              <Link
                href="/trial"
                className="bg-blue-600 text-white text-sm md:text-base px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold whitespace-nowrap"
              >
                무료 진단 시작
              </Link>
            </nav>
          </div>
        </header>

        {/* 페이지 히어로 */}
        <section className="bg-gradient-to-b from-blue-50/40 to-white px-4 md:px-6 py-10 md:py-14">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-3 break-keep">
              자주 묻는 질문
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-5 break-keep">
              AI 검색 노출 원리부터 AEOlab 서비스까지 — 궁금한 점을 정리했습니다
            </p>
            <div className="inline-flex items-center gap-2 text-sm md:text-base bg-white border border-blue-200 rounded-full px-4 py-2 shadow-sm">
              <span className="text-gray-700">상세한 동작 원리는</span>
              <Link href="/how-it-works" className="text-blue-600 font-semibold hover:underline">
                서비스 안내 매뉴얼 →
              </Link>
            </div>
          </div>
        </section>

        {/* 섹션 1: AI 검색 원리 */}
        <section className="px-4 md:px-6 py-8 md:py-10">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4 h-4 text-purple-600"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">
                AI 검색 원리
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {AI_FAQS.map((item, i) => (
                <FAQItem key={i} q={item.q} a={item.a} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          <hr className="border-gray-100" />
        </div>

        {/* 섹션 2: AEOlab 서비스 */}
        <section className="px-4 md:px-6 py-8 md:py-10">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4 h-4 text-blue-600"
                  aria-hidden="true"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">
                AEOlab 서비스
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {SERVICE_FAQS.map((item, i) => (
                <FAQItem key={i} q={item.q} a={item.a} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* 하단 CTA */}
        <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white px-4 md:px-6 py-10 md:py-14">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl md:text-3xl font-bold mb-3 break-keep">
              지금 바로 AI 노출 현황을 확인해 보세요
            </h2>
            <p className="text-base text-blue-100 mb-6 break-keep">
              업종 선택 → 30초 → 경쟁사 순위 확인
            </p>
            <Link
              href="/trial"
              className="inline-block bg-white text-blue-700 text-base md:text-lg px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors font-bold shadow-lg"
            >
              무료 진단 시작 →
            </Link>
            <p className="text-sm text-blue-200 mt-3">
              가입 불필요 · 카드 등록 불필요 · 30초
            </p>
          </div>
        </section>

        <SiteFooter activePage="/faq" />
      </main>
    </>
  );
}
