// 클라이언트 페이지는 metadata를 직접 내보낼 수 없어 레이아웃으로 화면별 제목 지정(WCAG 2.4.2, 2026-11-09)
export const metadata = { title: "팀 계정 관리 | AEOlab" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
