import type { Metadata } from "next";
import ToolShell from "../_components/ToolShell";
import BreakEvenCalculator from "./BreakEvenCalculator";

export const metadata: Metadata = {
  title: "손익분기점·마진율 계산기 | AEOlab 사장님 계산기",
  description:
    "판매가·원가·고정비만 넣으면 1개당 이익, 마진율, 한 달에 몇 개를 팔아야 손해가 없는지 바로 계산합니다. 입력한 값은 저장하지 않습니다.",
  alternates: { canonical: "/tools/break-even" },
};

export default function BreakEvenPage() {
  return (
    <ToolShell
      path="/tools/break-even"
      title="손익분기점·마진율 계산기"
      intro="판매가, 원가, 한 달 고정비를 넣으면 1개당 이익과 마진율, 그리고 한 달에 몇 개를 팔아야 손해를 면하는지 계산해 드려요."
    >
      <BreakEvenCalculator />
      <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <h2 className="text-base font-bold text-gray-900">계산 방법</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 break-keep">
          <li>1개당 이익 = 판매가 − 원가, 마진율 = 1개당 이익 ÷ 판매가</li>
          <li>손익분기 판매 개수 = 한 달 고정비 ÷ 1개당 이익 (소수점은 올림)</li>
          <li>세금(부가세·소득세)은 따로 계산하지 않아요. 판매가·원가를 같은 기준(부가세 포함 또는 제외)으로 입력해 주세요.</li>
        </ul>
      </section>
    </ToolShell>
  );
}
