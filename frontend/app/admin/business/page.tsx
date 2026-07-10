import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminBusinessSearchClient from "./AdminBusinessSearchClient";

export const metadata = { title: "사업장 조회 | AEOlab Admin" };

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export default async function AdminBusinessSearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/admin");
  }

  return <AdminBusinessSearchClient />;
}
