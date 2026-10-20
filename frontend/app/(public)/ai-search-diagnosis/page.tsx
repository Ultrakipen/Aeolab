import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight, Check, Search, Bot, MapPin, MessageSquareText, Clock, AlertTriangle } from "lucide-react"
import { SiteFooter } from "@/components/common/SiteFooter"
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient"

export const metadata: Metadata = {
  title: "AI 검색 노출 진단 도구 — 내 가게가 AI 답변에 나오는지 무료 확인 | AEOlab",
  description:
    "네이버 AI 브리핑·ChatGPT·Gemini·구글 AI 검색에 내 가게가 나오는지 진단하는 도구입니다. 무엇을 어떻게 측정하는지, 무료로 확인되는 범위와 한계, 결과를 읽는 법을 정리했습니다.",
  alternates: { canonical: "/ai-search-diagnosis" },
  openGraph: {
    title: "AI 검색 노출 진단 도구 — 내 가게가 AI 답변에 나오는지 확인",
    description: "무엇을 어떻게 측정하는지, 무료로 확인되는 범위와 한계, 결과를 읽는 법.",
    url: "https://aeolab.co.kr/ai-search-diagnosis",
    type: "article",
    locale: "ko_KR",
  },
}

const FAQS = [
  {
    q: "AI 검색 노출 진단이란 무엇인가요?",
    a: "손님이 네이버 AI 브리핑, ChatGPT, Gemini, 구글 AI 검색 같은 AI 답변에 가게를 물어볼 때, 내 가게가 실제로 언급·추천되는지 확인하는 것입니다. 순위를 보는 일반 검색 진단과 달리 '답변에 이름이 나오는가'를 봅니다.",
  },
  {
    q: "AI 노출 진단 도구는 무엇을 측정하나요?",
    a: "AEOlab은 가게 정보가 네이버 지도·검색에 어떻게 잡히는지, ChatGPT에 손님처럼 추천을 물었을 때 내 가게가 나오는지, 구글 지도에서의 노출·평점·리뷰 수를 직접 측정합니다. 네이버 AI 브리핑·AI탭·Gemini·구글 AI 개요는 가입 후 정기 스캔으로 확인합니다.",
  },
  {
    q: "무료 진단으로 어디까지 확인할 수 있나요?",
    a: "가입 없이 1회 체험할 수 있고, 네이버 지도·검색, ChatGPT 추천 여부, 구글 지도 노출을 확인합니다. AI 브리핑·AI탭·Gemini·구글 AI는 가입 후 확인합니다.",
  },
  {
    q: "진단 결과는 항상 같게 나오나요?",
    a: "아닙니다. AI 답변은 질문 표현·측정 시점·기기·로그인 상태에 따라 달라질 수 있어, 한 번의 결과보다 여러 번 반복해 본 경향이 중요합니다. 특히 ChatGPT 측정은 AI 학습 데이터 기반이라 실시간 웹 검색 결과와 다를 수 있습니다.",
  },
  {
    q: "진단하면 AI에 노출되도록 보장되나요?",
    a: "보장되지 않습니다. 진단은 현재 상태와 부족한 부분을 알려주는 것이고, 실제 노출은 각 AI 서비스의 정책과 경쟁 상황에 따라 달라집니다.",
  },
  {
    q: "개선하면 얼마나 걸려 반영되나요?",
    a: "채널마다 다릅니다. 네이버 AI 브리핑·AI탭은 네이버가 공개하지 않아 2~4주 정도로 추정하며, ChatGPT는 학습 데이터에 반영되기까지 수개월~1년 이상 걸릴 수 있습니다. 두 채널은 원리가 달라 묶어서 기대하면 안 됩니다.",
  },
]

const CHANNELS = [
  {
    icon: MapPin,
    title: "네이버 지도·검색",
    free: true,
    desc: "내 가게가 네이버 지도·통합검색에서 어떤 키워드로 잡히는지, 스마트플레이스 정보가 채워졌는지 확인합니다. 네이버 이용자가 가장 먼저 만나는 곳입니다.",
  },
  {
    icon: MessageSquareText,
    title: "ChatGPT 추천",
    free: true,
    desc: "가게 이름을 알려주지 않고 '이 동네 추천해줘'라고 물었을 때, 추천 목록에 내 가게가 스스로 나오는지 반복 측정합니다. 이름을 넣고 묻는 방식은 결과가 부풀려져 쓰지 않습니다.",
  },
  {
    icon: Search,
    title: "구글 지도",
    free: true,
    desc: "구글 지도에서의 노출 여부, 평점, 리뷰 수를 직접 조회합니다.",
  },
  {
    icon: Bot,
    title: "네이버 AI 브리핑·AI탭, Gemini, 구글 AI 개요",
    free: false,
    desc: "가입 후 정기 스캔으로 확인합니다. 네이버 AI 브리핑은 업종에 따라 노출 구조가 달라서 업종별로 안내가 달라집니다.",
  },
]

export default function AiSearchDiagnosisPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <main className="min-h-screen bg-white">
        <header className="border-b border-gray-100 px-4 md:px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">
              AEOlab
            </Link>
            <div className="flex items-center gap-3 md:gap-4">
              <Link href="/how-it-works" className="hidden md:block text-sm text-gray-600 hover:text-gray-900">
                서비스 안내
              </Link>
              <Link href="/pricing" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900">
                요금제
              </Link>
              <AuthNavControlClient />
              <Link
                href="/trial"
                className="bg-blue-600 text-white text-sm md:text-base px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                무료 진단
              </Link>
            </div>
          </div>
        </header>

        <article className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-10">
          {/* 제목 */}
          <section>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight break-keep">
              AI 검색 노출 진단 도구 — 내 가게가 AI 답변에 나오는지 확인하세요
            </h1>
            <p className="text-base md:text-lg text-gray-600 leading-relaxed break-keep">
              손님이 네이버 AI 브리핑이나 ChatGPT에 &ldquo;이 동네 괜찮은 곳 추천해줘&rdquo;라고 물을 때 내 가게 이름이
              나오는지 확인하는 것이 AI 검색 노출 진단입니다. 일반 검색 순위와는 다른 지표라서 따로 확인해야 합니다.
            </p>
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm text-amber-800 leading-relaxed">
                AI 답변은 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다. ChatGPT 측정은 AI 학습 데이터 기반이며
                실시간 웹 검색 결과와 다를 수 있습니다.
              </p>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Link
                href="/trial"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-base font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                내 가게 무료 진단하기 <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center text-base text-blue-600 font-medium hover:underline"
              >
                결과 화면 미리보기
              </Link>
            </div>
          </section>

          {/* 무엇을 측정하나 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 break-keep">
              AI 노출 진단 도구는 무엇을 측정하나요?
            </h2>
            <p className="text-base text-gray-600 mb-4 leading-relaxed break-keep">
              AEOlab은 채널마다 다른 방법으로 직접 측정합니다. 가입 없이 확인되는 범위와 가입 후 확인되는 범위를 구분해 표시했습니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CHANNELS.map(({ icon: Icon, title, free, desc }) => (
                <div key={title} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                    <h3 className="text-base font-bold text-gray-900 break-keep">{title}</h3>
                  </div>
                  <span
                    className={`inline-block text-sm font-medium rounded-full px-2.5 py-0.5 mb-2 ${
                      free ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {free ? "무료 체험에서 확인" : "가입 후 확인"}
                  </span>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 결과 읽는 법 */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
              진단 결과, 이렇게 읽으세요
            </h2>
            <ul className="space-y-3">
              {[
                "한 번의 결과보다 여러 번 반복해 본 경향을 보세요. AI 답변은 매번 조금씩 달라집니다.",
                "'나오지 않음'은 '없는 가게'가 아니라 '아직 AI가 추천 후보로 고르지 않음'이라는 뜻입니다.",
                "네이버 쪽 노출과 ChatGPT·구글 쪽 노출은 원리가 달라서 각각 따로 개선해야 합니다.",
                "측정되지 못한 항목은 '미노출'이 아니라 '알 수 없음'으로 구분해서 봅니다.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-base text-gray-700 leading-relaxed break-keep">{t}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 반영 기간 */}
          <section className="rounded-xl bg-gray-50 border border-gray-200 p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-gray-700" aria-hidden="true" />
              <h2 className="text-lg md:text-xl font-bold text-gray-900">개선하면 언제 반영되나요?</h2>
            </div>
            <ul className="space-y-2 text-base text-gray-700 leading-relaxed">
              <li className="break-keep">
                <strong>네이버 AI 브리핑·AI탭</strong> — 네이버가 공개하지 않아 2~4주 정도로 추정합니다.
              </li>
              <li className="break-keep">
                <strong>ChatGPT</strong> — 학습 데이터 기반이라 수개월~1년 이상 걸릴 수 있습니다.
              </li>
              <li className="break-keep">
                <strong>Gemini·구글 AI</strong> — 구글 비즈니스 프로필 등록 후 1~4주 뒤부터 반영이 시작되고, 안정적으로 언급되기까지는 더 걸릴 수 있습니다.
              </li>
            </ul>
            <p className="mt-3 flex items-start gap-2 text-sm text-gray-600 leading-relaxed">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="break-keep">진단은 현재 상태를 알려드릴 뿐, 특정 순위나 언급을 보장하지 않습니다.</span>
            </p>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">자주 묻는 질문</h2>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <details key={f.q} className="rounded-xl border border-gray-200 p-4 group">
                  <summary className="cursor-pointer text-base md:text-lg font-semibold text-gray-900 break-keep">
                    {f.q}
                  </summary>
                  <p className="mt-2 text-base text-gray-700 leading-relaxed break-keep">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* 관련 페이지 */}
          <section>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3">함께 보면 좋은 글</h2>
            <div className="flex flex-wrap gap-3 text-base">
              <Link href="/how-it-works" className="text-blue-600 hover:underline">AI 검색 노출 원리</Link>
              <Link href="/guide/chatgpt-search" className="text-blue-600 hover:underline">ChatGPT에 내 가게가 나오는 조건</Link>
              <Link href="/blog/naver-ai-briefing-guide" className="text-blue-600 hover:underline">네이버 AI 브리핑 가이드</Link>
              <Link href="/guide/channels" className="text-blue-600 hover:underline">업종별 노출 가이드</Link>
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-5 md:p-6 text-center">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2 break-keep">
              내 가게는 AI 답변에 나올까요?
            </h2>
            <p className="text-base text-gray-700 mb-4 leading-relaxed break-keep">
              가게 이름만 입력하면 무료로 확인할 수 있습니다. 가입 없이 1회 체험할 수 있습니다.
            </p>
            <Link
              href="/trial"
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-base font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              무료 진단 시작하기 <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </section>
        </article>

        <SiteFooter activePage="/ai-search-diagnosis" />
      </main>
    </>
  )
}
