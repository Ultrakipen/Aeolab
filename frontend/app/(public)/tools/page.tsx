import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, Receipt, Scale, Truck, Users, Search, MapPin } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";

export const metadata: Metadata = {
  title: "사장님 계산기 — 손익분기점·배달 실수령·인건비·부가세 | AEOlab",
  description:
    "손익분기점·마진율, 배달앱 실수령액, 직원 인건비(주휴수당·4대보험), 부가세를 로그인 없이 무료로 계산해 보세요. 입력한 값은 저장하지 않고 기준값은 출처와 확인일을 함께 보여 드립니다.",
  alternates: { canonical: "/tools" },
};

const TOOLS = [
  {
    href: "/tools/break-even",
    icon: Scale,
    title: "손익분기점·마진율",
    desc: "판매가·원가·고정비로 1개당 이익과 한 달에 몇 개를 팔아야 손해가 없는지 계산해요.",
  },
  {
    href: "/tools/delivery-settlement",
    icon: Truck,
    title: "배달앱 실수령액",
    desc: "정산서의 수수료율을 넣으면 배달비·광고비까지 뺀 실제 이익을 알려 드려요.",
  },
  {
    href: "/tools/labor-cost",
    icon: Users,
    title: "직원 인건비",
    desc: "주휴수당을 포함한 월급과 사업주가 내는 4대보험 개략액을 한 번에 계산해요.",
  },
  {
    href: "/tools/vat",
    icon: Receipt,
    title: "부가세",
    desc: "공급가액과 부가세를 나누고, 일반·간이과세 사업자의 납부세액을 추정해요.",
  },
  {
    href: "/tools/ad-cost-calculator",
    icon: Calculator,
    title: "광고비 vs 구독료 비교",
    desc: "지금 쓰는 월 광고비와 AEOlab 구독료를 1년 금액으로 나란히 비교해요.",
  },
  {
    href: "/tools/keyword",
    icon: Search,
    title: "무료 키워드 생성기",
    desc: "가게 이름과 업종만 넣으면 검색에 맞는 키워드 5개를 추천해요.",
  },
];

export default function ToolsHubPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xl font-bold text-blue-600 md:text-2xl">
              AEOlab
            </Link>
            <span className="hidden text-gray-300 sm:inline" aria-hidden="true">/</span>
            <span className="hidden text-sm text-gray-600 sm:inline">사장님 계산기</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/trial" className="hidden min-h-[44px] items-center text-sm text-gray-600 hover:text-gray-900 sm:inline-flex">
              무료 체험
            </Link>
            <AuthNavControlClient />
          </div>
        </div>
      </header>

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
          <h1 className="mb-3 break-keep text-2xl font-bold text-gray-900 md:text-3xl">사장님 계산기</h1>
          <p className="max-w-2xl break-keep text-sm leading-relaxed text-gray-600 md:text-base">
            가게를 하면서 자주 계산하게 되는 것들을 모았어요. 로그인 없이 무료이고, 입력한 값은 저장하지 않아요. 법으로 정해진 기준값은
            출처와 확인일을 함께 보여 드립니다.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <ul className="grid gap-4 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="flex h-full min-h-[44px] flex-col rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:bg-blue-50/40"
              >
                <t.icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-bold text-gray-900">{t.title}</h2>
                <p className="mt-1 break-keep text-sm leading-relaxed text-gray-600">{t.desc}</p>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/area"
          className="mt-6 flex min-h-[44px] items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:bg-blue-50/40"
        >
          <MapPin className="h-6 w-6 shrink-0 text-blue-600" aria-hidden="true" />
          <span className="break-keep text-sm leading-relaxed text-gray-700">
            <strong className="block text-base text-gray-900">우리 동네 상권 보기</strong>
            지역과 업종을 고르면 업소 수와 누적 폐업 현황을 공공데이터로 보여 드려요.
          </span>
        </Link>
      </section>

      <SiteFooter activePage="/tools" />
    </main>
  );
}
