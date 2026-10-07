import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "무료 키워드 생성기 | AEOlab",
  description: "가게 이름과 업종만 입력하면 AI가 키워드 5개를 추천합니다. 네이버·ChatGPT 검색 노출에 맞는 키워드를 즉시 확인하세요.",
};

export default function KeywordToolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
