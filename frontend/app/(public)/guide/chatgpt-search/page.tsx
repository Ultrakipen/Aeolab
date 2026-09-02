import Link from "next/link"
import type { Metadata } from "next"
import { Globe, MapPin, Newspaper, AlertTriangle, Bot, MessageSquareText, ArrowRight, ArrowDown } from "lucide-react"
import { SiteFooter } from "@/components/common/SiteFooter"
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient"
import { ChatGptChecklist } from "./ChatGptChecklist"

export const metadata: Metadata = {
  title: "ChatGPT에서 내 가게가 언급되는 조건 | AEOlab",
  description:
    "ChatGPT 웹검색은 OpenAI 자체 크롤러(OAI-SearchBot)와 구글 인덱스가 중심이며 Bing 비중은 제한적입니다. 자체 웹사이트·구글 비즈니스 프로필·영어권 플랫폼을 참조하는 구조와, 네이버 블로그·스마트플레이스가 직접 연결되지 않는 이유·실제 노출 조건을 정리합니다.",
}

const LEARN_SOURCES = [
  {
    icon: Globe,
    tone: "default" as const,
    title: "자체 웹사이트 (가장 효과적)",
    desc: "OAI-SearchBot(OpenAI 자체 크롤러)이 직접 크롤링하는 외부 URL. JSON-LD 구조화 마크업이 있으면 인용 가능성이 높아집니다. 티스토리·워드프레스도 포함됩니다. 구글·Bing 검색에도 함께 색인되면 발견 경로가 늘어납니다.",
  },
  {
    icon: MapPin,
    tone: "default" as const,
    title: "구글 비즈니스 프로필",
    desc: "구글 비즈니스 프로필에 등록하면 사업장 정보가 웹 전반에 퍼지며 OAI-SearchBot(OpenAI 자체 크롤러)과 구글 인덱스에서도 발견될 가능성이 높아집니다. business.google.com 무료 등록 후 웹 전체 인덱싱까지 1~4주 소요됩니다.",
  },
  {
    icon: Newspaper,
    tone: "default" as const,
    title: "뉴스·언론 기사·영어권 플랫폼",
    desc: "언론 보도, 트립어드바이저 등 영어권 글로벌 플랫폼은 OAI-SearchBot(OpenAI 자체 크롤러)과 구글 인덱싱이 활발하여 권위 신호로 인식되고 인용 가능성이 높아집니다.",
  },
  {
    icon: AlertTriangle,
    tone: "warning" as const,
    title: "네이버 블로그·스마트플레이스 — ChatGPT 효과 제한적",
    desc: "네이버 생태계(블로그·스마트플레이스)는 ChatGPT가 참조하는 검색엔진 인덱스에서 영향력이 제한적이어서 ChatGPT 응답에 미치는 효과가 작습니다. 네이버 최적화는 네이버 AI 브리핑·AI탭에 효과적입니다.",
  },
]

const CHECKLIST_ITEMS = [
  { id: "json_ld", label: "자체 웹사이트·홈페이지에 JSON-LD 구조화 마크업 적용" },
  { id: "qa", label: "자체 웹사이트·홈페이지에 Q&A 형식 콘텐츠 포함 (가격·운영시간·예약 방법 등)" },
  { id: "specific", label: "가격·운영시간·위치 구체 수치 명시" },
  { id: "authority", label: "권위 신호 포함 (경력·자격·수상)" },
  { id: "google_biz", label: "구글 비즈니스 프로필 등록 완료 (business.google.com)" },
  { id: "bing_webmaster", label: "Bing 웹마스터 도구 등록 (bing.com/webmasters) — 보조적 도움" },
  { id: "tripadvisor", label: "트립어드바이저 등 영어권 글로벌 플랫폼 등록" },
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

        {/* ── 1. 헤더 섹션 ── */}
        <section>
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight break-keep">
            ChatGPT에서 내 가게를 노출시키는 방법
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-4 leading-relaxed break-keep">
            ChatGPT 웹검색은 OpenAI 자체 크롤러(OAI-SearchBot) + 구글 인덱스 중심 구조 — 자체 웹사이트와 구글 비즈니스 프로필이 중요한 기반이 됩니다
          </p>
          {/* 면책 문구 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-800 leading-relaxed">
              ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
              측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
            </p>
          </div>
        </section>

        {/* ── 1-2. 두 트랙 구분 (먼저 이해해야 나머지 내용이 헷갈리지 않음) ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            ChatGPT 웹검색 노출과 AEOlab 점수는 서로 다르게 움직입니다
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">실사용자 ChatGPT 웹검색 (검색엔진 인덱싱 참고)</p>
              <ul className="space-y-1.5 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-blue-500 mt-0.5">•</span>
                  <span>자체 웹사이트 신규 등록 → 검색엔진 인덱싱: <strong>약 1~2주</strong> (Bing 기준 참고치)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-blue-500 mt-0.5">•</span>
                  <span>구글 비즈니스 프로필 등록 → 웹 전파 후 반영: <strong>약 2~4주</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-blue-500 mt-0.5">•</span>
                  <span>Bing 웹마스터 도구 등록은 보조적으로 도움이 될 수 있음 (OpenAI 자체 인덱스·구글 경로는 소요기간 미공개)</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800 mb-2">AEOlab 스캐너 점수 (ChatGPT 학습 데이터 기준)</p>
              <p className="text-sm text-gray-700 leading-relaxed">
                ChatGPT 모델 재학습 주기에 의존<br />
                <strong>수개월~1년</strong> 이상 소요
              </p>
              <p className="text-sm text-gray-500 mt-2">
                GPT-4.1-mini 학습 데이터 컷오프: 2024년 6월 기준
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            ※ AEOlab 점수는 학습 데이터 기반 측정이며, 실사용자 ChatGPT 웹검색 결과와 다를 수 있습니다.
            이 페이지의 체크리스트는 이 중 &lsquo;실사용자 웹검색&rsquo; 트랙을 돕는 항목이며, AEOlab 대시보드 점수와는 별개로 움직입니다.
          </p>
        </section>

        {/* ── 2. ChatGPT가 참조하는 정보 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 break-keep">
            ChatGPT가 실제로 참조하는 정보 — OpenAI 자체 크롤러 + 구글 인덱스 중심 구조
          </h2>

          {/* 흐름도: 내 사업장 정보가 ChatGPT 응답에 도달하는 경로 */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 md:p-6 mb-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-col items-center text-center gap-1.5 w-full md:w-auto">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Globe className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-gray-900">내 사업장 정보</p>
                <p className="text-sm text-gray-500">웹사이트 · 구글 비즈니스 프로필</p>
              </div>

              <ArrowDown className="w-5 h-5 text-gray-400 shrink-0 md:hidden" aria-hidden="true" />
              <ArrowRight className="w-5 h-5 text-gray-400 shrink-0 hidden md:block" aria-hidden="true" />

              <div className="flex flex-col items-center text-center gap-1.5 w-full md:w-auto">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Bot className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-gray-900">OpenAI 인덱싱</p>
                <p className="text-sm text-gray-500">OAI-SearchBot · 구글 인덱스</p>
              </div>

              <ArrowDown className="w-5 h-5 text-gray-400 shrink-0 md:hidden" aria-hidden="true" />
              <ArrowRight className="w-5 h-5 text-gray-400 shrink-0 hidden md:block" aria-hidden="true" />

              <div className="flex flex-col items-center text-center gap-1.5 w-full md:w-auto">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <MessageSquareText className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-gray-900">ChatGPT 응답</p>
                <p className="text-sm text-gray-500">질문에 대한 답으로 인용</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LEARN_SOURCES.map((item) => {
              const Icon = item.icon
              const isWarning = item.tone === "warning"
              return (
                <div
                  key={item.title}
                  className={`rounded-xl border p-4 md:p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow ${
                    isWarning
                      ? "border-amber-200 bg-amber-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isWarning ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <p className="text-sm md:text-base font-semibold text-gray-900 break-keep mt-1">
                      {item.title}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed break-keep">
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 3. 자체 웹사이트 FAQ 구조가 인용률을 높이는 이유 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            자체 웹사이트 FAQ 구조가 ChatGPT 인용률을 높이는 이유
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

        {/* ── 4. ChatGPT 노출 체크리스트 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            ChatGPT 노출 체크리스트
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            체크 상태는 이 브라우저에 저장됩니다 (새 기기·시크릿 모드에서는 초기화됩니다).
          </p>
          <ChatGptChecklist items={CHECKLIST_ITEMS} />
        </section>

        {/* ── 5. CTA ── */}
        <section className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-5 md:p-6 text-center">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2 break-keep">
            AEOlab에서 ChatGPT 소개글 자동 생성
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            ChatGPT가 내 사업장을 언급하도록 FAQ 중심 소개글·Q&A를 빠르게 자동 생성합니다. 구글 비즈니스 프로필·자체 웹사이트에 바로 활용하세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/trial"
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm md:text-base font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              무료 체험으로 시작하기 →
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm md:text-base text-blue-600 font-medium hover:underline"
            >
              대시보드 바로가기
            </Link>
          </div>
        </section>

      </article>

      <SiteFooter activePage="/guide/chatgpt-search" />
    </main>
  )
}
