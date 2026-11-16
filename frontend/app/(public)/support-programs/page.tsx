import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";
import FeatureHeader from "@/components/common/FeatureHeader";
import { fetchBizinfo } from "@/lib/bizinfoApi";
import { pageOpenGraph } from "@/lib/seoMeta";
import { formatKst } from "@/lib/supportBoard";
import SupportBoard from "./SupportBoard";

// 라우트 설정은 정적 분석되는 숫자 리터럴이어야 한다(상수 import 불가). lib/bizinfoApi.ts BIZINFO_REVALIDATE_SECONDS 와 같게 유지.
export const revalidate = 3600;

const TITLE = "소상공인 지원사업 공고 모음 — 마감 임박순·지역별 | AEOlab";
const DESCRIPTION =
  "기업마당(중소벤처기업부)에 올라온 지원사업 공고 중 지원대상이 소상공인이거나 소상공인이 언급된 공고를 지역·분야별로 모았습니다. 마감 임박순으로 확인하고 원문에서 신청하세요. 로그인 없이 무료.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/support-programs" },
  openGraph: pageOpenGraph({ title: TITLE, description: DESCRIPTION, path: "/support-programs" }),
};

export default async function SupportProgramsPage() {
  const view = await fetchBizinfo();
  const ready = view.available && view.support;
  const support = ready ? view.support!.items : [];
  const events = ready ? view.events?.items ?? [] : [];
  const updated = ready ? formatKst(view.generated_at) : "";

  return (
    <main className="min-h-screen bg-gray-50">
      <FeatureHeader />

      <div className="border-b border-gray-100 bg-white" style={{ backgroundImage: "linear-gradient(135deg, oklch(0.97 0.014 254.604), #ffffff 60%)" }}>
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
          <h1 className="mb-3 break-keep text-2xl font-bold text-gray-900 md:text-3xl">소상공인 지원사업 공고 모음</h1>
          <p className="max-w-3xl break-keep text-sm leading-relaxed text-gray-600 md:text-base">
            정부·지자체 지원사업 공고는 흩어져 있어 놓치기 쉬워요. 기업마당(중소벤처기업부)에 올라온 공고 중 소상공인과 관련된 것을
            모아, 마감이 가까운 순서로 보여 드려요. 신청은 항상 공고 원문에서 하세요.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {["로그인 없이 무료", "기업마당 원문 링크", "하루 한 번 갱신"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-sm font-medium text-blue-800">
                <Check className="h-4 w-4" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          {ready ? (
            <p className="mt-3 text-sm text-gray-600">
              마지막 갱신 {updated} · 소상공인 관련 공고 {support.length}건 (지원대상이 &lsquo;소상공인&rsquo;으로 표시된 공고 {support.filter((x) => x.sbiz_target).length}건 포함)
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 md:px-6">
        {ready ? (
          <SupportBoard support={support} events={events} />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm leading-relaxed text-gray-700 break-keep">
            공고 목록을 준비 중이에요. 잠시 뒤에 다시 확인해 주세요. 급하다면{" "}
            <a href="https://www.bizinfo.go.kr" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
              기업마당
            </a>
            에서 바로 확인할 수 있어요.
          </div>
        )}

        <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-4 md:p-5">
          <h2 className="text-base font-bold text-gray-900">이 목록을 볼 때 알아두세요</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 break-keep">
            <li>
              공고 정보는 기업마당(<a href="https://www.bizinfo.go.kr" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">bizinfo.go.kr</a>
              , 중소벤처기업부) 공개 API에서 하루 한 번 받아 와요. 공고가 바뀌거나 마감되면 반영까지 시간이 걸릴 수 있어요.
            </li>
            <li>&lsquo;지원대상&rsquo;은 기업마당이 공고에 붙인 분류를 그대로 보여 드려요. 내가 신청할 수 있는지는 AEOlab이 판단하지 않아요. 자격·서류·기간은 반드시 원문에서 확인하세요.</li>
            <li>신청기간이 날짜로 정해지지 않은 공고(예: 예산 소진 시까지, 상시)는 마감 여부를 이 화면에서 알 수 없어요. 원문을 확인하세요.</li>
            <li>AEOlab은 지원사업 신청을 대행하거나 선정을 보장하지 않아요. 정부 알림을 받으려면 소상공인24·정부24 혜택알리미도 함께 이용해 보세요.</li>
          </ul>
        </section>
      </div>

      <SiteFooter activePage="/support-programs" />
    </main>
  );
}
