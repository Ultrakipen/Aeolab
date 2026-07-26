import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { resolveActivePlan } from "@/lib/subscriptionPlan";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서 쿠키 설정 불가 시 무시
          }
        },
      },
    }
  );
}

/**
 * 인증된 사용자 조회 — 요청(request) 1회당 1번만 실제 네트워크 호출.
 * (dashboard) layout.tsx가 이미 getUser()로 검증하는데 각 page.tsx가 다시
 * getUser()를 호출해 페이지 이동마다 Supabase Auth 왕복이 2~3회 중복되던 것을
 * React cache()로 묶어 동일 요청 내 재호출은 네트워크 없이 즉시 반환되게 함.
 * 보안 동작은 동일 — 매 레이어가 여전히 "검증된" 값을 받되, 실제 검증은 1회.
 */
export const getCachedUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return data.user;
  } catch {
    // Invalid Refresh Token 등 인증 에러 → 비로그인 처리
  }
  return null;
});

/**
 * resolveActivePlan의 요청 단위 캐시 버전 — userId(문자열)로만 키를 잡아
 * (dashboard) layout.tsx와 각 page.tsx가 같은 사용자의 플랜을 중복 조회하던
 * Supabase 왕복을 요청당 1회로 줄인다. 서버 전용 파일에 둬야 클라이언트
 * 컴포넌트(review-inbox 등)가 subscriptionPlan.ts를 가져올 때 next/headers가
 * 함께 번들링되는 것을 막을 수 있다.
 */
export const getCachedActivePlan = cache(async (userId: string): Promise<string> => {
  const supabase = await createClient();
  return resolveActivePlan(supabase, userId);
});
