import type { Metadata } from "next";
import ToolShell from "../_components/ToolShell";
import { pageOpenGraph } from "@/lib/seoMeta";
import SalesTargetCalculator from "./SalesTargetCalculator";

const TITLE = "매출·이익 목표 계산기 — 몇 개 팔면 순이익이 얼마? | AEOlab 사장님 계산기";
const DESCRIPTION =
  "상품 판매가·원가를 넣고 몇 개를 팔면 원가·수수료·고정비를 뺀 순이익이 얼마 남는지, 목표 이익을 내려면 몇 개를 팔아야 하는지 바로 계산합니다. 입력한 값은 저장하지 않습니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/sales-target" },
  openGraph: pageOpenGraph({ title: TITLE, description: DESCRIPTION, path: "/tools/sales-target" }),
};

export default function SalesTargetPage() {
  return (
    <ToolShell
      path="/tools/sales-target"
      title="매출·이익 목표 계산기"
      intro="상품 하나의 판매가와 원가를 넣으면, 몇 개를 팔았을 때 순이익이 얼마 남는지와 목표 이익을 내려면 몇 개를 팔아야 하는지 계산해 드려요."
    >
      <SalesTargetCalculator />
      <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <h2 className="text-base font-bold text-gray-900">계산 방법</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 break-keep">
          <li>1개당 이익 = 판매가 − 원가 − (판매가 × 수수료율)</li>
          <li>남는 돈 = 판매 개수 × 1개당 이익, 순이익 = 남는 돈 − 한 달 고정비</li>
          <li>필요한 판매 개수 = (목표 순이익 + 한 달 고정비) ÷ 1개당 이익 (소수점은 올림)</li>
          <li>세금(부가세·소득세)은 따로 계산하지 않아요. 판매가·원가는 같은 기준(부가세 포함 또는 제외)으로 입력해 주세요.</li>
          <li>상품이 여러 개라면 상품마다 따로 계산하거나 평균 판매가·평균 원가를 넣어 보세요. 판매량이 늘 때 가격이나 손님 수가 달라지는 것은 반영하지 않아요.</li>
        </ul>
      </section>
    </ToolShell>
  );
}
