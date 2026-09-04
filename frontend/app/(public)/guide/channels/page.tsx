import Link from "next/link"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/common/SiteFooter"
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient"
import { CHANNEL_GUIDE, GROUP_LABELS, GROUP_COLORS, type ChannelGroup } from "@/lib/channelGuideData"
import { ChannelGuideList } from "./ChannelGuideList"
import TrackedCTA from "@/components/analytics/TrackedCTA"

export const metadata: Metadata = {
  title: "업종별 AI 검색 노출 채널 가이드 | AEOlab",
  description:
    "59개 업종별 네이버 AI 브리핑·AI탭·글로벌 AI(ChatGPT·Gemini·Google) 노출 채널 비중과 핵심 행동 5요소를 확인하세요.",
  alternates: { canonical: "/guide/channels" },
}

const GROUP_ORDER: ChannelGroup[] = ["A", "B", "C", "D", "E"]

export default function ChannelGuideIndexPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ── 헤더 ── */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
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

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* ── 브레드크럼 ── */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-600 mb-6" aria-label="breadcrumb">
          <Link href="/" className="hover:text-blue-600">홈</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">업종별 채널 가이드</span>
        </nav>

        {/* ── 타이틀 ── */}
        <div className="mb-8">
          <span className="inline-block bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full mb-3">
            무료 가이드
          </span>
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight break-keep mb-3">
            업종별 AI 검색 노출 채널 가이드
          </h1>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl leading-relaxed break-keep mb-2">
            네이버 AI 브리핑·AI탭·글로벌 AI(ChatGPT·Gemini·Google)에서 우리 가게가 노출되려면 어떤 채널에 집중해야 할까요?
            업종마다 채널 비중이 다릅니다. 59개 업종별로 확인하세요.
          </p>
          <p className="text-sm text-gray-600">
            59개 업종 · 채널별 노출 비중 + 핵심 행동 5요소 체크리스트 · 로그인 불필요
          </p>
        </div>

        {/* ── 검색 + 그룹별 업종 목록 ── */}
        <ChannelGuideList
          groups={GROUP_ORDER.map((group) => ({
            group,
            label: GROUP_LABELS[group],
            colorClass: GROUP_COLORS[group],
            entries: CHANNEL_GUIDE.filter((e) => e.group === group),
          })).filter((g) => g.entries.length > 0)}
        />

        {/* ── CTA ── */}
        <section className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 break-keep">
            내 업종 점수를 무료로 진단해보세요
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-5 leading-relaxed break-keep">
            가게 이름과 업종만 입력하면 1분 안에 AI 검색 노출 점수와 개선 가이드를 확인할 수 있습니다.
          </p>
          <TrackedCTA
            href="/trial"
            location="guide_channel_index"
            label="trial_start"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            무료 진단 시작 →
          </TrackedCTA>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed break-keep">
            회원가입·신용카드 입력 없이 1분 무료 체험. Basic 첫 달 50% 할인(5,950원).
          </p>
        </section>
      </div>

      <SiteFooter activePage="/guide/channels" />
    </main>
  )
}
