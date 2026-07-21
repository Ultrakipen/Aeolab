import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminGrowthFunnelClient from "./AdminGrowthFunnelClient";

export const metadata = { title: "성장 퍼널 | AEOlab Admin" };

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export default async function AdminGrowthFunnelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/admin");
  }

  return <AdminGrowthFunnelClient />;
}
