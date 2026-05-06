import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * 사용자의 활성 사업장 ID를 결정한다.
 * 우선순위: cookie(aeolab_active_biz) → 첫 번째 활성 사업장 → null
 * cookie 값이 user 소유 사업장이 아니면 무시한다(보안).
 */
export async function getActiveBusinessId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: list } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const ids = (list ?? []).map((b: { id: string }) => b.id);
  if (ids.length === 0) return null;

  const cookieStore = await cookies();
  const cookieBiz = cookieStore.get("aeolab_active_biz")?.value;
  if (cookieBiz && ids.includes(cookieBiz)) return cookieBiz;
  return ids[0];
}
