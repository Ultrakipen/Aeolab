import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "./AdminDashboard";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));
  if (!isAdmin) return null;

  return <AdminDashboard />;
}
