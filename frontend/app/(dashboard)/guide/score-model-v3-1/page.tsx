import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScoreModelV31Client } from "./ScoreModelV31Client";
import { getUserGroup } from "@/lib/userGroup";
import { fetchBriefingCategories } from "@/lib/briefingCategoriesServer";

export default async function ScoreModelV31Page() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");

  let userCategory: string | null = null;
  let userGroup: "ACTIVE" | "LIKELY" | "INACTIVE" | "franchise" | null = null;

  const { data: biz } = await supabase
    .from("businesses")
    .select("category, is_franchise")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (biz?.category) {
    const briefingCats = await fetchBriefingCategories();
    userCategory = biz.category;
    userGroup = getUserGroup(biz.category, !!biz.is_franchise, briefingCats.active, briefingCats.likely);
  }

  return <ScoreModelV31Client userCategory={userCategory} userGroup={userGroup} />;
}
