import type { Metadata } from "next";
import { CALC_BASIS } from "@/lib/calc";
import BasisNotice from "../_components/BasisNotice";
import ToolShell from "../_components/ToolShell";
import { pageOpenGraph } from "@/lib/seoMeta";
import VatCalculator from "./VatCalculator";

export const metadata: Metadata = {
  title: "부가세 계산기(일반·간이과세) | AEOlab 사장님 계산기",
  description:
    "부가세 포함 금액을 공급가액과 세액으로 나누고, 일반과세·간이과세 사업자의 납부세액을 추정합니다. 입력한 값은 저장하지 않으며 결과는 참고용입니다.",
  alternates: { canonical: "/tools/vat" },
  openGraph: pageOpenGraph({ title: "부가세 계산기(일반·간이과세) | AEOlab 사장님 계산기", description:
    "부가세 포함 금액을 공급가액과 세액으로 나누고, 일반과세·간이과세 사업자의 납부세액을 추정합니다. 입력한 값은 저장하지 않으며 결과는 참고용입니다.", path: "/tools/vat" }),
};

export default function VatPage() {
  return (
    <ToolShell
      path="/tools/vat"
      title="부가세 계산기"
      intro="부가세 포함 금액을 나누거나, 일반과세·간이과세 사업자가 한 번 신고할 때 내야 할 부가세를 대략 계산해 보세요."
    >
      <VatCalculator />
      <BasisNotice items={[{ label: "부가세율 10% · 간이과세 업종별 부가가치율·매입세액공제율", sources: [CALC_BASIS.vat.source] }]} />
    </ToolShell>
  );
}
