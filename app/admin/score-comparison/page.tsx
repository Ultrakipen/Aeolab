import { createClient } from "@/lib/supabase/server";
import { AdminScoreComparisonClient } from "./AdminScoreComparisonClient";

const ADMIN_EMAILS = ["hoozdev@gmail.com"];

export default async function AdminScoreComparisonPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));

  return <AdminScoreComparisonClient isAdmin={isAdmin} />;
}
