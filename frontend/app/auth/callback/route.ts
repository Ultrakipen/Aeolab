import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/**
 * Supabase Auth 콜백 핸들러
 * - 이메일 인증 확인 (회원가입)
 * - 비밀번호 재설정 토큰 교환
 * - 소셜 로그인 콜백
 *
 * Trial Conversion Funnel:
 * - URL에 trial_id 쿼리가 있으면 가입 완료 후 POST /api/scan/trial-attach 호출
 * - 성공 시 /dashboard?from=trial_claim 로 이동
 * - 실패해도 가입 자체는 성공이므로 그냥 next 또는 dashboard로 이동
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const trialId = searchParams.get("trial_id");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 비밀번호 재설정 타입이면 비밀번호 변경 페이지로
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }

      // Trial 보관 → 가입 연결 (graceful: 실패해도 가입은 성공)
      if (trialId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            await fetch(`${BACKEND}/api/scan/trial-attach`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ trial_id: trialId }),
              // 가입 흐름은 짧게 유지 (3초)
              signal: AbortSignal.timeout(3000),
            });
          }
        } catch {
          // 백엔드 미배포·네트워크 오류 무시 → 가입은 성공
        }
        return NextResponse.redirect(
          `${origin}/dashboard?from=trial_claim&trial_id=${encodeURIComponent(trialId)}`,
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 오류 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
