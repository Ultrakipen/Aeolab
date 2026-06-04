import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminCommsClient } from "./AdminCommsClient";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "hoozdev@gmail.com")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export default async function AdminCommsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/");
  }

  return <AdminCommsClient />;
}
