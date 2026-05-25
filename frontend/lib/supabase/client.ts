import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// 안전한 세션 조회 헬퍼 — TypeError 방지
// supabase.auth가 undefined일 때도 null을 반환하도록 방어 처리
export async function getSafeSession() {
  try {
    const client = createClient();
    if (!client || !client.auth) return null;
    const res = await client.auth.getSession();
    return res?.data?.session ?? null;
  } catch {
    return null;
  }
}

// 401 발생 후 세션 강제 정리 — 로컬 캐시만 제거 (네트워크 불필요)
export async function clearLocalSession(): Promise<void> {
  try {
    const client = createClient();
    if (!client?.auth) return;
    await client.auth.signOut({ scope: "local" });
  } catch {
    // ignore
  }
}
