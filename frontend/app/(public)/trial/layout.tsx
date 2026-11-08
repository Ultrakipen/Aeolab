import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "무료 AI 검색 노출 진단 — AEOlab",
  description:
    "몇 분이면 네이버·카카오·ChatGPT에서 내 가게가 얼마나 보이는지 무료로 확인할 수 있어요.",
  alternates: { canonical: "/trial" },
  openGraph: {
    title: "내 가게 무료 AI 노출 진단받기",
    description:
      "경쟁 가게와 비교해서 AI 검색 노출 상태와 부족한 키워드를 확인",
  },
};

export default function TrialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
