import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import { MoreInfo } from "@/components/common/MoreInfo";

export const metadata: Metadata = {
  title: "자주 묻는 질문 | AEOlab",
  description:
    "ChatGPT·네이버 AI 브리핑이 가게를 추천하는 기준, AEOlab 점수 계산 방식, 구독 해지 방법 등 자주 묻는 질문에 답합니다.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "자주 묻는 질문 | AEOlab",
    description:
      "ChatGPT·네이버 AI 브리핑이 가게를 추천하는 기준, AEOlab 점수 계산 방식, 구독 해지 방법 등 자주 묻는 질문에 답합니다.",
    url: "https://aeolab.co.kr/faq",
  },
};

interface FAQData {
  q: string;
  short: string;
  detail?: string;
}

const AI_FAQS: FAQData[] = [
  {
    q: "내 업종도 네이버 AI 브리핑에 노출될 수 있나요?",
    short:
      "음식점·카페·베이커리·바·숙박은 '가게 요약형(플레이스형: 가게 정보를 요약해 보여주는 방식)' AI 브리핑 대상입니다. 프랜차이즈는 업종 무관하게 제외됩니다. 그 외 업종도 블로그·콘텐츠 기반 '글 모음형(정보형: 블로그·글을 모아 추천하는 방식)' AI 브리핑은 업종 제한 없이 노출될 수 있고, AI탭도 네이버가 업종 제한을 발표하지 않았습니다.",
    detail:
      "뷰티·피트니스·댄스·요가·반려동물·약국 등은 아직 '가게 요약형' 대상이 아닙니다(확대 여부는 네이버가 발표하지 않았습니다). 네이버 AI탭은 업종 제한 발표 없이 모든 사업장이 노출될 수 있습니다(2026-06-25 정식 출시). 학원·병원·법무사·부동산 등은 '가게 요약형' 대상이 아니지만, 블로그·콘텐츠가 잘 갖춰지면 '글 모음형 AI 브리핑'에 노출될 수 있습니다.",
  },
  {
    q: "내 업종은 어디에 집중해야 하나요?",
    short: "업종마다 집중할 곳이 다릅니다. 아래 '업종별 안내'를 참고하세요.",
    detail:
      "음식점·카페·베이커리·주점·숙박: 스마트플레이스 완성도·리뷰·블로그가 핵심이며 '가게 요약형' 네이버 AI 브리핑과 AI탭이 주요 노출 경로입니다. 뷰티·피트니스 등: AI탭(업종 제한 발표 없음)과 ChatGPT·Gemini를 병행하세요. 학원·병원·법무사·부동산 등: 네이버 플레이스 일반검색과 ChatGPT·Gemini가 중요합니다. 세 그룹 모두 '글 모음형 AI 브리핑'은 블로그·콘텐츠가 잘 갖춰지면 업종 제한 없이 노출될 수 있습니다.",
  
  },
  {
    q: "네이버 AI탭과 AI 브리핑은 어떻게 다른가요?",
    short:
      "AI 브리핑은 검색 결과 상단에 자동으로 뜨는 추천 박스입니다. '가게 요약형'은 일부 업종만, '글 모음형'은 블로그·콘텐츠가 출처로 채택되면 업종 제한 없이 노출될 수 있습니다. AI탭은 검색창 상단 'AI' 탭을 직접 클릭해야 나오는 별도 화면으로, 네이버가 업종 제한을 발표하지 않았습니다.",
    detail: "AI탭은 2026-04-27 베타 출시, 2026-06-25 전체 사용자 정식 출시됐습니다.",
  },
  {
    q: "네이버 AI 브리핑에 내 가게가 나오려면 무엇이 필요한가요?",
    short:
      "스마트플레이스 정보 완성도(업종·소개·영업시간·사진 등), 최근 리뷰 활동, 네이버 블로그 언급이 도움이 될 수 있습니다. 네이버 검색 순위·AI 브리핑 노출은 네이버가 정한 기준이며 보장되지 않습니다.",
    detail:
      "소개글에 우리 가게가 무엇을 잘하는지 구체적으로 설명하면 AI가 해당 내용을 소개할 가능성이 생깁니다. AEOlab은 이 요소들을 자동으로 점검해 보여 줍니다.",
  },
  {
    q: "네이버가 ChatGPT 같은 AI를 막았다는데, 네이버 AI에는 어떻게 나오나요?",
    short:
      "네이버가 막아 둔 것은 ChatGPT 같은 외부 AI입니다(2026-10-07 확인). 네이버 AI 브리핑과 AI탭은 네이버가 직접 운영하는 서비스라 이 제한과는 별개로 동작하는 것으로 보입니다. 다만 네이버가 어떤 정보를 읽는지는 공개하지 않았습니다.",
    detail:
      "그래서 AEOlab은 구조를 짐작해 점수를 내지 않고, 네이버 검색 결과에 AI 브리핑이 실제로 뜨는지 직접 확인해 보여 드립니다. 반대로 네이버에만 정보가 있는 가게는 ChatGPT·Gemini에 잘 나오지 않는 편이라, 구글 비즈니스 프로필이나 자체 홈페이지처럼 네이버 밖 정보도 함께 챙기는 것이 좋습니다. 측정 결과는 시점·기기·로그인 상태에 따라 달라질 수 있습니다.",
  },
  {
    q: "리뷰가 100개인데 AI에 노출이 안 되는 이유는?",
    short:
      "리뷰 수보다 최신성·답변 여부, 소개글의 키워드, 블로그 언급 여부 등이 복합적으로 영향을 줄 수 있습니다. AEOlab 진단에서 어떤 항목이 부족한지 확인할 수 있습니다.",
    detail:
      "네이버는 순위·노출 기준을 공개하지 않습니다. 리뷰 수 단독이 AI 브리핑 노출을 보장하지 않습니다.",
  },
  {
    q: "소개글 Q&A 추가가 AI 추천에 어떤 영향을 주나요?",
    short:
      "소개글에 주차·예약 등 자주 묻는 내용을 Q&A 형태로 넣으면 네이버 AI 브리핑·AI탭이 언급해 줄 가능성이 생깁니다(보장 아님). ChatGPT·Gemini는 구글 비즈니스 프로필·자체 웹사이트가 핵심 경로이며, 스마트플레이스 소개글의 직접 효과는 낮습니다.",
    detail:
      "스마트플레이스 사장님 Q&A 탭은 2026년 5월 폐기됐습니다. 현재는 소개글과 톡톡 채팅방 메뉴가 대체 경로입니다.",
  },
  {
    q: "네이버 지도·플레이스 상위노출은 어떻게 결정되나요?",
    short:
      "네이버는 순위 결정 기준을 공개하지 않습니다. 리뷰·평점·최신성, 스마트플레이스 정보 완성도, 네이버 블로그·카페·지식인 언급, 방문 활동 등이 영향을 줄 수 있습니다. 네이버 검색 순위·AI 브리핑 노출은 네이버가 정한 기준이며 보장되지 않습니다.",
    detail:
      "AEOlab은 이 요소들을 항목별로 분석해 어떤 항목이 경쟁사 대비 부족한지 보여 줍니다.",
  },
  {
    q: "네이버 AI탭에 노출되려면 무엇을 준비해야 하나요?",
    short:
      "소개글을 업종·특징·서비스가 잘 드러나게 작성하고, 최신 사진 등록, 예약·주문 연동, 리뷰에 답변하는 것이 도움이 될 수 있습니다. 소개글에 자주 받는 질문을 미리 답변 형태로 넣으면 AI탭 답변에 소개될 가능성이 생깁니다.",
    detail:
      "손님이 직접 쓴 블로그 후기가 쌓이면 AI탭 답변의 소스로 활용될 수 있습니다. AI탭은 사용자 질문에 맞는 정보를 참고해 답하는 방식으로 동작합니다.",
  },
  {
    q: "AI 노출과 네이버 광고는 다른가요?",
    short:
      "네이버 광고(파워링크·플레이스 광고)는 비용을 내는 동안만 노출되고 중단하면 즉시 사라집니다. AI 브리핑 노출은 광고가 아니라 스마트플레이스 정보 품질 등에 영향을 받는 자연 노출이라, 정보를 잘 갖추면 광고 없이도 노출에 도움이 될 수 있습니다(보장 아님).",
    detail: "AEOlab은 광고 대신 자연 노출을 높이는 데 집중합니다.",
  },
  {
    q: "ChatGPT는 어떤 기준으로 가게를 추천하나요?",
    short:
      "웹검색이 켜져 있으면 인터넷에서 찾은 자료(자체 웹사이트·구글 비즈니스 프로필 등 네이버 밖 정보)를 참고합니다. 네이버는 블로그·지도·카페 글을 ChatGPT 같은 AI가 가져가지 못하게 막아 두었어요(2026-10-07 확인). 네이버에만 정보가 있으면 ChatGPT에 잘 나오지 않는 편입니다. ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.",
    detail:
      "웹검색이 꺼져 있으면 AI가 미리 공부한 자료를 바탕으로만 답변합니다. AEOlab의 ChatGPT 측정 도구는 AI가 미리 공부한 자료 기반으로 측정하며, 실시간 마이크로소프트 검색 결과와 별개입니다.",
  },
  {
    q: "Gemini는 어떤 기준으로 사업장을 추천하나요?",
    short:
      "Gemini는 구글 비즈니스 프로필(구 구글 마이비즈니스), 구글 지도, 웹 전반의 콘텐츠를 기반으로 답변합니다. 네이버 스마트플레이스는 Gemini 답변에 영향이 적은 편입니다.",
    detail:
      "실사용 Gemini 앱은 구글 검색을 실시간 참고해 구글 비즈니스 프로필 업데이트 후 수주~수개월 내 반영될 수 있습니다. AEOlab의 Gemini 측정 도구 점수는 같은 질문을 50~100번 물어봐서 몇 번 나오는지 측정하는 AI가 미리 공부한 자료 기반으로, 실사용 앱 반영 속도와 별개입니다.",
  },
  {
    q: "Google 검색 확인은 어떻게 하나요?",
    short:
      "손님이 검색할 법한 질문으로 Google을 검색해 내 가게가 나오는지 확인합니다. Google 검색 상단 AI 요약(AI Overview) 영역은 현재 측정 방식상 별도 확인이 어렵습니다.",
  },
  {
    q: "개선 후 AI에 반영되기까지 얼마나 걸리나요?",
    short:
      "서비스마다 다릅니다. 네이버 AI 브리핑·AI탭은 2~4주, Gemini는 구글 비즈니스 프로필 업데이트 후 수주 이내 시작될 수 있지만 안정적으로 소개되기까지 수개월이 걸릴 수 있습니다. ChatGPT는 AI가 미리 공부한 자료 기반이라 수개월~1년 이상 걸릴 수 있습니다. 어느 쪽도 기간을 보장하지 않습니다.",
    detail:
      "Gemini와 ChatGPT는 반영 원리가 다릅니다. Gemini는 구글 검색을 실시간 참고하는 기능이 있어 구글 정보가 갱신되면 더 빠르게 반영될 수 있습니다. AEOlab의 Gemini 측정 도구 점수는 AI가 미리 공부한 자료 기반 측정이라 실사용 앱 반영 속도와 별개입니다.",
  },
];

const SERVICE_FAQS: FAQData[] = [
  {
    q: "AEOlab 점수는 어떻게 계산되나요?",
    short:
      "네이버에서의 활동(리뷰·블로그·소식), 내 가게에 맞는 검색어가 소개글에 들어 있는 정도, 리뷰 품질을 '네이버 점수'로, ChatGPT·Gemini 언급 여부, 구글 검색 노출, 홈페이지 정리 상태를 '글로벌 AI 점수'로 합산합니다.",
    detail:
      "업종마다 비중이 다릅니다. 음식점은 네이버 점수 80%·글로벌 AI 20%, 법률 서비스는 그 반대입니다.",
  },
  {
    q: "무료 체험과 유료 구독의 차이는?",
    short:
      "무료 체험은 업종·지역을 입력하면 경쟁사 현황과 기본 결과를 한 번 확인할 수 있습니다. 유료 구독(Basic 17,900원/월, 첫 달 8,950원)은 내 사업장을 등록하고 자동 점검, 경쟁사 비교, 30일 변화 그래프, 월별 개선 안내를 이용할 수 있습니다.",
  },
  {
    q: "결과가 나오기까지 얼마나 걸리나요?",
    short:
      "무료 체험은 잠시 기다리면 결과가 나옵니다. 유료 전체 점검은 더 오래 걸립니다. 네이버 쪽 확인에 시간이 걸려 네트워크 상황에 따라 더 걸릴 수 있습니다. 진행률은 실시간으로 표시됩니다.",
  },
  {
    q: "언제든지 해지할 수 있나요?",
    short:
      "네, 언제든지 해지할 수 있습니다. 구독 설정 페이지에서 직접 해지하면 다음 결제일부터 청구되지 않습니다. 남은 기간은 그대로 이용할 수 있으며, 위약금이나 추가 비용은 없습니다. 매월 카드로 자동 결제되며, 첫 결제 때 카드를 1회 등록합니다.",
  },
];

interface FAQItemProps {
  q: string;
  short: string;
  detail?: string;
  index: number;
}

function FAQItem({ q, short, detail, index }: FAQItemProps) {
  return (
    <details className="border border-gray-200 rounded-xl overflow-hidden group h-fit">
      <summary className="px-5 py-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-start gap-3 min-h-[48px]">
        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <h3 className="text-base font-semibold text-gray-900 break-keep leading-snug flex-1">{q}</h3>
        <span
          className="shrink-0 ml-2 text-gray-600 group-open:rotate-180 transition-transform duration-200"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
        <p className="text-base text-gray-700 leading-relaxed break-keep pl-9">{short}</p>
        {detail && (
          <div className="pl-9 mt-3">
            <MoreInfo summary="자세히 보기" tone="light">
              <p className="text-sm text-gray-700 leading-relaxed break-keep">{detail}</p>
            </MoreInfo>
          </div>
        )}
      </div>
    </details>
  );
}

export default function FAQPage() {
  const allFaqs = [...AI_FAQS, ...SERVICE_FAQS];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allFaqs.map(({ q, short, detail }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: detail ? `${short} ${detail}` : short,
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
              <span className="text-sm text-gray-600 hidden sm:block">
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
              <AuthNavControlClient />
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
            <div className="inline-flex items-center gap-2 text-sm md:text-base bg-white border border-blue-200 rounded-full px-4 py-2 shadow-sm mb-6">
              <span className="text-gray-700">상세한 동작 원리는</span>
              <Link href="/how-it-works" className="text-blue-600 font-semibold hover:underline">
                서비스 안내 매뉴얼 →
              </Link>
            </div>
            {/* 주제별 바로가기 칩 */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { label: "네이버 AI 브리핑", href: "#ai-briefing" },
                { label: "ChatGPT·Gemini", href: "#chatgpt-gemini" },
                { label: "업종별 안내", href: "#업종안내" },
                { label: "요금·해지", href: "#service" },
              ].map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className="text-sm font-semibold px-4 py-1.5 rounded-full border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* 섹션 1: AI 검색 원리 */}
        <section className="px-4 md:px-6 py-8 md:py-10 scroll-mt-20" id="ai-briefing">
          <div className="max-w-5xl mx-auto">
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
            {/* 네이버 관련 10개 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AI_FAQS.slice(0, 10).map((item, i) => (
                <FAQItem key={i} q={item.q} short={item.short} detail={item.detail} index={i} />
              ))}
            </div>

            {/* ChatGPT·Gemini 앵커 sub-label */}
            <div id="chatgpt-gemini" className="scroll-mt-20 mt-8 mb-4 flex items-center gap-2">
              <span className="w-1 h-6 rounded-full bg-blue-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-blue-700">ChatGPT·Gemini·Google 관련</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AI_FAQS.slice(10).map((item, i) => (
                <FAQItem
                  key={i + 10}
                  q={item.q}
                  short={item.short}
                  detail={item.detail}
                  index={i + 10}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 업종별 채널 안내 카드 */}
        <section id="업종안내" className="scroll-mt-20 bg-gray-50 px-4 md:px-6 py-8 md:py-10">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 break-keep">
              업종별로 어디에 집중하면 좋을까요?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 음식점·카페 계열 */}
              <div className="bg-[#DDF7EA] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                  <span className="font-bold text-[#0B6B45] text-base break-keep">
                    음식점·카페·숙박 계열
                  </span>
                </div>
                <p className="text-sm text-[#0B6B45] mb-3 break-keep">
                  가게 요약형 AI 브리핑 + AI탭이 핵심
                </p>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
                  <li>스마트플레이스 정보 완성도</li>
                  <li>리뷰 수·최신성·답변</li>
                  <li>네이버 블로그 언급</li>
                </ul>
              </div>
              {/* 뷰티·피트니스 계열 */}
              <div className="bg-[#EEF2FF] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
                  <span className="font-bold text-blue-700 text-base break-keep">
                    뷰티·피트니스 등
                  </span>
                </div>
                <p className="text-sm text-blue-700 mb-3 break-keep">
                  AI탭 + ChatGPT·Gemini 병행
                </p>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
                  <li>소개글·사진 최신화</li>
                  <li>구글 비즈니스 프로필 등록</li>
                  <li>블로그 후기 축적</li>
                </ul>
              </div>
              {/* 학원·병원 계열 */}
              <div className="bg-[#FFF1D6] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                  <span className="font-bold text-[#7A4B00] text-base break-keep">
                    학원·병원·전문직
                  </span>
                </div>
                <p className="text-sm text-[#7A4B00] mb-3 break-keep">
                  ChatGPT·Gemini + 네이버 일반검색
                </p>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-4">
                  <li>구글 비즈니스 프로필</li>
                  <li>자체 웹사이트 개선</li>
                  <li>글 모음형 AI 브리핑 콘텐츠</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4 break-keep">
              세 그룹 모두 블로그·콘텐츠가 잘 갖춰지면 업종 제한 없는 &lsquo;글 모음형 AI 브리핑&rsquo;에 노출될 수 있습니다. 무료 진단으로 내 업종의 노출 현황을 바로 확인해 보세요.
            </p>
          </div>
        </section>

        {/* 구분선 */}
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <hr className="border-gray-100" />
        </div>

        {/* 섹션 2: AEOlab 서비스 */}
        <section id="service" className="scroll-mt-20 px-4 md:px-6 py-8 md:py-10">
          <div className="max-w-5xl mx-auto">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SERVICE_FAQS.map((item, i) => (
                <FAQItem
                  key={i}
                  q={item.q}
                  short={item.short}
                  detail={item.detail}
                  index={i}
                />
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
              업종 선택 → 진단 → 경쟁사 순위 확인
            </p>
            <Link
              href="/trial"
              className="inline-block bg-white text-blue-700 text-base md:text-lg px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors font-bold shadow-lg"
            >
              무료 진단 시작 →
            </Link>
            <p className="text-sm text-blue-200 mt-3">
              가입 불필요 · 카드 등록 불필요
            </p>
          </div>
        </section>

        <SiteFooter activePage="/faq" />
      </main>
    </>
  );
}
