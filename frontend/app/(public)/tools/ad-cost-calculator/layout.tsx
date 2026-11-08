import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "광고비 vs 구독료 비교 | AEOlab",
  description: "현재 월 광고비를 입력하면 AEOlab 구독료와의 연간 금액을 나란히 비교해 보여줍니다. 절감 효과를 보장하지 않는 단순 금액 비교입니다.",
};

export default function AdCostCalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
