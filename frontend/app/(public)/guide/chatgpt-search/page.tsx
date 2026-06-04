import Link from "next/link"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/common/SiteFooter"
import { ChatGptChecklist } from "./ChatGptChecklist"

export const metadata: Metadata = {
  title: "ChatGPT에서 내 가게가 언급되는 조건 | AEOlab",
  description:
    "ChatGPT는 Bing 검색 기반으로 구글 비즈니스 프로필·자체 웹사이트·영문 플랫폼을 참조합니다. 네이버 블로그·스마트플레이스와는 직접 연결되지 않는 이유를 정리합니다.",
}

const LEARN_SOURCES = [
  {
    icon: "🌐",
    title: "자체 웹사이트 (가장 효과적)",
    desc: "Bing·OAI-SearchBot이 직접 크롤링하는 외부 URL. JSON-LD 구조화 마크업이 있으면 인용 가능성이 높아집니다. 티스토리·워드프레스도 포함됩니다.",
  },
  {
    icon: "📍",
    title: "구글 비즈니스 프로필",
    desc: "Google 데이터를 기반으로 하는 ChatGPT 웹 검색에서 가장 직접적으로 참조됩니다. business.google.com 무료 등록만으로 즉시 효과가 있습니다.",
  },
  {
    icon: "📰",
    title: "뉴스·언론 기사·영문 플랫폼",
    desc: "언론 보도, 트립어드바이저 등 Bing 인덱싱이 잘 되는 외부 플랫폼은 권위 신호로 인식되어 인용 가능성이 높아집니다.",
  },
  {
    icon: "⚠️",
    title: "네이버 블로그·스마트플레이스는 ChatGPT 응답에 미치는 영향이 제한적입니다",
    desc: "ChatGPT는 Bing 검색 엔진을 기반으로 합니다. 네이버 생태계(블로그·스마트플레이스)는 구글 색인 콘텐츠 대비 Bing 내 영향력이 매우 제한적이어서 ChatGPT 응답에 미치는 효과가 작습니다. 네이버 최적화는 네이버 AI 브리핑·AI탭에 효과적입니다.",
  },
]

const CHECKLIST_ITEMS = [
  { id: "google_biz", label: "구글 비즈니스 프로필 등록 완료 (business.google.com)" },
  { id: "qa", label: "자체 웹사이트·홈페이지에 Q&A 5개 이상 포함" },
  { id: "specific", label: "가격·운영시간·위치 구체 수치 명시" },
  { id: "authority", label: "권위 신호 포함 (경력·자격·수상)" },
  { id: "tripadvisor", label: "트립어드바이저·망고플레이트 등 외부 플랫폼 등록" },
]

export default function ChatGptSearchGuidePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">
            AEOlab
          </Link>
          <div className="flex items-center gap-3 md:gap-4">
            <Link
              href="/how-it-works"
              className="hidden md:block text-sm text-gray-600 hover:text-gray-900"
            >
              서비스 안내
            </Link>
            <Link
              href="/pricing"
              className="hidden sm:block text-sm text-gray-600 hover:text-gray-900"
            >
              요금제
            </Link>
            <Link
              href="/trial"
              className="bg-blue-600 text-white text-sm md:text-base px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              무료 진단
            </Link>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-10">

        {/* ── 1. 헤더 섹션 ── */}
        <section>
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight break-keep">
            ChatGPT에서 내 가게를 노출시키는 방법
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-4 leading-relaxed break-keep">
            ChatGPT는 Bing 검색 기반 — 구글 비즈니스 프로필과 자체 웹사이트가 핵심입니다
          </p>
          {/* 면책 문구 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-800 leading-relaxed">
              ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
              측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
            </p>
          </div>
        </section>

        {/* ── 2. ChatGPT가 참조하는 정보 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 break-keep">
            실사용자 ChatGPT가 참조하는 정보 — Bing 웹검색 기반
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LEARN_SOURCES.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                  <p className="text-sm md:text-base font-semibold text-gray-900 break-keep">
                    {item.title}
                  </p>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed break-keep">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. 소개글 FAQ 구조가 인용률을 높이는 이유 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            소개글 FAQ 구조가 인용률을 높이는 이유
          </h2>
          <div className="space-y-3 mb-5">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center mt-0.5">
                1
              </span>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                Q&amp;A 형식 텍스트는 AI가 <strong>질문-답변 쌍</strong>으로 인식하여
                특정 질문에 대한 답으로 인용하기 쉽습니다.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center mt-0.5">
                2
              </span>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                AI가 인용하기 좋은 <strong>명확한 문장 구조</strong>는 출처를 특정할 수 있어
                인용 가능성이 높아집니다.
              </p>
            </div>
          </div>

          {/* Before / After 비교 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">Before (인용 어려움)</p>
              <p className="text-sm md:text-base text-gray-800 leading-relaxed italic">
                &ldquo;맛있는 음식을 제공합니다.&rdquo;
              </p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                구체적 정보 없음 — ChatGPT가 인용할 근거가 부족합니다.
              </p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-700 mb-2">After (인용 가능)</p>
              <p className="text-sm md:text-base text-gray-800 leading-relaxed italic">
                &ldquo;Q. 대표 메뉴는? A. 시그니처 파스타(15,000원)와 트러플 리조또(18,000원)입니다.&rdquo;
              </p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Q&amp;A 구조 + 구체 수치 → 질문에 바로 답하는 형태로 인용 가능합니다.
              </p>
            </div>
          </div>
        </section>

        {/* ── 개선 후 반영까지 걸리는 시간 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            개선 후 ChatGPT에 반영되기까지
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">실사용자 ChatGPT (Bing 웹검색 기준)</p>
              <p className="text-sm text-gray-700 leading-relaxed">
                구글 비즈니스 프로필 등록·업데이트 → Bing 인덱싱 후 반영<br />
                <strong>약 1~4주</strong> 소요
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">AEOlab 스캐너 점수 (ChatGPT 학습 데이터 기준)</p>
              <p className="text-sm text-gray-700 leading-relaxed">
                ChatGPT 모델 재학습 주기에 의존<br />
                <strong>수개월~1년</strong> 이상 소요
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            ※ AEOlab 점수는 학습 데이터 기반 측정이며, 실사용자 ChatGPT 웹검색 결과와 다를 수 있습니다.
          </p>
        </section>

        {/* ── 4. ChatGPT 노출 체크리스트 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            ChatGPT 노출 체크리스트
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            체크는 화면 확인용입니다. 브라우저에 저장되며 닫으면 초기화됩니다.
          </p>
          <ChatGptChecklist items={CHECKLIST_ITEMS} />
        </section>

        {/* ── 5. CTA ── */}
        <section className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-5 md:p-6 text-center">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2 break-keep">
            AEOlab에서 ChatGPT 소개글 자동 생성
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            ChatGPT·Gemini가 내 사업장을 언급하도록 FAQ 중심 소개글·Q&A를 30초 안에 자동 생성합니다. 구글 비즈니스 프로필·자체 웹사이트에 바로 활용하세요.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm md:text-base font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            대시보드에서 소개글 생성하기 →
          </Link>
        </section>

      </article>

      <SiteFooter />
    </main>
  )
}
