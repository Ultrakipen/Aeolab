import Link from "next/link"
import type { Metadata } from "next"
import type { LucideIcon } from "lucide-react"
import {
  Check, X, CheckCircle2, FileText,
  Bot, Globe, Search, MessageSquare, BarChart3,
  Target, AlertCircle, Users, Clock, TrendingUp,
  Layers, CreditCard, Star, MapPin, Radio, Zap, Settings,
} from "lucide-react"
import { SiteFooter } from "@/components/common/SiteFooter"
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient"
import { PLAN_PRICES } from "@/lib/plans"
import { MoreInfo } from "@/components/common/MoreInfo"
import { IconTile } from "@/components/common/IconTile"

export const metadata: Metadata = {
  title: "AI 브리핑·AI탭·Gemini·ChatGPT·Google AI 노출 완전 설명 | AEOlab",
  description:
    "네이버 AI 브리핑·AI탭·Gemini·ChatGPT·Google AI Overview — 5곳에서 내 가게가 나오는 원리를 업종별로 설명합니다. 노출 조건·반영 속도·점수 기준·5단계 행동·한계까지.",
  alternates: { canonical: "/how-it-works" },
}

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">AEOlab</Link>
          <div className="flex items-center gap-3 md:gap-4">
            <Link href="/faq" className="hidden md:block text-sm text-gray-600 hover:text-gray-900">FAQ</Link>
            <Link href="/pricing" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900">요금제</Link>
            <AuthNavControlClient />
            <Link href="/trial" className="bg-blue-600 text-white text-sm md:text-base px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              무료 진단
            </Link>
          </div>
        </div>
      </header>

      <article className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* ─── Hero ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-10 md:mb-14 items-start">
          {/* Left: title + summary */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#0E1A3A] mb-3 leading-tight break-keep">
              AI 검색에서<br />내 가게가 나오는 방법
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-3 leading-relaxed break-keep">
              네이버·Gemini·ChatGPT·Google AI — 5곳에서 가게가 노출되는 조건을 점수로 보여주고,
              사장님이 바로 실행할 수 있는 콘텐츠 초안을 자동으로 만들어 드립니다.
            </p>
            <p className="text-sm text-gray-500 mb-5">
              마지막 업데이트: 2026-10-07 ·{" "}
              <a
                href="https://help.naver.com/service/30026/contents/24632"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                네이버 스마트플레이스 공식 안내
              </a>
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/trial" className="text-center px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base">
                무료 진단 시작 →
              </Link>
              <Link href="/pricing" className="text-center px-5 py-2.5 border border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors text-sm md:text-base">
                요금제 보기
              </Link>
            </div>
          </div>

          {/* Right: 5 AI tiles bento */}
          <div className="grid grid-cols-1 gap-3">
            <p className="text-sm font-semibold text-gray-600 mb-1">측정하는 AI 5곳 (손님이 AI로 가게를 찾는 경로)</p>
            {/* Naver AI Briefing — navy */}
            <div className="rounded-2xl bg-[#0E1A3A] p-4 flex items-center gap-3">
              <span className="inline-flex shrink-0 items-center justify-center w-10 h-10 rounded-xl bg-white/20" aria-hidden="true">
                <MapPin className="w-5 h-5 text-white" strokeWidth={2} />
              </span>
              <div>
                <p className="text-white font-bold text-sm md:text-base">네이버 AI 브리핑</p>
                <p className="text-white/85 text-sm break-keep">플레이스형(가게 카드) + 정보형(콘텐츠 기반)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Naver AI Tab */}
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 flex items-center gap-3">
                <IconTile icon={Radio} tone="blue" size="md" />
                <div>
                  <p className="text-gray-900 font-bold text-sm">네이버 AI탭</p>
                  <p className="text-gray-600 text-sm break-keep">업종 제한 발표 없음 · 정식 출시</p>
                </div>
              </div>
              {/* Gemini */}
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex items-center gap-3">
                <IconTile icon={Globe} tone="green" size="md" />
                <div>
                  <p className="text-gray-900 font-bold text-sm">Gemini</p>
                  <p className="text-gray-600 text-sm break-keep">구글 검색을 참고해 답변</p>
                </div>
              </div>
              {/* ChatGPT */}
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex items-center gap-3">
                <IconTile icon={Bot} tone="amber" size="md" />
                <div>
                  <p className="text-gray-900 font-bold text-sm">ChatGPT</p>
                  <p className="text-gray-600 text-sm break-keep">학습 데이터 중심, 반영이 느린 편</p>
                </div>
              </div>
              {/* Google AI */}
              <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 flex items-center gap-3">
                <IconTile icon={Search} tone="violet" size="md" />
                <div>
                  <p className="text-gray-900 font-bold text-sm">Google AI</p>
                  <p className="text-gray-600 text-sm break-keep">구글 검색 노출 확인</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 3가지 핵심 bento cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {/* Card 1 — navy accent */}
          <div className="rounded-3xl bg-[#0E1A3A] p-5 md:p-6 flex flex-col gap-3">
            <IconTile icon={Layers} tone="navy" size="lg" className="bg-white/20" />
            <h2 className="text-white font-bold text-lg md:text-xl leading-snug break-keep">업종마다 점수 기준이 다릅니다</h2>
            <p className="text-white/75 text-sm leading-relaxed break-keep">음식점은 네이버 비중 80%, 법률·교육은 글로벌 AI 비중 60~90% — 같은 점수라도 업종이 다르면 개선 방향이 다릅니다.</p>
            <MoreInfo summary="업종별 비중 차이 보기" tone="dark" className="mt-1">
              <ul className="space-y-1 text-sm text-white/80 leading-relaxed">
                <li>• 음식점·카페·숙박 → 네이버 AI 브리핑·키워드 비중 75~80%</li>
                <li>• 뷰티·펫·피트니스 → 네이버 65~70% (확대 예정)</li>
                <li>• 법률·교육·온라인몰 → ChatGPT·Google·Gemini 비중 60~90%</li>
                <li className="pt-1 text-white/60 text-sm">성장 단계(단계·개선 중 등)는 네이버 채널 점수만으로 결정됩니다 (업종 비율 보정).</li>
              </ul>
            </MoreInfo>
          </div>
          {/* Card 2 */}
          <div className="rounded-3xl bg-white border border-gray-200 p-5 md:p-6 flex flex-col gap-3">
            <IconTile icon={Zap} tone="blue" size="lg" />
            <h2 className="text-gray-900 font-bold text-lg md:text-xl leading-snug break-keep">지금 당장 점수를 올리는 방법</h2>
            <p className="text-gray-600 text-sm leading-relaxed break-keep">스마트플레이스 <strong>소개글 작성</strong> + <strong>소식 탭 최근 게시물</strong> — 광고비 없이 콘텐츠만으로 가능한 가장 빠른 개선입니다.</p>
            <MoreInfo summary="소개글·소식이 왜 중요한지 보기" tone="light" className="mt-1">
              <p className="text-sm text-gray-700 leading-relaxed break-keep">네이버 AI 브리핑은 소개글·소식·리뷰·연계 블로그 텍스트를 주요 정보 소스로 씁니다. 소개글에 Q&A 구조 + 즉답형 첫 문단이 있으면 AI 브리핑 인용 후보가 됩니다. 소식은 최신성 점수를 높여 줍니다.</p>
            </MoreInfo>
          </div>
          {/* Card 3 */}
          <div className="rounded-3xl bg-white border border-gray-200 p-5 md:p-6 flex flex-col gap-3">
            <IconTile icon={TrendingUp} tone="green" size="lg" />
            <h2 className="text-gray-900 font-bold text-lg md:text-xl leading-snug break-keep">채널마다 반영 기간이 다릅니다</h2>
            <p className="text-gray-600 text-sm leading-relaxed break-keep">네이버 AI 브리핑 2~4주, Gemini 수주~수개월, ChatGPT 수개월~1년 이상 — 순서대로 공략해야 합니다.</p>
            <MoreInfo summary="채널별 반영 기간 보기" tone="light" className="mt-1">
              <ul className="space-y-1 text-sm text-gray-700 leading-relaxed">
                <li>1위 네이버 AI 브리핑·AI탭 — <strong>2~4주</strong> (소개글·소식·리뷰)</li>
                <li>2위 Gemini — <strong>수주~수개월</strong> (구글 비즈니스 프로필 등록 후 2~4주 내 반영 시작, 안정 인용 수개월, 보장 아님)</li>
                <li>3위 Google AI Overview — <strong>수주~수개월</strong></li>
                <li>4위 ChatGPT — <strong>수개월~1년 이상</strong> (학습 데이터, 보장 아님)</li>
              </ul>
            </MoreInfo>
          </div>
        </div>

        {/* ─── TOC: PC chips, mobile MoreInfo ─── */}
        <div className="mb-10">
          {/* mobile */}
          <div className="md:hidden">
            <MoreInfo summary="목차 — 펼쳐서 바로 이동" tone="light">
              <ol className="space-y-1.5 text-sm text-blue-600">
                <li><a href="#search-intent" className="hover:underline">어떤 검색에서 AI 가게 추천이 될까?</a></li>
                <li><a href="#step1" className="hover:underline">1단계. 노출 가능한지 먼저 확인</a></li>
                <li><a href="#step2" className="hover:underline">2단계. 콘텐츠 점수 100점</a></li>
                <li><a href="#step3" className="hover:underline">3단계. AI 브리핑 노출 강화</a></li>
                <li><a href="#channel-speed" className="hover:underline font-semibold text-blue-700">채널별 노출 속도 비교</a></li>
                <li><a href="#step4" className="hover:underline">4단계. AI 정보 탭 토글</a></li>
                <li><a href="#ai-tab" className="hover:underline">네이버 AI탭</a></li>
                <li><a href="#phase-a" className="hover:underline">통합 측정 기능</a></li>
                <li><a href="#step5" className="hover:underline">5단계. 결과 측정</a></li>
                <li><a href="#dia" className="hover:underline">네이버 품질 기준 5요소</a></li>
                <li><a href="#plans" className="hover:underline">요금제별 기능</a></li>
                <li><a href="#roles" className="hover:underline">역할 분담</a></li>
                <li><a href="#limits" className="hover:underline">한계와 면책</a></li>
                <li><a href="#start" className="hover:underline">시작하는 법</a></li>
                <li><a href="#ad-impact" className="hover:underline">AI 브리핑 광고 도입 영향</a></li>
              </ol>
            </MoreInfo>
          </div>
          {/* PC chips */}
          <nav className="hidden md:flex flex-wrap gap-2" aria-label="목차">
            {[
              ["#search-intent", "검색 의도 분류"],
              ["#step1", "1. 노출 조건 확인"],
              ["#step2", "2. 콘텐츠 점수"],
              ["#step3", "3. AI 브리핑 강화"],
              ["#channel-speed", "채널별 속도"],
              ["#step4", "4. AI 탭 토글"],
              ["#ai-tab", "네이버 AI탭"],
              ["#phase-a", "통합 측정"],
              ["#step5", "5. 결과 측정"],
              ["#dia", "품질 기준 5요소"],
              ["#plans", "요금제 기능"],
              ["#roles", "역할 분담"],
              ["#limits", "한계·면책"],
              ["#start", "시작하는 법"],
              ["#ad-impact", "광고 도입 영향"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm hover:bg-blue-100 hover:text-blue-700 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* ─── 네이버 공식 발표 데이터 ─── */}
        <div className="mb-10">
          <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">네이버 공식 발표 (2025-2026)</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3 md:p-4 text-center">
              <div className="text-xl md:text-3xl font-bold text-blue-700 mb-1">3,000만+</div>
              <div className="text-sm md:text-sm text-blue-800 font-medium leading-tight">AI 브리핑 사용자</div>
              <div className="text-sm text-gray-400 mt-1 hidden md:block">네이버 컨콜 2025.08</div>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 md:p-4 text-center">
              <div className="text-xl md:text-3xl font-bold text-emerald-700 mb-1">+27.4%</div>
              <div className="text-sm md:text-sm text-emerald-800 font-medium leading-tight">음식점 클릭률</div>
              <div className="text-sm text-gray-400 mt-1 hidden md:block">한국경제 2025.08.21</div>
            </div>
            <div className="rounded-2xl bg-purple-50 border border-purple-100 p-3 md:p-4 text-center">
              <div className="text-xl md:text-3xl font-bold text-purple-700 mb-1">1.5만+</div>
              <div className="text-sm md:text-sm text-purple-800 font-medium leading-tight">숙박 업체 적용</div>
              <div className="text-sm text-gray-400 mt-1 hidden md:block">브릿지경제 2026.04.01</div>
            </div>
          </div>
          <MoreInfo summary="출처 및 상세 수치 보기" tone="light">
            <ul className="space-y-2 text-sm text-gray-700 leading-relaxed">
              <li className="flex gap-2">
                <span className="shrink-0 text-blue-600 font-bold">•</span>
                <span>AI 브리핑 사용자 <strong>3,000만명+</strong>, 통합검색 질의 약 <strong>20%</strong> 적용{" "}
                  <a href="https://news.nate.com/view/20250808n07723" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">[출처: 네이버 컨콜 2025.08]</a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 text-blue-600 font-bold">•</span>
                <span>음식점 적용 후 — 체류시간 <strong>+10.4%</strong> / 클릭률 <strong>+27.4%</strong> / 예약 <strong>+8%</strong>{" "}
                  <a href="https://www.hankyung.com/article/202508212669g" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">[출처: 한국경제 2025.08.21]</a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 text-blue-600 font-bold">•</span>
                <span>숙박 <strong>1만 5천 개</strong> 업체 적용 (2026년 기준){" "}
                  <a href="https://www.viva100.com/article/20260401500944" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">[출처: 브릿지경제 2026.04.01]</a>
                </span>
              </li>
            </ul>
            <p className="text-sm text-gray-500 mt-3 leading-relaxed">데이터는 네이버 공식 발표 기준이며 실제 결과는 업종·지역에 따라 다를 수 있습니다.</p>
          </MoreInfo>
        </div>

        {/* ─── §3.7 검색 의도 분류 ─── */}
        <section id="search-intent" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Search} tone="blue" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">어떤 검색에서 AI가 가게를 추천할까?</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            모든 검색에서 AI 추천이 나오는 것은 아닙니다. <strong>정보형 검색</strong>(추천 요청)에서만 나옵니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">정보형</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
                  <Check className="w-3 h-3" />노출 가능
                </span>
              </div>
              <p className="text-sm md:text-sm text-gray-600 break-keep">"강남 데이트 맛집", "부산 오션뷰 호텔"</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">탐색형</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold">제한적</span>
              </div>
              <p className="text-sm md:text-sm text-gray-600 break-keep">"스타벅스 강남점", "롯데호텔 서울"</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">거래형</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-sm font-semibold">
                  <X className="w-3 h-3" />노출 안 됨
                </span>
              </div>
              <p className="text-sm md:text-sm text-gray-600 break-keep">"스타벅스 예약", "호텔 바로 예약"</p>
            </div>
          </div>

          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-sm md:text-base text-gray-700 leading-relaxed break-keep">
            AEOlab은 <strong>정보형 검색 쿼리에서의 AI 검색 노출을 집중 분석합니다.</strong>
            "우리 동네 맛집", "근처 카페 추천"처럼 AI가 다양한 옵션을 제안하는 검색에서 가게가 먼저 언급되도록 최적화합니다.
          </div>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed break-keep">
            ※ 여기서 &lsquo;정보형&rsquo;은 검색 목적 분류입니다. 아래 1단계에 나오는 &lsquo;정보형 AI 브리핑&rsquo;(가게 카드형인 &lsquo;플레이스형&rsquo;과 대비되는 AI 브리핑 유형)과는 다른 개념입니다.
          </p>
        </section>

        {/* ─── 1단계: 게이트 ─── */}
        <section id="step1" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Target} tone="indigo" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">1단계. 노출 가능한지 먼저 확인할 3가지</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            네이버 &lsquo;플레이스형&rsquo;(가게 정보를 요약해 보여주는 방식) AI 브리핑은 모든 가게에 노출되지 않습니다.
            아래 3가지 중 하나라도 안 되면 콘텐츠가 아무리 좋아도 노출되지 않습니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm mb-3">1</div>
              <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1">노출 가능 업종?</h3>
              <p className="text-sm md:text-sm text-gray-600 leading-relaxed break-keep">음식점·카페·베이커리·바·숙박 → ACTIVE. 뷰티·네일·피트니스 등 12개 → 확대 예정(LIKELY).</p>
              <MoreInfo summary="비대상 업종도 가치 있는 이유" tone="soft" className="mt-2">
                <div className="space-y-2 text-sm text-gray-700 leading-relaxed break-keep">
                  <p><strong>수일~1주:</strong> 소개글 키워드·리뷰·소식 최적화 → 네이버 플레이스 탭 순위 개선</p>
                  <p><strong>2~4주:</strong> 블로그 초안 생성 + 키워드 차이 분석 → 네이버 통합검색 블로그 영역 상위 노출</p>
                  <p><strong>수주~수개월:</strong> 구글 비즈니스 프로필 등록 → Gemini·Google AI Overview 반영 시작(안정 인용까지 수개월, 보장 아님)</p>
                  <p><strong>장기:</strong> 플랫폼 등록·외부 언급 누적 → ChatGPT 학습 데이터 반영(수개월~1년 이상)</p>
                  <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">※ 네이버 검색 기반이 강할수록, AI 브리핑 대상 업종 확대 시 즉시 수혜 받습니다.</p>
                </div>
              </MoreInfo>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm mb-3">2</div>
              <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1">프랜차이즈 가맹점 아님?</h3>
              <p className="text-sm md:text-sm text-gray-600 leading-relaxed break-keep">네이버 정책: 프랜차이즈는 현재 플레이스형 AI 브리핑에서 제외됩니다.</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">프랜차이즈라도 정보형 AI 브리핑·글로벌 AI 채널 노출 개선은 가능합니다.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm mb-3">3</div>
              <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1">리뷰 수 기준 충족?</h3>
              <p className="text-sm md:text-sm text-gray-600 leading-relaxed break-keep">영수증 리뷰 10건 이상 권장. AEOlab이 자동 추적 → 10건 미만 시 가이드에서 경고 + QR 카드 다운로드 제공.</p>
            </div>
          </div>

          <MoreInfo summary="전체 게이트 점검표 자세히 보기 (AEOlab vs 사장님 역할)" tone="soft">
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full text-sm border-collapse min-w-[540px]">
                <thead>
                  <tr className="bg-white/80">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">확인 항목</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">AEOlab이 하는 일</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">사장님이 하는 일</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr className="border-b border-gray-100">
                    <td className="py-2 px-3 align-top font-medium">① 노출 가능 업종?</td>
                    <td className="py-2 px-3 align-top">업종 선택 시 자동 판정. 비대상이면 정보형·글로벌 AI 채널 안내</td>
                    <td className="py-2 px-3 align-top">업종 선택</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 px-3 align-top font-medium">② 프랜차이즈 아님?</td>
                    <td className="py-2 px-3 align-top">체크 시 플레이스형 비대상으로 전환 + 정보형·글로벌 AI 경로로 전환</td>
                    <td className="py-2 px-3 align-top">사업장 등록 시 체크박스로 답변</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 align-top font-medium">③ 리뷰 수 기준?</td>
                    <td className="py-2 px-3 align-top">리뷰 수 자동 추적. 10건 미만 시 경고 + QR 카드 다운로드 제공</td>
                    <td className="py-2 px-3 align-top">QR 카드를 매장에 비치해 리뷰 유도</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </MoreInfo>
        </section>

        {/* ─── 2단계: 점수 100점 ─── */}
        <section id="step2" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={BarChart3} tone="blue" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">2단계. 콘텐츠 점수 100점 — 네이버 채널 6항목</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            업종 그룹(AI 브리핑 대상 / 확대 예정 / 글로벌 AI 중심)에 따라 6항목 가중치가 달리 적용됩니다.
            비대상 업종은 AI 브리핑 비중이 0%로 빠져 점수상 불이익이 없습니다.
          </p>

          <MoreInfo summary="업종별 항목 가중치 자세히 보기 (6가지 항목)" tone="soft">
            <p className="text-sm text-gray-500 mb-2 md:hidden">← 좌우로 밀어 비교하세요</p>
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full text-sm border border-gray-200 rounded-lg min-w-[480px]">
                <thead className="bg-gray-50">
                  <tr className="text-left text-sm uppercase text-gray-600">
                    <th className="px-3 py-2 font-medium">항목</th>
                    <th className="px-3 py-2 font-medium text-center">AI 브리핑 대상</th>
                    <th className="px-3 py-2 font-medium text-center">AI 브리핑 확대 예정</th>
                    <th className="px-3 py-2 font-medium text-center">글로벌 AI 중심</th>
                    <th className="px-3 py-2 font-medium hidden md:table-cell">측정 방법</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-medium">네이버 키워드 검색 노출</td><td className="px-3 py-2 text-center">25%</td><td className="px-3 py-2 text-center">30%</td><td className="px-3 py-2 text-center font-bold text-blue-700">35%</td><td className="px-3 py-2 hidden md:table-cell text-sm text-gray-600">등록한 키워드로 네이버 PC·모바일·플레이스 탭 순위 자동 측정</td></tr>
                  <tr className="border-t border-gray-100 bg-gray-50/40"><td className="px-3 py-2 font-medium">리뷰 품질</td><td className="px-3 py-2 text-center">15%</td><td className="px-3 py-2 text-center">17%</td><td className="px-3 py-2 text-center">20%</td><td className="px-3 py-2 hidden md:table-cell text-sm text-gray-600">리뷰수·평점·영수증 리뷰·최신성</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-medium">스마트플레이스 완성도</td><td className="px-3 py-2 text-center">15%</td><td className="px-3 py-2 text-center">18%</td><td className="px-3 py-2 text-center">20%</td><td className="px-3 py-2 hidden md:table-cell text-sm text-gray-600">소개글·소식·메뉴·사진·영업시간 + 키워드 콘텐츠 매칭</td></tr>
                  <tr className="border-t border-gray-100 bg-gray-50/40"><td className="px-3 py-2 font-medium">블로그 생태계 (추정)</td><td className="px-3 py-2 text-center">10%</td><td className="px-3 py-2 text-center">10%</td><td className="px-3 py-2 text-center">10%</td><td className="px-3 py-2 hidden md:table-cell text-sm text-gray-600">30일 내 발행 + 외부 인용 + 업체명 매칭</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-medium">지도/플레이스 + 카카오맵</td><td className="px-3 py-2 text-center">10%</td><td className="px-3 py-2 text-center">10%</td><td className="px-3 py-2 text-center">15%</td><td className="px-3 py-2 hidden md:table-cell text-sm text-gray-600">네이버 지도 50% + 카카오맵 50%</td></tr>
                  <tr className="border-t border-gray-100 bg-gray-50/40"><td className="px-3 py-2 font-medium">AI 브리핑 인용</td><td className="px-3 py-2 text-center font-bold text-emerald-700">25%</td><td className="px-3 py-2 text-center">15%</td><td className="px-3 py-2 text-center text-gray-400">0%</td><td className="px-3 py-2 hidden md:table-cell text-sm text-gray-600">네이버 AI 브리핑 노출 여부 자동 확인 + AI 정보 탭 ON 여부</td></tr>
                  <tr className="border-t-2 border-gray-300 font-semibold bg-blue-50"><td className="px-3 py-2">합계</td><td className="px-3 py-2 text-center">100%</td><td className="px-3 py-2 text-center">100%</td><td className="px-3 py-2 text-center">100%</td><td className="px-3 py-2 hidden md:table-cell"></td></tr>
                </tbody>
              </table>
            </div>
          </MoreInfo>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-3">
            <p className="text-sm text-amber-900 leading-relaxed">
              ※ 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다. AEOlab은 서울 기준 비로그인 PC/모바일로 측정합니다.
            </p>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            점수 산출 상세는{" "}
            <Link href="/score-guide" className="text-blue-600 hover:underline font-medium">점수 계산 가이드</Link>를 참고하세요.
          </p>
        </section>

        {/* ─── 3단계: 콘텐츠 인용 강화 ─── */}
        <section id="step3" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={MessageSquare} tone="green" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">3단계. AI 브리핑 노출 강화 — 콘텐츠 품질</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            네이버 AI 브리핑은 <strong>소개글·소식·리뷰·연계 블로그</strong>를 주요 정보 소스로 씁니다.
            AI가 4가지 텍스트 초안을 자동으로 만들어 드립니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <ContentCard
              icon={FileText}
              tone="blue"
              num={1}
              title="소개글"
              summary="Q&A 구조 + 즉답형 첫 문단으로 AI 인용 후보가 됩니다."
              detail="AI가 Q&A 5개를 자연스럽게 삽입하고 키워드·내 가게만의 강점·서비스를 명시합니다. 네이버 블로그 분석에 따르면 'FAQ 구조 + 즉답형 첫 문단'이 AI 브리핑 인용 후보로 적합합니다. 스마트플레이스 사장님 Q&A 탭이 폐기된 현재(2026-05), 소개글 안의 Q&A 섹션이 사장님이 직접 컨트롤할 수 있는 인용 경로 중 하나입니다."
            />
            <ContentCard
              icon={TrendingUp}
              tone="green"
              num={2}
              title="소식"
              summary="매주 자동 초안 생성 — 1분 복사·등록으로 최신성 유지."
              detail="매주 월요일 오전 9시에 자동 초안을 생성합니다. 사장님은 1분 만에 복사·등록만 하면 최신성 점수가 유지됩니다."
            />
            <ContentCard
              icon={Star}
              tone="amber"
              num={3}
              title="리뷰"
              summary="QR 카드 + 답변 자동 생성으로 리뷰 수·반응성 동시 강화."
              detail="QR 카드(매장 비치용) 자동 생성 + 리뷰 답변 자동 작성으로 리뷰 수·다양성·반응성을 모두 강화합니다."
            />
            <ContentCard
              icon={Globe}
              tone="indigo"
              num={4}
              title="연계 블로그"
              summary="키워드 매칭·콘텐츠 품질을 분석해 구체 가이드를 드립니다."
              detail="블로그 URL 입력 시 키워드 매칭·콘텐츠 품질 평가를 진행해 '이 키워드를 보강하라'는 가이드를 제공합니다."
            />
          </div>
        </section>

        {/* ─── AI 채널별 노출 속도 비교 ─── */}
        <section id="channel-speed" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Clock} tone="violet" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">AI 채널별 노출 속도 — 빠른 순서로</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-5 leading-relaxed break-keep">
            소개글·소식·리뷰는 네이버 AI 채널에 효과적입니다. ChatGPT·Gemini는 구글·Bing 생태계 기반이라 별도 경로가 필요합니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1위 */}
            <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center shrink-0">1</span>
                <p className="text-sm md:text-base font-bold text-green-900">네이버 AI 브리핑·AI탭 — <span className="text-green-700">2~4주</span></p>
              </div>
              <p className="text-sm text-gray-700 ml-9 leading-relaxed break-keep">소개글·소식·리뷰 최적화 → 2~4주 내 반영. ACTIVE 업종(음식점·카페·숙박 등)에 해당 시 가장 빠른 채널.</p>
              <MoreInfo summary="상세 액션 보기" tone="light" className="mt-2">
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• 스마트플레이스 소개글·소식·리뷰 최적화</li>
                  <li>• AI 정보 탭 토글 ON 설정 후 1일 이내 적용</li>
                  <li>• AI 브리핑은 ACTIVE 업종(음식점·카페·베이커리·바·숙박, 프랜차이즈 제외). AI탭은 업종 제한 없음.</li>
                </ul>
              </MoreInfo>
            </div>
            {/* 2위 */}
            <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-blue-700 text-white text-sm font-bold flex items-center justify-center shrink-0">2</span>
                <p className="text-sm md:text-base font-bold text-blue-900">Gemini — <span className="text-blue-700">수주~수개월</span></p>
              </div>
              <p className="text-sm text-gray-700 ml-9 leading-relaxed break-keep">구글 비즈니스 프로필 등록 후 2~4주 내 반영 시작. 안정 인용까지 수개월 (보장 아님). 실사용 Gemini 앱은 Google Search 실시간 색인 기반.</p>
              <MoreInfo summary="상세 액션 보기" tone="light" className="mt-2">
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• 구글 비즈니스 프로필 등록·완성 (우선순위 1위)</li>
                  <li>• 구글 지도 리뷰 10개+ 확보</li>
                  <li>• 자체 웹사이트 구글 색인 + 색인 등록 요청</li>
                </ul>
              </MoreInfo>
            </div>
            {/* 3위 */}
            <div className="rounded-2xl border-2 border-purple-300 bg-purple-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-purple-700 text-white text-sm font-bold flex items-center justify-center shrink-0">3</span>
                <p className="text-sm md:text-base font-bold text-purple-900">Google AI Overview — <span className="text-purple-700">수주~수개월</span></p>
              </div>
              <p className="text-sm text-gray-700 ml-9 leading-relaxed break-keep">실시간 구글 색인 기반 → 색인 완료 후 2~4주 내 반영. 안정 인용까지 3~6개월.</p>
              <MoreInfo summary="상세 액션 보기" tone="light" className="mt-2">
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• 구글 비즈니스 프로필 완성</li>
                  <li>• 가게 정보를 구조화한 코드(JSON-LD) 적용</li>
                  <li>• 모든 곳에서 가게 이름·주소·전화번호 일치</li>
                </ul>
              </MoreInfo>
            </div>
            {/* 4위 */}
            <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-orange-700 text-white text-sm font-bold flex items-center justify-center shrink-0">4</span>
                <p className="text-sm md:text-base font-bold text-orange-900">ChatGPT — <span className="text-orange-700">수개월~1년 (장기)</span></p>
              </div>
              <p className="text-sm text-gray-700 ml-9 leading-relaxed break-keep">학습 데이터 기반 — 실시간 웹 반영까지 수개월~1년. 네이버 블로그는 ChatGPT 점수에 직접 효과 없음.</p>
              <MoreInfo summary="상세 액션 보기" tone="light" className="mt-2">
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• 자체 웹사이트에 JSON-LD 구조화 데이터 추가</li>
                  <li>• 구글 비즈니스 프로필 (Bing도 참조)</li>
                  <li>• 트립어드바이저·망고플레이트 등 Bing에 잡히는 플랫폼 등록</li>
                </ul>
              </MoreInfo>
            </div>
          </div>

          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 leading-relaxed break-keep">
            <strong>ChatGPT 측정 안내:</strong> AEOlab이 측정하는 ChatGPT 스캐너 점수는 AI 학습 데이터 기반입니다. 실제 ChatGPT.com·Gemini 앱은 Bing·Google 실시간 검색을 사용하므로 스캐너 점수와 실사용 경험이 다를 수 있습니다. <span className="block mt-1">ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.</span>
          </div>
        </section>

        {/* ─── 4단계: 토글 추적 ─── */}
        <section id="step4" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Settings} tone="slate" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">4단계. AI 정보 탭 토글 추적</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            네이버 공식: 사장님이 <strong>스마트플레이스 → 업체정보 → AI 정보</strong> 탭에서 토글을 직접 ON으로 설정해야 노출됩니다.
            AEOlab은 상태를 추적·안내할 뿐, <strong>대신 ON 할 수 없습니다.</strong>
          </p>

          <MoreInfo summary="AI 정보 탭 상태 5가지 보기" tone="soft">
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full text-sm border-collapse min-w-[480px]">
                <thead>
                  <tr className="bg-white/80">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">상태</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">의미</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b">AEOlab의 안내</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr className="border-b border-gray-100"><td className="py-2 px-3">메뉴 없음</td><td className="py-2 px-3">메뉴 자체 없음</td><td className="py-2 px-3">비대상 업종 안내</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3">꺼짐</td><td className="py-2 px-3">사장님이 직접 끈 상태</td><td className="py-2 px-3">5단계 가이드 단계 2로 유도</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3">켜짐</td><td className="py-2 px-3">사장님이 직접 켠 상태</td><td className="py-2 px-3">정상 — 콘텐츠 점수에 집중</td></tr>
                  <tr className="border-b border-gray-100"><td className="py-2 px-3">조건 미달</td><td className="py-2 px-3">조건 미달로 비활성</td><td className="py-2 px-3">리뷰 수 등 조건 안내</td></tr>
                  <tr><td className="py-2 px-3">확인 안 됨</td><td className="py-2 px-3">미확인</td><td className="py-2 px-3">사장님 자기 보고 요청</td></tr>
                </tbody>
              </table>
            </div>
          </MoreInfo>
        </section>

        {/* ─── 네이버 AI탭 전용 섹션 ─── */}
        <section id="ai-tab" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Radio} tone="blue" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">네이버 AI탭 — 업종 제한 발표 없음, 정식 출시</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 md:p-5">
              <p className="text-sm font-bold text-green-800 mb-1">2026-06-25 전체 사용자 정식 출시</p>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">
                네이버 AI탭은 AI 브리핑과 별개 경로입니다. 업종 제한 발표가 없어 장소 기반 모든 업종이 플레이스 에이전트를 통해 노출될 수 있습니다.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 md:p-5">
              <p className="text-sm font-bold text-blue-800 mb-2">노출 가능성을 높이는 방법</p>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• 스마트플레이스 소개글 충실히 작성</li>
                <li>• 소식 탭 최근 게시물 유지</li>
                <li>• 업종·지역 키워드 조합 관리</li>
                <li>• 리뷰 답변 꾸준히 작성</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 leading-relaxed break-keep">
            <strong>AI 브리핑 vs AI탭 차이:</strong> 브리핑은 ACTIVE 업종(음식점·카페·숙박 등, 프랜차이즈 제외) 한정. AI탭은 2026-06-25 정식 출시 · 업종 제한 없음. ※ AI탭 노출 여부는 네이버 비공개 알고리즘으로 결정됩니다. 노출을 100% 보장하지 않습니다.
          </div>
        </section>

        {/* ─── Phase A: 통합 측정 ─── */}
        <section id="phase-a" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Layers} tone="indigo" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">Phase A. AI 검색 노출을 위한 통합 측정</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            단순 점수 산출을 넘어 <strong>키워드 검색 순위·FAQ 자동 생성·블로그 지수</strong>를 통합 측정합니다.
            각 기능은 플랜별로 측정 주기와 한도가 다릅니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
              <div className="flex items-start gap-3 mb-2">
                <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">1</span>
                <h3 className="font-bold text-gray-900 text-sm md:text-base break-keep">네이버 키워드 검색 순위 추적</h3>
              </div>
              <p className="text-sm text-gray-700 ml-10 mb-2 leading-relaxed break-keep">등록한 키워드로 네이버 PC·모바일·플레이스 탭 순위를 자동 측정합니다.</p>
              <MoreInfo summary="플랜별 측정 주기 보기" tone="light">
                <div className="overflow-x-auto" tabIndex={0}>
                  <table className="w-full text-sm border-collapse min-w-[280px]">
                    <tbody className="text-gray-700">
                      <tr className="border-b border-gray-100"><td className="py-1.5 px-2">Free</td><td className="py-1.5 px-2 text-center">—</td><td className="py-1.5 px-2 text-gray-500">정기 측정 없음</td></tr>
                      <tr className="border-b border-gray-100"><td className="py-1.5 px-2">Basic</td><td className="py-1.5 px-2 text-center">주 1회</td><td className="py-1.5 px-2 text-gray-500">매주 월요일 04:00</td></tr>
                      <tr className="border-b border-gray-100"><td className="py-1.5 px-2">창업패키지·Pro·Biz</td><td className="py-1.5 px-2 text-center">매일</td><td className="py-1.5 px-2 text-gray-500">매일 04:30 자동</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-gray-500 mt-1.5">※ AI 자동 스캔(Gemini·ChatGPT·네이버) 주기와 별도입니다.</p>
              </MoreInfo>
            </div>
            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
              <div className="flex items-start gap-3 mb-2">
                <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0">2</span>
                <h3 className="font-bold text-gray-900 text-sm md:text-base break-keep">키워드 자동 추천</h3>
              </div>
              <p className="text-sm text-gray-700 ml-10 mb-2 leading-relaxed break-keep">AI가 업종·지역·리뷰 키워드를 분석해 최적의 검색 키워드를 추천합니다.</p>
              <div className="flex flex-wrap gap-1.5 text-sm ml-10">
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Free: 0건</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Basic: 월 5회</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Pro: 월 20회</span>
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">Biz: 무제한</span>
              </div>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4">
              <div className="flex items-start gap-3 mb-2">
                <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm shrink-0">3</span>
                <h3 className="font-bold text-gray-900 text-sm md:text-base break-keep">톡톡 채팅방 메뉴 자동 생성</h3>
              </div>
              <p className="text-sm text-gray-700 ml-10 mb-2 leading-relaxed break-keep">채팅방 하단 메뉴 6개를 자동 생성합니다. 예약·메뉴·블로그로 즉시 연결.</p>
              <p className="text-sm text-gray-500 ml-10">* 소개글 AI 생성과 합산 한도 (Basic 10건, Pro 30건, Biz 60건)</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-start gap-3 mb-2">
                <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">4</span>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm md:text-base break-keep">블로그 콘텐츠 품질 추정</h3>
                  <span className="px-1.5 py-0.5 text-sm bg-gray-200 text-gray-600 rounded-full">(추정)</span>
                </div>
              </div>
              <p className="text-sm text-gray-700 ml-10 leading-relaxed break-keep">30일 발행 빈도·외부 인용·업체명 매칭 3가지를 실측해 추정합니다. 실제 네이버 내부 점수와 오차 가능.</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 leading-relaxed break-keep">
            <strong>면책:</strong> 키워드 순위·AI 인용 횟수 등 모든 변동 데이터는 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
            AEOlab은 서울 기준 비로그인 PC/모바일로 측정합니다. 네이버 검색 순위·AI 브리핑 노출은 네이버 알고리즘 기준이며 보장되지 않습니다.
          </div>
        </section>

        {/* ─── 5단계: 결과 측정 ─── */}
        <section id="step5" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={CheckCircle2} tone="green" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">5단계. 결과 측정 — 실제 노출 확인</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            플랜에 따라 자동으로 다음을 확인해 <strong>실제로 노출되었는지 객관적으로 측정</strong>합니다 (정기 측정은 유료 플랜).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ["네이버 AI 브리핑 노출 자동 확인", "가게명 검색 시 AI 브리핑 영역에 노출되는지 직접 확인"],
              ["AI 인용 기록", "어떤 키워드로 어떻게 인용됐는지 누적 (ChatGPT·Gemini·Google·네이버)"],
              ["30일 점수 추세", "개선 행동이 점수에 반영되는지 검증"],
              ["경쟁사 비교", "같은 업종·지역의 상위 10% 가게와의 차이 분석"],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-gray-200 bg-white p-4 flex gap-3">
                <span className="text-blue-500 shrink-0 mt-0.5">●</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-sm text-gray-600 mt-0.5 leading-relaxed break-keep">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── D.I.A. 5요소 + 2026 변화 ─── */}
        <section id="dia" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Star} tone="amber" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">네이버 품질 기준 5요소 + 2026 변화</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-2 leading-relaxed break-keep">
            네이버 AI 브리핑은 콘텐츠의 5가지 측면을 평가합니다. 이 5요소가 충족될수록 AI 브리핑 인용 확률이 높아집니다.
          </p>
          <p className="text-sm text-gray-500 mb-4 bg-gray-50 border border-gray-200 rounded px-3 py-2">
            ※ 이 5요소는 네이버 비공개 알고리즘을 외부 분석 기반으로 추정한 것입니다. 실제 평가 방식과 다를 수 있습니다.
          </p>

          <MoreInfo summary="네이버 품질 기준 5요소 자세히 보기 (외부 분석 기반 추정)" tone="soft">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-lg p-4"><p className="font-semibold text-gray-900 mb-1 text-sm">1. 주제 적합도</p><p className="text-sm text-gray-700 break-keep leading-relaxed">검색 키워드와 콘텐츠 주제가 얼마나 정확히 일치하는가. AEOlab은 업종별 관련 키워드를 자동 추천해 적합도를 강화합니다.</p></div>
              <div className="border border-gray-200 rounded-lg p-4"><p className="font-semibold text-gray-900 mb-1 text-sm">2. 경험 정보</p><p className="text-sm text-gray-700 break-keep leading-relaxed">실제 방문·이용 경험에서 비롯된 정보인가. 영수증 리뷰·사장님 답변 등 실증 데이터를 우선 평가합니다.</p></div>
              <div className="border border-gray-200 rounded-lg p-4"><p className="font-semibold text-gray-900 mb-1 text-sm">3. 정보 충실성</p><p className="text-sm text-gray-700 break-keep leading-relaxed">가격·시간·조건 등 구체 수치가 명시되어 있는가. AEOlab의 FAQ 자동 생성은 첫 문장을 30~60자 즉답형으로 작성하도록 가이드합니다.</p></div>
              <div className="border border-gray-200 rounded-lg p-4"><p className="font-semibold text-gray-900 mb-1 text-sm">4. 독창성</p><p className="text-sm text-gray-700 break-keep leading-relaxed">다른 사업장과 차별화된 표현·관점이 있는가. AEOlab 초안의 [직접 입력] 플레이스홀더에 본인의 특징을 추가하세요.</p></div>
              <div className="border border-gray-200 rounded-lg p-4 md:col-span-2"><p className="font-semibold text-gray-900 mb-1 text-sm">5. 적시성</p><p className="text-sm text-gray-700 break-keep leading-relaxed">정보가 최신인가, 정기적으로 업데이트되는가. AEOlab은 블로그 초안에 <strong>&ldquo;2026년 10월 업데이트&rdquo; 예시</strong> 표기를 자동 삽입하고, 소식 2주 이상 미업데이트 시 알림을 보냅니다.</p></div>
            </div>
          </MoreInfo>

          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 mt-6 break-keep">2026년 변화 — 미리 대비하세요</h3>
          <ul className="space-y-2 text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
            <li><strong>2026-04-06 별점 도입</strong> — 5점 척도 별점이 리뷰 옆에 표시됩니다. 일반 공개 여부는 <strong>사업주가 스마트플레이스에서 직접 선택</strong>합니다.</li>
            <li><strong>네이버 통합검색 별도 &lsquo;AI 탭&rsquo; — 2026-06-25 정식 출시</strong> — 연속적 대화형 검색이 별도 탭으로 분리됩니다. 전체 네이버 사용자 대상 정식 출시 완료 (네이버 공식).</li>
            <li><strong>인용 콘텐츠 배지</strong> — AI 브리핑에 인용된 블로그·콘텐츠에 배지가 표시됩니다. <span className="text-gray-600 text-sm">(다수 사용자 관측 기반 — 네이버 미공식)</span></li>
          </ul>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm md:text-base text-gray-700 leading-relaxed break-keep">
            <strong>지금 해야 할 일:</strong> ① 사장님 블로그에 가게 소개 글을 1편 발행(AEOlab 초안 활용) ② 매월 1회 업데이트로 적시성 신호 유지 ③ 소개글 Q&A 섹션 첫 문장을 30~60자 즉답형으로 작성.
          </div>
        </section>

        {/* ─── 요금제별 기능 ─── */}
        <section id="plans" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={CreditCard} tone="indigo" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">요금제별 사용 가능 기능</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-3 leading-relaxed break-keep">
            요금제마다 자동화 도구의 사용 한도가 다릅니다. 자세한 가격은{" "}
            <Link href="/pricing" className="text-blue-600 hover:underline font-medium">요금제 페이지</Link>에서 확인하세요.
          </p>

          <div className="overflow-x-auto" tabIndex={0}>
            <p className="text-sm text-gray-500 mb-1 md:hidden">← 좌우로 밀어 비교하세요</p>
            <table className="w-full text-sm md:text-base border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-blue-50">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">기능</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">Free</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">Basic<br /><span className="text-sm font-normal">{PLAN_PRICES.basic.toLocaleString()}원</span></th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">창업패키지<br /><span className="text-sm font-normal">{PLAN_PRICES.startup.toLocaleString()}원</span></th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">Pro<br /><span className="text-sm font-normal">{PLAN_PRICES.pro.toLocaleString()}원</span></th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">Biz<br /><span className="text-sm font-normal">{PLAN_PRICES.biz.toLocaleString()}원</span></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">무료 진단(1회)</td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" aria-label="제공" /></td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" aria-label="제공" /></td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" aria-label="제공" /></td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" aria-label="제공" /></td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" aria-label="제공" /></td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">AI 자동 스캔 (Gemini·ChatGPT·네이버)</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5 text-sm">주 2회</td><td className="text-center py-2.5 text-sm">주 1회</td><td className="text-center py-2.5 text-sm">주 3회</td><td className="text-center py-2.5 text-sm">매일</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">AI 콘텐츠 생성<br /><span className="text-sm text-gray-500">소개글+채팅방메뉴 합산</span></td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5 text-sm">월 10건</td><td className="text-center py-2.5 text-sm">월 20건</td><td className="text-center py-2.5 text-sm">월 30건</td><td className="text-center py-2.5 text-sm">월 60건</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">소식 자동 초안 (매주)</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">리뷰 답변 생성</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5 text-sm">월 50회</td><td className="text-center py-2.5 text-sm">무제한</td><td className="text-center py-2.5 text-sm">무제한</td><td className="text-center py-2.5 text-sm">무제한</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">경쟁사 분석</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5 text-sm">3개</td><td className="text-center py-2.5 text-sm">5개</td><td className="text-center py-2.5 text-sm">5개</td><td className="text-center py-2.5 text-sm">무제한</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">창업 시장 분석</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td></tr>
                <tr><td className="py-2.5 px-3">멀티 사업장</td><td className="text-center py-2.5 text-sm">1개</td><td className="text-center py-2.5 text-sm">1개</td><td className="text-center py-2.5 text-sm">1개</td><td className="text-center py-2.5 text-sm">2개</td><td className="text-center py-2.5 text-sm">5개</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            * 창업패키지는 예비 창업자 전용으로 창업 시장 분석을 제공합니다. 단, 자동 스캔은 주 1회로 Basic(주 2회)보다 적습니다.
          </p>
        </section>

        {/* ─── 역할 분담 ─── */}
        <section id="roles" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Users} tone="slate" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">AEOlab vs 사장님 — 역할 분담</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            AEOlab은 사장님의 시간을 줄이는 도구이지, 사장님의 권한을 대신하는 시스템이 아닙니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-5">
              <h3 className="text-base md:text-lg font-bold text-blue-900 mb-3">AEOlab이 하는 일</h3>
              <ul className="space-y-2 text-sm md:text-base text-gray-700 leading-relaxed">
                <li className="flex items-start gap-2"><IconTile icon={CheckCircle2} tone="green" size="sm" className="mt-0.5 shrink-0" /> 노출 조건 6항목 점수화·시각화</li>
                <li className="flex items-start gap-2"><IconTile icon={CheckCircle2} tone="green" size="sm" className="mt-0.5 shrink-0" /> AI 콘텐츠 초안 자동 생성 (소개글·채팅방 메뉴·소식)</li>
                <li className="flex items-start gap-2"><IconTile icon={CheckCircle2} tone="green" size="sm" className="mt-0.5 shrink-0" /> 플랜에 따라 Gemini·ChatGPT·네이버·Google AI 4채널 점검 + 결과 추적</li>
                <li className="flex items-start gap-2"><IconTile icon={CheckCircle2} tone="green" size="sm" className="mt-0.5 shrink-0" /> 경쟁사 비교 + 상위 가게와의 차이 분석</li>
                <li className="flex items-start gap-2"><IconTile icon={CheckCircle2} tone="green" size="sm" className="mt-0.5 shrink-0" /> 카카오 알림 + 이메일 다이제스트</li>
                <li className="flex items-start gap-2"><IconTile icon={CheckCircle2} tone="green" size="sm" className="mt-0.5 shrink-0" /> QR 카드·리뷰 답변 도구 제공</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-5">
              <h3 className="text-base md:text-lg font-bold text-amber-900 mb-3">사장님이 하는 일</h3>
              <ul className="space-y-2 text-sm md:text-base text-gray-700 leading-relaxed">
                <li className="flex items-start gap-2"><IconTile icon={FileText} tone="blue" size="sm" className="mt-0.5 shrink-0" /> AI 정보 탭 토글 ON 직접 설정</li>
                <li className="flex items-start gap-2"><IconTile icon={FileText} tone="blue" size="sm" className="mt-0.5 shrink-0" /> 자동 생성된 소개글 복사·붙여넣기</li>
                <li className="flex items-start gap-2"><IconTile icon={FileText} tone="blue" size="sm" className="mt-0.5 shrink-0" /> 자동 초안 소식을 1분 만에 등록</li>
                <li className="flex items-start gap-2"><IconTile icon={FileText} tone="blue" size="sm" className="mt-0.5 shrink-0" /> QR 카드 출력해 매장에 비치</li>
                <li className="flex items-start gap-2"><IconTile icon={FileText} tone="blue" size="sm" className="mt-0.5 shrink-0" /> 자동 생성된 리뷰 답변 검토·등록</li>
                <li className="flex items-start gap-2"><IconTile icon={FileText} tone="blue" size="sm" className="mt-0.5 shrink-0" /> 프랜차이즈 여부 정직히 답변</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ─── 한계와 면책 ─── */}
        <section id="limits" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={AlertCircle} tone="amber" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">한계와 면책 — 정직한 약속</h2>
          </div>
          <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
            네이버 알고리즘은 비공개이며 외부 도구가 노출 자체를 보장할 수 없습니다.
          </p>

          <div className="overflow-x-auto mb-4" tabIndex={0}>
            <table className="w-full text-sm md:text-base border-collapse min-w-[480px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-2.5 px-3 font-semibold text-green-700 border-b">가능</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-red-700 border-b">불가능</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3 align-top">노출 조건 점수화 + 자동 콘텐츠 생성</td><td className="py-2.5 px-3 align-top text-gray-700"><strong>노출 자체를 보장</strong> (네이버 알고리즘 비공개)</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3 align-top">&lsquo;플레이스형&rsquo; AI 브리핑 비대상 업종에 대해 네이버 일반 검색·정보형 AI 브리핑 노출 개선</td><td className="py-2.5 px-3 align-top text-gray-700">비대상 업종을 &lsquo;플레이스형&rsquo; AI 브리핑 대상으로 만들기</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3 align-top">사장님 5단계 행동 가이드</td><td className="py-2.5 px-3 align-top text-gray-700">AI 정보 탭 토글을 대신 켜기</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3 align-top">리뷰 유도 도구(QR·답변 생성)</td><td className="py-2.5 px-3 align-top text-gray-700">리뷰 수 조작</td></tr>
                <tr><td className="py-2.5 px-3 align-top">콘텐츠 품질 개선</td><td className="py-2.5 px-3 align-top text-gray-700">네이버 정책 위반 우회</td></tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-gray-700 leading-relaxed break-keep">
              <strong>&lsquo;플레이스형&rsquo; AI 브리핑 비대상 업종(병원·법무·교육·쇼핑몰 등) 안내:</strong>{" "}
              &lsquo;플레이스형&rsquo; 네이버 AI 브리핑은 지원되지 않지만, 블로그·콘텐츠로 &lsquo;정보형 AI 브리핑&rsquo; 노출 가능합니다. 네이버 플레이스 탭 검색 상위 노출은 업종과 무관하게 개선됩니다.
              ChatGPT·Gemini·Google은 네이버 밖 정보를 따로 갖춰야 하고, 반영 기간도 채널마다 다릅니다. 구독 전{" "}
              <Link href="/trial" className="text-blue-600 hover:underline font-medium">무료 진단</Link>으로 자신의 업종과 개선 가능 영역을 확인하세요.
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-700 leading-relaxed break-keep">
              <strong>2026-04-06 별점 도입 안내:</strong> 5점 척도 별점이 도입됐습니다. 일반 이용자 공개 여부는 사업주가 스마트플레이스에서 직접 선택합니다. 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
            </div>
          </div>
        </section>

        {/* ─── 시작하는 법 ─── */}
        <section id="start" className="mb-10 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={Zap} tone="blue" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">시작하는 법</h2>
          </div>
          <ol className="space-y-3 text-sm md:text-base text-gray-700 leading-relaxed mb-5">
            <li><strong>1.</strong>{" "}<Link href="/trial" className="text-blue-600 hover:underline font-medium">무료 진단</Link>{" "}— 비로그인으로 가게 이름·업종만 입력하면 1분 만에 현재 점수 확인</li>
            <li><strong>2.</strong>{" "}<Link href="/pricing" className="text-blue-600 hover:underline font-medium">요금제 보기</Link>{" "}— Basic 첫 달 50% 할인({PLAN_PRICES.basic && Math.round(PLAN_PRICES.basic / 2).toLocaleString()}원)으로 시작</li>
            <li><strong>3.</strong>{" "}가입 후 대시보드 → <strong>내 업종에 맞는 AI 노출 가이드</strong>를 따라 15분간 설정</li>
            <li><strong>4.</strong>{" "}플랜에 따라 자동 점검 결과 + 카카오 알림으로 변화 추적</li>
          </ol>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed break-keep">
            내 업종이 어떤 채널에 집중해야 하는지 먼저 확인하려면{" "}
            <Link href="/guide/channels" className="text-blue-600 hover:underline font-medium">업종별 채널 가이드</Link>에서 59개 업종별 네이버·글로벌 AI 비중을 확인해보세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/trial" className="flex-1 text-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              무료 진단 시작 →
            </Link>
            <Link href="/pricing" className="flex-1 text-center px-6 py-3 border border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors">
              요금제 보기
            </Link>
          </div>
        </section>

        {/* ─── 2026 하반기~ AI 브리핑 광고 도입 영향 ─── */}
        <section id="ad-impact" className="mb-10 scroll-mt-20">
          <div className="flex items-center gap-3 mb-3">
            <IconTile icon={AlertCircle} tone="rose" size="md" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">2026 하반기~: AI 브리핑 광고 도입 (모니터링 중)</h2>
          </div>
          <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-4 break-keep">
            네이버는 2026년 하반기 중 AI 브리핑 결과 내에 광고성 플레이스 카드 노출을 예고했으며, 공식 출시 일정은 모니터링 중입니다.
            광고 노출과 <strong>AI가 콘텐츠를 보고 자동 선택하는 노출</strong>은 구분되며, AEOlab 점수 산정에서 별도로 처리됩니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">AI 자동 선택 노출 (광고 아님)</p>
              <p className="text-sm text-blue-700 leading-relaxed break-keep">AI 브리핑이 콘텐츠 품질·리뷰·정보 완성도를 기준으로 자동 선정. AEOlab <strong>네이버 채널 점수에 반영</strong>됩니다.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">광고 전용 노출 (돈 내야만 나옴)</p>
              <p className="text-sm text-amber-700 leading-relaxed break-keep">네이버 광고비를 지불한 경우에만 노출. AEOlab은 광고 배지를 자동 감지하여 <strong>&lsquo;플레이스형&rsquo; AI 브리핑 점수 0점</strong>으로 산정합니다.</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 leading-relaxed break-keep">
            <strong>AEOlab 감지 방식:</strong> 스캔할 때 AI 브리핑 화면에서 광고 표시(AD 배지 등)를 자동으로 확인합니다. 광고 배지가 있으면 해당 노출을 점수에서 제외합니다. 광고 도입 이후에도 AI가 콘텐츠를 보고 자연스럽게 선택하는 노출이 장기적으로 더 효과적이며, AEOlab은 이 방식의 최적화에 집중합니다.
            <span className="block mt-1">광고 도입 일정·형태는 네이버 공식 발표 전까지 변경될 수 있습니다. 측정 시점·기기·로그인 상태에 따라 달라질 수 있음.</span>
          </div>
        </section>

        {/* ─── 더 알아보기 ─── */}
        <section className="border-t border-gray-100 pt-6 mt-8">
          <p className="text-sm font-semibold text-gray-700 mb-3">더 알아보기</p>
          <ul className="space-y-1.5 text-sm md:text-base text-blue-600">
            <li><Link href="/score-guide" className="hover:underline">점수 계산 가이드 — 100점이 어떻게 산출되는지</Link></li>
            <li><Link href="/faq" className="hover:underline">자주 묻는 질문</Link></li>
            <li><Link href="/demo" className="hover:underline">실제 화면 미리보기</Link></li>
            <li><a href="https://help.naver.com/service/30026/contents/24632" target="_blank" rel="noopener noreferrer" className="hover:underline">네이버 스마트플레이스 공식 안내 (출처)</a></li>
          </ul>
        </section>
      </article>

      <SiteFooter activePage="/how-it-works" />
    </main>
  )
}

interface ContentCardProps {
  icon: LucideIcon
  tone: "blue" | "indigo" | "green" | "amber" | "rose" | "violet" | "slate" | "navy"
  num: number
  title: string
  summary: string
  detail: string
}

function ContentCard({ icon: Icon, tone, num, title, summary, detail }: ContentCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <IconTile icon={Icon} tone={tone} size="sm" />
        <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center shrink-0">{num}</span>
        <h3 className="text-base md:text-lg font-bold text-gray-900 break-keep">{title}</h3>
      </div>
      <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">{summary}</p>
      <MoreInfo summary="상세 보기" tone="light">
        <p className="text-sm text-gray-700 leading-relaxed break-keep">{detail}</p>
      </MoreInfo>
    </div>
  )
}
