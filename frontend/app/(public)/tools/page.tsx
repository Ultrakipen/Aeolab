import SiteHeader from "@/components/common/SiteHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";
import { pageOpenGraph } from "@/lib/seoMeta";
import { TOOL_THEMES, themeVars } from "./_components/toolTheme";

export const metadata: Metadata = {
  title: "사장님 계산기 — 손익분기점·배달 실수령·인건비·부가세 | AEOlab",
  description:
    "손익분기점·마진율, 배달앱 실수령액, 직원 인건비(주휴수당·4대보험), 부가세를 로그인 없이 무료로 계산해 보세요. 입력한 값은 저장하지 않고 기준값은 출처와 확인일을 함께 보여 드립니다.",
  alternates: { canonical: "/tools" },
  openGraph: pageOpenGraph({ title: "사장님 계산기 — 손익분기점·배달 실수령·인건비·부가세 | AEOlab", description:
    "손익분기점·마진율, 배달앱 실수령액, 직원 인건비(주휴수당·4대보험), 부가세를 로그인 없이 무료로 계산해 보세요. 입력한 값은 저장하지 않고 기준값은 출처와 확인일을 함께 보여 드립니다.", path: "/tools" }),
};

const TOOLS = [
  {
    href: "/tools/break-even",
    theme: "break-even",
    title: "손익분기점·마진율",
    desc: "판매가·원가·고정비로 1개당 이익과 한 달에 몇 개를 팔아야 손해가 없는지 계산해요.",
  },
  {
    href: "/tools/delivery-settlement",
    theme: "delivery-settlement",
    title: "배달앱 실수령액",
    desc: "정산서의 수수료율을 넣으면 배달비·광고비까지 뺀 실제 이익을 알려 드려요.",
  },
  {
    href: "/tools/labor-cost",
    theme: "labor-cost",
    title: "직원 인건비",
    desc: "주휴수당을 포함한 월급과 사업주가 내는 4대보험 개략액을 한 번에 계산해요.",
  },
  {
    href: "/tools/vat",
    theme: "vat",
    title: "부가세",
    desc: "공급가액과 부가세를 나누고, 일반·간이과세 사업자의 납부세액을 추정해요.",
  },
  {
    href: "/tools/menu-cost",
    theme: "menu-cost",
    title: "메뉴 원가·원가율",
    desc: "재료별 산 금액과 사용량으로 1인분 원가와 원가율, 목표 원가율을 맞추는 판매가를 계산해요.",
  },
  {
    href: "/tools/price-increase",
    theme: "price-increase",
    title: "원가 상승 가격 인상",
    desc: "재료비가 오르면 남는 돈이 얼마나 줄고, 가격을 얼마로 올려야 하는지 계산해요.",
  },
  {
    href: "/tools/ad-cost-calculator",
    theme: "ad-cost-calculator",
    title: "광고비 vs 구독료 비교",
    desc: "지금 쓰는 월 광고비와 AEOlab 구독료를 1년 금액으로 나란히 비교해요.",
  },
  {
    href: "/tools/keyword",
    theme: "keyword",
    title: "무료 키워드 생성기",
    desc: "가게 이름과 업종만 넣으면 검색에 맞는 키워드 5개를 추천해요.",
  },
];

export default function ToolsHubPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader maxWidth="max-w-5xl" />

      <div
        className="border-b border-gray-100 bg-white"
        style={{ backgroundImage: "linear-gradient(135deg, oklch(0.97 0.014 254.604), #ffffff 60%)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
          <h1 className="mb-3 break-keep text-2xl font-bold text-gray-900 md:text-3xl">사장님 계산기</h1>
          <p className="max-w-2xl break-keep text-sm leading-relaxed text-gray-600 md:text-base">
            가게를 하면서 자주 계산하게 되는 것들을 모았어요. 로그인 없이 무료이고, 입력한 값은 저장하지 않아요. 법으로 정해진 기준값은
            출처와 확인일을 함께 보여 드립니다.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {["로그인 없이 무료", "입력값 저장 안 함", "기준값 출처·확인일 표시"].map((t) => (
              <li
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-sm font-medium text-blue-800"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <ul className="grid gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => {
            const th = TOOL_THEMES[t.theme];
            const Icon = th.icon;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  style={themeVars(th)}
                  className="group flex h-full min-h-[44px] items-start gap-4 rounded-xl border border-gray-200 border-l-4 border-l-[var(--tool-accent)] bg-white p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:border-l-[var(--tool-accent)] hover:shadow-md"
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "var(--tool-soft)", color: "var(--tool-ink)" }}
                    aria-hidden="true"
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-gray-900">{t.title}</h2>
                    <p className="mt-1 break-keep text-sm leading-relaxed text-gray-600">{t.desc}</p>
                  </span>
                  <ArrowRight
                    className="mt-1 hidden h-5 w-5 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--tool-ink)] sm:block"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href="/area"
          style={themeVars(TOOL_THEMES.area)}
          className="mt-6 flex min-h-[44px] items-center gap-4 rounded-xl border border-gray-200 border-l-4 border-l-[var(--tool-accent)] bg-white p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:border-l-[var(--tool-accent)] hover:shadow-md"
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--tool-soft)", color: "var(--tool-ink)" }}
            aria-hidden="true"
          >
            <TOOL_THEMES.area.icon className="h-6 w-6" />
          </span>
          <span className="break-keep text-sm leading-relaxed text-gray-700">
            <strong className="block text-base text-gray-900">우리 동네 상권 보기</strong>
            지역과 업종을 고르면 업소 수와 누적 폐업 현황을 공공데이터로 보여 드려요.
          </span>
        </Link>
        <Link
          href="/support-programs"
          style={themeVars(TOOL_THEMES.support)}
          className="mt-4 flex min-h-[44px] items-center gap-4 rounded-xl border border-gray-200 border-l-4 border-l-[var(--tool-accent)] bg-white p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:border-l-[var(--tool-accent)] hover:shadow-md"
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--tool-soft)", color: "var(--tool-ink)" }}
            aria-hidden="true"
          >
            <TOOL_THEMES.support.icon className="h-6 w-6" />
          </span>
          <span className="break-keep text-sm leading-relaxed text-gray-700">
            <strong className="block text-base text-gray-900">소상공인 지원사업 공고</strong>
            기업마당에 올라온 지원사업·교육·행사를 마감 임박순으로 모아 보여 드려요. 신청은 원문에서 해요.
          </span>
        </Link>
      </section>

      <SiteFooter activePage="/tools" />
    </main>
  );
}
