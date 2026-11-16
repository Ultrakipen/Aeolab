import type { Metadata } from "next";
import { CALC_BASIS } from "@/lib/calc";
import BasisNotice from "../_components/BasisNotice";
import ToolShell from "../_components/ToolShell";
import LaborCalculator from "./LaborCalculator";

export const metadata: Metadata = {
  title: "직원 인건비 계산기(주휴수당·4대보험) | AEOlab 사장님 계산기",
  description:
    "시급과 근무 시간을 넣으면 주휴수당을 포함한 월급과 사업주가 부담하는 4대보험 개략액까지 한 달 인건비를 계산합니다. 입력한 값은 저장하지 않습니다.",
  alternates: { canonical: "/tools/labor-cost" },
};

export default function LaborCostPage() {
  const { minWages, insurance } = CALC_BASIS;
  const lastMinWage = minWages[minWages.length - 1];
  return (
    <ToolShell
      path="/tools/labor-cost"
      title="직원 인건비 계산기"
      intro="시급과 근무 시간을 넣으면 주휴수당을 포함한 월급과, 사업주가 따로 부담하는 보험료까지 직원 1명을 쓰는 데 드는 한 달 비용을 계산해요."
    >
      <LaborCalculator />
      <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <h2 className="text-base font-bold text-gray-900">계산 방법</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 break-keep">
          <li>월 환산 근로시간 = (주 근무시간 + 주휴시간) × 365 ÷ 7 ÷ 12 (반올림). 주 40시간이면 209시간이에요.</li>
          <li>주휴시간은 주 15시간 이상 일할 때 근무시간에 비례해 최대 8시간이에요.</li>
          <li>월급 = 시급 × 월 환산 근로시간. 사업주 보험료는 월급에 요율을 곱해 노사가 반씩 내는 몫만 더해요.</li>
        </ul>
      </section>
      <BasisNotice
        items={[
          {
            label: `최저임금 (${minWages.map((m) => `${m.year}년 ${m.hourly.toLocaleString("ko-KR")}원`).join(" · ")})`,
            validThrough: lastMinWage.validThrough,
            sources: minWages.map((m) => m.source),
          },
          {
            label: `${insurance.year}년 보험료율 (국민연금 ${insurance.pensionPct}%·건강보험 ${insurance.healthPct}%·장기요양 ${insurance.longTermCarePct}%)`,
            validThrough: insurance.validThrough,
            sources: insurance.sources,
          },
        ]}
      />
    </ToolShell>
  );
}
