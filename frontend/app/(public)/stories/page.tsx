import type { Metadata } from "next";
import StoriesClient from "./StoriesClient";

export const metadata: Metadata = {
  title: "고객 성공 사례 — AEOlab",
  description: "AEOlab 대행 서비스를 통해 AI 검색 노출을 높인 소상공인 실제 성공 사례. 음식점·카페·미용실 등 업종별 30일 개선 결과.",
  openGraph: {
    title: "고객 성공 사례 — AEOlab",
    description: "AEOlab 대행 서비스를 통해 AI 검색 노출을 높인 소상공인 실제 성공 사례.",
    url: "https://aeolab.co.kr/stories",
    siteName: "AEOlab",
    locale: "ko_KR",
    type: "website",
  },
};

export default function StoriesPage() {
  return <StoriesClient />;
}
