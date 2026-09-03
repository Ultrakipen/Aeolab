import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScoreModelV31Client } from "./ScoreModelV31Client";
import { getUserGroup } from "@/lib/userGroup";
import { fetchBriefingCategories } from "@/lib/briefingCategoriesServer";
import { getActiveBusinessId } from "@/lib/active-business";

export default async function ScoreModelV31Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");

  const params = await searchParams;
  const selectedBizId = params.biz_id ?? null;
  const activeBizId = selectedBizId ?? await getActiveBusinessId(user.id);

  let userCategory: string | null = null;
  let userGroup: "ACTIVE" | "LIKELY" | "INACTIVE" | "franchise" | null = null;

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, category, is_franchise")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(10);

  const biz = (activeBizId
    ? businesses?.find((b) => b.id === activeBizId)
    : businesses?.[0]) ?? null;

  if (biz?.category) {
    const briefingCats = await fetchBriefingCategories();
    userCategory = biz.category;
    userGroup = getUserGroup(biz.category, !!biz.is_franchise, briefingCats.active, briefingCats.likely);
  }

  return <ScoreModelV31Client userCategory={userCategory} userGroup={userGroup} />;
}
