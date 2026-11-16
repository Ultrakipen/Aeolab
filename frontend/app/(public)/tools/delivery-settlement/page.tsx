import type { Metadata } from "next";
import ToolShell from "../_components/ToolShell";
import DeliveryCalculator from "./DeliveryCalculator";

export const metadata: Metadata = {
  title: "배달앱 실수령액 계산기 | AEOlab 사장님 계산기",
  description:
    "주문금액과 정산서의 수수료율을 넣으면 배달앱 수수료·배달비·광고비를 뺀 실수령액과 이익을 계산합니다. 수수료율은 직접 입력하며 입력한 값은 저장하지 않습니다.",
  alternates: { canonical: "/tools/delivery-settlement" },
};

export default function DeliverySettlementPage() {
  return (
    <ToolShell
      path="/tools/delivery-settlement"
      title="배달앱 실수령액 계산기"
      intro="배달앱 주문 1건에서 수수료·배달비·광고비를 빼고 실제로 얼마가 남는지 계산해요. 수수료율은 앱과 요금제마다 달라서, 정산서에 적힌 값을 직접 입력해 주세요."
    >
      <DeliveryCalculator />
      <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <h2 className="text-base font-bold text-gray-900">계산 방법</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 break-keep">
          <li>수수료 = 주문금액 × (중개수수료율 + 결제수수료율). 부가세가 따로 붙으면 수수료의 10%를 더해요.</li>
          <li>실수령액 = 주문금액 − 할인·쿠폰 − 수수료 − 배달비 − 광고비, 이익 = 실수령액 − 원가</li>
          <li>배달앱 수수료율은 자주 바뀌고 매출 구간·요금제에 따라 달라서 기본값을 넣지 않았어요. 사장님 사이트의 정산서나 요금제 안내에서 확인해 입력해 주세요.</li>
        </ul>
      </section>
    </ToolShell>
  );
}
