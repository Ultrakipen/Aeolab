import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "새 비밀번호 설정 | AEOlab",
};

export default function UpdatePasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
