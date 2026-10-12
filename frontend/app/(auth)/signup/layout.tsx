import type { Metadata } from "next";

// 로그인·가입 폼은 검색 결과에 노출할 가치가 없는 페이지 — 색인 제외(크롤은 허용해야 noindex가 읽힘)
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
