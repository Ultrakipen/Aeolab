import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Bot, Sparkles, Globe, type LucideIcon } from "lucide-react"
import { SiteFooter } from "@/components/common/SiteFooter"
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient"
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd"
import TrackedCTA from "@/components/analytics/TrackedCTA"
import { ActionChecklist } from "./ActionChecklist"
import {
  CHANNEL_GUIDE_MAP,
  CHANNEL_GUIDE,
  GROUP_LABELS,
  GROUP_COLORS,
  BRIEFING_LABELS,
  type ChannelGuideEntry,
} from "@/lib/channelGuideData"

// ── SSG: 59개 업종 정적 생성 ────────────────────────────────────────────
export async function generateStaticParams() {
  return CHANNEL_GUIDE.map((entry) => ({ category: entry.value }))
}

// ── SEO metadata ─────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const entry = CHANNEL_GUIDE_MAP[category]
  if (!entry) return { title: "채널 가이드 | AEOlab" }

  const briefingText =
    entry.briefing === "active"
      ? "네이버 AI 브리핑 노출 가능 업종"
      : entry.briefing === "likely"
      ? "네이버 AI 브리핑 확대 예정 업종"
      : "AI탭 + 글로벌 AI 최적화 + 정보형 AI 브리핑 노출 가능 업종"

  return {
    title: `${entry.label} AI 검색 노출 채널 가이드 | AEOlab`,
    description: `${entry.label} 업종의 AI 노출 채널 분석. ${briefingText}. 핵심 행동 5요소와 최적화 방법을 확인하세요.`,
    alternates: { canonical: `/guide/channels/${entry.value}` },
  }
}

// ── 채널 카드 데이터 ─────────────────────────────────────────────────────
function getChannelCards(entry: ChannelGuideEntry): {
  id: string
  title: string
  subtitle: string
  status: string
  statusColor: string
  detail: string
  icon: LucideIcon
}[] {
  return [
    {
      id: "briefing",
      title: "네이버 AI 브리핑",
      subtitle: "네이버 플레이스 노출",
      status: BRIEFING_LABELS[entry.briefing].label,
      statusColor: BRIEFING_LABELS[entry.briefing].color,
      detail:
        entry.briefing === "active"
          ? "검색 결과 상단 AI 브리핑에 플레이스 카드로 노출될 수 있는 대상 업종입니다."
          : entry.briefing === "likely"
          ? "'플레이스형' AI 브리핑 확대 예정 업종입니다. 업종 확대 시 즉시 노출 대상이 됩니다. (네이버 AI탭은 이미 전체 업종 대상으로 정식 출시되었습니다 — 아래 AI탭 카드 참고)"
          : "'플레이스형' AI 브리핑 대상 업종은 아니지만, 블로그·콘텐츠가 갖춰지면 업종 제한 없는 '정보형 AI 브리핑'에는 노출될 수 있습니다. AI탭과 글로벌 AI에도 집중하세요.",
      icon: Bot,
    },
    {
      id: "aitab",
      title: "네이버 AI탭",
      subtitle: "2026-06-25 정식 출시",
      status: "2026-06-25 정식 출시",
      statusColor: "bg-violet-100 text-violet-800",
      detail:
        "2026-04-27 베타 출시 후 2026-06-25 전체 사용자 대상 정식 출시됐습니다. 업종 제한 발표가 없습니다. 콘텐츠 품질·예약 연동이 핵심 신호입니다.",
      icon: Sparkles,
    },
    {
      id: "global",
      title: "글로벌 AI",
      subtitle: "ChatGPT · Gemini · Google",
      status: `${entry.globalRatio}% 비중`,
      statusColor: "bg-orange-100 text-orange-800",
      detail:
        entry.globalRatio >= 70
          ? "이 업종은 글로벌 AI 노출 비중이 높습니다. ChatGPT·Gemini 최적화를 우선 진행하세요."
          : "글로벌 AI 노출도 꾸준히 관리하세요. 소개글 품질과 Schema.org 구조화 데이터가 핵심입니다.",
      icon: Globe,
    },
  ]
}

// ── 페이지 컴포넌트 ───────────────────────────────────────────────────────
export default async function ChannelGuidePage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const entry = CHANNEL_GUIDE_MAP[category]
  if (!entry) notFound()

  const channelCards = getChannelCards(entry)
  const groupColor = GROUP_COLORS[entry.group]
  const groupLabel = GROUP_LABELS[entry.group]

  return (
    <main className="min-h-screen bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "홈", url: "https://aeolab.co.kr/" },
          { name: "업종별 가이드", url: "https://aeolab.co.kr/guide/channels" },
          { name: `${entry.label} 채널 가이드`, url: `https://aeolab.co.kr/guide/channels/${entry.value}` },
        ]}
      />
      {/* ── 헤더 ── */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">
            AEOlab
          </Link>
          <nav className="flex items-center gap-3 md:gap-4 text-sm md:text-base">
            <Link href="/trial" className="text-gray-600 hover:text-blue-600">
              무료 진단
            </Link>
            <AuthNavControlClient />
            <Link
              href="/trial"
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
            >
              시작하기
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* ── 브레드크럼 ── */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6" aria-label="breadcrumb">
          <Link href="/" className="hover:text-blue-600">홈</Link>
          <span>/</span>
          <Link href="/guide/channels" className="hover:text-blue-600">업종별 가이드</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{entry.label} 채널 가이드</span>
        </nav>

        {/* ── 타이틀 ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold border ${groupColor}`}
            >
              그룹 {entry.group} — {groupLabel}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${BRIEFING_LABELS[entry.briefing].color}`}>
              {BRIEFING_LABELS[entry.briefing].label}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 break-keep">
            {entry.label} — AI 검색 노출 채널 가이드
          </h1>
          <p className="text-base md:text-lg text-gray-600 leading-relaxed break-keep">
            {entry.label} 업종의 AI 노출 채널별 현황과 핵심 최적화 행동 5가지를 안내합니다.
            {entry.note && (
              <span className="block mt-1 text-sm text-blue-700">{entry.note}</span>
            )}
          </p>
        </div>

        {/* ── 트랙 비중 바 ── */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">이 업종의 AI 노출 트랙 비중</p>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm text-gray-500 w-20 shrink-0">네이버 {entry.naverRatio}%</span>
            <div className="flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${entry.naverRatio}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 w-16 shrink-0 text-right">글로벌 {entry.globalRatio}%</span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed break-keep">
            AEOlab 듀얼트랙 모델 기준. 점수 = 네이버 채널 점수 × {entry.naverRatio}% + 글로벌 AI 점수 × {entry.globalRatio}%.
            측정 시점·기기·로그인 상태에 따라 달라질 수 있음.
          </p>
        </div>

        {/* ── AI 노출 채널 3종 카드 ── */}
        <section className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 break-keep">
            AI 노출 채널 분석
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {channelCards.map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm md:text-base font-bold text-gray-900 break-keep">{card.title}</p>
                      <p className="text-sm text-gray-500">{card.subtitle}</p>
                    </div>
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-semibold ${card.statusColor}`}>
                    {card.status}
                  </span>
                  <p className="text-sm text-gray-600 leading-relaxed break-keep">{card.detail}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 핵심 행동 5요소 ── */}
        <section className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 break-keep">
            {entry.label} 핵심 행동 5요소
          </h2>
          <p className="text-sm text-gray-500 mb-1 leading-relaxed break-keep">
            {entry.label} 업종에 공통으로 적용되는 가이드입니다. 내 가게 맞춤 진단 결과는{" "}
            <Link href="/trial" className="text-blue-600 hover:underline font-medium">
              무료 진단
            </Link>{" "}
            후 대시보드에서 확인할 수 있습니다.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            체크 상태는 이 브라우저에 저장됩니다 (새 기기·시크릿 모드에서는 초기화됩니다).
          </p>
          <ActionChecklist
            storageKey={`aeolab.channel_checklist.${entry.value}`}
            items={entry.keyActions.map((action, idx) => ({ id: String(idx), label: action }))}
            category={entry.value}
          />
          <p className="text-sm text-gray-500 mt-3 leading-relaxed break-keep">
            행동 5요소는 AEOlab 분석 기반 권장 사항이며, 노출 결과는 네이버·AI 플랫폼 정책에 따라 달라질 수 있습니다.
          </p>
        </section>

        {/* ── 업종 전환 링크 ── */}
        <section className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 break-keep">
            다른 업종 채널 가이드
          </h2>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_GUIDE.filter((e) => e.value !== entry.value).slice(0, 16).map((e) => (
              <Link
                key={e.value}
                href={`/guide/channels/${e.value}`}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                {e.label}
              </Link>
            ))}
            {CHANNEL_GUIDE.length > 17 && (
              <Link
                href="/guide/channels"
                className="px-3 py-1.5 rounded-lg border border-blue-200 text-sm text-blue-600 font-medium hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                전체 {CHANNEL_GUIDE.length}개 업종 보기 →
              </Link>
            )}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 break-keep">
            내 {entry.label} 점수를 무료로 진단해보세요
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-5 leading-relaxed break-keep">
            가게 이름과 업종만 입력하면 1분 안에 AI 검색 노출 점수와 개선 가이드를 확인할 수 있습니다.
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <TrackedCTA
              href="/trial"
              location="guide_channel_detail"
              label="trial_start"
              className="flex-1 text-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              무료 진단 시작 →
            </TrackedCTA>
            <Link
              href="/how-it-works"
              className="flex-1 text-center px-6 py-3 border border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
            >
              AI 브리핑 노출 원리 알아보기
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed break-keep">
            회원가입·신용카드 입력 없이 1분 무료 체험. Basic 첫 달 50% 할인(5,950원).
          </p>
        </section>
      </div>

      <SiteFooter activePage="/guide/channels" />
    </main>
  )
}
