// 결제·카드 결과 화면은 검색 노출 대상이 아니고 화면별 제목이 필요하다(WCAG 2.4.2, 2026-11-09)
export const metadata = {
  title: "결제 결과 안내 | AEOlab",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
