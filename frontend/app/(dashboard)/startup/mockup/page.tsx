import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MockupClient } from "./MockupClient";

export const metadata = {
  title: "창업 시장 분석 목업 — AEOlab",
};

// 결과 화면 레이아웃 확인 전용 목업 — 실제 API 호출 없음. 관리자 전용(가짜 수치를
// 실사용자에게 노출 금지, CLAUDE.md "실제·사실적 정보" 원칙). 네비게이션에 링크하지 않음.
export default async function StartupMockupPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) redirect("/login");

  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "hoozdev@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS.includes((user.email ?? "").toLowerCase());
  if (!isAdmin) redirect("/startup");

  return <MockupClient />;
}
