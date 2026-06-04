import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "./AdminDashboard";

const ADMIN_EMAILS = ["hoozdev@gmail.com"];

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));
  if (!isAdmin) return null;

  return <AdminDashboard />;
}
