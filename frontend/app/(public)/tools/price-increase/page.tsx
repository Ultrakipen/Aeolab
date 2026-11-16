import type { Metadata } from "next";
import ToolShell from "../_components/ToolShell";
import { pageOpenGraph } from "@/lib/seoMeta";
import PriceIncreaseCalculator from "./PriceIncreaseCalculator";

const TITLE = "원가 상승 가격 인상 계산기(마진·원가율 유지) | AEOlab 사장님 계산기";
const DESCRIPTION =
  "재료비가 오르면 가격을 안 올릴 때 남는 돈이 얼마나 줄어드는지, 남는 돈이나 원가율을 지키려면 판매가를 얼마로 올려야 하는지 계산합니다. 입력한 값은 저장하지 않습니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/price-increase" },
  openGraph: pageOpenGraph({ title: TITLE, description: DESCRIPTION, path: "/tools/price-increase" }),
};

export default function PriceIncreasePage() {
  return (
    <ToolShell
      path="/tools/price-increase"
      title="원가 상승 가격 인상 계산기"
      intro="재료비가 올랐을 때 가격을 그대로 두면 남는 돈이 얼마나 줄고, 가격을 얼마로 올려야 하는지 계산해요. 판매가와 원가를 넣고 재료비가 오른 비율만 알려 주세요."
    >
      <PriceIncreaseCalculator />
      <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <h2 className="text-base font-bold text-gray-900">계산 방법</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 break-keep">
          <li>늘어난 원가 = 오르는 재료비 × 오른 비율, 새 원가 = 지금 원가 + 늘어난 원가</li>
          <li>남는 돈을 지키는 판매가 = 지금 판매가 + 늘어난 원가 (1개당 남는 금액이 그대로)</li>
          <li>원가율을 지키는 판매가 = 지금 판매가 × 새 원가 ÷ 지금 원가 (원가가 판매가에서 차지하는 비율이 그대로)</li>
          <li>가격을 올리면 판매량이 줄 수 있어요. 이 계산기는 판매량 변화·경쟁 가게 가격·할인 계획을 반영하지 않으니 가격 결정의 참고로만 쓰세요.</li>
        </ul>
      </section>
    </ToolShell>
  );
}
