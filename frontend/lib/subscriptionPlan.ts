import type { SupabaseClient } from "@supabase/supabase-js";

function endAtInFuture(endAt?: string | null): boolean {
  if (!endAt) return false;
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() > Date.now();
}

/**
 * 사용자의 현재 활성 구독 플랜 (backend middleware/plan_gate.py get_user_plan()과 동일 로직).
 * cancelled 상태도 end_at 이전이면 active와 동일 취급 — 해지해도 잔여기간엔 플랜 유지
 * ("해지해도 end_at까지 서비스 유지"라고 SettingsClient.tsx가 사용자에게 안내하는 것과 일치).
 */
export async function resolveActivePlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, end_at")
    .eq("user_id", userId)
    .in("status", ["active", "grace_period", "cancelled"])
    .maybeSingle();

  if (!data) return "free";
  if (data.status === "cancelled" && !endAtInFuture(data.end_at)) return "free";
  return data.plan ?? "free";
}
