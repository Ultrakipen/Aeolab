import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "서비스 미리보기 | AEOlab",
  description: "AEOlab 대시보드를 미리 체험해보세요. 샘플 데이터로 구성된 AI 스캔 결과 화면, 채널별 노출 분석, 개선 가이드를 데모로 확인할 수 있습니다.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
