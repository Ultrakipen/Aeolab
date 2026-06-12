import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// 안전한 세션 조회 헬퍼 — TypeError 방지
// supabase.auth가 undefined일 때도 null을 반환하도록 방어 처리
//
// ⚠️ 콜드 로드 401 레이스 방지 (2026-06-11): getSession()은 백그라운드 auto-refresh가
// 돌기 전 순간엔 "만료된 캐시 토큰"을 그대로 반환할 수 있다. 1시간+ 방치 후 복귀처럼
// 저장 토큰이 만료된 상태로 마운트 즉시 fetch하면 만료 JWT → 백엔드 401(1회성)이 난다.
// 만료 임박(60초 이내)·경과 시 refreshSession()으로 강제 갱신 후 반환해 노이즈를 근절한다.
// 토큰이 유효한 일반적인 경우엔 추가 네트워크 호출이 없다.
export async function getSafeSession() {
  try {
    const client = createClient();
    if (!client || !client.auth) return null;
    const res = await client.auth.getSession();
    let session = res?.data?.session ?? null;
    if (session?.expires_at) {
      const nowSec = Math.floor(Date.now() / 1000);
      // 만료까지 60초 미만(또는 이미 만료)이면 갱신
      if (session.expires_at - nowSec < 60) {
        const refreshed = await client.auth.refreshSession();
        session = refreshed?.data?.session ?? session;
      }
    }
    return session;
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
