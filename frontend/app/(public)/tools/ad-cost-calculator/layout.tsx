import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "광고비 절감 계산기 | AEOlab",
  description: "AI 검색 노출로 광고비를 얼마나 절감할 수 있는지 계산해보세요. 현재 월 광고비를 입력하면 AEOlab 구독 대비 절감 효과를 즉시 확인합니다.",
};

export default function AdCostCalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
