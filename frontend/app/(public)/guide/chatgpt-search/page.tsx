import Link from "next/link"
import type { Metadata } from "next"
import { Globe, MapPin, Newspaper, AlertTriangle, Bot, MessageSquareText, ArrowRight, ArrowDown, Check, X as XIcon } from "lucide-react"
import { SiteFooter } from "@/components/common/SiteFooter"
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient"
import { MoreInfo } from "@/components/common/MoreInfo"
import { ChatGptChecklist } from "./ChatGptChecklist"

export const metadata: Metadata = {
  title: "ChatGPT에서 내 가게가 언급되는 조건 | AEOlab",
  description:
    "ChatGPT 웹검색은 ChatGPT의 검색 프로그램과 구글 검색이 중심이며 마이크로소프트 검색 비중은 제한적입니다. 자체 웹사이트·구글 비즈니스 프로필·영어권 사이트를 참조하는 구조와, 네이버 블로그·스마트플레이스가 직접 연결되지 않는 이유·실제 노출 조건을 정리합니다.",
}

const LEARN_SOURCES = [
  {
    icon: Globe,
    tone: "default" as const,
    title: "자체 웹사이트 (기본이 되는 곳)",
    desc: "ChatGPT의 검색 프로그램이 직접 읽어가는 외부 URL입니다. AI가 읽기 쉬운 정보 코드가 있으면 소개될 가능성이 높아집니다. 티스토리·워드프레스도 포함됩니다. 구글·마이크로소프트 검색에도 함께 잡히면 발견 경로가 늘어납니다.",
  },
  {
    icon: MapPin,
    tone: "default" as const,
    title: "구글 비즈니스 프로필",
    desc: "등록하면 사업장 정보가 웹 전반에 퍼지며 ChatGPT의 검색 로봇과 구글 인덱스에서도 발견될 가능성이 높아집니다. business.google.com 무료 등록 후 웹 전체에 반영까지 1~4주 소요됩니다.",
  },
  {
    icon: Newspaper,
    tone: "default" as const,
    title: "뉴스·언론 기사·영어권 사이트",
    desc: "언론 보도, 트립어드바이저 등 영어권 글로벌 사이트는 ChatGPT의 검색 프로그램과 구글 등록이 활발해서 믿을 만한 곳에 소개된 글로 인식되고 소개될 가능성이 높아집니다.",
  },
  {
    icon: AlertTriangle,
    tone: "warning" as const,
    title: "네이버 블로그·스마트플레이스 — ChatGPT 효과 제한적",
    desc: "네이버 안의 활동(블로그·스마트플레이스)은 ChatGPT가 참조하는 검색에서 영향력이 제한적이어서 ChatGPT 응답에 미치는 효과가 작습니다. 네이버 개선은 네이버 AI 브리핑·AI탭에 효과적입니다.",
  },
]

const CHECKLIST_ITEMS = [
  { id: "json_ld", label: "자체 웹사이트·홈페이지에 AI가 읽기 쉬운 정보 코드 적용" },
  { id: "qa", label: "자체 웹사이트·홈페이지에 질문-답 형식 콘텐츠 포함 (가격·운영시간·예약 방법 등)" },
  { id: "specific", label: "가격·운영시간·위치 구체 수치 명시" },
  { id: "authority", label: "믿을 만한 곳에 소개된 글 확보 (경력·자격·수상·언론 보도)" },
  { id: "google_biz", label: "구글 비즈니스 프로필 등록 완료 (business.google.com)" },
  { id: "bing_webmaster", label: "(선택) 마이크로소프트 검색 등록 (bing.com/webmasters) — 보조적 도움" },
  { id: "tripadvisor", label: "트립어드바이저 등 영어권 글로벌 사이트 등록" },
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

        {/* ── 0. 핵심 3줄 요약 카드 ── */}
        <section>
          <div className="rounded-3xl bg-[#0E1A3A] text-white p-6 md:p-8 mb-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-300 mb-3">핵심 먼저</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center mt-0.5">1</span>
                <p className="text-base md:text-lg font-semibold break-keep">자체 웹사이트·구글 비즈니스 프로필이 기본입니다.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center mt-0.5">2</span>
                <p className="text-base md:text-lg font-semibold break-keep">네이버 블로그는 ChatGPT에 영향이 적습니다.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center mt-0.5">3</span>
                <p className="text-base md:text-lg font-semibold break-keep">AEOlab 점수는 AI가 미리 공부한 자료 기반이라 실시간 ChatGPT 검색과 다르게 움직입니다.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 1. 헤더 섹션 ── */}
        <section>
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight break-keep">
            ChatGPT에서 내 가게를 노출시키는 방법
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-4 leading-relaxed break-keep">
            ChatGPT 웹검색은 ChatGPT의 검색 프로그램 + 구글 검색 중심 구조 — 자체 웹사이트와 구글 비즈니스 프로필이 중요한 기반이 됩니다
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
              <p className="text-sm font-semibold text-blue-800 mb-2">실사용자 ChatGPT 웹검색 (검색 등록 기준 참고)</p>
              <ul className="space-y-1.5 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-blue-600 mt-0.5">•</span>
                  <span>자체 웹사이트 신규 등록 → 검색 등록: <strong>약 1~2주</strong> (마이크로소프트 검색 기준 참고치)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-blue-600 mt-0.5">•</span>
                  <span>구글 비즈니스 프로필 → ChatGPT 반영 기간은 공식 확인되지 않았습니다 (수개월~1년 이상 걸릴 수 있음)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-blue-600 mt-0.5">•</span>
                  <span>마이크로소프트 검색 도구 등록은 보조적으로 도움이 될 수 있음 (ChatGPT 자체 경로·구글 경로는 소요기간 미공개)</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800 mb-2">AEOlab 측정 결과 (ChatGPT AI 공부 자료 기준)</p>
              <p className="text-sm text-gray-700 leading-relaxed">
                ChatGPT 모델 재학습 주기에 의존<br />
                <strong>수개월~1년</strong> 이상 소요
              </p>
              <p className="text-sm text-gray-600 mt-2">
                AI가 공부한 자료는 2024년 6월까지
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            ※ AEOlab 점수는 AI가 미리 공부한 자료 기반 측정이며, 실사용자 ChatGPT 웹검색 결과와 다를 수 있습니다.
            이 페이지의 체크리스트는 이 중 &lsquo;실사용자 웹검색&rsquo; 방식을 돕는 항목이며, AEOlab 대시보드 점수와는 별개로 움직입니다.
          </p>
        </section>

        {/* ── 2. ChatGPT가 참조하는 정보 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 break-keep">
            ChatGPT가 실제로 참조하는 정보 — ChatGPT의 검색 프로그램 + 구글 검색 중심 구조
          </h2>

          {/* 흐름도: 내 사업장 정보가 ChatGPT 응답에 도달하는 경로 */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 md:p-6 mb-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-col items-center text-center gap-1.5 w-full md:w-auto">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Globe className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-gray-900">내 사업장 정보</p>
                <p className="text-sm text-gray-600">웹사이트 · 구글 비즈니스 프로필</p>
              </div>

              <ArrowDown className="w-5 h-5 text-gray-600 shrink-0 md:hidden" aria-hidden="true" />
              <ArrowRight className="w-5 h-5 text-gray-600 shrink-0 hidden md:block" aria-hidden="true" />

              <div className="flex flex-col items-center text-center gap-1.5 w-full md:w-auto">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Bot className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-gray-900">ChatGPT 검색 등록</p>
                <p className="text-sm text-gray-600">ChatGPT 검색 프로그램 · 구글 검색</p>
              </div>

              <ArrowDown className="w-5 h-5 text-gray-600 shrink-0 md:hidden" aria-hidden="true" />
              <ArrowRight className="w-5 h-5 text-gray-600 shrink-0 hidden md:block" aria-hidden="true" />

              <div className="flex flex-col items-center text-center gap-1.5 w-full md:w-auto">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <MessageSquareText className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-gray-900">ChatGPT 응답</p>
                <p className="text-sm text-gray-600">질문에 맞는 답으로 소개</p>
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
                  {isWarning && (
                    <MoreInfo summary="네이버 AI 수집 제한 관련" tone="soft">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        네이버 블로그·지도·카페는 ChatGPT 같은 AI가 글을 읽어 가는 것을 제한하고 있습니다(2026-10-07 확인).
                        이로 인해 ChatGPT 등 글로벌 AI가 네이버 콘텐츠를 직접 읽어가기 어렵습니다.
                      </p>
                    </MoreInfo>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 3. 자체 웹사이트 FAQ 구조가 인용률을 높이는 이유 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            질문-답 형식이 ChatGPT에서 잘 읽히는 이유
          </h2>
          <div className="space-y-3 mb-5">
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center mt-0.5">
                1
              </span>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                Q&amp;A 형식 텍스트는 AI가 <strong>질문-답변 쌍</strong>으로 인식해
                특정 질문의 답으로 소개하기 쉽습니다.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center mt-0.5">
                2
              </span>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                AI가 소개하기 좋은 <strong>명확한 문장 구조</strong>는 출처를 특정할 수 있어
                소개될 가능성이 높아집니다.
              </p>
            </div>
          </div>

          {/* Before / After 비교 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 mb-2">
                <XIcon className="w-4 h-4" aria-hidden="true" /> Before (소개 어려움)
              </p>
              <p className="text-sm md:text-base text-gray-800 leading-relaxed italic">
                &ldquo;맛있는 음식을 제공합니다.&rdquo;
              </p>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                구체적 정보 없음 — ChatGPT가 참고할 정보가 부족합니다.
              </p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700 mb-2">
                <Check className="w-4 h-4" aria-hidden="true" /> After (소개 가능)
              </p>
              <p className="text-sm md:text-base text-gray-800 leading-relaxed italic">
                &ldquo;Q. 대표 메뉴는? A. 시그니처 파스타(15,000원)와 트러플 리조또(18,000원)입니다.&rdquo;
              </p>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Q&amp;A 구조 + 구체 수치 → 질문에 바로 답하는 형태로 소개될 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        {/* ── 4. ChatGPT 노출 체크리스트 ── */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            ChatGPT 노출 체크리스트
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            체크 상태는 이 브라우저에 저장됩니다 (새 기기·시크릿 모드에서는 초기화됩니다).
          </p>
          <ChatGptChecklist items={CHECKLIST_ITEMS} />
        </section>

        {/* ── 5. CTA ── */}
        <section className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-5 md:p-6 text-center">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2 break-keep">
            AEOlab에서 소개글·Q&amp;A 초안 자동 생성
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            AI가 읽기 쉬운 소개글·Q&amp;A 초안을 만들어 드립니다. 구글 비즈니스 프로필·자체 웹사이트에 바로 활용하세요. 언급은 보장되지 않습니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/trial"
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm md:text-base font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              무료 체험으로 시작하기 <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
