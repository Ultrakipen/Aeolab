import { createClient } from "@/lib/supabase/server";
import { AdminScoreComparisonClient } from "./AdminScoreComparisonClient";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export default async function AdminScoreComparisonPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));

  return <AdminScoreComparisonClient isAdmin={isAdmin} />;
}
